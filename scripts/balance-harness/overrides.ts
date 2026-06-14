/**
 * Tunable override plumbing for the #247 sensitivity sweep (mode B).
 *
 * The game's data loaders read their config from statically-imported JSON
 * modules (`data/tier-gate.json`, `data/tunables.json`). Node caches those by
 * resolved path, so the object the harness imports here is the SAME instance
 * the loaders see. `loadTierGateConfig()` returns it directly and
 * `loadTunables()` re-parses it on every call, so mutating a field in place
 * makes the next `createWorld` pick the new value up — no disk writes, no
 * process restart. The sweep mutates one field, runs the cohort, then restores
 * the original value, leaving the data files on disk untouched.
 */
import tierGateRaw from '../../data/tier-gate.json';
import tunablesRaw from '../../data/tunables.json';

type AnyRecord = Record<string, unknown>;

const FILES: Readonly<Record<string, AnyRecord>> = {
  'tier-gate': tierGateRaw as unknown as AnyRecord,
  tunables: tunablesRaw as unknown as AnyRecord,
};

export function knownFiles(): string[] {
  return Object.keys(FILES);
}

function resolveParent(file: string, path: string): { parent: AnyRecord; key: string } {
  const root = FILES[file];
  if (!root) {
    throw new Error(`Unknown tunable file '${file}'. Known: ${knownFiles().join(', ')}`);
  }
  const parts = path.split('.');
  let node: AnyRecord = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node[parts[i]];
    if (typeof next !== 'object' || next === null) {
      throw new Error(`Path '${path}' does not resolve in ${file}.json (at '${parts[i]}')`);
    }
    node = next as AnyRecord;
  }
  return { parent: node, key: parts[parts.length - 1] };
}

export function readTunable(file: string, path: string): number {
  const { parent, key } = resolveParent(file, path);
  const value = parent[key];
  if (typeof value !== 'number') {
    throw new Error(`Tunable ${file}:${path} is not a number (got ${typeof value})`);
  }
  return value;
}

/** Set the tunable in place, returning the previous value for restoration. */
export function applyOverride(file: string, path: string, value: number): number {
  const previous = readTunable(file, path);
  const { parent, key } = resolveParent(file, path);
  parent[key] = value;
  return previous;
}

export function restoreOverride(file: string, path: string, previous: number): void {
  const { parent, key } = resolveParent(file, path);
  parent[key] = previous;
}

/** Inclusive linear sweep of `steps` values from min to max. */
export function linspace(min: number, max: number, steps: number): number[] {
  if (steps < 1) return [];
  if (steps === 1) return [min];
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    out.push(min + ((max - min) * i) / (steps - 1));
  }
  return out;
}

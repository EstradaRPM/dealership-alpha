/**
 * Tunable override plumbing for the #247 sensitivity sweep (mode B) and the
 * #344 search space the slice-C optimizer drives.
 *
 * The game's data loaders read their config from statically-imported JSON
 * modules (`data/tier-gate.json`, `data/tunables.json`, …). Node caches those by
 * resolved path, so the object the harness imports here is the SAME instance
 * the loaders see, and none of the registered loaders memoize their parse — they
 * re-read that object on every call. Mutating a field in place therefore makes
 * the next `createWorld` pick the new value up: no disk writes, no process
 * restart. The sweep mutates one field, runs the cohort, then restores the
 * original value, leaving the data files on disk untouched. That property is why
 * `sweep` never dirties the working tree, and it has to keep holding for every
 * file added below.
 *
 * Registering a file here makes it *reachable*; it does not make it searchable.
 * What the optimizer may vary is the manifest in `searchSpace.ts` — everything
 * else in a registered file is frozen, and `tests/balanceHarness.searchSpace.test.ts`
 * asserts the freeze byte-for-byte rather than trusting it.
 *
 * `data/tier-pacing-targets.json` is deliberately NOT registered: the pacing
 * targets are the director's to author (#343), so no search can reach them.
 */
import bodyShopDemandRaw from '../../data/bodyshop-demand.json';
import bodyShopManagerRaw from '../../data/body-shop-manager.json';
import intelPrecisionRaw from '../../data/intel-precision.json';
import newsGatingRaw from '../../data/news-progression-gating.json';
import serviceManagerRaw from '../../data/service-manager.json';
import sourcingRaw from '../../data/sourcing.json';
import startingInventoryRaw from '../../data/starting-inventory.json';
import tierGateRaw from '../../data/tier-gate.json';
import tunablesRaw from '../../data/tunables.json';

type AnyRecord = Record<string, unknown>;

const FILES: Readonly<Record<string, AnyRecord>> = {
  'body-shop-manager': bodyShopManagerRaw as unknown as AnyRecord,
  'bodyshop-demand': bodyShopDemandRaw as unknown as AnyRecord,
  'intel-precision': intelPrecisionRaw as unknown as AnyRecord,
  'news-progression-gating': newsGatingRaw as unknown as AnyRecord,
  'service-manager': serviceManagerRaw as unknown as AnyRecord,
  sourcing: sourcingRaw as unknown as AnyRecord,
  'starting-inventory': startingInventoryRaw as unknown as AnyRecord,
  'tier-gate': tierGateRaw as unknown as AnyRecord,
  tunables: tunablesRaw as unknown as AnyRecord,
};

export function knownFiles(): string[] {
  return Object.keys(FILES);
}

/**
 * The live config object for a registered file — the same instance the loaders
 * read. Exposed so the freeze guard can serialize every registered file before
 * and after a candidate is applied.
 */
export function registeredFile(file: string): AnyRecord {
  const root = FILES[file];
  if (!root) {
    throw new Error(`Unknown tunable file '${file}'. Known: ${knownFiles().join(', ')}`);
  }
  return root;
}

/**
 * A path segment may select an array element by a field value —
 * `unlocks[id=auction_data].dailyCost`, `slots[category=suv].targetRetail`.
 * Positional indices (`slots.0.targetRetail`) still work, but a selector keeps
 * pointing at the right entry when the array is reordered, which a numeric index
 * silently would not.
 */
const SELECTOR = /^([^[\]]+)\[([^[\]=]+)=([^[\]]+)\]$/;

function descend(node: AnyRecord, segment: string, file: string, path: string): AnyRecord {
  const match = SELECTOR.exec(segment);
  if (!match) {
    const next = node[segment];
    if (typeof next !== 'object' || next === null) {
      throw new Error(`Path '${path}' does not resolve in ${file}.json (at '${segment}')`);
    }
    return next as AnyRecord;
  }
  const [, name, field, wanted] = match;
  const array = node[name];
  if (!Array.isArray(array)) {
    throw new Error(`Path '${path}' does not resolve in ${file}.json ('${name}' is not an array)`);
  }
  const found = array.find(
    (entry) =>
      typeof entry === 'object' && entry !== null && String((entry as AnyRecord)[field]) === wanted,
  );
  if (!found) {
    throw new Error(
      `Path '${path}' does not resolve in ${file}.json (no ${name} entry with ${field}=${wanted})`,
    );
  }
  return found as AnyRecord;
}

function resolveParent(file: string, path: string): { parent: AnyRecord; key: string } {
  let node = registeredFile(file);
  const parts = path.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    node = descend(node, parts[i], file, path);
  }
  const key = parts[parts.length - 1];
  if (SELECTOR.test(key)) {
    throw new Error(`Path '${path}' must end in a plain key, not a selector (${file}.json)`);
  }
  return { parent: node, key };
}

/**
 * The same path with every `[field=value]` selector replaced by the positional
 * index it currently resolves to — so a manifest path can be compared against a
 * structural diff, which has no way to know which field identifies an element.
 */
export function positionalPath(file: string, path: string): string {
  let node = registeredFile(file);
  const parts = path.split('.');
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const match = SELECTOR.exec(parts[i]);
    const child = descend(node, parts[i], file, path);
    if (match) {
      const array = node[match[1]] as unknown[];
      out.push(match[1], String(array.indexOf(child)));
    } else {
      out.push(parts[i]);
    }
    node = child;
  }
  out.push(parts[parts.length - 1]);
  return out.join('.');
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

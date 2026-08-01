/**
 * The resumable study file (#345) — the durable record of a balance search.
 *
 * A study is line-delimited JSON: one header line, then one line per completed
 * evaluation, appended **before the next evaluation starts**. Append-only is the
 * point: a study is hours of simulation, and an interrupted session must lose at
 * most the trial that was in flight, never the ones already paid for. Resuming
 * replays the recorded trials into the loop without re-running any of them.
 *
 * **A study is only comparable to itself.** The header records a fingerprint of
 * the manifest it was searched against, plus the cohort config it was run with.
 * Resuming against a changed manifest is refused by name — silently mixing
 * trials scored under different bounds (or a different seed cohort, or a
 * different day budget) would produce a ranking of numbers that never meant the
 * same thing. The refusal says which dimension moved.
 *
 * The header also records the **baseline**: what `data/**` held for every
 * searched dimension when the study opened. That is what makes `apply` able to
 * refuse a stale write (see `applyTuning.ts`) rather than diffing a proposal
 * against values that have since moved.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Candidate, Dimension } from './searchSpace';

export const STUDY_VERSION = 1;

/** The four terms from slice A (#343), carried per trial. NEVER pre-blended. */
export interface TrialTerms {
  readonly medianSurvivalDay: number;
  readonly medianTierReached: number;
  readonly meanVerdictPassRate: number;
  readonly meanTimeToTierFit: number;
}

/** Where a candidate came from — the search's own audit trail. */
export type TrialSource =
  /** The values `data/**` already holds: the incumbent every proposal is judged against. */
  | 'baseline'
  /** A point from the space-filling initial design. */
  | 'design'
  /** Proposed by maximizing Expected Improvement over the surrogate. */
  | 'ei'
  /** A re-evaluation on the full seed spread of a candidate first scored cheaply. */
  | 'promotion';

/** Whether a score came from the reduced seed subset or the full spread. */
export type TrialStage = 'cheap' | 'full';

export interface Trial {
  /** Completion order, 0-based — also the id `apply --trial N` names. */
  readonly index: number;
  readonly source: TrialSource;
  readonly stage: TrialStage;
  /** Seeds behind THIS score. A cheap score and a full score are not equals. */
  readonly seedCount: number;
  readonly score: number;
  /** The reduced-subset score, when the candidate was screened before promotion. */
  readonly cheapScore: number | null;
  readonly failureRate: number;
  readonly terms: TrialTerms;
  readonly wallMs: number;
  readonly candidate: Candidate;
}

export interface StudyConfig {
  readonly policyId: string;
  readonly maxDays: number;
  readonly baseSeed: number;
  readonly seedCount: number;
  readonly cheapSeedCount: number;
  readonly dimensionIds: readonly string[];
}

/** One manifest dimension as the study remembers it. */
export interface ManifestEntry {
  readonly id: string;
  readonly file: string;
  readonly path: string;
  readonly bound: string;
}

export interface StudyHeader {
  readonly kind: 'study';
  readonly version: number;
  readonly createdAt: string;
  readonly fingerprint: string;
  readonly manifest: readonly ManifestEntry[];
  readonly config: StudyConfig;
  /** `data/**` values for the searched dimensions when the study opened. */
  readonly baseline: Candidate;
}

export interface Study {
  readonly path: string;
  readonly header: StudyHeader;
  readonly trials: readonly Trial[];
}

export function boundOf(dim: Dimension): string {
  return dim.values
    ? `{${dim.values.join(', ')}}`
    : `[${dim.range!.min}, ${dim.range!.max}] step ${dim.range!.step}`;
}

export function manifestDescriptor(dims: readonly Dimension[]): ManifestEntry[] {
  return dims.map((d) => ({ id: d.id, file: d.file, path: d.path, bound: boundOf(d) }));
}

/**
 * FNV-1a over the canonical descriptor. Not cryptographic and not meant to be —
 * it is a cheap equality check on a structure the refusal path then diffs by
 * hand so the message can name what moved.
 */
export function fingerprintManifest(dims: readonly Dimension[]): string {
  const text = JSON.stringify(manifestDescriptor(dims));
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Human-readable differences between a recorded manifest and a live one. */
export function describeManifestMismatch(
  recorded: readonly ManifestEntry[],
  current: readonly ManifestEntry[],
): string[] {
  const byId = (entries: readonly ManifestEntry[]) => new Map(entries.map((e) => [e.id, e]));
  const was = byId(recorded);
  const now = byId(current);
  const out: string[] = [];
  for (const [id, entry] of was) {
    const live = now.get(id);
    if (!live) {
      out.push(`${id}: removed from the manifest (was ${entry.file}:${entry.path} ${entry.bound})`);
      continue;
    }
    if (live.file !== entry.file || live.path !== entry.path) {
      out.push(`${id}: ${entry.file}:${entry.path} → ${live.file}:${live.path}`);
    }
    if (live.bound !== entry.bound) {
      out.push(`${id}: bound ${entry.bound} → ${live.bound}`);
    }
  }
  for (const [id, entry] of now) {
    if (!was.has(id)) out.push(`${id}: added to the manifest (${entry.file}:${entry.path})`);
  }
  return out;
}

function describeConfigMismatch(recorded: StudyConfig, current: StudyConfig): string[] {
  const out: string[] = [];
  const cmp = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${label}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  };
  cmp('policy', recorded.policyId, current.policyId);
  cmp('maxDays', recorded.maxDays, current.maxDays);
  cmp('baseSeed', recorded.baseSeed, current.baseSeed);
  cmp('seeds', recorded.seedCount, current.seedCount);
  cmp('cheapSeeds', recorded.cheapSeedCount, current.cheapSeedCount);
  cmp('dimensions', [...recorded.dimensionIds].sort(), [...current.dimensionIds].sort());
  return out;
}

export function readStudy(path: string): Study {
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error(`Study file '${path}' is empty.`);
  const header = JSON.parse(lines[0]) as StudyHeader;
  if (header.kind !== 'study') {
    throw new Error(`Study file '${path}' does not start with a study header.`);
  }
  if (header.version !== STUDY_VERSION) {
    throw new Error(
      `Study file '${path}' is version ${header.version}; this harness writes version ${STUDY_VERSION}.`,
    );
  }
  // The `kind` discriminator is a property of the LINE, not of the trial — it
  // is dropped on read so a resumed trial is identical to the one that was
  // written, which is what lets a resumed study be compared to a fresh one.
  const trials = lines.slice(1).map((line) => {
    const { kind, ...trial } = JSON.parse(line) as Trial & { kind?: string };
    if (kind !== 'trial') throw new Error(`Study file '${path}' has a line that is not a trial.`);
    return trial as Trial;
  });
  return { path, header, trials };
}

export interface OpenStudyOptions {
  readonly path: string;
  readonly dims: readonly Dimension[];
  readonly config: StudyConfig;
  readonly baseline: Candidate;
}

/**
 * Open a study for writing: resume the file if it exists and is comparable,
 * otherwise create it. **Refuses rather than mixes** — a mismatched manifest or
 * cohort config throws with the differences named.
 */
export function openStudy(opts: OpenStudyOptions): Study {
  const fingerprint = fingerprintManifest(opts.dims);
  if (existsSync(opts.path)) {
    const study = readStudy(opts.path);
    if (study.header.fingerprint !== fingerprint) {
      const diffs = describeManifestMismatch(study.header.manifest, manifestDescriptor(opts.dims));
      throw new Error(
        `Refusing to resume '${opts.path}': the tunable manifest has changed since it was ` +
          `written (fingerprint ${study.header.fingerprint} → ${fingerprint}). Trials scored ` +
          `under different bounds are not comparable. Changes:\n  ${diffs.join('\n  ')}`,
      );
    }
    const configDiffs = describeConfigMismatch(study.header.config, opts.config);
    if (configDiffs.length > 0) {
      throw new Error(
        `Refusing to resume '${opts.path}': it was run with a different cohort config. ` +
          `Scores from different cohorts are not comparable. Changes:\n  ${configDiffs.join('\n  ')}`,
      );
    }
    return study;
  }

  const header: StudyHeader = {
    kind: 'study',
    version: STUDY_VERSION,
    createdAt: new Date().toISOString(),
    fingerprint,
    manifest: manifestDescriptor(opts.dims),
    config: opts.config,
    baseline: opts.baseline,
  };
  writeFileSync(opts.path, JSON.stringify(header) + '\n');
  return { path: opts.path, header, trials: [] };
}

/** Durably append one completed evaluation. Called BEFORE the next one starts. */
export function appendTrial(path: string, trial: Trial): void {
  appendFileSync(path, JSON.stringify({ kind: 'trial', ...trial }) + '\n');
}

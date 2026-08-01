/**
 * The balance search loop (#345, parent #339) — slice C of three.
 *
 * Slice A gave the harness an honest objective (`scoring.ts`); slice B declared
 * what a search is allowed to vary (`searchSpace.ts`). This closes the loop:
 * Bayesian optimization over that surface, so the #286 calibration campaign is a
 * review of ranked candidates instead of a from-scratch hand-tune of dozens of
 * placeholder constants.
 *
 * **This module runs no game days and writes no `data/**`.** It takes its
 * evaluator injected — the real one is a thin adapter over `runCohort` +
 * `scoreCohort` in `evaluator.ts`, and tests drive a synthetic objective with a
 * known optimum. That is not a testing convenience bolted on afterwards: one
 * real evaluation is ~7 ms × 360 days × N seeds, so an optimizer that could only
 * be exercised through the sim could not be unit-tested at all. The only thing
 * that ever writes `data/**` is the explicit `apply` step (`applyTuning.ts`).
 *
 * Three behaviours worth knowing before reading the code:
 *
 *   - **Trial 0 is the incumbent.** The first candidate is whatever `data/**`
 *     holds today, evaluated on the full seed spread. Every proposal is then
 *     ranked against a real score for the current game rather than against
 *     nothing, and the report's diff has a baseline that was actually measured.
 *   - **Adaptive sampling spends runs where the signal is.** A candidate is
 *     first scored on a reduced seed subset; only one that looks promising
 *     against the observed distribution earns the full spread, and the refined
 *     score replaces the cheap one. Every score records the seed count behind
 *     it, and the surrogate is told a cheap score is noisier rather than being
 *     allowed to treat it as an equal.
 *   - **The recommendation is never a cheap score.** If the top-ranked trial was
 *     screened on the subset when the budget runs out, it is promoted to a full
 *     evaluation before the study reports a best.
 */
import { fitGp, expectedImprovement, type GpObservation } from './gp';
import { createHarnessRng } from './seeds';
import {
  allowsValue,
  currentValue,
  dimensionById,
  type Candidate,
  type Dimension,
} from './searchSpace';
import {
  appendTrial,
  openStudy,
  type Study,
  type StudyConfig,
  type Trial,
  type TrialSource,
  type TrialTerms,
} from './study';

/** What one evaluation of a candidate reports back. */
export interface Evaluation {
  /** The slice-A search blend over the cohort. SEARCH SIGNAL ONLY. */
  readonly score: number;
  readonly terms: TrialTerms;
  readonly failureRate: number;
}

/** A candidate scored over an explicit seed list — the injection seam. */
export type Evaluator = (candidate: Candidate, seeds: readonly number[]) => Evaluation;

/**
 * How close to the best observed score a cheap screen must come to earn the
 * full seed spread, as a fraction of the observed spread. Tighter spends less
 * and risks discarding a candidate the subset scored unluckily; looser spends
 * the budget re-confirming mediocre points.
 */
export const PROMOTION_MARGIN = 0.25;

/** Observation-noise variance credited to a full-cohort score, in score units. */
const FULL_SCORE_NOISE = 1e-4;

/** Candidate points drawn per acquisition maximization. */
const ACQ_SAMPLES = 512;
/** Fraction of those drawn as local perturbations of the incumbent. */
const ACQ_LOCAL_FRACTION = 0.5;
const ACQ_LOCAL_SIGMA = 0.12;

// ── Unit-box mapping ─────────────────────────────────────────────────────────

function decimalsOfStep(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  if (dot < 0 || text.includes('e')) return 0;
  return text.length - dot - 1;
}

/** A dimension's value as a coordinate in [0,1]. */
export function toUnit(dim: Dimension, value: number): number {
  if (dim.values) {
    if (dim.values.length === 1) return 0;
    let nearest = 0;
    for (let i = 1; i < dim.values.length; i++) {
      if (Math.abs(dim.values[i] - value) < Math.abs(dim.values[nearest] - value)) nearest = i;
    }
    return nearest / (dim.values.length - 1);
  }
  const { min, max } = dim.range!;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * A [0,1] coordinate back to a legal value. Rounded to the precision implied by
 * the dimension's step — a proposal need not land on the step grid (#344), but
 * `0.30000000000000004` in a diff the director reads is noise, not precision.
 */
export function fromUnit(dim: Dimension, unit: number): number {
  const u = Math.min(1, Math.max(0, unit));
  if (dim.values) {
    const idx = Math.round(u * (dim.values.length - 1));
    return dim.values[Math.min(dim.values.length - 1, Math.max(0, idx))];
  }
  const { min, max, step } = dim.range!;
  const raw = min + u * (max - min);
  const rounded = Number(raw.toFixed(decimalsOfStep(step)));
  return Math.min(max, Math.max(min, rounded));
}

export function candidateToUnit(candidate: Candidate, dims: readonly Dimension[]): number[] {
  return dims.map((d) => toUnit(d, candidate[d.id] ?? currentValue(d)));
}

export function unitToCandidate(point: readonly number[], dims: readonly Dimension[]): Candidate {
  const out: Record<string, number> = {};
  dims.forEach((d, i) => {
    out[d.id] = fromUnit(d, point[i]);
  });
  return out;
}

/** The values `data/**` holds right now, as a candidate over the given dims. */
export function baselineCandidate(dims: readonly Dimension[]): Candidate {
  const out: Record<string, number> = {};
  for (const d of dims) out[d.id] = currentValue(d);
  return out;
}

// ── Initial design ───────────────────────────────────────────────────────────

/**
 * Trial 0 is the incumbent; the rest is a Latin hypercube, which spreads a small
 * budget across every dimension's range instead of leaving whole stretches
 * unsampled the way independent uniform draws do at n=8.
 */
export function buildInitialDesign(
  dims: readonly Dimension[],
  count: number,
  rng: () => number,
): Candidate[] {
  const design: Candidate[] = [baselineCandidate(dims)];
  const remaining = Math.max(0, count - 1);
  if (remaining === 0) return design;

  const strata = dims.map(() => {
    const order = Array.from({ length: remaining }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  });

  for (let k = 0; k < remaining; k++) {
    design.push(unitToCandidate(dims.map((_, d) => (strata[d][k] + 0.5) / remaining), dims));
  }
  return design;
}

// ── Acquisition ──────────────────────────────────────────────────────────────

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function observationsOf(trials: readonly Trial[], dims: readonly Dimension[], fullSeeds: number): GpObservation[] {
  return trials.map((t) => ({
    x: candidateToUnit(t.candidate, dims),
    y: t.score,
    // A score from k of n seeds is a noisier estimate of the same quantity.
    // Scaling the observation noise by n/k is how the surrogate is told so.
    noise: FULL_SCORE_NOISE * (t.seedCount > 0 ? fullSeeds / t.seedCount : fullSeeds),
  }));
}

/**
 * Maximize Expected Improvement over the surrogate by scoring a deterministic
 * sample of the unit box — half uniform, half clustered on the incumbent. A
 * sampled maximization is unglamorous, but with a handful of dimensions and a
 * budget measured in tens of real evaluations, the acquisition's own precision
 * is nowhere near the binding constraint.
 */
export function proposeCandidate(
  trials: readonly Trial[],
  dims: readonly Dimension[],
  fullSeeds: number,
  rng: () => number,
): Candidate {
  const observations = observationsOf(trials, dims, fullSeeds);
  const gp = fitGp(observations);
  const best = Math.max(...trials.map((t) => t.score));
  const incumbent = candidateToUnit(
    trials.reduce((m, t) => (t.score > m.score ? t : m)).candidate,
    dims,
  );

  const scored: { point: number[]; ei: number }[] = [];
  for (let i = 0; i < ACQ_SAMPLES; i++) {
    const local = i < ACQ_SAMPLES * ACQ_LOCAL_FRACTION;
    const point = dims.map((_, d) =>
      local
        ? Math.min(1, Math.max(0, incumbent[d] + gaussian(rng) * ACQ_LOCAL_SIGMA))
        : rng(),
    );
    scored.push({ point, ei: expectedImprovement(gp.predict(point), best) });
  }
  scored.sort((a, b) => b.ei - a.ei);

  // Skip a proposal that rounds onto a candidate already evaluated: re-running
  // it would burn a full cohort to learn nothing.
  const seen = new Set(trials.map((t) => JSON.stringify(unitToCandidate(candidateToUnit(t.candidate, dims), dims))));
  for (const { point } of scored) {
    const candidate = unitToCandidate(point, dims);
    if (!seen.has(JSON.stringify(candidate))) return candidate;
  }
  return unitToCandidate(scored[0].point, dims);
}

// ── The loop ─────────────────────────────────────────────────────────────────

export interface SearchOptions {
  readonly studyPath: string;
  readonly dims: readonly Dimension[];
  /** The full seed cohort. A cheap screen uses its first `cheapSeedCount`. */
  readonly seeds: readonly number[];
  readonly cheapSeedCount: number;
  /** Total trial records the study should hold when this returns. */
  readonly trials: number;
  readonly initialDesign: number;
  readonly config: StudyConfig;
  readonly evaluate: Evaluator;
  /** Seeds the design and acquisition sampling; defaults to `config.baseSeed`. */
  readonly rngSeed?: number;
  readonly onTrial?: (trial: Trial, budget: number) => void;
}

export interface SearchResult {
  readonly study: Study;
  /** Highest-scoring trial; always a full-spread score, never a cheap screen. */
  readonly best: Trial | null;
  /** Best of the baseline + initial design — what the optimizer had to beat. */
  readonly initialBest: Trial | null;
  /** Evaluations this invocation actually ran (0 when a study is already complete). */
  readonly evaluated: number;
}

function promotionBar(trials: readonly Trial[]): number {
  if (trials.length === 0) return -Infinity;
  const scores = trials.map((t) => t.score);
  const best = Math.max(...scores);
  const spread = best - Math.min(...scores);
  return best - PROMOTION_MARGIN * (spread > 0 ? spread : Math.abs(best) || 1);
}

function assertLegal(candidate: Candidate, dims: readonly Dimension[]): void {
  for (const [id, value] of Object.entries(candidate)) {
    const dim = dimensionById(id, dims);
    if (!allowsValue(dim, value)) {
      throw new Error(`Search proposed ${id}=${value}, outside its declared bound.`);
    }
  }
}

export function runSearch(opts: SearchOptions): SearchResult {
  const dims = opts.dims;
  if (dims.length === 0) throw new Error('A search needs at least one dimension.');
  const fullSeeds = opts.seeds;
  const cheapSeeds = fullSeeds.slice(0, Math.max(1, Math.min(opts.cheapSeedCount, fullSeeds.length)));
  const screens = cheapSeeds.length < fullSeeds.length;

  const study = openStudy({
    path: opts.studyPath,
    dims,
    config: opts.config,
    baseline: baselineCandidate(dims),
  });

  const rng = createHarnessRng(opts.rngSeed ?? opts.config.baseSeed);
  const design = buildInitialDesign(dims, Math.max(1, opts.initialDesign), rng);
  const trials: Trial[] = [...study.trials];
  let evaluated = 0;

  const record = (candidate: Candidate, source: TrialSource, forceFull: boolean): Trial => {
    assertLegal(candidate, dims);
    const startedAt = Date.now();
    let stage: Trial['stage'] = 'full';
    let seedsUsed = fullSeeds;
    let cheapScore: number | null = null;
    let evaluation: Evaluation;

    if (!screens || forceFull) {
      evaluation = opts.evaluate(candidate, fullSeeds);
    } else {
      const screen = opts.evaluate(candidate, cheapSeeds);
      cheapScore = screen.score;
      if (screen.score >= promotionBar(trials)) {
        evaluation = opts.evaluate(candidate, fullSeeds);
      } else {
        evaluation = screen;
        stage = 'cheap';
        seedsUsed = cheapSeeds;
      }
    }

    const trial: Trial = {
      index: trials.length,
      source,
      stage,
      seedCount: seedsUsed.length,
      score: evaluation.score,
      cheapScore,
      failureRate: evaluation.failureRate,
      terms: evaluation.terms,
      wallMs: Date.now() - startedAt,
      candidate,
    };
    // Appended BEFORE the next evaluation starts: an interrupted study loses at
    // most the trial in flight.
    appendTrial(opts.studyPath, trial);
    trials.push(trial);
    evaluated++;
    opts.onTrial?.(trial, opts.trials);
    return trial;
  };

  while (trials.length < opts.trials) {
    const i = trials.length;
    if (i < design.length) {
      record(design[i], i === 0 ? 'baseline' : 'design', i === 0);
    } else {
      record(proposeCandidate(trials, dims, fullSeeds.length, rng), 'ei', false);
    }
  }

  // The recommendation is never a cheap score: if the subset put a screened
  // candidate on top, it earns the full spread before the study names a best.
  const top = rankTrials(trials)[0];
  if (top && top.stage === 'cheap') record(top.candidate, 'promotion', true);

  const ranked = rankTrials(trials).filter((t) => t.stage === 'full');
  const initialPool = trials.filter((t) => t.source === 'baseline' || t.source === 'design');
  return {
    study: { path: opts.studyPath, header: study.header, trials },
    best: ranked[0] ?? null,
    initialBest: rankTrials(initialPool)[0] ?? null,
    evaluated,
  };
}

/** Trials by score, best first. Ties break toward the more-seeded score. */
export function rankTrials(trials: readonly Trial[]): Trial[] {
  return [...trials].sort((a, b) => b.score - a.score || b.seedCount - a.seedCount || a.index - b.index);
}

// ── The readable diff ────────────────────────────────────────────────────────

export interface DiffRow {
  readonly id: string;
  /** `file:path`, the same address `sweep --tunable` takes. */
  readonly label: string;
  readonly current: number;
  readonly proposed: number;
}

/**
 * What a candidate would change in `data/**`, one row per key that actually
 * moves. The review is "accept this diff", not "read this JSON blob".
 */
export function trialDiff(candidate: Candidate, dims: readonly Dimension[]): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const dim of dims) {
    const proposed = candidate[dim.id];
    if (proposed === undefined) continue;
    const current = currentValue(dim);
    if (Object.is(current, proposed)) continue;
    rows.push({ id: dim.id, label: `${dim.file}:${dim.path}`, current, proposed });
  }
  return rows;
}

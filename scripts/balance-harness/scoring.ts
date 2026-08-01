/**
 * Honest failure scoring for the #247 balance harness (#343, parent #339).
 *
 * The harness's reports used to be readable as "everything is fine" while most
 * seeds went broke — `endedReason` tags only the hard mid-floor insolvency
 * THROW, so a modeled bankruptcy hid in the `gameover` bucket. `types.ts`
 * already split those two buckets; this module supplies the part that was still
 * missing: a **per-run failure verdict** and the **four separately-reported
 * terms** slice C's search loop will read.
 *
 * Two rules this file exists to enforce:
 *
 *   1. **The four terms are never pre-blended in a report.** `searchScore` is a
 *      single direction for an optimizer, nothing else — every printer that
 *      shows it also shows the terms, so a human never accepts a config on the
 *      blend alone.
 *   2. **Time-to-tier fit stays differentiable past the tolerance band.** A
 *      binary WITHIN/OUT flag hands an optimizer zero gradient over exactly the
 *      region the un-tuned tunables sit in today (see
 *      docs/balance-harness-recipe.md — the bot bankrupts before T2), so a
 *      badly-out config must still rank above a worse one.
 *
 * Reads `data/tier-pacing-targets.json`; never writes it. The targets are the
 * director's to author (locked 2026-06-11).
 */
import pacingTargets from '../../data/tier-pacing-targets.json';
import { loadTunables } from '../../src/game/data';
import type {
  CohortScore,
  FailureCause,
  FailureRec,
  MonthVerdictRec,
  RunResult,
  RunSample,
  RunScore,
} from './types';

/**
 * How many CONSECUTIVE month-end verdicts at band `miss` make a run a failure
 * rather than a bad month.
 *
 * Derived from the campaign streak rule in `data/tier-pacing-targets.json`:
 * *"to leave tier N, post N consecutive meet-or-better verdict months on all
 * active faces."* Advancement is an unbroken run of good months, so ruin is its
 * mirror — and three unbroken missed months is longer than the entire Tier-1
 * dwell target (2 game-months), i.e. the run has spent its whole budget for the
 * tier without one gradeable month of progress.
 *
 * `nearMiss` is honest progress: it breaks the streak. Only `miss` extends it.
 */
export const SUSTAINED_MISS_MONTHS = 3;

/**
 * Weights of the search blend. Documented and named because slice C tunes
 * against this number and a bare literal here would be an unreviewable choice.
 * Survival leads (a dead run teaches nothing about pacing), tier and pacing fit
 * carry the campaign shape, verdict pass rate is the month-to-month texture.
 * They sum to 1 so `searchScore` stays in [0,1].
 */
export const SEARCH_WEIGHTS = {
  survival: 0.3,
  tier: 0.25,
  verdictPass: 0.2,
  pacingFit: 0.25,
} as const;

/** Top of the tier ladder — the normalization ceiling of the tier term. */
const MAX_TIER = 7;

const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;
const TOLERANCE_BAND = pacingTargets.toleranceBand;
const DWELL_TARGETS = pacingTargets.dwellTargets as Record<
  string,
  { realHours: number; medianGameMonths: number }
>;

/** Every cause, in the order a report buckets them. */
export const FAILURE_CAUSES: readonly FailureCause[] = [
  'insolventThrow',
  'modeledBankruptcy',
  'cashNegative',
  'verdictMissStreak',
  'forcedContraction',
];

export interface ScoreOptions {
  /** The run budget the cohort was given — normalizes the survival term. */
  readonly maxDays: number;
}

// ── The four terms ───────────────────────────────────────────────────────────

/**
 * Smooth pacing fit for one tier's observed dwell against its target.
 *
 * 1.0 exactly on target, **0.5 at the tolerance-band edge**, decaying
 * continuously and strictly monotonically forever after — so two configs that
 * are both far out of band still order correctly. This is the differentiability
 * requirement stated at the top of the file; do not replace it with a threshold.
 */
export function tierFit(
  observedMonths: number,
  targetMonths: number,
  band: number = TOLERANCE_BAND,
): number {
  if (!(targetMonths > 0) || !(band > 0) || !Number.isFinite(observedMonths)) return 0;
  const relativeError = Math.abs(observedMonths - targetMonths) / targetMonths;
  return 1 / (1 + relativeError / band);
}

/** Mean `tierFit` over every tier the run actually completed a dwell in. */
export function timeToTierFit(result: RunResult): {
  fit: number;
  tierCount: number;
} {
  const fits: number[] = [];
  for (const key of Object.keys(DWELL_TARGETS)) {
    const tier = Number(key);
    const entered = result.tierReachedDay[tier];
    const left = result.tierReachedDay[tier + 1];
    if (entered === undefined || left === undefined) continue;
    fits.push(tierFit((left - entered) / DAYS_PER_MONTH, DWELL_TARGETS[key].medianGameMonths));
  }
  if (fits.length === 0) return { fit: 0, tierCount: 0 };
  return { fit: fits.reduce((s, f) => s + f, 0) / fits.length, tierCount: fits.length };
}

/** Highest tier ever reached — a contraction can leave `finalTier` below it. */
export function tierReached(result: RunResult): number {
  const tiers = Object.keys(result.tierReachedDay).map(Number);
  return tiers.length === 0 ? result.finalTier : Math.max(...tiers);
}

/** meet-or-better ÷ graded months. 0 when nothing was graded — a run that died
 *  before its first month-end has no evidence of passing, and `gradedMonths`
 *  says so alongside it. */
export function verdictPassRate(verdicts: readonly MonthVerdictRec[]): number {
  if (verdicts.length === 0) return 0;
  const passed = verdicts.filter((v) => v.overall === 'meet' || v.overall === 'exceed').length;
  return passed / verdicts.length;
}

// ── Failure conditions ───────────────────────────────────────────────────────

/** First sampled day the cash was below zero, whether or not it recovered.
 *  This dates the failure EARLIER and more honestly than the terminal event
 *  does — the recipe's instrumented fixture seed goes negative ~day 125 but
 *  only publishes `career:bankruptcy_terminal` later. */
export function firstCashNegativeDay(samples: readonly RunSample[]): number | null {
  for (const s of samples) if (s.cash < 0) return s.day;
  return null;
}

/** Day the `miss` streak reached `SUSTAINED_MISS_MONTHS` — i.e. the day of the
 *  Nth consecutive missed verdict. Any non-`miss` band resets the count. */
export function missStreakDay(
  verdicts: readonly MonthVerdictRec[],
  streak: number = SUSTAINED_MISS_MONTHS,
): number | null {
  let run = 0;
  for (const v of verdicts) {
    run = v.overall === 'miss' ? run + 1 : 0;
    if (run >= streak) return v.day;
  }
  return null;
}

function failureRecords(result: RunResult): FailureRec[] {
  const recs: FailureRec[] = [];
  if (result.endedReason === 'bankrupt') {
    recs.push({ cause: 'insolventThrow', day: result.endedDay });
  }
  if (result.endedReason === 'gameover' && result.gameOverReason === 'bankruptcy') {
    recs.push({ cause: 'modeledBankruptcy', day: result.endedDay });
  }
  const cashDay = firstCashNegativeDay(result.samples);
  if (cashDay != null) recs.push({ cause: 'cashNegative', day: cashDay });

  const streakDay = missStreakDay(result.verdicts);
  if (streakDay != null) recs.push({ cause: 'verdictMissStreak', day: streakDay });

  if (result.contractions.length > 0) {
    recs.push({
      cause: 'forcedContraction',
      day: Math.min(...result.contractions.map((c) => c.day)),
    });
  }
  // Stable sort: ties keep the declaration order above, so an insolvency throw
  // and a same-day cash dip report the throw as the headline cause.
  return recs.sort((a, b) => a.day - b.day);
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export function scoreRun(result: RunResult, opts: ScoreOptions): RunScore {
  const failures = failureRecords(result);
  const fit = timeToTierFit(result);
  const reached = tierReached(result);
  const passRate = verdictPassRate(result.verdicts);

  const survivalTerm = opts.maxDays > 0 ? Math.min(1, result.endedDay / opts.maxDays) : 0;
  const tierTerm = Math.min(1, Math.max(0, (reached - 1) / (MAX_TIER - 1)));

  return {
    policyId: result.policyId,
    seed: result.seed,
    failed: failures.length > 0,
    failureDay: failures[0]?.day ?? null,
    failureCause: failures[0]?.cause ?? null,
    failures,
    survivalDay: result.endedDay,
    tierReached: reached,
    verdictPassRate: passRate,
    gradedMonths: result.verdicts.length,
    timeToTierFit: fit.fit,
    fitTierCount: fit.tierCount,
    searchScore:
      SEARCH_WEIGHTS.survival * survivalTerm +
      SEARCH_WEIGHTS.tier * tierTerm +
      SEARCH_WEIGHTS.verdictPass * passRate +
      SEARCH_WEIGHTS.pacingFit * fit.fit,
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = (sorted.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  return lo === hi ? sorted[lo] : (sorted[lo] + sorted[hi]) / 2;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

export function scoreCohort(
  policyId: string,
  results: readonly RunResult[],
  opts: ScoreOptions,
): CohortScore {
  const runs = results.map((r) => scoreRun(r, opts));
  const failed = runs.filter((r) => r.failed);
  const causeCounts = Object.fromEntries(
    FAILURE_CAUSES.map((c) => [c, failed.filter((r) => r.failureCause === c).length]),
  ) as Record<FailureCause, number>;

  return {
    policyId,
    seedCount: runs.length,
    failureRate: runs.length === 0 ? 0 : failed.length / runs.length,
    medianFailureDay: failed.length === 0 ? null : median(failed.map((r) => r.failureDay as number)),
    causeCounts,
    medianSurvivalDay: runs.length === 0 ? 0 : median(runs.map((r) => r.survivalDay)),
    medianTierReached: runs.length === 0 ? 0 : median(runs.map((r) => r.tierReached)),
    meanVerdictPassRate: mean(runs.map((r) => r.verdictPassRate)),
    meanTimeToTierFit: mean(runs.map((r) => r.timeToTierFit)),
    meanSearchScore: mean(runs.map((r) => r.searchScore)),
    runs,
  };
}

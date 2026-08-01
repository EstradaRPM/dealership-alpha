/**
 * The real evaluator behind the #345 search: apply a candidate to the live
 * in-memory config, run the policy bot across a seed cohort, score it honestly
 * (#343), restore.
 *
 * Deliberately thin, and deliberately its own module. `search.ts` takes its
 * evaluator injected and therefore never imports the game; keeping the adapter
 * here is what lets the optimizer be unit-tested against a synthetic objective
 * while the shipping path still measures the real sim.
 *
 * The candidate is applied to the same in-memory JSON objects the loaders read
 * and restored in a `finally` — a search writes its study file and nothing else.
 * `data/**` on disk is only ever written by the explicit `apply` step.
 */
import { runCohort } from './runner';
import { scoreCohort } from './scoring';
import { applyCandidate, type Candidate, type Dimension } from './searchSpace';
import type { Evaluation, Evaluator } from './search';
import type { Policy } from './policies';

export interface CohortEvaluatorOptions {
  readonly policy: Policy;
  readonly maxDays: number;
  readonly dims: readonly Dimension[];
}

export function evaluateCandidate(
  candidate: Candidate,
  seeds: readonly number[],
  opts: CohortEvaluatorOptions,
): Evaluation {
  const applied = applyCandidate(candidate, opts.dims);
  try {
    const results = runCohort(opts.policy, seeds, { maxDays: opts.maxDays });
    const cohort = scoreCohort(opts.policy.id, results, { maxDays: opts.maxDays });
    return {
      score: cohort.meanSearchScore,
      failureRate: cohort.failureRate,
      terms: {
        medianSurvivalDay: cohort.medianSurvivalDay,
        medianTierReached: cohort.medianTierReached,
        meanVerdictPassRate: cohort.meanVerdictPassRate,
        meanTimeToTierFit: cohort.meanTimeToTierFit,
      },
    };
  } finally {
    applied.restore();
  }
}

export function createCohortEvaluator(opts: CohortEvaluatorOptions): Evaluator {
  return (candidate, seeds) => evaluateCandidate(candidate, seeds, opts);
}

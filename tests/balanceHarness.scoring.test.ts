/**
 * #343 — the balance harness's honest objective.
 *
 * These are the guards on the thing the parent issue (#339) exists to fix: the
 * harness's reports could be read as "everything is fine" while most seeds went
 * broke. Every criterion below is a way a run can be ruined that the old
 * `endedReason`/bankruptcy-rate view could not see.
 *
 * Most of the file drives synthetic `RunResult`s, which is deliberate — the
 * scorer is a pure function of a run record, and a real 360-day cohort would
 * take minutes. The one place that has to touch the live sim is the contraction
 * wiring, because the bug there was a MISSING SUBSCRIPTION: no synthetic record
 * can prove the runner listens.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEventBus } from '../src/game/EventBus';
import { runOne } from '../scripts/balance-harness/runner';
import { policyById } from '../scripts/balance-harness/policies';
import {
  FAILURE_CAUSES,
  SEARCH_WEIGHTS,
  SUSTAINED_MISS_MONTHS,
  scoreCohort,
  scoreRun,
  tierFit,
} from '../scripts/balance-harness/scoring';
import {
  SEARCH_SCORE_LABEL,
  TERM_LABELS,
  formatPacing,
  summarizePacing,
} from '../scripts/balance-harness/reports';
import type { GateBand } from '../src/game/TierGate';
import type {
  MonthVerdictRec,
  RunResult,
  RunSample,
} from '../scripts/balance-harness/types';
import targets from '../data/tier-pacing-targets.json';
import { loadTunables } from '../src/game/data';

const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;
const DWELL_TARGETS = targets.dwellTargets as Record<string, { medianGameMonths: number }>;
const TARGETS_PATH = join(__dirname, '..', 'data', 'tier-pacing-targets.json');
const OPTS = { maxDays: 360 } as const;

function sample(day: number, cash: number): RunSample {
  return { day, cash, lotCount: 3, lotValue: 45000, cumUnits: 0, tier: 1, csi: 80 };
}

function verdict(month: number, overall: GateBand): MonthVerdictRec {
  return {
    day: month * DAYS_PER_MONTH,
    month,
    tier: 1,
    overall,
    bindingFaceId: 'units',
    bindingRatio: 0.5,
  };
}

function makeRun(over: Partial<RunResult> = {}): RunResult {
  return {
    policyId: 'competent',
    seed: 1,
    tierReachedDay: { 1: 0 },
    verdicts: [],
    samples: [sample(1, 50000), sample(2, 50000)],
    arrivals: 20,
    closes: 2,
    strongMatches: 1,
    finalTier: 1,
    finalCash: 50000,
    endedReason: 'completed',
    gameOverReason: null,
    contractions: [],
    endedDay: 360,
    ...over,
  };
}

describe('cash below zero is a failure, dated off the per-day series', () => {
  it('scores a run that dips negative on day 40 and RECOVERS as failed on day 40', () => {
    const samples = [sample(38, 1200), sample(39, 400), sample(40, -75), sample(41, 900)];
    const score = scoreRun(makeRun({ samples }), OPTS);

    expect(score.failed).toBe(true);
    expect(score.failureDay).toBe(40);
    expect(score.failureCause).toBe('cashNegative');
  });

  it('leaves a run that never goes negative unfailed', () => {
    expect(scoreRun(makeRun(), OPTS).failed).toBe(false);
    expect(scoreRun(makeRun(), OPTS).failureDay).toBeNull();
  });

  it('dates the failure EARLIER than the terminal event when both fire', () => {
    // The whole point of reading the sample series: a modeled bankruptcy is
    // published long after the run actually went under.
    const score = scoreRun(
      makeRun({
        samples: [sample(120, 500), sample(125, -1813), sample(200, -4000)],
        endedReason: 'gameover',
        gameOverReason: 'bankruptcy',
        endedDay: 200,
      }),
      OPTS,
    );
    expect(score.failureDay).toBe(125);
    expect(score.failureCause).toBe('cashNegative');
    expect(score.failures.map((f) => f.cause)).toEqual(['cashNegative', 'modeledBankruptcy']);
  });
});

describe('a sustained run of missed month verdicts is a failure', () => {
  it(`fails on ${SUSTAINED_MISS_MONTHS} consecutive misses, dated to the streak's last month`, () => {
    const verdicts = [verdict(1, 'miss'), verdict(2, 'miss'), verdict(3, 'miss')];
    const score = scoreRun(makeRun({ verdicts }), OPTS);

    expect(score.failed).toBe(true);
    expect(score.failureCause).toBe('verdictMissStreak');
    expect(score.failureDay).toBe(3 * DAYS_PER_MONTH);
  });

  it('does NOT fail on miss/nearMiss alternation — nearMiss is honest progress', () => {
    const verdicts = [
      verdict(1, 'miss'),
      verdict(2, 'nearMiss'),
      verdict(3, 'miss'),
      verdict(4, 'nearMiss'),
      verdict(5, 'miss'),
      verdict(6, 'nearMiss'),
    ];
    expect(scoreRun(makeRun({ verdicts }), OPTS).failed).toBe(false);
  });

  it('resets the streak on a meet, so a late streak still fires on its own months', () => {
    const verdicts = [
      verdict(1, 'miss'),
      verdict(2, 'miss'),
      verdict(3, 'meet'),
      verdict(4, 'miss'),
      verdict(5, 'miss'),
      verdict(6, 'miss'),
    ];
    const score = scoreRun(makeRun({ verdicts }), OPTS);
    expect(score.failureCause).toBe('verdictMissStreak');
    expect(score.failureDay).toBe(6 * DAYS_PER_MONTH);
  });
});

describe('forced contractions', () => {
  it('scores a recorded contraction as a failure on the contraction day', () => {
    const score = scoreRun(
      makeRun({
        contractions: [{ day: 210, kind: 'bankruptcy', fromTier: 2 }],
        finalTier: 1,
        tierReachedDay: { 1: 0, 2: 90 },
      }),
      OPTS,
    );
    expect(score.failed).toBe(true);
    expect(score.failureCause).toBe('forcedContraction');
    expect(score.failureDay).toBe(210);
  });

  it('takes the EARLIEST contraction when several fire', () => {
    const score = scoreRun(
      makeRun({
        contractions: [
          { day: 300, kind: 'indictment', fromTier: 2 },
          { day: 150, kind: 'agComplaint', fromTier: 2 },
        ],
      }),
      OPTS,
    );
    expect(score.failureDay).toBe(150);
  });

  it('captures a contraction published on the live run bus (the missing subscription)', () => {
    // Runner-level: the bug this guards is that runner.ts subscribed to NONE of
    // the three contraction events, so a contracted run looked healthy. Drive a
    // real short run and publish the event from inside the day loop.
    const bus = createEventBus();
    bus.subscribe('clock:day_started', (p) => {
      if (p.day === 2) {
        bus.publish('career:bankruptcy_contraction', {
          day: p.day,
          fromTier: 2,
          debtPrincipal: 25000,
        });
      }
    });

    const policy = policyById('competent');
    expect(policy).toBeDefined();
    const result = runOne(policy!, 1, { maxDays: 3, bus });

    expect(result.contractions).toEqual([{ day: 2, kind: 'bankruptcy', fromTier: 2 }]);
    expect(scoreRun(result, { maxDays: 3 }).failures.map((f) => f.cause)).toContain(
      'forcedContraction',
    );
  });
});

describe('the four terms are reported separately', () => {
  it('exposes survival day, tier reached, verdict pass rate and pacing fit as distinct fields', () => {
    const score = scoreRun(
      makeRun({
        tierReachedDay: { 1: 0, 2: 2 * DAYS_PER_MONTH },
        verdicts: [verdict(1, 'meet'), verdict(2, 'miss'), verdict(3, 'exceed'), verdict(4, 'meet')],
        endedDay: 180,
        finalTier: 2,
      }),
      OPTS,
    );

    expect(score.survivalDay).toBe(180);
    expect(score.tierReached).toBe(2);
    expect(score.verdictPassRate).toBeCloseTo(0.75);
    expect(score.gradedMonths).toBe(4);
    // T1 dwell landed exactly on target ⇒ fit 1.0.
    expect(score.timeToTierFit).toBeCloseTo(1);
    expect(score.fitTierCount).toBe(1);
    // The blend is a FIFTH number, derived from the four — not a replacement.
    expect(score.searchScore).not.toBe(score.timeToTierFit);
  });

  it('reports the highest tier reached even after a contraction drops finalTier', () => {
    const score = scoreRun(
      makeRun({ tierReachedDay: { 1: 0, 2: 60, 3: 200 }, finalTier: 1 }),
      OPTS,
    );
    expect(score.tierReached).toBe(3);
  });

  it('prints all four terms in the pacing report, and never the blend without them', () => {
    const report = formatPacing([
      summarizePacing('competent', [makeRun(), makeRun({ seed: 2, endedDay: 120 })], OPTS),
    ]);

    for (const label of Object.values(TERM_LABELS)) {
      expect(report).toContain(label);
    }
    // The blend is present, labelled as search-only, and printed AFTER every term.
    expect(report).toContain(SEARCH_SCORE_LABEL);
    const blendAt = report.indexOf(SEARCH_SCORE_LABEL);
    for (const label of Object.values(TERM_LABELS)) {
      expect(report.indexOf(label)).toBeLessThan(blendAt);
    }
  });

  it('keeps the search blend a documented weighted sum of the four terms', () => {
    const total = Object.values(SEARCH_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1);
    // A perfect run maxes every term ⇒ the blend saturates at 1. Walk the
    // ladder hitting each tier's target dwell exactly.
    const onTargetLadder: Record<number, number> = { 1: 0 };
    let day = 0;
    for (const tier of [1, 2, 3, 4, 5, 6]) {
      day += DWELL_TARGETS[String(tier)].medianGameMonths * DAYS_PER_MONTH;
      onTargetLadder[tier + 1] = day;
    }
    const perfect = scoreRun(
      makeRun({
        tierReachedDay: onTargetLadder,
        verdicts: [verdict(1, 'meet'), verdict(2, 'exceed')],
        endedDay: 360,
        finalTier: 7,
      }),
      OPTS,
    );
    expect(perfect.tierReached).toBe(7);
    expect(perfect.fitTierCount).toBe(6);
    expect(perfect.searchScore).toBeCloseTo(1);
  });
});

describe('time-to-tier fit stays differentiable past the tolerance band', () => {
  const target = targets.dwellTargets['1'].medianGameMonths;
  const band = targets.toleranceBand;

  it('is 1.0 on target and exactly 0.5 at the tolerance-band edge', () => {
    expect(tierFit(target, target)).toBeCloseTo(1);
    expect(tierFit(target * (1 + band), target)).toBeCloseTo(0.5);
    expect(tierFit(target * (1 - band), target)).toBeCloseTo(0.5);
  });

  it('ranks the nearer of three OUT-OF-BAND dwells strictly higher', () => {
    // All three are far outside ±band, where a WITHIN/OUT flag would tie them
    // at "OUT" and hand slice C's optimizer zero gradient.
    const near = target * (1 + band * 2);
    const mid = target * (1 + band * 4);
    const far = target * (1 + band * 8);
    for (const d of [near, mid, far]) {
      expect(Math.abs(d - target) / target).toBeGreaterThan(band);
    }
    expect(tierFit(near, target)).toBeGreaterThan(tierFit(mid, target));
    expect(tierFit(mid, target)).toBeGreaterThan(tierFit(far, target));
    expect(tierFit(far, target)).toBeGreaterThan(0);
  });

  it('carries that monotonicity through a whole run score', () => {
    const runFor = (dwellMonths: number) =>
      scoreRun(
        makeRun({ tierReachedDay: { 1: 0, 2: Math.round(dwellMonths * DAYS_PER_MONTH) } }),
        OPTS,
      ).timeToTierFit;

    const near = runFor(target * (1 + band * 2));
    const mid = runFor(target * (1 + band * 4));
    const far = runFor(target * (1 + band * 8));
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });
});

describe('cohort aggregation', () => {
  it('reports failure rate, median failure day and a cause split', () => {
    const cohort = scoreCohort(
      'competent',
      [
        makeRun({ seed: 1 }),
        makeRun({ seed: 2, samples: [sample(50, -10)], endedDay: 60 }),
        makeRun({ seed: 3, samples: [sample(100, -10)], endedDay: 110 }),
        makeRun({
          seed: 4,
          verdicts: [verdict(1, 'miss'), verdict(2, 'miss'), verdict(3, 'miss')],
        }),
      ],
      OPTS,
    );

    expect(cohort.seedCount).toBe(4);
    expect(cohort.failureRate).toBeCloseTo(0.75);
    expect(cohort.medianFailureDay).toBe(3 * DAYS_PER_MONTH);
    expect(cohort.causeCounts.cashNegative).toBe(2);
    expect(cohort.causeCounts.verdictMissStreak).toBe(1);
    expect(cohort.causeCounts.forcedContraction).toBe(0);
    // Every cause is bucketed, so a report can never silently drop one.
    expect(Object.keys(cohort.causeCounts).sort()).toEqual([...FAILURE_CAUSES].sort());
  });

  it('handles an empty cohort without producing NaN rates', () => {
    const cohort = scoreCohort('competent', [], OPTS);
    expect(cohort.failureRate).toBe(0);
    expect(cohort.medianFailureDay).toBeNull();
    expect(cohort.meanSearchScore).toBe(0);
  });
});

describe('the targets file is read-only to the harness', () => {
  it('leaves data/tier-pacing-targets.json byte-identical after scoring a cohort', () => {
    const before = readFileSync(TARGETS_PATH);
    scoreCohort(
      'competent',
      [makeRun(), makeRun({ seed: 2, samples: [sample(10, -1)] })],
      OPTS,
    );
    formatPacing([summarizePacing('competent', [makeRun()], OPTS)]);
    const after = readFileSync(TARGETS_PATH);
    expect(after.equals(before)).toBe(true);
  });
});

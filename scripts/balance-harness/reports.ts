/**
 * Report builders for the #247 harness:
 *   A — pacing:     median/p10/p90 days-in-tier vs data/tier-pacing-targets.json
 *   B — sweep:      one tunable across a range → pacing delta
 *   C — calibration: per-day time-series of a named metric across seeds (CSV)
 *
 * The harness MEASURES; it does not judge. The pacing targets are the user's to
 * author (locked 2026-06-11) — this report only states observed-vs-target so the
 * director can see where the live tunables land.
 */
import pacingTargets from '../../data/tier-pacing-targets.json';
import { loadTunables } from '../../src/game/data';
import { FAILURE_CAUSES, SUSTAINED_MISS_MONTHS, scoreCohort, type ScoreOptions } from './scoring';
import type { SpaceRow } from './searchSpace';
import type {
  CohortScore,
  EndReasonBreakdown,
  PolicyPacing,
  RunResult,
  RunSample,
  TierDwellStat,
} from './types';

const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;
const TOLERANCE_BAND = pacingTargets.toleranceBand;
const DWELL_TARGETS = pacingTargets.dwellTargets as Record<
  string,
  { realHours: number; medianGameMonths: number }
>;
/** Tiers the pacing model spans (1 → 6 dwell, with 7 the terminal cap). */
const TIERS = [1, 2, 3, 4, 5, 6];

function quantileAsc(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  return quantileAsc([...values].sort((a, b) => a - b), 0.5);
}

// ── Mode A: pacing ───────────────────────────────────────────────────────────

/** Combined bankruptcy rate — BOTH the hard insolvency throw and the modeled
 *  `career:bankruptcy_terminal`. The honest "how often does it go broke" number. */
export function bankruptRate(p: PolicyPacing): number {
  if (p.seedCount === 0) return 0;
  return (p.endReasons.insolventThrow + p.endReasons.modeledBankruptcy) / p.seedCount;
}

export function summarizePacing(
  policyId: string,
  results: readonly RunResult[],
  opts: ScoreOptions,
): PolicyPacing {
  const seedCount = results.length;
  const endReasons: EndReasonBreakdown = {
    completed: results.filter((r) => r.endedReason === 'completed').length,
    insolventThrow: results.filter((r) => r.endedReason === 'bankrupt').length,
    modeledBankruptcy: results.filter(
      (r) => r.endedReason === 'gameover' && r.gameOverReason === 'bankruptcy',
    ).length,
    otherGameOver: results.filter(
      (r) => r.endedReason === 'gameover' && r.gameOverReason !== 'bankruptcy',
    ).length,
  };

  const tiers: TierDwellStat[] = TIERS.map((tier) => {
    const reached = results.filter((r) => r.tierReachedDay[tier] !== undefined);
    const dwellDays = reached
      .filter((r) => r.tierReachedDay[tier + 1] !== undefined)
      .map((r) => r.tierReachedDay[tier + 1] - r.tierReachedDay[tier])
      .sort((a, b) => a - b);

    const hasDwell = dwellDays.length > 0;
    const medianDays = hasDwell ? quantileAsc(dwellDays, 0.5) : null;
    const medianMonths = medianDays != null ? medianDays / DAYS_PER_MONTH : null;
    const targetMonths = DWELL_TARGETS[String(tier)]?.medianGameMonths ?? null;
    const withinTolerance =
      medianMonths != null && targetMonths != null
        ? Math.abs(medianMonths - targetMonths) <= targetMonths * TOLERANCE_BAND
        : null;

    return {
      tier,
      reachedCount: reached.length,
      advancedCount: dwellDays.length,
      p10Days: hasDwell ? quantileAsc(dwellDays, 0.1) : null,
      medianDays,
      p90Days: hasDwell ? quantileAsc(dwellDays, 0.9) : null,
      medianMonths,
      targetMonths,
      withinTolerance,
    };
  });

  return {
    policyId,
    seedCount,
    endReasons,
    tiers,
    medianFinalTier: seedCount === 0 ? 0 : median(results.map((r) => r.finalTier)),
    score: scoreCohort(policyId, results, opts),
  };
}

function fmt(n: number | null, digits = 1): string {
  return n == null || Number.isNaN(n) ? '—' : n.toFixed(digits);
}

/** Labels of the four terms. Exported so the guard test can assert that every
 *  one of them is printed — the blend must never appear on its own (#343). */
export const TERM_LABELS = {
  survival: 'survival day',
  tier: 'tier reached',
  verdictPass: 'verdict pass rate',
  pacingFit: 'time-to-tier fit',
} as const;

/** The blend's label. Carries the caveat inline so it is unmissable in output. */
export const SEARCH_SCORE_LABEL = 'search score (BLEND — search signal only)';

/**
 * The honest-verdict block: failure rate and cause split, then the four terms
 * as four separate values, and only then the blend. Printing order is the point
 * — the blend is never the first or the only number a reader sees.
 */
export function formatCohortScore(s: CohortScore): string[] {
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const causes = FAILURE_CAUSES.filter((c) => s.causeCounts[c] > 0)
    .map((c) => `${c}=${s.causeCounts[c]}`)
    .join(', ');
  return [
    `   FAILED: ${pct(s.failureRate)} of ${s.seedCount} seeds` +
      `   median failure day: ${fmt(s.medianFailureDay, 0)}` +
      (causes ? `   [${causes}]` : ''),
    `   terms (reported separately — never judge on the blend alone):`,
    `     ${TERM_LABELS.survival}: median ${fmt(s.medianSurvivalDay, 0)}` +
      `   ${TERM_LABELS.tier}: median ${fmt(s.medianTierReached, 1)}`,
    `     ${TERM_LABELS.verdictPass}: mean ${pct(s.meanVerdictPassRate)}` +
      `   ${TERM_LABELS.pacingFit}: mean ${fmt(s.meanTimeToTierFit, 3)}`,
    `   ${SEARCH_SCORE_LABEL}: ${fmt(s.meanSearchScore, 4)}`,
  ];
}

export function formatPacing(pacings: readonly PolicyPacing[]): string {
  const lines: string[] = [];
  lines.push('# Balance harness — pacing report (mode A)');
  lines.push(`Targets: data/tier-pacing-targets.json (tolerance ±${TOLERANCE_BAND * 100}%)`);
  lines.push(`Days per game-month: ${DAYS_PER_MONTH}`);
  lines.push(`Sustained-miss streak that scores a run failed: ${SUSTAINED_MISS_MONTHS} months`);
  lines.push('');
  for (const p of pacings) {
    lines.push(`## policy: ${p.policyId}  (seeds=${p.seedCount})`);
    const e = p.endReasons;
    lines.push(
      `   bankrupt: ${(bankruptRate(p) * 100).toFixed(0)}%` +
        ` (modeled=${e.modeledBankruptcy}, throw=${e.insolventThrow})` +
        `   completed=${e.completed}  other-gameover=${e.otherGameOver}` +
        `   median final tier: ${fmt(p.medianFinalTier, 1)}`,
    );
    lines.push(...formatCohortScore(p.score));
    lines.push(
      '   tier  reached  advanced   p10d  medianMo  p90d   targetMo   status',
    );
    for (const t of p.tiers) {
      if (t.reachedCount === 0) continue;
      const status =
        t.withinTolerance == null ? '—' : t.withinTolerance ? 'WITHIN' : 'OUT';
      lines.push(
        `   T${t.tier}` +
          `   ${String(t.reachedCount).padStart(6)}` +
          `  ${String(t.advancedCount).padStart(8)}` +
          `  ${fmt(t.p10Days, 0).padStart(5)}` +
          `  ${fmt(t.medianMonths, 1).padStart(7)}` +
          `  ${fmt(t.p90Days, 0).padStart(5)}` +
          `  ${fmt(t.targetMonths, 1).padStart(8)}` +
          `   ${status}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── Mode B: sensitivity sweep ────────────────────────────────────────────────

export interface SweepRow {
  readonly value: number;
  readonly pacing: PolicyPacing;
}

export function formatSweep(file: string, path: string, rows: readonly SweepRow[]): string {
  const lines: string[] = [];
  lines.push('# Balance harness — sensitivity sweep (mode B)');
  lines.push(`Tunable: ${file}:${path}`);
  lines.push('');
  // `failed%` is the honest verdict (#343) — bankrupt% counts only the two
  // bankruptcy buckets and so under-reports a run ruined by a miss streak or a
  // forced contraction. The search blend is deliberately NOT a column here:
  // it may never be printed without all four of its terms.
  lines.push('   value      bankrupt%    failed%  medFinalTier  T1 medMo  T2 medMo  T3 medMo');
  for (const row of rows) {
    const t = (tier: number) =>
      fmt(row.pacing.tiers.find((x) => x.tier === tier)?.medianMonths ?? null, 1).padStart(8);
    lines.push(
      `   ${String(row.value).padStart(8)}` +
        `  ${(bankruptRate(row.pacing) * 100).toFixed(0).padStart(8)}%` +
        `  ${(row.pacing.score.failureRate * 100).toFixed(0).padStart(6)}%` +
        `  ${fmt(row.pacing.medianFinalTier, 1).padStart(12)}` +
        `  ${t(1)}  ${t(2)}  ${t(3)}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

// ── Mode D: the search space (#344) ──────────────────────────────────────────

/** Marks a shipped value that sits outside its own declared bound. */
export const OUTSIDE_BOUND_FLAG = '!! outside declared bound';

/**
 * The tunable manifest as a readable table — every dimension, its declared
 * bound, and the value `data/**` currently holds, so the searchable surface is
 * inspectable without reading source.
 */
export function formatSearchSpace(rows: readonly SpaceRow[]): string {
  const lines: string[] = [];
  lines.push('# Balance harness — tunable search space (#344)');
  lines.push('');
  lines.push(
    `${rows.length} dimensions. Every key NOT listed here is frozen — asserted by ` +
      'tests/balanceHarness.searchSpace.test.ts, not trusted.',
  );
  lines.push('');
  const idW = Math.max(...rows.map((r) => r.id.length));
  const boundW = Math.max(...rows.map((r) => r.bound.length));
  let file = '';
  for (const row of rows) {
    if (row.file !== file) {
      file = row.file;
      lines.push('');
      lines.push(`  ${file}.json`);
    }
    lines.push(
      `    ${row.id.padEnd(idW)}  ${row.bound.padEnd(boundW)}` +
        `  current=${row.current}` +
        (row.outsideBound ? `  ${OUTSIDE_BOUND_FLAG}` : ''),
    );
    lines.push(`    ${' '.repeat(idW)}  ${row.path} — ${row.why}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ── Mode C: calibration time-series (CSV) ────────────────────────────────────

const METRIC_KEYS: readonly (keyof RunSample)[] = [
  'cash',
  'lotCount',
  'lotValue',
  'cumUnits',
  'tier',
  'csi',
];

export function isMetric(name: string): name is keyof RunSample {
  return (METRIC_KEYS as readonly string[]).includes(name);
}

export function metricNames(): string[] {
  return [...METRIC_KEYS] as string[];
}

/** Wide CSV: one row per day, one column per seed, cells = the metric value. */
export function formatCalibCsv(
  metric: keyof RunSample,
  results: readonly RunResult[],
  maxDays: number,
): string {
  const bySeedDay = new Map<number, Map<number, number>>();
  let lastDay = 0;
  for (const r of results) {
    const dayMap = new Map<number, number>();
    for (const s of r.samples) {
      dayMap.set(s.day, s[metric] as number);
      if (s.day > lastDay) lastDay = s.day;
    }
    bySeedDay.set(r.seed, dayMap);
  }
  const days = Math.min(maxDays, lastDay);
  const seeds = results.map((r) => r.seed);
  const header = ['day', ...seeds.map((s) => `seed_${s}`)].join(',');
  const lines = [`# metric: ${metric}`, header];
  for (let day = 1; day <= days; day++) {
    const cells = [String(day)];
    for (const seed of seeds) {
      const v = bySeedDay.get(seed)?.get(day);
      cells.push(v === undefined ? '' : String(v));
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

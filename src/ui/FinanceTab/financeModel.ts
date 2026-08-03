import type { DayRange, KPIDayTotals, KPISnapshot } from '../../game/KPIDashboard';
import type { LedgerEntry, PnLSummary } from '../../game/Economy';
import type { BarDatum, DonutDatum, TrendDirection } from '../kit';

/**
 * Finance's pure read-model (#351).
 *
 * Every number the analytics dashboard draws is computed here — window
 * arithmetic, period-over-period deltas, hero bucketing, the two breakdowns —
 * with no React and no theme, so a wrong dashboard is an assertion on a model
 * field rather than a screenshot. The container's whole job is to call the
 * engine's range reads and hand the results in.
 *
 * The tab's charter (locked IA §1/§4) is the **backward-looking judgment
 * numbers**: what the month did, in honest DMS idiom. Nothing here is a lever;
 * numbers you act on while working stay in the room where you do the work.
 */

export type FinanceRangeId = 'today' | '7d' | '30d' | 'quarter';

export interface FinanceRangeOption {
  readonly id: FinanceRangeId;
  readonly label: string;
}

/**
 * The chips, in order. Lengths are the reporting periods a dealer actually
 * closes against — the day, the week, the month, the quarter — not powers of
 * ten. `quarter` is the 91-day game season (`DAYS_PER_SEASON`).
 */
export const FINANCE_RANGES: readonly FinanceRangeOption[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'quarter', label: 'Quarter' },
];

const RANGE_DAYS: Record<FinanceRangeId, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  quarter: 91,
};

/** How the period reads in a sentence, e.g. the hero chart's caption. */
const RANGE_PHRASE: Record<FinanceRangeId, string> = {
  today: 'today',
  '7d': 'the last 7 days',
  '30d': 'the last 30 days',
  quarter: 'the last quarter',
};

/** What the delta chip is comparing against. */
const PRIOR_PHRASE: Record<FinanceRangeId, string> = {
  today: 'vs yesterday',
  '7d': 'vs prior 7 days',
  '30d': 'vs prior 30 days',
  quarter: 'vs prior quarter',
};

export function financeRangeDays(id: FinanceRangeId): number {
  return RANGE_DAYS[id];
}

/**
 * The selected window, ending on the current day. Clamped at day 1 — early in a
 * career the "30 days" chip is honestly a shorter window, and the model says so
 * rather than reporting a month that has not happened yet.
 */
export function financeRangeWindow(id: FinanceRangeId, currentDay: number): DayRange {
  return {
    fromDay: Math.max(1, currentDay - financeRangeDays(id) + 1),
    toDay: currentDay,
  };
}

/**
 * The immediately preceding window of the same nominal length — the delta's
 * comparison base. May be entirely before day 1 at the start of a career, in
 * which case it is empty and the model suppresses the delta instead of
 * reporting a fictional +100%.
 */
export function financePriorWindow(id: FinanceRangeId, currentDay: number): DayRange {
  const len = financeRangeDays(id);
  const current = financeRangeWindow(id, currentDay);
  return { fromDay: current.fromDay - len, toDay: current.fromDay - 1 };
}

/** One headline figure: value, its period-over-period move, and its shape. */
export interface FinanceStat {
  readonly id: string;
  readonly label: string;
  /** Pre-formatted headline figure, or the empty dash when nothing happened. */
  readonly value: string;
  /** Absent when there is no comparable prior period, or nothing to compare. */
  readonly delta?: string;
  readonly deltaContext?: string;
  readonly trend: TrendDirection;
  /** Sparkline series, oldest→newest. Absent on stats with no honest daily shape. */
  readonly series?: readonly number[];
  /** True when the window holds no activity — the card shows its empty state. */
  readonly empty: boolean;
  /** Why the card is blank, when it is. */
  readonly emptyNote?: string;
}

export interface FinanceHeroChart {
  readonly title: string;
  readonly caption: string;
  readonly data: readonly BarDatum[];
  readonly emptyLabel: string;
}

export interface FinanceDonut {
  readonly title: string;
  readonly caption: string;
  readonly data: readonly DonutDatum[];
  readonly centerValue: string;
  readonly centerLabel: string;
  readonly emptyLabel: string;
}

export interface FinanceBars {
  readonly title: string;
  readonly caption: string;
  readonly data: readonly BarDatum[];
  readonly emptyLabel: string;
}

export interface FinanceDashboardModel {
  readonly ranges: readonly FinanceRangeOption[];
  readonly selectedRangeId: FinanceRangeId;
  /** e.g. "Day 12 · last 7 days" — states the window the whole page is showing. */
  readonly rangeCaption: string;
  /** False ⇒ every card renders its empty state rather than a zero. */
  readonly hasActivity: boolean;
  readonly headline: readonly FinanceStat[];
  readonly hero: FinanceHeroChart;
  readonly grossMix: FinanceDonut;
  readonly expenses: FinanceBars;
  /**
   * The windowed KPI snapshot, passed straight through to the shared
   * `KPIDashboard` block — the one component that decides how a KPI row reads,
   * used identically here and in the month-close interstitial. Reformatting
   * these into a second row of strings would be a second answer to the same
   * question.
   */
  readonly kpi: KPISnapshot;
}

export interface FinanceDashboardInputs {
  readonly rangeId: FinanceRangeId;
  readonly currentDay: number;
  /** KPIs over the selected window. */
  readonly kpi: KPISnapshot;
  /** KPIs over the immediately preceding window of the same length. */
  readonly priorKpi: KPISnapshot;
  /** P&L over the selected window. */
  readonly pnl: PnLSummary;
  /** P&L over the immediately preceding window. */
  readonly priorPnl: PnLSummary;
  /** Per-day retail flow across the selected window, oldest→newest. */
  readonly daily: readonly KPIDayTotals[];
  /** True when the prior window contains at least one real day (day ≥ 1). */
  readonly hasPriorWindow: boolean;
}

const EMPTY_VALUE = '—';

export function money(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Period-over-period move as a percentage of the prior figure. Returns
 * `undefined` — not "+100%" — when there is no prior period or the prior figure
 * was zero: a percentage change from nothing is not a fact about the business.
 */
function delta(
  current: number,
  prior: number,
  hasPrior: boolean,
): { text: string; trend: TrendDirection } | undefined {
  if (!hasPrior || prior === 0) return undefined;
  const change = (current - prior) / Math.abs(prior);
  if (Math.abs(change) < 0.005) return { text: '0%', trend: 'flat' };
  const text = `${change > 0 ? '+' : '-'}${Math.round(Math.abs(change) * 100)}%`;
  return { text, trend: change > 0 ? 'up' : 'down' };
}

function stat(
  id: string,
  label: string,
  current: number,
  prior: number,
  format: (n: number) => string,
  opts: {
    hasPrior: boolean;
    rangeId: FinanceRangeId;
    empty: boolean;
    emptyNote: string;
    series?: readonly number[];
  },
): FinanceStat {
  if (opts.empty) {
    return { id, label, value: EMPTY_VALUE, trend: 'flat', empty: true, emptyNote: opts.emptyNote };
  }
  const d = delta(current, prior, opts.hasPrior);
  return {
    id,
    label,
    value: format(current),
    ...(d ? { delta: d.text, deltaContext: PRIOR_PHRASE[opts.rangeId] } : {}),
    trend: d?.trend ?? 'flat',
    ...(opts.series ? { series: opts.series } : {}),
    empty: false,
  };
}

/**
 * The hero trend chart's buckets. A quarter is 91 bars, which is a texture and
 * not a chart, so long windows aggregate into equal-width blocks; short ones
 * stay per-day. The bucket count is capped rather than the width scaled so the
 * bars stay wide enough to read at phone width.
 */
const MAX_HERO_BUCKETS = 13;

export function bucketDaily(
  daily: readonly KPIDayTotals[],
): readonly { label: string; days: readonly KPIDayTotals[] }[] {
  if (daily.length === 0) return [];
  if (daily.length <= MAX_HERO_BUCKETS) {
    return daily.map((d) => ({ label: `D${d.day}`, days: [d] }));
  }
  const size = Math.ceil(daily.length / MAX_HERO_BUCKETS);
  const out: { label: string; days: readonly KPIDayTotals[] }[] = [];
  for (let i = 0; i < daily.length; i += size) {
    const chunk = daily.slice(i, i + size);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    // The label names the bucket's span, not its index — "D8" and "D8–14" are
    // both a day range the player can find on the calendar.
    out.push({
      label: first.day === last.day ? `D${first.day}` : `D${first.day}–${last.day}`,
      days: chunk,
    });
  }
  return out;
}

/**
 * Where the money went, grouped by the ledger's human-readable label (#351).
 * Labels are already the grouping Economy writes them for; the top few by size
 * are shown and the long tail folds into one "Other" so the chart names the
 * spend that actually moved the period.
 */
const MAX_EXPENSE_BARS = 5;

export function groupExpenses(
  entries: readonly LedgerEntry[],
): readonly { label: string; amount: number }[] {
  const byLabel = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    byLabel.set(e.label, (byLabel.get(e.label) ?? 0) + e.amount);
  }
  const sorted = [...byLabel.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
  if (sorted.length <= MAX_EXPENSE_BARS) return sorted;
  const head = sorted.slice(0, MAX_EXPENSE_BARS);
  const tail = sorted.slice(MAX_EXPENSE_BARS);
  return [
    ...head,
    { label: 'Other', amount: tail.reduce((s, e) => s + e.amount, 0) },
  ];
}

export function buildFinanceDashboard(
  inputs: FinanceDashboardInputs,
): FinanceDashboardModel {
  const { rangeId, currentDay, kpi, priorKpi, pnl, priorPnl, daily, hasPriorWindow } = inputs;
  const hasDeals = kpi.unitsRetailed > 0;
  const hasLedger = pnl.entries.length > 0;
  const hasActivity = hasDeals || hasLedger;
  // Total gross is the two funding buckets added, not an average multiplied
  // back out — the buckets are exact sums and the averages are not.
  const gross = kpi.cashGross + kpi.financeGross;
  const priorGross = priorKpi.cashGross + priorKpi.financeGross;

  const noDeals = 'No deals closed in this window.';
  const headline: readonly FinanceStat[] = [
    stat('units', 'Units Retailed', kpi.unitsRetailed, priorKpi.unitsRetailed, (n) => String(n), {
      hasPrior: hasPriorWindow,
      rangeId,
      empty: !hasDeals,
      emptyNote: noDeals,
      series: daily.map((d) => d.units),
    }),
    stat('gross', 'Total Gross', gross, priorGross, money, {
      hasPrior: hasPriorWindow,
      rangeId,
      empty: !hasDeals,
      emptyNote: noDeals,
      series: daily.map((d) => d.gross),
    }),
    stat('net', 'Net Income', pnl.netIncome, priorPnl.netIncome, money, {
      hasPrior: hasPriorWindow,
      rangeId,
      empty: !hasLedger,
      emptyNote: 'Nothing has been posted to the books in this window.',
    }),
    // PVR carries no sparkline on purpose: it is undefined on a day with no
    // units, so a per-day series would draw zeroes on quiet days and read as a
    // collapse in per-deal profitability that never happened.
    stat('pvr', 'PVR', kpi.pvr, priorKpi.pvr, money, {
      hasPrior: hasPriorWindow,
      rangeId,
      empty: !hasDeals,
      emptyNote: noDeals,
    }),
  ];

  const buckets = bucketDaily(daily);
  const hero: FinanceHeroChart = {
    title: 'Gross Written',
    caption: `Front + back gross across ${RANGE_PHRASE[rangeId]}.`,
    data: buckets.map((b) => ({
      label: b.label,
      value: b.days.reduce((s, d) => s + d.gross, 0),
      valueLabel: money(b.days.reduce((s, d) => s + d.gross, 0)),
    })),
    emptyLabel: 'No gross written in this window.',
  };

  const grossMix: FinanceDonut = {
    title: 'How They Paid',
    caption: 'Gross split by how the deal was funded.',
    data: [
      { label: 'Cash', value: kpi.cashGross },
      { label: 'Financed', value: kpi.financeGross },
    ],
    centerValue: hasDeals ? String(kpi.unitsRetailed) : EMPTY_VALUE,
    centerLabel: kpi.unitsRetailed === 1 ? 'unit' : 'units',
    emptyLabel: noDeals,
  };

  const grouped = groupExpenses(pnl.entries);
  const expenses: FinanceBars = {
    title: 'Where the Money Went',
    caption: `Expenses posted across ${RANGE_PHRASE[rangeId]}, largest first.`,
    data: grouped.map((g) => ({
      label: g.label,
      value: g.amount,
      valueLabel: money(g.amount),
    })),
    emptyLabel: 'Nothing was spent in this window.',
  };

  const window = financeRangeWindow(rangeId, currentDay);
  const spanned = window.toDay - window.fromDay + 1;
  const rangeCaption =
    rangeId === 'today'
      ? `Day ${currentDay}`
      : `Day ${window.fromDay}–${window.toDay} · ${spanned} day${spanned === 1 ? '' : 's'}`;

  return {
    ranges: FINANCE_RANGES,
    selectedRangeId: rangeId,
    rangeCaption,
    hasActivity,
    headline,
    hero,
    grossMix,
    expenses,
    kpi,
  };
}

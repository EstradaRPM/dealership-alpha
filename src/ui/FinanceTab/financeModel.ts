import type { DayRange, KPIDayTotals, KPISnapshot } from '../../game/KPIDashboard';
import { PROFIT_CENTER_LABELS } from '../../game/Economy';
import type { DepartmentPnLSummary, LedgerEntry, PnLSummary } from '../../game/Economy';
import { CREDIT_INTEREST_LABEL } from '../../game/CreditFacility';
import { compactMoney, domainFraction, money, signedDomain } from '../kit';
import type { BarDatum, DonutDatum, LineSeries, TrendDirection } from '../kit';
import { emptyState } from '../copy';

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
 * Whether the period-over-period delta has an honest comparison base (#376).
 *
 * The test is that the prior window fits **entirely** inside the career, not
 * merely that it overlaps it: on day 10 the "7D" chip's prior window reaches
 * back to day −3, and comparing seven traded days against the three that
 * actually happened reports a collapse the store never had. A clamped prior
 * window is a shorter window, and two spans of different lengths are not a
 * period-over-period move.
 */
export function financeHasPriorWindow(id: FinanceRangeId, currentDay: number): boolean {
  return financePriorWindow(id, currentDay).fromDay >= 1;
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

/**
 * The three P&L lines over the window (#376). Bucketed on the *same* boundaries
 * as the gross hero, so the two charts sit above each other and read against
 * each other rather than against two different clocks.
 */
export interface FinanceTrendChart {
  readonly title: string;
  readonly caption: string;
  /** Bucket labels, shared with the hero chart. Empty ⇒ the empty state. */
  readonly labels: readonly string[];
  readonly series: readonly LineSeries[];
  readonly emptyLabel: string;
}

/**
 * One line on the gross→net statement (#376). `amount` is the signed figure the
 * line contributes, so the arithmetic can be checked without parsing money out
 * of a string, and `value` is how it reads.
 */
export interface FinanceStatementLine {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly amount: number;
  /**
   * `department` lines add up to the `subtotal`; the `deduction` comes off it;
   * the `total` is what is left. The surface reads this to weight a line, and
   * a test reads it to check the ladder adds up.
   */
  readonly kind: 'department' | 'subtotal' | 'deduction' | 'total';
}

export interface FinanceStatement {
  readonly title: string;
  readonly caption: string;
  readonly lines: readonly FinanceStatementLine[];
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
  /**
   * What the gross was made of (#365) — front, F&I products, and finance
   * reserve. Products and reserve are stated as two bars rather than one "back
   * gross" bucket because they are earned by different things: product margin
   * comes from what attached, reserve from the rate the store held.
   */
  readonly grossBreakdown: FinanceBars;
  /**
   * Where the gross came from (#375) — gross per profit center. The store runs
   * four businesses out of one building and this is the only surface that says
   * which of them earned. A different axis from `grossBreakdown`, which cuts
   * the *sales* deal into its revenue lines.
   */
  readonly departmentGross: FinanceBars;
  /**
   * The statement itself (#376) — what came in, what went out, and what was
   * left, across the window. The hero charts *gross*; this charts the P&L, and
   * net income is the line that can go below zero.
   */
  readonly pnlTrend: FinanceTrendChart;
  /**
   * Departmental gross → less store overhead → net income (#376), stated as a
   * ladder the player can follow line by line. This is where a fat service
   * month visibly paid for a thin sales month, which is the load-bearing
   * reading of a real dealership's month-end.
   */
  readonly statement: FinanceStatement;
  /** Back-end gross per car by deal structure (#152). */
  readonly backEndByStructure: FinanceBars;
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
  /** The same window cut by profit center (#375). */
  readonly departmentPnl: DepartmentPnLSummary;
  /** Per-day retail flow across the selected window, oldest→newest. */
  readonly daily: readonly KPIDayTotals[];
  /** True when the prior window contains at least one real day (day ≥ 1). */
  readonly hasPriorWindow: boolean;
}

const EMPTY_VALUE = '—';

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

/** One day's three P&L lines. `net` is `revenue − expenses` and may be negative. */
export interface PnLDayTotals {
  readonly day: number;
  readonly revenue: number;
  readonly expenses: number;
  readonly net: number;
}

/**
 * The P&L per day across the window (#376), read off the ledger entries the
 * summary already carries.
 *
 * No new engine read: `PnLSummary.entries` is exactly the set the totals are
 * computed from — accrual, with `inventoryAcquisition` already dropped — and
 * every entry is day-stamped. Asking Economy for one summary per bucket would
 * be the same filter run thirteen times and would let the chart's arithmetic
 * drift from the Net Income printed above it.
 *
 * `days` is the window's day list (every day, traded or not), so a quiet day is
 * a zero in the series rather than a gap — a series that skips its quiet days
 * draws a shape the business never had.
 */
export function dailyPnL(
  entries: readonly LedgerEntry[],
  days: readonly number[],
): readonly PnLDayTotals[] {
  const byDay = new Map<number, { revenue: number; expenses: number }>();
  for (const e of entries) {
    const bucket = byDay.get(e.day) ?? { revenue: 0, expenses: 0 };
    if (e.type === 'revenue') bucket.revenue += e.amount;
    else bucket.expenses += e.amount;
    byDay.set(e.day, bucket);
  }
  return days.map((day) => {
    const b = byDay.get(day) ?? { revenue: 0, expenses: 0 };
    return { day, revenue: b.revenue, expenses: b.expenses, net: b.revenue - b.expenses };
  });
}

/**
 * A raw series mapped into the [0,1] samples `Sparkline` draws (#376).
 *
 * The kit primitive takes normalized samples because only the caller knows
 * where the meaningful baseline is, and this caller's baseline is **zero** —
 * every headline figure here is a money-or-count flow, so a bar half as tall
 * must mean half as much. Handing it raw dollars (which is what shipped before
 * #376) clamps every figure over 1 to the top of the plot, and the trend of a
 * store writing $2k, $6k and $3k days draws as a flat line.
 *
 * The domain includes zero on both sides, so a negative day — Net Income is the
 * one headline that has them — sits below where zero sits rather than on the
 * floor.
 */
export function normalizeSeries(values: readonly number[]): readonly number[] {
  const domain = signedDomain([...values]);
  return values.map((v) => domainFraction(v, domain));
}

/**
 * Where the money went, grouped by the ledger's human-readable label (#351).
 * Labels are already the grouping Economy writes them for; the top few by size
 * are shown and the long tail folds into one "Other" so the chart names the
 * spend that actually moved the period.
 */
const MAX_EXPENSE_BARS = 5;

/**
 * Labels the tail fold may never swallow (#393).
 *
 * Every other cost on this chart is the price of running the store, and folding
 * the small ones into "Other" is the chart naming what actually moved the
 * period. Credit-line interest is different in kind: it is the price of a
 * standing decision the player can end with a button **on this same screen**,
 * and a cost you are asked to act on cannot be a cost the chart hides. On a
 * $50,000 line it is a couple of dollars a day against a payroll of hundreds, so
 * without this it would be folded away in every window that mattered.
 */
const PINNED_EXPENSE_LABELS: readonly string[] = [CREDIT_INTEREST_LABEL];

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

  const pinned = sorted.filter((e) => PINNED_EXPENSE_LABELS.includes(e.label));
  const rest = sorted.filter((e) => !PINNED_EXPENSE_LABELS.includes(e.label));
  // The pinned lines take their slots first; what is left of the budget goes to
  // the biggest of the rest, and the named set is re-sorted by size so the chart
  // still reads largest-first however a line earned its place.
  const head = rest.slice(0, Math.max(0, MAX_EXPENSE_BARS - pinned.length));
  const tail = rest.slice(head.length);
  const named = [...pinned, ...head].sort((a, b) => b.amount - a.amount);
  if (tail.length === 0) return named;
  return [
    ...named,
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

  // The P&L per day, off the entries the summary already carries. Both the Net
  // Income sparkline and the trend chart are read from this one series, so the
  // card and the chart beside it cannot disagree about the same window.
  const pnlDays = dailyPnL(pnl.entries, daily.map((d) => d.day));

  const noDeals = emptyState('finance_no_deals');
  const headline: readonly FinanceStat[] = [
    stat('units', 'Units Retailed', kpi.unitsRetailed, priorKpi.unitsRetailed, (n) => String(n), {
      hasPrior: hasPriorWindow,
      rangeId,
      empty: !hasDeals,
      emptyNote: noDeals,
      series: normalizeSeries(daily.map((d) => d.units)),
    }),
    stat('gross', 'Total Gross', gross, priorGross, money, {
      hasPrior: hasPriorWindow,
      rangeId,
      empty: !hasDeals,
      emptyNote: noDeals,
      series: normalizeSeries(daily.map((d) => d.gross)),
    }),
    // #376: Net Income was the one headline card with no shape at all, which
    // made the single number look like a verdict rather than a trajectory. Its
    // series is the per-day net — the only one of the four that goes negative,
    // which is why the normalized domain has to hold zero.
    stat('net', 'Net Income', pnl.netIncome, priorPnl.netIncome, money, {
      hasPrior: hasPriorWindow,
      rangeId,
      empty: !hasLedger,
      emptyNote: emptyState('finance_no_postings'),
      series: normalizeSeries(pnlDays.map((d) => d.net)),
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
    emptyLabel: emptyState('finance_no_gross'),
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

  // #365: the back end is two different businesses, so it is stated as two
  // bars. Summed off the day series rather than off the averages — the series
  // is exact and an average multiplied back out is not.
  const frontTotal = daily.reduce((s, d) => s + d.frontGross, 0);
  const grossBreakdown: FinanceBars = {
    title: 'What the Gross Was Made Of',
    caption: 'Margin on the metal, on the F&I products, and on the rate.',
    data: [
      { label: 'Vehicle', value: frontTotal, valueLabel: money(frontTotal) },
      { label: 'F&I Products', value: kpi.productGross, valueLabel: money(kpi.productGross) },
      // "Rate Reserve", not "Finance Reserve": the horizontal bar chart's name
      // column clips at ~13 characters, and a half-read label is worse than a
      // shorter one. The caption carries the full sentence.
      { label: 'Rate Reserve', value: kpi.reserveGross, valueLabel: money(kpi.reserveGross) },
    ],
    emptyLabel: noDeals,
  };

  // #375: which of the store's four businesses made the money. A department
  // that posted nothing in the window is OMITTED rather than drawn at zero — a
  // Tier-1 store has no service lane and no body shop, and a flat bar labelled
  // "Body Shop" says it lost money on collision work it never did. `active`
  // (not `gross !== 0`) is the test, so a department that spent on parts and
  // billed nothing still shows its negative bar.
  const departmentGross: FinanceBars = {
    title: 'Where the Gross Came From',
    caption:
      'Gross by department — revenue less what it cost to deliver. ' +
      `Store overhead of ${money(inputs.departmentPnl.overhead)} sits below this ` +
      'and is what the four have to cover.',
    data: inputs.departmentPnl.departments
      .filter((d) => d.active)
      .map((d) => ({
        label: PROFIT_CENTER_LABELS[d.center],
        value: d.gross,
        valueLabel: money(d.gross),
      })),
    emptyLabel: emptyState('finance_no_departments'),
  };

  // #376: the statement over time. Bucketed off the SAME `buckets` the hero
  // chart is built from — one call, not two computations that agree today — so
  // "Gross Written" and this sit on identical boundaries and can be read
  // against each other. A window with nothing posted ships no series at all,
  // because a flat line at zero is a claim the store broke even.
  const netByDay = new Map(pnlDays.map((d) => [d.day, d]));
  const sumBucket = (
    b: { days: readonly KPIDayTotals[] },
    pick: (d: PnLDayTotals) => number,
  ): number => b.days.reduce((s, d) => s + (netByDay.has(d.day) ? pick(netByDay.get(d.day)!) : 0), 0);
  const trendBuckets = hasLedger ? buckets : [];
  const pnlTrend: FinanceTrendChart = {
    title: 'What Came In, What Went Out',
    caption:
      `Revenue, spending and what was left across ${RANGE_PHRASE[rangeId]}. ` +
      'What was left is the only one of the three that can drop below the line.',
    labels: trendBuckets.map((b) => b.label),
    series: trendBuckets.length
      ? [
          // The three lines take semantic roles rather than categorical slots:
          // money in, money out and what survived are exactly what `positive`,
          // `danger` and `primary` mean, and a palette hue here would strip the
          // meaning the reader already has.
          {
            label: 'Came in',
            tone: 'positive',
            values: trendBuckets.map((b) => sumBucket(b, (d) => d.revenue)),
          },
          {
            label: 'Went out',
            tone: 'danger',
            values: trendBuckets.map((b) => sumBucket(b, (d) => d.expenses)),
          },
          {
            label: 'Left over',
            tone: 'primary',
            values: trendBuckets.map((b) => sumBucket(b, (d) => d.net)),
          },
        ]
      : [],
    emptyLabel: emptyState('finance_no_postings'),
  };

  // #376: the ladder. Departmental gross → less store overhead → what was left.
  // The same `active` rule the bars use, for the same reason: a Tier-1 store
  // has no body shop, and a "Body Shop $0" line on a statement asserts a
  // department that broke even rather than one that does not exist.
  //
  // Every figure is rounded to whole dollars ONCE, and each summed line is the
  // sum of the rounded lines above it — so the ladder adds up on screen. Six
  // independently rounded cents' worth of residue is what made a live 30-day
  // window print $2,713 + $35,479 = $38,191, which is exactly the arithmetic
  // this panel promises the player they can follow.
  //
  // The residue lands on the overhead line, not on the bottom one: Net Income
  // is stated by the headline card six inches above and by `getDepartmentPnL`
  // itself, so it is the figure that must match everywhere, and a balancing
  // line absorbing rounding is how a real statement handles the same problem.
  const activeDepartments = inputs.departmentPnl.departments.filter((d) => d.active);
  const departmentLines = activeDepartments.map((d) => ({
    center: d.center,
    amount: Math.round(d.gross),
  }));
  const departmentTotal = departmentLines.reduce((s, d) => s + d.amount, 0);
  const netTotal = Math.round(inputs.departmentPnl.netIncome);
  const deduction = netTotal - departmentTotal;
  const statement: FinanceStatement = {
    title: 'From Gross to What You Kept',
    caption:
      'Each department earns its own gross. The store is run out of what they ' +
      'make together — so a strong month in one covers a thin month in another.',
    lines: hasLedger
      ? [
          ...departmentLines.map((d) => ({
            id: `dept-${d.center}`,
            label: PROFIT_CENTER_LABELS[d.center],
            value: money(d.amount),
            amount: d.amount,
            kind: 'department' as const,
          })),
          {
            id: 'departments-total',
            label: 'The departments together',
            value: money(departmentTotal),
            amount: departmentTotal,
            kind: 'subtotal' as const,
          },
          {
            // Stated as the negative it is, so the ladder reads as arithmetic
            // rather than as three unrelated figures the player must sign
            // themselves. Overhead is store expenses NET of store revenue, so
            // a store-level receipt legitimately makes this line positive —
            // which is what a pre-#375 save's untagged revenue does.
            id: 'overhead',
            label: 'Less what it costs to run the store',
            value: money(deduction),
            amount: deduction,
            kind: 'deduction' as const,
          },
          {
            id: 'net',
            label: 'Net Income',
            value: money(netTotal),
            amount: netTotal,
            kind: 'total' as const,
          },
        ]
      : [],
    emptyLabel: emptyState('finance_no_postings'),
  };

  // #152: the back end per car, by how much of the price the customer borrowed.
  // Stated PER UNIT rather than as window totals — a total here just reports
  // which structure was commonest, while the thing the player can act on is
  // that the same store earns a different back end on a big note than on a
  // cash deal. The three buckets are disjoint, so nothing is double-counted.
  const structures = kpi.backEndByStructure;
  const backEndByStructure: FinanceBars = {
    title: 'Back End per Deal',
    // The denominators ride the CAPTION, not the bar labels: the horizontal
    // chart reserves 56px for its value column and clips anything wider at the
    // plot edge, which is the same trap that shortened #365's reserve label. A
    // per-unit figure with no count invites reading one lucky cash deal as a
    // trend, so the counts have to be somewhere — they just cannot be there.
    caption:
      'F&I gross per car, by how much of the price the customer borrowed.' +
      // Only state the denominators when there are some — "averaged over 0
      // cash" on a quiet window reads as a broken sentence, not as a fact.
      (hasDeals
        ? ` Averaged over ${structures.cash.units} cash, ` +
          `${structures.standardFinance.units} little-down and ` +
          `${structures.heavyDown.units} large-down deals.`
        : ''),
    data: [
      {
        label: 'Cash',
        value: structures.cash.perUnit,
        valueLabel: money(structures.cash.perUnit),
      },
      {
        label: 'Little Down',
        value: structures.standardFinance.perUnit,
        valueLabel: money(structures.standardFinance.perUnit),
      },
      {
        label: 'Large Down',
        value: structures.heavyDown.perUnit,
        valueLabel: money(structures.heavyDown.perUnit),
      },
    ],
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
    emptyLabel: emptyState('finance_no_spend'),
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
    grossBreakdown,
    departmentGross,
    pnlTrend,
    statement,
    backEndByStructure,
    expenses,
    kpi,
  };
}

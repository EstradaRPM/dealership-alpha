import {
  buildFinanceDashboard,
  bucketDaily,
  groupExpenses,
  financeRangeWindow,
  financePriorWindow,
  financeRangeDays,
  type FinanceDashboardInputs,
} from '../src/ui/FinanceTab';
import { ZERO_KPI_SNAPSHOT } from '../src/game/KPIDashboard';
import type { KPIDayTotals, KPISnapshot } from '../src/game/KPIDashboard';
import type { LedgerEntry, PnLSummary } from '../src/game/Economy';

const ZERO_KPI: KPISnapshot = ZERO_KPI_SNAPSHOT;

const ZERO_PNL: PnLSummary = {
  totalRevenue: 0,
  totalExpenses: 0,
  netIncome: 0,
  entries: [],
};

function kpi(over: Partial<KPISnapshot>): KPISnapshot {
  return { ...ZERO_KPI, ...over };
}

function pnl(over: Partial<PnLSummary>): PnLSummary {
  return { ...ZERO_PNL, ...over };
}

function daily(rows: readonly (readonly [number, number, number])[]): KPIDayTotals[] {
  return rows.map(([day, units, gross]) => ({
    day,
    units,
    frontGross: gross,
    backGross: 0,
    productGross: 0,
    reserveGross: 0,
    gross,
  }));
}

function inputs(over: Partial<FinanceDashboardInputs> = {}): FinanceDashboardInputs {
  return {
    rangeId: '7d',
    currentDay: 10,
    kpi: ZERO_KPI,
    priorKpi: ZERO_KPI,
    pnl: ZERO_PNL,
    priorPnl: ZERO_PNL,
    daily: [],
    hasPriorWindow: true,
    ...over,
  };
}

const stat = (m: ReturnType<typeof buildFinanceDashboard>, id: string) => {
  const found = m.headline.find((s) => s.id === id);
  if (!found) throw new Error(`no headline stat ${id}`);
  return found;
};

describe('finance range windows (#351)', () => {
  it('ends the window on the current day and spans the range length', () => {
    expect(financeRangeWindow('today', 12)).toEqual({ fromDay: 12, toDay: 12 });
    expect(financeRangeWindow('7d', 12)).toEqual({ fromDay: 6, toDay: 12 });
    expect(financeRangeWindow('30d', 40)).toEqual({ fromDay: 11, toDay: 40 });
    expect(financeRangeWindow('quarter', 100)).toEqual({ fromDay: 10, toDay: 100 });
  });

  it('clamps at day 1 rather than reporting days the career never had', () => {
    expect(financeRangeWindow('30d', 4)).toEqual({ fromDay: 1, toDay: 4 });
    expect(financeRangeWindow('quarter', 1)).toEqual({ fromDay: 1, toDay: 1 });
  });

  it('puts the prior window immediately before the current one', () => {
    expect(financePriorWindow('7d', 20)).toEqual({ fromDay: 7, toDay: 13 });
    expect(financePriorWindow('today', 20)).toEqual({ fromDay: 19, toDay: 19 });
  });

  it('reports the quarter as the 91-day game season', () => {
    expect(financeRangeDays('quarter')).toBe(91);
  });
});

describe('finance headline stats (#351)', () => {
  it('formats the four headline figures off the windowed reads', () => {
    const m = buildFinanceDashboard(
      inputs({
        kpi: kpi({ unitsRetailed: 4, cashGross: 3_000, financeGross: 9_000, pvr: 3_000 }),
        pnl: pnl({ totalRevenue: 50_000, totalExpenses: 38_000, netIncome: 12_000, entries: [
          { day: 8, type: 'revenue', amount: 50_000, label: 'Sale' },
        ] }),
      }),
    );
    expect(stat(m, 'units').value).toBe('4');
    // Total gross is the two funding buckets added, never an average re-multiplied.
    expect(stat(m, 'gross').value).toBe('$12,000');
    expect(stat(m, 'net').value).toBe('$12,000');
    expect(stat(m, 'pvr').value).toBe('$3,000');
  });

  it('states the period-over-period move against the prior window', () => {
    const m = buildFinanceDashboard(
      inputs({
        kpi: kpi({ unitsRetailed: 6, cashGross: 6_000 }),
        priorKpi: kpi({ unitsRetailed: 4, cashGross: 8_000 }),
      }),
    );
    expect(stat(m, 'units').delta).toBe('+50%');
    expect(stat(m, 'units').trend).toBe('up');
    expect(stat(m, 'units').deltaContext).toBe('vs prior 7 days');
    expect(stat(m, 'gross').delta).toBe('-25%');
    expect(stat(m, 'gross').trend).toBe('down');
  });

  it('suppresses the delta when there is no prior window to compare against', () => {
    const m = buildFinanceDashboard(
      inputs({
        currentDay: 2,
        hasPriorWindow: false,
        kpi: kpi({ unitsRetailed: 3, cashGross: 9_000 }),
        priorKpi: kpi({ unitsRetailed: 0 }),
      }),
    );
    expect(stat(m, 'units').delta).toBeUndefined();
    expect(stat(m, 'units').trend).toBe('flat');
  });

  it('suppresses the delta when the prior figure was zero (no % change from nothing)', () => {
    const m = buildFinanceDashboard(
      inputs({ kpi: kpi({ unitsRetailed: 3, cashGross: 9_000 }) }),
    );
    expect(stat(m, 'units').delta).toBeUndefined();
  });

  it('renders each card empty rather than a zero that reads as a result', () => {
    const m = buildFinanceDashboard(inputs({ currentDay: 1, rangeId: 'today' }));
    expect(m.hasActivity).toBe(false);
    for (const s of m.headline) {
      expect(s.empty).toBe(true);
      expect(s.value).toBe('—');
      expect(s.emptyNote).toBeTruthy();
    }
  });

  it('gives the flow stats a daily series and PVR none', () => {
    const m = buildFinanceDashboard(
      inputs({
        kpi: kpi({ unitsRetailed: 2, cashGross: 4_000, pvr: 2_000 }),
        daily: daily([
          [4, 1, 2_000],
          [5, 0, 0],
          [6, 1, 2_000],
        ]),
      }),
    );
    expect(stat(m, 'units').series).toEqual([1, 0, 1]);
    expect(stat(m, 'gross').series).toEqual([2_000, 0, 2_000]);
    // PVR is undefined on a day with no units — a per-day series would draw a
    // collapse in per-deal profit that never happened.
    expect(stat(m, 'pvr').series).toBeUndefined();
  });

  it('names the window the whole page is showing', () => {
    expect(buildFinanceDashboard(inputs({ rangeId: 'today', currentDay: 9 })).rangeCaption)
      .toBe('Day 9');
    expect(buildFinanceDashboard(inputs({ rangeId: '7d', currentDay: 9 })).rangeCaption)
      .toBe('Day 3–9 · 7 days');
    // Early career: the "30 days" chip is honestly a shorter window.
    expect(buildFinanceDashboard(inputs({ rangeId: '30d', currentDay: 4 })).rangeCaption)
      .toBe('Day 1–4 · 4 days');
  });
});

describe('finance charts (#351)', () => {
  it('keeps one bar per day on short windows', () => {
    const buckets = bucketDaily(daily([[1, 1, 100], [2, 0, 0], [3, 2, 500]]));
    expect(buckets.map((b) => b.label)).toEqual(['D1', 'D2', 'D3']);
  });

  it('aggregates a long window into readable blocks labelled by day span', () => {
    const rows = Array.from({ length: 91 }, (_, i): readonly [number, number, number] => [
      i + 1,
      1,
      100,
    ]);
    const buckets = bucketDaily(daily(rows));
    expect(buckets.length).toBeLessThanOrEqual(13);
    expect(buckets[0].label).toBe('D1–7');
    // Every day lands in exactly one bucket — no day is dropped or double-counted.
    expect(buckets.reduce((s, b) => s + b.days.length, 0)).toBe(91);
  });

  it('groups the ledger by label, largest first, folding the tail into Other', () => {
    const entries: LedgerEntry[] = [
      { day: 1, type: 'expense', amount: 10_000, label: 'Auction purchase' },
      { day: 1, type: 'expense', amount: 2_000, label: 'Auction purchase' },
      { day: 2, type: 'expense', amount: 5_000, label: 'Payroll' },
      { day: 2, type: 'expense', amount: 400, label: 'Rent' },
      { day: 2, type: 'expense', amount: 300, label: 'Recon' },
      { day: 2, type: 'expense', amount: 200, label: 'Marketing' },
      { day: 2, type: 'expense', amount: 100, label: 'Supplies' },
      { day: 2, type: 'expense', amount: 50, label: 'Carrying' },
      // Revenue never appears in a spend breakdown.
      { day: 2, type: 'revenue', amount: 90_000, label: 'Sale' },
    ];
    const grouped = groupExpenses(entries);
    expect(grouped[0]).toEqual({ label: 'Auction purchase', amount: 12_000 });
    expect(grouped[1]).toEqual({ label: 'Payroll', amount: 5_000 });
    expect(grouped[grouped.length - 1]).toEqual({ label: 'Other', amount: 150 });
    expect(grouped.some((g) => g.label === 'Sale')).toBe(false);
  });

  it('builds the funding donut off the exact gross buckets', () => {
    const m = buildFinanceDashboard(
      inputs({ kpi: kpi({ unitsRetailed: 3, cashGross: 4_000, financeGross: 11_000 }) }),
    );
    expect(m.grossMix.data).toEqual([
      { label: 'Cash', value: 4_000 },
      { label: 'Financed', value: 11_000 },
    ]);
    expect(m.grossMix.centerValue).toBe('3');
    expect(m.grossMix.centerLabel).toBe('units');
  });

  // #365: the gross breakdown states products and reserve separately. One
  // undifferentiated "back gross" bar cannot tell the player whether the month
  // was carried by what attached or by the rate the store held.
  it('the gross breakdown separates products from reserve', () => {
    const m = buildFinanceDashboard(
      inputs({
        kpi: kpi({ unitsRetailed: 4, productGross: 3_200, reserveGross: 900 }),
        daily: daily([
          [4, 2, 6_000],
          [5, 2, 5_000],
        ]),
      }),
    );
    const labels = m.grossBreakdown.data.map((d) => d.label);
    expect(labels).toEqual(['Vehicle', 'F&I Products', 'Rate Reserve']);
    const byLabel = Object.fromEntries(m.grossBreakdown.data.map((d) => [d.label, d.value]));
    expect(byLabel['F&I Products']).toBe(3_200);
    expect(byLabel['Rate Reserve']).toBe(900);
    // Front is summed off the exact day series, not an average multiplied back.
    expect(byLabel['Vehicle']).toBe(11_000);
  });

  // #152: attach scales with the amount financed, so the back end per car
  // differs by structure. Per unit rather than as totals — a total only reports
  // which structure was commonest that month.
  it('states the back end per car for each deal structure', () => {
    const m = buildFinanceDashboard(
      inputs({
        kpi: kpi({
          unitsRetailed: 6,
          backEndByStructure: {
            cash: { units: 2, backGross: 800, productGross: 800, reserveGross: 0, perUnit: 400 },
            standardFinance: {
              units: 3,
              backGross: 6_300,
              productGross: 5_400,
              reserveGross: 900,
              perUnit: 2_100,
            },
            heavyDown: {
              units: 1,
              backGross: 1_200,
              productGross: 1_080,
              reserveGross: 120,
              perUnit: 1_200,
            },
          },
        }),
      }),
    );
    expect(m.backEndByStructure.data.map((d) => d.label)).toEqual([
      'Cash',
      'Little Down',
      'Large Down',
    ]);
    expect(m.backEndByStructure.data.map((d) => d.value)).toEqual([400, 2_100, 1_200]);
    expect(m.backEndByStructure.data.map((d) => d.valueLabel)).toEqual([
      '$400',
      '$2,100',
      '$1,200',
    ]);
    // The denominators ride the caption rather than the bars: a per-unit figure
    // with no count invites reading one lucky cash deal as a trend, and the
    // chart's 56px value column clips anything longer than the money figure
    // (the #365 label-clipping lesson).
    expect(m.backEndByStructure.caption).toContain(
      'Averaged over 2 cash, 3 little-down and 1 large-down deals.',
    );
  });

  it('passes the windowed KPI snapshot straight through to the shared block', () => {
    const windowed = kpi({ unitsRetailed: 7 });
    expect(buildFinanceDashboard(inputs({ kpi: windowed })).kpi).toBe(windowed);
  });

  it('ships an empty label on every chart so a blank plot is never ambiguous', () => {
    const m = buildFinanceDashboard(inputs());
    expect(m.hero.emptyLabel).toBeTruthy();
    expect(m.grossMix.emptyLabel).toBeTruthy();
    expect(m.grossBreakdown.emptyLabel).toBeTruthy();
    expect(m.backEndByStructure.emptyLabel).toBeTruthy();
    expect(m.expenses.emptyLabel).toBeTruthy();
  });
});

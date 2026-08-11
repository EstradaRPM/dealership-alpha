import React from 'react';
import { render } from '@testing-library/react-native';
import { buildStoreWorth } from '../src/ui/StoreWorth';
import {
  FinanceTab,
  buildFinanceDashboard,
  financeHasPriorWindow,
  compactMoney,
  dailyPnL,
} from '../src/ui/FinanceTab';
import type { FinanceDashboardInputs } from '../src/ui/FinanceTab';
import { LineChart, signedDomain, signedTicks, linePoints } from '../src/ui/kit';
import { ZERO_KPI_SNAPSHOT } from '../src/game/KPIDashboard';
import type { KPIDayTotals } from '../src/game/KPIDashboard';
import { DEPARTMENT_CENTERS } from '../src/game/Economy';
import type {
  DepartmentPnLSummary,
  LedgerEntry,
  PnLSummary,
  ProfitCenter,
} from '../src/game/Economy';

// #380: the room's position header. Fixed here — these suites are about the
// windowed readings below it.
const WORTH = buildStoreWorth({ cash: 120_000, stockValue: 80_000, total: 200_000 });

/**
 * #376 — the P&L proper.
 *
 * The room used to chart *gross* and print Net Income as a bare number: it could
 * say what came in by revenue line and what went out by ledger label, and could
 * not show the statement those two sides make. This covers the two halves that
 * fixed it — the three P&L lines over time, and the departmental-gross → store
 * overhead → net ladder.
 */

function ledger(rows: readonly (readonly [number, 'revenue' | 'expense', number, string])[]): LedgerEntry[] {
  return rows.map(([day, type, amount, label]) => ({ day, type, amount, label }));
}

function pnlOf(entries: readonly LedgerEntry[]): PnLSummary {
  const totalRevenue = entries.filter((e) => e.type === 'revenue').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  return { totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses, entries };
}

function days(from: number, to: number): KPIDayTotals[] {
  const out: KPIDayTotals[] = [];
  for (let day = from; day <= to; day++) {
    out.push({ day, units: 0, frontGross: 0, backGross: 0, productGross: 0, reserveGross: 0, gross: 0 });
  }
  return out;
}

function deptPnl(
  lines: Partial<Record<ProfitCenter, { revenue: number; costOfSale: number }>>,
  overhead = 0,
): DepartmentPnLSummary {
  const departments = DEPARTMENT_CENTERS.map((center) => {
    const line = lines[center];
    return {
      center,
      revenue: line?.revenue ?? 0,
      costOfSale: line?.costOfSale ?? 0,
      gross: (line?.revenue ?? 0) - (line?.costOfSale ?? 0),
      active: line !== undefined,
    };
  });
  return {
    departments,
    overhead,
    netIncome: departments.reduce((s, d) => s + d.gross, 0) - overhead,
  };
}

const ZERO_DEPT = deptPnl({});

function model(over: Partial<FinanceDashboardInputs> = {}) {
  return buildFinanceDashboard({
    rangeId: '7d',
    currentDay: 7,
    kpi: ZERO_KPI_SNAPSHOT,
    priorKpi: ZERO_KPI_SNAPSHOT,
    pnl: pnlOf([]),
    priorPnl: pnlOf([]),
    departmentPnl: ZERO_DEPT,
    daily: days(1, 7),
    hasPriorWindow: true,
    ...over,
  });
}

function renderTab(m: ReturnType<typeof buildFinanceDashboard>) {
  return render(
    <FinanceTab
      model={m}
      storeWorth={WORTH}
      onSelectRange={() => {}}
      onOpenHistory={() => {}}
      onOpenMonthResults={() => {}}
    />,
  );
}

/** A week that earned, then a week that did not. */
const TRADING_WEEK = ledger([
  [1, 'revenue', 20_000, 'Vehicle sale'],
  [1, 'expense', 15_000, 'Cost of vehicle sold'],
  [3, 'revenue', 30_000, 'Vehicle sale'],
  [3, 'expense', 24_000, 'Cost of vehicle sold'],
  [5, 'expense', 9_000, 'Payroll'],
  [7, 'revenue', 1_200, 'Service: ticket'],
]);

describe('Finance — the P&L over time (#376)', () => {
  it('charts all three P&L lines, not just gross', () => {
    const m = model({ pnl: pnlOf(TRADING_WEEK) });
    expect(m.pnlTrend.series.map((s) => s.label)).toEqual(['Came in', 'Went out', 'Left over']);

    // Revenue and expenses each total the window; what is left is the P&L's own
    // net income, so the chart and the headline card cannot disagree.
    const total = (label: string) =>
      m.pnlTrend.series.find((s) => s.label === label)!.values.reduce((a, b) => a + b, 0);
    expect(total('Came in')).toBe(51_200);
    expect(total('Went out')).toBe(48_000);
    expect(total('Left over')).toBe(3_200);

    const { getByTestId } = renderTab(m);
    expect(getByTestId('finance-pnl-trend-chart')).toBeTruthy();
  });

  it('the two charts share a bucketing', () => {
    // A 91-day quarter is bucketed into blocks; the trend must land on exactly
    // the blocks the gross hero used, or the two charts sit above each other
    // showing the same window on two different clocks.
    const m = model({
      rangeId: 'quarter',
      currentDay: 91,
      daily: days(1, 91),
      pnl: pnlOf(TRADING_WEEK),
    });
    expect(m.pnlTrend.labels).toEqual(m.hero.data.map((d) => d.label));
    expect(m.pnlTrend.labels.length).toBeGreaterThan(1);
    for (const s of m.pnlTrend.series) {
      expect(s.values).toHaveLength(m.pnlTrend.labels.length);
    }
  });

  it('a losing week renders below the line', () => {
    // Day 5's only post is payroll, so that bucket's net is negative. The value
    // must survive into the series as a negative...
    const m = model({ pnl: pnlOf(TRADING_WEEK) });
    const left = m.pnlTrend.series.find((s) => s.label === 'Left over')!;
    expect(left.values[4]).toBe(-9_000);
    expect(Math.min(...left.values)).toBeLessThan(0);

    // ...and the chart must place it below zero rather than on the plot floor.
    // The domain always contains zero, so the baseline is a real position.
    const domain = signedDomain([...left.values]);
    expect(domain.min).toBeLessThan(0);
    expect(signedTicks(domain)).toContain(0);
    const points = linePoints(left.values, domain, 200, 100);
    const zeroY = points[Math.max(0, left.values.indexOf(0))];
    expect(zeroY).toBeTruthy();
    // Screen y grows downward, so "below the line" is a LARGER y than zero's.
    const yOfZero = 100 - 100 * ((0 - domain.min) / (domain.max - domain.min));
    expect(points[4]!.y).toBeGreaterThan(yOfZero);

    // The zero rule itself is drawn, so the reader has a line to be below.
    const { getByTestId } = render(
      <LineChart
        width={300}
        series={[{ label: 'Left over', values: left.values }]}
        testID="trend"
      />,
    );
    expect(getByTestId('trend-zero')).toBeTruthy();
  });

  it('a window that never lost money draws no zero rule to be below', () => {
    const { queryByTestId } = render(
      <LineChart width={300} series={[{ label: 'Left over', values: [1, 2, 3] }]} testID="trend" />,
    );
    expect(queryByTestId('trend-zero')).toBeNull();
  });

  it('an empty window reads as empty, not as break-even', () => {
    const m = model();
    expect(m.pnlTrend.series).toEqual([]);
    expect(m.pnlTrend.labels).toEqual([]);
    expect(m.statement.lines).toEqual([]);

    const { getAllByText } = renderTab(m);
    // Both halves say so rather than drawing a flat line at zero, which is a
    // claim the store traded and broke even.
    expect(getAllByText('Nothing has been posted to the books in this window.').length)
      .toBeGreaterThanOrEqual(2);
  });
});

describe('Finance — the gross-to-net statement (#376)', () => {
  const STORE = deptPnl(
    {
      sales: { revenue: 220_000, costOfSale: 178_000 },
      fni: { revenue: 9_400, costOfSale: 0 },
      service: { revenue: 12_000, costOfSale: 3_500 },
    },
    30_000,
  );

  it("the statement's lines sum to its own net income", () => {
    const m = model({ pnl: pnlOf(TRADING_WEEK), departmentPnl: STORE });
    const lines = m.statement.lines;

    const departments = lines.filter((l) => l.kind === 'department');
    expect(departments.map((l) => l.label)).toEqual(['Sales', 'F&I', 'Service']);

    const subtotal = lines.find((l) => l.kind === 'subtotal')!;
    const deduction = lines.find((l) => l.kind === 'deduction')!;
    const total = lines.find((l) => l.kind === 'total')!;

    // Every step is checkable off the line above it — that is what makes it a
    // statement rather than four cards.
    expect(departments.reduce((s, l) => s + l.amount, 0)).toBe(subtotal.amount);
    expect(deduction.amount).toBe(-30_000);
    expect(subtotal.amount + deduction.amount).toBe(total.amount);
    expect(total.amount).toBe(STORE.netIncome);
    expect(total.value).toBe('$29,900');
  });

  it('omits a department the store does not have, rather than stating it at zero', () => {
    const m = model({ pnl: pnlOf(TRADING_WEEK), departmentPnl: STORE });
    expect(m.statement.lines.some((l) => l.label === 'Body Shop')).toBe(false);

    const { queryByTestId, getByTestId } = renderTab(m);
    expect(queryByTestId('finance-statement-dept-bodyshop')).toBeNull();
    expect(getByTestId('finance-statement-net')).toBeTruthy();
  });

  it('adds up on screen even when every line carries cents', () => {
    // Found on a live 30-day window, which printed $2,713 + $35,479 = $38,191:
    // rounding each figure independently leaves a residue, and a statement that
    // does not add up is exactly the thing this panel promises it does.
    const centy = deptPnl(
      {
        sales: { revenue: 1_132.4, costOfSale: 0 },
        fni: { revenue: 1_581.4, costOfSale: 0 },
      },
      -35_479.4,
    );
    const m = model({ pnl: pnlOf(TRADING_WEEK), departmentPnl: centy });
    const lines = m.statement.lines;
    const amount = (kind: string) => lines.find((l) => l.kind === kind)!.amount;

    expect(lines.filter((l) => l.kind === 'department').reduce((s, l) => s + l.amount, 0))
      .toBe(amount('subtotal'));
    expect(amount('subtotal') + amount('deduction')).toBe(amount('total'));
    // Every figure is a whole dollar, so what is printed is what was summed.
    for (const l of lines) expect(Number.isInteger(l.amount)).toBe(true);
    // The bottom line still matches the Net Income headline card beside it —
    // the residue is absorbed by the balancing line, not by the total.
    expect(amount('total')).toBe(Math.round(centy.netIncome));
  });

  it('states a losing month as a negative bottom line', () => {
    const m = model({
      pnl: pnlOf(TRADING_WEEK),
      departmentPnl: deptPnl({ sales: { revenue: 20_000, costOfSale: 18_000 } }, 12_000),
    });
    const total = m.statement.lines.find((l) => l.kind === 'total')!;
    expect(total.amount).toBe(-10_000);
    expect(total.value).toBe('-$10,000');
  });
});

describe('Finance — headline series and deltas (#376)', () => {
  it('every headline card has a series', () => {
    const m = model({
      pnl: pnlOf(TRADING_WEEK),
      kpi: { ...ZERO_KPI_SNAPSHOT, unitsRetailed: 2, cashGross: 5_000, pvr: 2_500 },
    });
    // Net Income was the card that had none — it printed a verdict with no
    // trajectory. PVR is the deliberate exemption: it is undefined on a day
    // with no units, so a per-day series draws zeroes on quiet days and reads
    // as a collapse in per-deal profitability that never happened.
    for (const s of m.headline) {
      if (s.id === 'pvr') {
        expect(s.series).toBeUndefined();
        continue;
      }
      expect(s.series).toBeDefined();
      expect(s.series!.length).toBeGreaterThan(0);
    }
    expect(m.headline.find((s) => s.id === 'net')!.series).toBeDefined();
  });

  it('normalizes a sparkline series instead of clamping every figure to the top', () => {
    // The kit primitive takes [0,1] samples. Handing it raw dollars drew a
    // $2k day and a $6k day at exactly the same height.
    const m = model({
      pnl: pnlOf(ledger([
        [1, 'revenue', 2_000, 'Sale'],
        [2, 'revenue', 6_000, 'Sale'],
      ])),
    });
    const net = m.headline.find((s) => s.id === 'net')!.series!;
    for (const v of net) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(new Set(net).size).toBeGreaterThan(1);
  });

  it('day 3 shows no month-over-month delta', () => {
    // The "30D" chip on day 3 has no prior month at all.
    expect(financeHasPriorWindow('30d', 3)).toBe(false);
    // And a prior window that merely *overlaps* the career is still the wrong
    // comparison: seven days against the three that happened is a collapse
    // that is only the clamp.
    expect(financeHasPriorWindow('7d', 10)).toBe(false);
    expect(financeHasPriorWindow('7d', 14)).toBe(true);

    const m = model({
      currentDay: 3,
      rangeId: '30d',
      daily: days(1, 3),
      hasPriorWindow: financeHasPriorWindow('30d', 3),
      pnl: pnlOf(TRADING_WEEK),
      priorPnl: pnlOf(ledger([[1, 'revenue', 99_000, 'Sale']])),
    });
    expect(m.headline.find((s) => s.id === 'net')!.delta).toBeUndefined();
  });
});

describe('Finance — the P&L read helpers (#376)', () => {
  it('gives a quiet day a zero row rather than a gap', () => {
    const rows = dailyPnL(TRADING_WEEK, [1, 2, 3]);
    expect(rows.map((r) => r.day)).toEqual([1, 2, 3]);
    expect(rows[1]).toEqual({ day: 2, revenue: 0, expenses: 0, net: 0 });
    expect(rows[0]!.net).toBe(5_000);
  });

  it('shortens axis money without dropping the sign', () => {
    expect(compactMoney(0)).toBe('$0');
    expect(compactMoney(950)).toBe('$950');
    expect(compactMoney(12_000)).toBe('$12k');
    expect(compactMoney(-1_400)).toBe('-$1.4k');
    expect(compactMoney(2_400_000)).toBe('$2.4M');
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import { buildStoreWorth } from '../src/ui/StoreWorth';
import { FinanceTab, buildFinanceDashboard } from '../src/ui/FinanceTab';
import type { FinanceDashboardInputs } from '../src/ui/FinanceTab';
import { ZERO_KPI_SNAPSHOT } from '../src/game/KPIDashboard';
import { DEPARTMENT_CENTERS } from '../src/game/Economy';
import type { DepartmentPnLSummary, PnLSummary, ProfitCenter } from '../src/game/Economy';

// #380: the room's position header. Fixed here — these suites are about the
// windowed readings below it.
const WORTH = buildStoreWorth({ cash: 120_000, stockValue: 80_000, total: 200_000 });

/**
 * #375 — the Finance room's "Where the Gross Came From" panel. The store runs
 * four businesses out of one building; this is the only surface that says which
 * of them earned. A department that posted nothing is omitted, not drawn at
 * zero: a Tier-1 store has no body shop, and a flat bar labelled "Body Shop"
 * asserts a loss on collision work it never did.
 */

const ZERO_PNL: PnLSummary = {
  totalRevenue: 0,
  totalExpenses: 0,
  netIncome: 0,
  entries: [],
};

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

function model(departmentPnl: DepartmentPnLSummary, over: Partial<FinanceDashboardInputs> = {}) {
  return buildFinanceDashboard({
    rangeId: '30d',
    currentDay: 30,
    kpi: ZERO_KPI_SNAPSHOT,
    priorKpi: ZERO_KPI_SNAPSHOT,
    pnl: ZERO_PNL,
    priorPnl: ZERO_PNL,
    departmentPnl,
    daily: [],
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

const FULL_STORE = deptPnl(
  {
    sales: { revenue: 220_000, costOfSale: 178_000 },
    fni: { revenue: 9_400, costOfSale: 0 },
    service: { revenue: 12_000, costOfSale: 3_500 },
    bodyshop: { revenue: 18_000, costOfSale: 6_000 },
  },
  30_000,
);

describe('Finance — Where the Gross Came From (#375)', () => {
  it('names each department and its gross', () => {
    const m = model(FULL_STORE);
    expect(m.departmentGross.data).toEqual([
      { label: 'Sales', value: 42_000, valueLabel: '$42,000' },
      { label: 'F&I', value: 9_400, valueLabel: '$9,400' },
      { label: 'Service', value: 8_500, valueLabel: '$8,500' },
      { label: 'Body Shop', value: 12_000, valueLabel: '$12,000' },
    ]);

    const { getByTestId, getByText } = renderTab(m);
    expect(getByTestId('finance-department-gross-bars')).toBeTruthy();
    expect(getByText('Where the Gross Came From')).toBeTruthy();
    // Overhead is stated, because the four grosses only mean something against
    // what the building costs to run.
    expect(getByText(/Store overhead of \$30,000/)).toBeTruthy();
  });

  it('a store with no body shop shows no body-shop bar', () => {
    const m = model(deptPnl({ sales: { revenue: 60_000, costOfSale: 48_000 } }, 9_000));
    expect(m.departmentGross.data.map((d) => d.label)).toEqual(['Sales']);

    const { queryByText } = renderTab(m);
    expect(queryByText('Body Shop')).toBeNull();
  });

  it('shows a department that spent and billed nothing, rather than hiding it', () => {
    // Parts bought and burned on jobs that were never billed is a real, negative
    // reading — `active`, not `gross !== 0`, is what decides the bar exists.
    const m = model(deptPnl({ service: { revenue: 0, costOfSale: 1_200 } }));
    expect(m.departmentGross.data).toEqual([
      { label: 'Service', value: -1_200, valueLabel: '-$1,200' },
    ]);
  });

  it('a fresh store reads the empty state', () => {
    const m = model(deptPnl({}));
    expect(m.departmentGross.data).toEqual([]);

    const { getByText } = renderTab(m);
    expect(getByText('No department has posted to the books in this window.')).toBeTruthy();
  });

  it('every bar label fits the horizontal chart name column', () => {
    // The kit clips at ~13 characters — "Finance Reserve" rendered as "inance
    // Reserve" on the #365 web drive. Guarded here so a renamed center cannot
    // ship half-read.
    for (const bar of model(FULL_STORE).departmentGross.data) {
      expect(bar.label.length).toBeLessThanOrEqual(13);
    }
  });
});

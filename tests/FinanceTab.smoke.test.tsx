import React from 'react';
import { render } from '@testing-library/react-native';
import {
  FinanceTab,
  MonthResultsScreen,
  buildFinanceDashboard,
  buildMonthResults,
} from '../src/ui/FinanceTab';
import { ZERO_KPI_SNAPSHOT } from '../src/game/KPIDashboard';
import type { KPISnapshot } from '../src/game/KPIDashboard';
import { DEPARTMENT_CENTERS } from '../src/game/Economy';
import type { DepartmentPnLSummary, PnLSummary } from '../src/game/Economy';
import type { GateMonthVerdict } from '../src/game/TierGate';

const KPI: KPISnapshot = {
  ...ZERO_KPI_SNAPSHOT,
  unitsRetailed: 5,
  pvr: 3_000,
  fniPpru: 900,
  avgFrontGross: 2_100,
  avgBackGross: 900,
  productGross: 0,
  reserveGross: 0,
  avgDii: 21,
  cashUnits: 2,
  cashGross: 6_000,
  financeUnits: 3,
  financeGross: 9_000,
  heavyDownUnits: 1,
  avgApr: 0.079,
  avgTerm: 66,
  avgDownPct: 0.18,
  dailyCarryingCost: 240,
};

const PNL: PnLSummary = {
  totalRevenue: 120_000,
  totalExpenses: 96_000,
  netIncome: 24_000,
  entries: [
    { day: 5, type: 'revenue', amount: 120_000, label: 'Sale' },
    { day: 5, type: 'expense', amount: 90_000, label: 'Auction purchase' },
    { day: 6, type: 'expense', amount: 6_000, label: 'Payroll' },
  ],
};

const DEPT_PNL: DepartmentPnLSummary = {
  departments: DEPARTMENT_CENTERS.map((center) => ({
    center,
    revenue: center === 'sales' ? 120_000 : 0,
    costOfSale: center === 'sales' ? 90_000 : 0,
    gross: center === 'sales' ? 30_000 : 0,
    active: center === 'sales',
  })),
  overhead: 6_000,
  netIncome: 24_000,
};

const MODEL = buildFinanceDashboard({
  rangeId: '7d',
  currentDay: 9,
  kpi: KPI,
  priorKpi: { ...KPI, unitsRetailed: 4, cashGross: 4_000, financeGross: 8_000 },
  pnl: PNL,
  priorPnl: { totalRevenue: 0, totalExpenses: 0, netIncome: 0, entries: [] },
  departmentPnl: DEPT_PNL,
  daily: [3, 4, 5, 6, 7, 8, 9].map((day) => ({
    day,
    units: day % 2,
    frontGross: (day % 2) * 2_100,
    backGross: (day % 2) * 900,
    productGross: (day % 2) * 900,
    reserveGross: 0,
    gross: (day % 2) * 3_000,
  })),
  hasPriorWindow: true,
});

describe('FinanceTab view', () => {
  it('renders the dashboard grammar without crashing', () => {
    const { getByTestId, getByText } = render(
      <FinanceTab
        model={MODEL}
        onSelectRange={() => {}}
        onOpenHistory={() => {}}
        onOpenMonthResults={() => {}}
      />,
    );
    expect(getByTestId('finance-tab')).toBeTruthy();
    expect(getByTestId('finance-range-chips')).toBeTruthy();
    expect(getByTestId('finance-hero-chart')).toBeTruthy();
    expect(getByTestId('finance-mix-donut')).toBeTruthy();
    expect(getByTestId('finance-expense-bars')).toBeTruthy();
    expect(getByText('Where the Money Went')).toBeTruthy();
  });

  it('carries no placeholder copy', () => {
    const { queryByText } = render(
      <FinanceTab
        model={MODEL}
        onSelectRange={() => {}}
        onOpenHistory={() => {}}
        onOpenMonthResults={() => {}}
      />,
    );
    expect(queryByText(/coming in a later slice/i)).toBeNull();
  });
});

const VERDICT: GateMonthVerdict = {
  day: 30,
  month: 1,
  tier: 1,
  overall: 'nearMiss',
  faces: [
    { id: 'units', band: 'meet', ratio: 1.04 },
    { id: 'cash', band: 'nearMiss', ratio: 0.87 },
  ],
};

describe('MonthResultsScreen', () => {
  it('renders a closed month with its grade and the numbers behind it', () => {
    const model = buildMonthResults([
      { verdict: VERDICT, fromDay: 1, toDay: 30, kpi: KPI, pnl: PNL },
    ]);
    const { getByTestId, getByText, getAllByText } = render(
      <MonthResultsScreen model={model} onClose={() => {}} />,
    );
    expect(getByTestId('month-result-1')).toBeTruthy();
    expect(getByText('Day 1–30 · Tier 1')).toBeTruthy();
    // Plain-language band wording — never a temperature word. Twice over: the
    // month's overall grade, and the cash face that was the binding constraint.
    expect(getAllByText('Just short')).toHaveLength(2);
    expect(getByText('Cash on Hand')).toBeTruthy();
    expect(getByText('87% of target')).toBeTruthy();
    expect(getByText('$24,000')).toBeTruthy();
  });

  it('states why the list is empty before the first month closes', () => {
    const { getByText, queryByTestId } = render(
      <MonthResultsScreen model={buildMonthResults([])} onClose={() => {}} />,
    );
    expect(queryByTestId('month-result-1')).toBeNull();
    expect(getByText(/No month has closed yet/)).toBeTruthy();
  });

  it('lists the newest closed month first', () => {
    const model = buildMonthResults([
      { verdict: VERDICT, fromDay: 1, toDay: 30, kpi: KPI, pnl: PNL },
      {
        verdict: { ...VERDICT, month: 2, overall: 'exceed' },
        fromDay: 31,
        toDay: 60,
        kpi: KPI,
        pnl: PNL,
      },
    ]);
    expect(model.rows.map((r) => r.month)).toEqual([2, 1]);
    expect(model.rows[0].bandLabel).toBe('Beat the target');
  });
});

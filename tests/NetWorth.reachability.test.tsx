import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render } from '@testing-library/react-native';
import { HomeTab, buildHomeDashboard } from '../src/ui/HomeTab';
import type { HomeDashboardInputs } from '../src/ui/HomeTab';
import { FinanceTab, buildFinanceDashboard } from '../src/ui/FinanceTab';
import { buildStoreWorth } from '../src/ui/StoreWorth';
import { ZERO_KPI_SNAPSHOT } from '../src/game/KPIDashboard';
import { DEPARTMENT_CENTERS } from '../src/game/Economy';
import type { DepartmentPnLSummary, PnLSummary } from '../src/game/Economy';
import type { DayLoopState } from '../src/game/DayLoopController';

/**
 * #380 anti-orphan: the pair — **Cash on Hand** and **What the Store Is Worth**
 * — is mounted in both rooms that state it, and both take it off the engine's
 * one `getStoreWorth()`. A worth figure that exists only in a model builder
 * fixes nothing: the disconnection it was filed against is felt on the Home
 * HUD, every day, by a player watching an automated buy drop the only number
 * the screen renders big.
 */

const MANAGERIAL: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 12,
  ownershipUnlocked: true,
  hasRecap: false,
};

const HOME_INPUTS: HomeDashboardInputs = {
  businessName: 'Summit Motors',
  tierLabel: 'Tier 1 — Gravel Yard',
  storeWorth: { cash: 177_803, stockValue: 35_652, total: 213_455 },
  cashDelta: { ops: 2_140, stock: 19_500 },
  reputation: 72,
  currentDay: 12,
  season: 'spring',
  daysPerWeek: 7,
  daysPerMonth: 30,
  daysPerYear: 364,
  pendingLeads: 3,
  inventoryCount: 4,
  inService: 0,
};

const PNL: PnLSummary = {
  totalRevenue: 0,
  totalExpenses: 0,
  netIncome: 0,
  entries: [],
};

const DEPT_PNL: DepartmentPnLSummary = {
  departments: DEPARTMENT_CENTERS.map((center) => ({
    center,
    revenue: 0,
    costOfSale: 0,
    gross: 0,
    active: false,
  })),
  overhead: 0,
  netIncome: 0,
};

const FINANCE_MODEL = buildFinanceDashboard({
  rangeId: 'today',
  currentDay: 12,
  kpi: ZERO_KPI_SNAPSHOT,
  priorKpi: ZERO_KPI_SNAPSHOT,
  pnl: PNL,
  priorPnl: PNL,
  departmentPnl: DEPT_PNL,
  daily: [],
  hasPriorWindow: false,
});

describe('#380 both numbers are mounted in the live app', () => {
  it('the Home HUD renders cash as the headline with the worth line under it', () => {
    const model = buildHomeDashboard(HOME_INPUTS);
    const { getByTestId, getByText } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );

    // Cash stays the primary figure — it is the constraint every gate, ending
    // and bankruptcy check branches on, so the worth line never displaces it.
    expect(getByText('Cash on Hand')).toBeTruthy();
    expect(getByText('$177,803')).toBeTruthy();

    expect(getByTestId('home-store-worth')).toBeTruthy();
    expect(getByText('What the Store Is Worth')).toBeTruthy();
    expect(getByText('$213,455')).toBeTruthy();
    // The rule, stated where it is read: the total names what it sums.
    expect(getByText(/cost you/)).toBeTruthy();
  });

  it('the Finance room is headed by the same pair', () => {
    const { getByTestId, getByText } = render(
      <FinanceTab
        model={FINANCE_MODEL}
        storeWorth={buildStoreWorth({
          cash: 177_803,
          stockValue: 35_652,
          total: 213_455,
        })}
        onSelectRange={() => {}}
        onOpenHistory={() => {}}
        onOpenMonthResults={() => {}}
      />,
    );

    expect(getByTestId('finance-region-position')).toBeTruthy();
    expect(getByTestId('finance-store-worth')).toBeTruthy();
    expect(getByText('Cash on Hand')).toBeTruthy();
    expect(getByText('What the Store Is Worth')).toBeTruthy();
    expect(getByText('$213,455')).toBeTruthy();
  });

  it('a store with no cars is worth its cash, not an empty state', () => {
    const empty = buildStoreWorth({ cash: 41_200, stockValue: 0, total: 41_200 });
    // Not a dash and not a blank card: a sold-out Tier-1 lot is a normal
    // morning, and "—" there would read as "unknown" on the day it matters.
    expect(empty.worthValue).toBe('$41,200');
    expect(empty.worthValue).toBe(empty.cashValue);

    const model = buildHomeDashboard({
      ...HOME_INPUTS,
      storeWorth: { cash: 41_200, stockValue: 0, total: 41_200 },
      inventoryCount: 0,
    });
    const { getAllByText } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    // Both figures render the same number — cash and worth, twice.
    expect(getAllByText('$41,200')).toHaveLength(2);
  });

  it('both rooms build the pair off the engine getter, never their own sum', () => {
    const gameScreen = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'screens', 'GameScreen.tsx'),
      'utf8',
    );
    expect(gameScreen).toMatch(/storeWorth: world\.getStoreWorth\(\)/);

    const financeContainer = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'screens', 'FinanceTabContainer.tsx'),
      'utf8',
    );
    expect(financeContainer).toMatch(
      /storeWorth=\{buildStoreWorth\(world\.getStoreWorth\(\)\)\}/,
    );
  });
});

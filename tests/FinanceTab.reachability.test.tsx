import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { createEventBus, type EventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { FinanceTabContainer } from '../src/app/screens/FinanceTabContainer';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { TabStacks } from '../src/ui/Navigator';
import type { ShellTabKey } from '../src/ui/AppShell';
import { readAppCompositionSource } from './helpers/appComposition';
import { emptyState } from '../src/ui/copy';
import { stubHints } from './helpers/hints';

// Anti-orphan (#351): Finance was one of the two placeholder tabs, and the KPI
// readout + history log were full-screen routes behind the in-game menu that
// nobody opened. This proves the tab is mounted on the LIVE world, that the
// range chips actually re-read the engine, and that the two sibling records are
// reachable from inside the tab.

// Declared in full (#390) — an empty modifier behind an `as` cast becomes a NaN
// opening balance now that `startingCapitalBonus` reaches `createEconomy`.
const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

function freshWorld(masterSeed = 351): World {
  return createWorld({ bus: createEventBus(), masterSeed, characterProfile: PROFILE });
}

/**
 * The three composition deps the room takes beyond the world (#393): the
 * teaching cluster and the two write-echoes the credit controls need. Every
 * test in this file is about a *reading*, so all three are inert here.
 */
function deps() {
  return { hints: stubHints(), bump: () => {}, setCash: () => {} };
}

/** A minimal stack stand-in — the tab's two siblings only ever push. */
function stubTabs(): TabStacks<ShellTabKey> & { pushed: string[] } {
  const pushed: string[] = [];
  return {
    pushed,
    navigate: (route: string) => pushed.push(route),
    back: () => {},
  } as unknown as TabStacks<ShellTabKey> & { pushed: string[] };
}

function closeDeal(bus: EventBus, frontGross: number) {
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 20_000,
    frontGross,
    backGross: 500,
    productGross: 500,
    reserveGross: 0,
    daysInInventory: 10,
    paymentMethod: 'cash',
    downPayment: 20_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

describe('#351 the Finance tab is mounted on the live world', () => {
  it('renders every region of the dashboard off a real createWorld', () => {
    const { getByTestId } = render(
      <FinanceTabContainer world={freshWorld()} tabs={stubTabs()} {...deps()} />,
    );
    for (const region of [
      'finance-region-range',
      'finance-region-headline',
      'finance-region-hero',
      'finance-region-mix',
      // #375: which of the store's four businesses earned.
      'finance-region-department-gross',
      // #376: the three P&L lines over time, and the gross→net ladder. The
      // room charted gross and printed net as a bare number before these.
      'finance-region-pnl-trend',
      'finance-region-statement',
      'finance-region-gross-breakdown',
      // #152: the back end per car by deal structure.
      'finance-region-back-end-structure',
      'finance-region-expenses',
      'finance-region-kpis',
      'finance-region-records',
    ]) {
      expect(getByTestId(region)).toBeTruthy();
    }
    // The KPI block is row one of this dashboard now, not a menu screen.
    expect(getByTestId('kpi-dashboard')).toBeTruthy();
  });

  it('renders no placeholder or coming-later copy', () => {
    const { queryByText, queryByTestId } = render(
      <FinanceTabContainer world={freshWorld()} tabs={stubTabs()} {...deps()} />,
    );
    expect(queryByText(/coming in a later slice/i)).toBeNull();
    expect(queryByTestId('strategic-tab-finance')).toBeNull();
  });

  it('shows each stat card empty on a day-1 world rather than a zero that reads as a result', () => {
    const { getByTestId, queryByTestId } = render(
      <FinanceTabContainer world={freshWorld()} tabs={stubTabs()} {...deps()} />,
    );
    for (const id of ['units', 'gross', 'net', 'pvr']) {
      expect(getByTestId(`finance-stat-${id}`)).toBeTruthy();
    }
    // No deals have closed, so the three retail cards have nothing behind them
    // and draw no sparkline.
    for (const id of ['units', 'gross', 'pvr']) {
      expect(queryByTestId(`finance-spark-${id}`)).toBeNull();
    }
    // Net Income is the exception, and it is not a zero reading as a result:
    // day 1 already carries the seed lot, so the books hold a real (negative)
    // carrying-cost entry. Before #376 this card had no series at all, which is
    // the only reason it used to draw nothing here.
    expect(getByTestId('finance-spark-net')).toBeTruthy();
  });

  it('re-reads the engine when the player selects a different range', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 351, characterProfile: PROFILE });
    // Day 1 trades, then two quiet days: "Today" must read nothing while "7D"
    // still holds the day-1 deal.
    closeDeal(bus, 3_000);
    bus.publish('clock:day_started', { day: 2 });
    bus.publish('clock:day_started', { day: 3 });
    world.clock.restore({ schemaVersion: 1, day: 3 });

    const { getByText, getByTestId, queryByTestId } = render(
      <FinanceTabContainer world={world} tabs={stubTabs()} {...deps()} />,
    );
    // "Today" is day 3 — nothing traded, so the card is empty, not a zero.
    expect(
      within(getByTestId('finance-stat-units')).getByText(emptyState('finance_no_deals')),
    ).toBeTruthy();
    expect(queryByTestId('finance-spark-units')).toBeNull();

    fireEvent.press(getByText('7D'));
    // The same card now reads the day-1 deal the wider window covers.
    expect(
      within(getByTestId('finance-stat-units')).queryByText(emptyState('finance_no_deals')),
    ).toBeNull();
    expect(within(getByTestId('finance-stat-units')).getByText('1')).toBeTruthy();
    expect(getByTestId('finance-spark-units')).toBeTruthy();
    expect(within(getByTestId('finance-stat-gross')).getByText('$3,500')).toBeTruthy();
  });

  it('reaches deal history and month-close results from inside the tab', () => {
    const tabs = stubTabs();
    const { getByTestId } = render(
      <FinanceTabContainer world={freshWorld()} tabs={tabs} {...deps()} />,
    );
    fireEvent.press(getByTestId('finance-open-history'));
    fireEvent.press(getByTestId('finance-open-month-results'));
    // Pushed onto the TAB stack — the console stays mounted (locked IA §3).
    expect(tabs.pushed).toEqual(['dealHistory', 'monthResults']);
  });

  it('is wired into the composition root, with both siblings as tab routes', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/finance: \(\s*<FinanceTabContainer/);
    expect(src).toMatch(/screen === 'dealHistory'/);
    expect(src).toMatch(/screen === 'monthResults'/);
    expect(src).toMatch(/world\.tierGate\.getMonthVerdicts\(\)/);
  });
});

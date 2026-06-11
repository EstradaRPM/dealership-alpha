import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppShell, type ShellTab } from '../src/ui/AppShell';

// Anti-orphan (#215): the 5-tab shell must mount the available tabs, keep each
// reachable, and keep the day-close primary action reachable above the nav.
// The grep guards the wiring in App.tsx so the IA can't be quietly orphaned.

const TABS: ShellTab[] = [
  { key: 'home', label: 'Home', content: <Text>HOME BODY</Text> },
  { key: 'operations', label: 'Operations', content: <Text>OPS BODY</Text> },
];

describe('#215 AppShell — 5-tab IA reachability', () => {
  it('shows the first tab, and every available tab is reachable by tapping it', () => {
    const { getByText, queryByText, getByLabelText } = render(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 1 — Micro Lot"
        tabs={TABS}
      />,
    );

    // Home is the default tab.
    expect(getByText('HOME BODY')).toBeTruthy();
    expect(queryByText('OPS BODY')).toBeNull();

    // Operations is reachable.
    fireEvent.press(getByLabelText('Operations'));
    expect(getByText('OPS BODY')).toBeTruthy();
    expect(queryByText('HOME BODY')).toBeNull();

    // Back to Home.
    fireEvent.press(getByLabelText('Home'));
    expect(getByText('HOME BODY')).toBeTruthy();
  });

  it('keeps the day-close primary action reachable and fires it', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 1 — Micro Lot"
        stats={[{ label: 'CASH', value: '$5,000' }]}
        tabs={TABS}
        primaryAction={{ label: 'Next Day →', onPress }}
      />,
    );

    expect(getByText('$5,000')).toBeTruthy();
    fireEvent.press(getByText('Next Day →'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders standalone (no ThemeProvider → default theme)', () => {
    expect(() =>
      render(
        <AppShell businessName="Ray's Lot" tierLabel="Tier 1" tabs={TABS} />,
      ),
    ).not.toThrow();
  });

  it('App.tsx mounts the Home + Operations tabs and the pinned day action', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
    // The shell replaces the DayLoopShell + BottomNav management composition.
    expect(src).toMatch(/from '\.\/src\/ui\/AppShell'/);
    expect(src).toMatch(/type ShellTab\b/);
    expect(src).not.toMatch(/from '\.\/src\/ui\/DayLoopShell'/);
    // The fixed 5-tab IA is composed from the data-driven nav list.
    expect(src).toMatch(/loadNavTabs\(\)/);
    // Home + Operations tab content is composed and handed to the shell.
    expect(src).toMatch(/home:/);
    expect(src).toMatch(/operations:/);
    expect(src).toMatch(/<HomeTab\s/);
    expect(src).toMatch(/<OperationsTab\s/);
    expect(src).toMatch(/<AppShell/);
    expect(src).toMatch(/primaryAction=\{\{/);
    // The floor is a MODE, not a tab.
    expect(src).toMatch(/loopState\.phase === 'FLOOR_OPEN' && floorModel/);
  });
});

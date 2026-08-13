import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { readAppCompositionSource } from './helpers/appComposition';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppShell, loadNavTabs, type ShellTab } from '../src/ui/AppShell';

// The 5-tab IA is FIXED — navigation is never gated by tier (#226 reverted the
// progressive tab-unlock that was never an agreed mechanic). All five tabs are
// always present; progression is altitude rising inside a surface, not tabs
// appearing/disappearing. All five back real rooms as of the 5c rebuild, and
// #378 deleted the placeholder surface the last three used to fall back to.
// This file guards the static nav + the active-tab fix.

describe('the fixed 5-tab IA — always present, never tier-gated', () => {
  it('is exactly the canonical five, in order, regardless of tier', () => {
    expect(loadNavTabs().map((t) => t.key)).toEqual([
      'home',
      'operations',
      'people',
      'finance',
      'growth',
    ]);
  });

  it('carries no tier/unlock fields — gating is gone, not just unused', () => {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'data', 'nav-tabs.json'),
      'utf8',
    );
    expect(raw).not.toMatch(/unlockTier|revealTier/);
  });

  it('carries no placeholder tagline field — the surface it fed is gone', () => {
    // #378: `tagline` existed only to caption the StrategicTab stub. With the
    // stub deleted the field has no reader, and dead data is exactly how a
    // placeholder grows back.
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'data', 'nav-tabs.json'),
      'utf8',
    );
    expect(raw).not.toMatch(/tagline/);
  });
});

describe('AppShell — controlled active tab survives a sub-screen round-trip', () => {
  const TABS: ShellTab[] = [
    { key: 'home', label: 'Home', content: <Text>HOME BODY</Text> },
    { key: 'operations', label: 'Operations', content: <Text>OPS BODY</Text> },
    { key: 'people', label: 'People', content: <Text>PEOPLE BODY</Text> },
  ];

  it('renders the controlled tab and reports taps instead of owning state', () => {
    const onTabChange = jest.fn();
    const { getByText, getByLabelText, queryByText } = render(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 1"
        tabs={TABS}
        activeTabKey="operations"
        onTabChange={onTabChange}
      />,
    );
    expect(getByText('OPS BODY')).toBeTruthy();
    expect(queryByText('HOME BODY')).toBeNull();
    // Tapping reports up; the shell does NOT self-switch (parent owns state).
    fireEvent.press(getByLabelText('Home'));
    expect(onTabChange).toHaveBeenCalledWith('home');
    expect(getByText('OPS BODY')).toBeTruthy();
  });

  it('keeps the active tab across a sub-screen round-trip (the reset bug)', () => {
    // At Operations, open a sub-screen and come back. #348 made this structural
    // — the shell no longer unmounts at all — but the controlled-tab contract
    // still has to hold across a remount.
    const { rerender, getByText } = render(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 1"
        tabs={TABS}
        activeTabKey="operations"
      />,
    );
    rerender(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 1"
        tabs={TABS}
        activeTabKey="operations"
      />,
    );
    expect(getByText('OPS BODY')).toBeTruthy();
  });
});

describe('App.tsx wiring', () => {
  it('mounts the fixed nav and lifts the active tab out of the shell', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/loadNavTabs\(\)/);
    expect(src).not.toMatch(/resolveNavTabs/);
    // #378: the nav defs are bound to composed rooms, not to a render-time
    // placeholder fallback.
    expect(src).toMatch(/composeShellTabs\(loadNavTabs\(\), tabContent\)/);
    // #348: the active tab moved from a lifted useState into TabStacks, which
    // owns the tab AND that tab's stack position.
    expect(src).toMatch(/activeTabKey=\{tabs\.activeTab\}/);
    // #213 named the handler so a tab press into Growth also finishes the
    // spine's read-the-market step. The guard is what it was for: the shell
    // reports the tap and `tabs` still owns which tab is active.
    expect(src).toMatch(/onTabChange=\{changeTab\}/);
    expect(src).toMatch(
      /const changeTab = \(key: ShellTabKey\) => \{[\s\S]*?tabs\.setActiveTab\(key\);/,
    );
  });
});

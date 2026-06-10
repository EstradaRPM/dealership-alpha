import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import {
  AppShell,
  resolveNavTabs,
  loadNavTabs,
  type ShellTab,
} from '../src/ui/AppShell';
import { StrategicTab } from '../src/ui/StrategicTab';

// #226: progressive tier-gating + the People/Finance/Growth scaffolds. The
// gate is data-driven and pure; the scaffolds render in both states; the shell
// marks locked tabs and (per the bug fix) honors a controlled active tab so the
// tab survives a round-trip through a sub-screen.

describe('#226 resolveNavTabs — tier gating tracks tier, not a hardcoded list', () => {
  it('T1 reveals only Home + Operations, both unlocked (no empty tabs day one)', () => {
    const tabs = resolveNavTabs(1);
    expect(tabs.map((t) => t.key)).toEqual(['home', 'operations']);
    expect(tabs.every((t) => t.state === 'unlocked')).toBe(true);
  });

  it('T2 reveals People (unlocked) and Finance as a locked teaser', () => {
    const tabs = resolveNavTabs(2);
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.state]));
    expect(byKey.people).toBe('unlocked');
    expect(byKey.finance).toBe('locked');
    expect(byKey.growth).toBeUndefined(); // not revealed until T3
  });

  it('T3 unlocks Finance and reveals Growth as a locked teaser', () => {
    const tabs = resolveNavTabs(3);
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.state]));
    expect(byKey.finance).toBe('unlocked');
    expect(byKey.growth).toBe('locked');
  });

  it('availability is monotonic — a tab never disappears as tier rises', () => {
    const seen = new Set<string>();
    for (let tier = 1; tier <= 4; tier++) {
      const keys = resolveNavTabs(tier).map((t) => t.key);
      for (const prior of seen) expect(keys).toContain(prior);
      keys.forEach((k) => seen.add(k));
    }
    // By T4 every canonical tab is present and Growth has gone live.
    expect(seen).toEqual(
      new Set(['home', 'operations', 'people', 'finance', 'growth']),
    );
    expect(
      resolveNavTabs(4).find((t) => t.key === 'growth')?.state,
    ).toBe('unlocked');
  });

  it('every locked tab carries the copy its scaffold needs', () => {
    for (const def of loadNavTabs()) {
      if (def.unlockTier > def.revealTier) {
        expect(def.tagline).toBeTruthy();
        expect(def.unlockHint).toBeTruthy();
      }
    }
  });
});

describe('#226 StrategicTab — renders in both locked and unlocked states', () => {
  const base = {
    title: 'People',
    tagline: 'Hiring, training, morale.',
    unlockHint: 'Unlocks at Tier 2.',
  };

  it('unlocked shows the tagline scaffold', () => {
    const { getByTestId, getByText } = render(
      <StrategicTab {...base} unlocked />,
    );
    expect(getByTestId('strategic-tab-unlocked')).toBeTruthy();
    expect(getByText('Hiring, training, morale.')).toBeTruthy();
  });

  it('locked shows the teaser without crashing', () => {
    const { getByTestId, getByText } = render(
      <StrategicTab {...base} unlocked={false} />,
    );
    expect(getByTestId('strategic-tab-locked')).toBeTruthy();
    expect(getByText('Unlocks at Tier 2.')).toBeTruthy();
  });
});

describe('#226 AppShell — controlled active tab + locked affordance', () => {
  const TABS: ShellTab[] = [
    { key: 'home', label: 'Home', content: <Text>HOME BODY</Text> },
    { key: 'operations', label: 'Operations', content: <Text>OPS BODY</Text> },
    {
      key: 'finance',
      label: 'Finance',
      locked: true,
      content: <Text>FINANCE LOCKED</Text>,
    },
  ];

  it('renders the controlled tab and reports taps instead of owning state', () => {
    const onTabChange = jest.fn();
    const { getByText, getByLabelText, queryByText } = render(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 2"
        tabs={TABS}
        activeTabKey="operations"
        onTabChange={onTabChange}
      />,
    );
    // Controlled: shows operations even though it isn't the first tab.
    expect(getByText('OPS BODY')).toBeTruthy();
    expect(queryByText('HOME BODY')).toBeNull();
    // Tapping reports up; the shell does NOT self-switch (parent owns state).
    fireEvent.press(getByLabelText('Home'));
    expect(onTabChange).toHaveBeenCalledWith('home');
    expect(getByText('OPS BODY')).toBeTruthy();
  });

  it('keeps the active tab across a sub-screen round-trip (the reset bug)', () => {
    // Simulate: at Operations, navigate away (AppShell unmounts), come back.
    // Because the parent holds activeTabKey, the remount restores Operations
    // rather than snapping back to Home.
    const { rerender, getByText } = render(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 2"
        tabs={TABS}
        activeTabKey="operations"
      />,
    );
    rerender(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 2"
        tabs={TABS}
        activeTabKey="operations"
      />,
    );
    expect(getByText('OPS BODY')).toBeTruthy();
  });

  it('marks a locked tab and still renders its locked content when selected', () => {
    const { getByLabelText, getByText } = render(
      <AppShell
        businessName="Ray's Lot"
        tierLabel="Tier 2"
        tabs={TABS}
        activeTabKey="finance"
        onTabChange={jest.fn()}
      />,
    );
    expect(getByLabelText('Finance (locked)')).toBeTruthy();
    expect(getByText('FINANCE LOCKED')).toBeTruthy();
  });
});

describe('#226 App.tsx wiring', () => {
  it('gates tabs via resolveNavTabs and lifts the active tab out of the shell', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
    expect(src).toMatch(/resolveNavTabs\(\s*world\.tierManager\.currentTier/);
    expect(src).toMatch(/<StrategicTab/);
    expect(src).toMatch(/activeTabKey=\{shellTab\}/);
    expect(src).toMatch(/onTabChange=\{setShellTab\}/);
  });
});

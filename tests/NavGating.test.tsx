import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppShell, loadNavTabs, type ShellTab } from '../src/ui/AppShell';
import { StrategicTab } from '../src/ui/StrategicTab';

// The 5-tab IA is FIXED — navigation is never gated by tier (#226 reverted the
// progressive tab-unlock that was never an agreed mechanic). All five tabs are
// always present; progression is altitude rising inside a surface, not tabs
// appearing/disappearing. People/Finance/Growth are placeholders until their
// own per-surface slice. This file guards the static nav + the active-tab fix.

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

  it('every strategic tab carries the tagline its placeholder needs', () => {
    for (const def of loadNavTabs()) {
      if (def.key === 'people' || def.key === 'finance' || def.key === 'growth') {
        expect(def.tagline).toBeTruthy();
      }
    }
  });
});

describe('StrategicTab — placeholder for an unbuilt strategic surface', () => {
  it('renders the title + tagline with no tier/unlock language', () => {
    const { getByTestId, getByText, queryByText } = render(
      <StrategicTab title="People" tagline="Hiring, training, morale." />,
    );
    expect(getByTestId('strategic-tab-people')).toBeTruthy();
    expect(getByText('Hiring, training, morale.')).toBeTruthy();
    expect(queryByText(/lock|Lock|Tier|tier/)).toBeNull();
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
    // At Operations, navigate away (AppShell unmounts), come back. Because the
    // parent holds activeTabKey, the remount restores Operations rather than
    // snapping back to Home.
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
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
    expect(src).toMatch(/loadNavTabs\(\)/);
    expect(src).not.toMatch(/resolveNavTabs/);
    expect(src).toMatch(/<StrategicTab/);
    expect(src).toMatch(/activeTabKey=\{shellTab\}/);
    expect(src).toMatch(/onTabChange=\{setShellTab\}/);
  });
});

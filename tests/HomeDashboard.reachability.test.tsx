import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { HomeTab, buildHomeDashboard, csiLabel } from '../src/ui/HomeTab';
import type { HomeDashboardInputs } from '../src/ui/HomeTab';
import type { DayLoopState } from '../src/game/DayLoopController';

// Anti-orphan (#230): the Home status dashboard must be reachable through the
// model builder → HomeTab pipeline, and actually wired into App.tsx — the guard
// against the recurring "surface built but never mounted" failure.

const MANAGERIAL: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 42,
  ownershipUnlocked: true,
  hasRecap: true,
};

const INPUTS: HomeDashboardInputs = {
  businessName: 'Summit Motors',
  tierLabel: 'Tier 2 — Paved Lot',
  storeWorth: { cash: 1_247_503, stockValue: 412_000, total: 1_659_503 },
  cashDelta: { ops: 32_490, stock: 0 },
  reputation: 87,
  currentDay: 42,
  season: 'spring',
  daysPerWeek: 7,
  daysPerMonth: 30,
  daysPerYear: 364,
  pendingLeads: 18,
  inventoryCount: 128,
  inService: 16,
};

describe('#230 buildHomeDashboard — pure model math', () => {
  it('buckets the reputation score into a CSI band', () => {
    expect(csiLabel(87)).toBe('Very Good');
    expect(csiLabel(30)).toBe('Poor');
    expect(csiLabel(50)).toBe('Fair');
    expect(csiLabel(70)).toBe('Good');
    expect(csiLabel(95)).toBe('Excellent');
    // Clamps out-of-range scores.
    expect(csiLabel(120)).toBe('Excellent');
    expect(csiLabel(-5)).toBe('Poor');
  });

  it('formats cash + a signed vs-yesterday delta with a trend', () => {
    const m = buildHomeDashboard(INPUTS);
    expect(m.cash.value).toBe('$1.2M');
    expect(m.cash.delta).toBe('+$32.5k');
    expect(m.cash.deltaContext).toBe('vs yesterday');
    expect(m.cash.trend).toBe('up');

    const down = buildHomeDashboard({ ...INPUTS, cashDelta: { ops: -1500, stock: 0 } });
    expect(down.cash.delta).toBe('-$1.5k');
    expect(down.cash.deltaContext).toBe('vs yesterday');
    expect(down.cash.trend).toBe('down');

    const none = buildHomeDashboard({ ...INPUTS, cashDelta: null });
    expect(none.cash.delta).toBeUndefined();
    expect(none.cash.deltaContext).toBeUndefined();
    expect(none.cash.trend).toBe('flat');
  });

  it('breaks stock spend out of the delta and keys the trend off ops (#255)', () => {
    // Buy-heavy profitable day: raw cash change is -$25,510, but the card
    // reads a positive ops delta with the buy broken out, trending up.
    const m = buildHomeDashboard({
      ...INPUTS,
      cashDelta: { ops: 12_490, stock: 38_000 },
    });
    expect(m.cash.delta).toBe('+$12.5k ops');
    expect(m.cash.deltaContext).toBe('-$38k into stock');
    expect(m.cash.trend).toBe('up');

    // Ops loss alongside a buy still trends down — the split is honest, it
    // just never colors the deliberate buy itself as the loss.
    const opsLoss = buildHomeDashboard({
      ...INPUTS,
      cashDelta: { ops: -2_000, stock: 38_000 },
    });
    expect(opsLoss.cash.delta).toBe('-$2k ops');
    expect(opsLoss.cash.deltaContext).toBe('-$38k into stock');
    expect(opsLoss.cash.trend).toBe('down');
  });

  it('derives calendar labels + a today-highlighted mini-calendar off the game year', () => {
    const m = buildHomeDashboard(INPUTS);
    // Day 42, 7-day weeks, 30-day months, spring.
    expect(m.calendar.day).toBe(42);
    expect(m.calendar.week).toBe(6); // ceil(42/7)
    expect(m.calendar.month).toBe(2); // floor(41/30)+1
    expect(m.calendar.quarter).toBe(1); // spring
    expect(m.calendar.seasonLabel).toBe('Spring');
    // The grid is one gameplay month, with exactly one cell flagged today.
    expect(m.calendar.miniCal).toHaveLength(30);
    const today = m.calendar.miniCal.filter((d) => d.isToday);
    expect(today).toHaveLength(1);
    expect(today[0].dayOfMonth).toBe(12); // (41 % 30) + 1
  });

  it('inventory stat carries value + deep-link, no note (#254)', () => {
    const m = buildHomeDashboard(INPUTS);
    const inv = m.stats.find((s) => s.key === 'inventory');
    expect(inv?.value).toBe('128');
    expect(inv?.deepLink).toBe(true);
  });
});

describe('#230 Home dashboard — reachable through the live pipeline', () => {
  it('renders the dashboard in the Home tab with cash/CSI/calendar/quick-stats', () => {
    const model = buildHomeDashboard(INPUTS);
    const { getByText, getByTestId } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    expect(getByTestId('home-dashboard')).toBeTruthy();
    // Identity (name + tier) now lives in the AppShell header, not the
    // dashboard body (#238); the dashboard leads with the cash card.
    expect(getByText('$1.2M')).toBeTruthy();
    expect(getByText('Very Good')).toBeTruthy(); // CSI band
    // The day now renders as the skeuo calendar-page badge (#240): a "DAY"
    // header strip over the number, not a single "Day 42" text run.
    expect(getByTestId('home-day-badge')).toBeTruthy();
    expect(getByText('42')).toBeTruthy();
    // Calendar collapses by default (#256); expand it to verify the month grid.
    fireEvent.press(getByTestId('home-calendar-toggle'));
    expect(getByTestId('home-mini-calendar')).toBeTruthy();
    expect(getByText('Pending Leads')).toBeTruthy();
    expect(getByText('In Service')).toBeTruthy();
  });

  it('deep-links the inventory quick-stat into Operations', () => {
    const onOpenOperations = jest.fn();
    const model = buildHomeDashboard(INPUTS);
    const { getByLabelText } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={onOpenOperations} />,
    );
    fireEvent.press(getByLabelText('Inventory — open Operations'));
    expect(onOpenOperations).toHaveBeenCalledTimes(1);
  });

  it('renders standalone with no ThemeProvider (default theme)', () => {
    const model = buildHomeDashboard(INPUTS);
    expect(() => render(<HomeTab state={MANAGERIAL} dashboard={model} />)).not.toThrow();
  });

  it('GameScreen builds the dashboard from the live world and mounts it on Home', () => {
    // The live-game composition was extracted to src/app/screens/GameScreen.tsx
    // (#242); the dashboard wiring this test guards lives there now.
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'screens', 'GameScreen.tsx'),
      'utf8',
    );
    expect(src).toMatch(/buildHomeDashboard\(\{/);
    expect(src).toMatch(/reputation: world\.reputation\.reviewScore/);
    expect(src).toMatch(/currentDay: world\.clock\.currentDay/);
    expect(src).toMatch(/season: world\.clock\.currentSeason/);
    expect(src).toMatch(/dashboard=\{homeDashboard\}/);
    expect(src).toMatch(
      /onOpenOperations=\{\(\) => tabs\.setActiveTab\('operations'\)\}/,
    );
  });
});

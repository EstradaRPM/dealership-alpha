import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { buildIndustryWire } from '../src/app/config';
import { HomeTab, IndustryWire } from '../src/ui/HomeTab';
import { snapshotWorld, restoreWorld } from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { DayLoopState } from '../src/game/DayLoopController';

/**
 * #176 reachability — the industry wire has to be reachable in the LIVE flow:
 * a real world, ticking real days, producing real headlines that reach the Home
 * screen. Plus the anti-orphan guard the repo keeps needing (a surface built and
 * never mounted).
 *
 * Seeded, so "a headline eventually lands" is deterministic rather than likely.
 */

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

const MANAGERIAL: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 1,
  ownershipUnlocked: true,
  hasRecap: false,
};

function runDays(world: ReturnType<typeof createWorld>, bus: ReturnType<typeof createEventBus>, days: number): void {
  for (let d = 1; d <= days; d += 1) bus.publish('clock:day_started', { day: d });
}

describe('#176 industry wire — live world', () => {
  it('publishes headlines the player can read as the market moves', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 176, characterProfile: PROFILE });
    const published: Array<{ reliability: string; text: string }> = [];
    bus.subscribe('news:headline_published', (e) =>
      published.push({ reliability: e.reliability, text: e.text }),
    );

    runDays(world, bus, 90);

    expect(published.length).toBeGreaterThan(0);
    // Every published line is fully filled — no unresolved slot reaches a player.
    for (const h of published) expect(h.text).not.toMatch(/\{\w+\}/);
    expect(world.marketEconomy.news.getHeadlines().length).toBeGreaterThan(0);
  });

  it('replays identically from the same seed and diverges from another', () => {
    const textsFor = (seed: number): string[] => {
      const bus = createEventBus();
      const world = createWorld({ bus, masterSeed: seed, characterProfile: PROFILE });
      runDays(world, bus, 90);
      return world.marketEconomy.news.getHeadlines().map((h) => `${h.day}|${h.text}`);
    };
    expect(textsFor(176)).toEqual(textsFor(176));
    expect(textsFor(176)).not.toEqual(textsFor(999));
  });

  it('reaches the Home read model with a trust badge on every line', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 176, characterProfile: PROFILE });
    runDays(world, bus, 90);

    const model = buildIndustryWire(world);
    expect(model.headlines.length).toBeGreaterThan(0);
    for (const h of model.headlines) {
      expect(h.reliabilityLabel.length).toBeGreaterThan(0);
      expect(h.sourceLabel.length).toBeGreaterThan(0);
      expect(h.dayLabel.length).toBeGreaterThan(0);
    }
    // Newest first.
    const days = model.headlines.map((h) =>
      Number(h.id.slice(0, h.id.indexOf('#'))),
    );
    expect([...days].sort((a, b) => b - a)).toEqual(days);
    // The legend explains all three tiers in the player's own words.
    expect(model.legend.map((l) => l.reliability)).toEqual([
      'direct',
      'leading',
      'lagging',
    ]);

    const { getByTestId } = render(<HomeTab state={MANAGERIAL} industryWire={model} />);
    expect(getByTestId('home-region-wire')).toBeTruthy();
    expect(getByTestId('industry-wire')).toBeTruthy();
  });

  it('survives a save/load through the world seam', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 176, characterProfile: PROFILE });
    runDays(world, bus, 90);
    const before = world.marketEconomy.news.getHeadlines();
    expect(before.length).toBeGreaterThan(0);

    const snap = snapshotWorld(world);
    const bus2 = createEventBus();
    const world2 = createWorld({ bus: bus2, masterSeed: 176, characterProfile: PROFILE });
    restoreWorld(snap, world2);

    expect(world2.marketEconomy.news.getHeadlines()).toEqual(before);
    expect(buildIndustryWire(world2).headlines).toEqual(
      buildIndustryWire(world).headlines,
    );
  });

  it('is actually mounted on the Home tab by the composition root', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'screens', 'GameScreen.tsx'),
      'utf8',
    );
    expect(src).toMatch(/industryWire=\{buildIndustryWire\(world\)\}/);

    const worldState = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'useWorldState.ts'),
      'utf8',
    );
    // Headlines publish mid-day too, so the panel refreshes on the publish.
    expect(worldState).toMatch(/subscribe\('news:headline_published'/);
  });
});

describe('#176 industry wire — panel behavior', () => {
  const MODEL = {
    headlines: [
      {
        id: '9#0',
        text: 'Fuel price spike. Dealers are already repricing.',
        sourceLabel: 'Auction block report',
        reliability: 'direct' as const,
        reliabilityLabel: 'Confirmed',
        dayLabel: 'Today',
      },
      {
        id: '8#1',
        text: 'Talk is trucks values slide inside 3 days.',
        sourceLabel: 'Analyst desk',
        reliability: 'leading' as const,
        reliabilityLabel: 'Rumor',
        dayLabel: 'Yesterday',
      },
    ],
    legend: [
      {
        reliability: 'direct' as const,
        label: 'Confirmed',
        note: 'It already happened — you can verify it.',
      },
      {
        reliability: 'leading' as const,
        label: 'Rumor',
        note: "A call about what's next. It may not pan out.",
      },
    ],
  };

  it('renders each headline with its source, trust badge and day stamp', () => {
    const { getByTestId, getAllByText, getByText } = render(
      <IndustryWire model={MODEL} />,
    );
    expect(getByTestId('wire-headline-9#0')).toBeTruthy();
    expect(getByTestId('wire-headline-8#1')).toBeTruthy();
    expect(getByText('Analyst desk')).toBeTruthy();
    expect(getByText('Yesterday')).toBeTruthy();
    // Badge text is uppercased by the kit's caps treatment.
    expect(getAllByText(/confirmed/i).length).toBeGreaterThan(0);
  });

  it('teaches the trust tiers behind a tap', () => {
    const { getByTestId, queryByTestId } = render(<IndustryWire model={MODEL} />);
    expect(queryByTestId('wire-legend')).toBeNull();
    fireEvent.press(getByTestId('wire-legend-toggle'));
    expect(getByTestId('wire-legend')).toBeTruthy();
  });

  it('says so honestly when nothing has come over the wire yet', () => {
    const { getByTestId, queryByTestId } = render(
      <IndustryWire model={{ headlines: [], legend: MODEL.legend }} />,
    );
    expect(getByTestId('industry-wire')).toBeTruthy();
    expect(queryByTestId('wire-legend-toggle')).toBeNull();
  });

  it('renders the Home tab with no wire at all (pre-day-1)', () => {
    const { getByTestId } = render(<HomeTab state={MANAGERIAL} />);
    expect(getByTestId('home-region-wire')).toBeTruthy();
  });
});

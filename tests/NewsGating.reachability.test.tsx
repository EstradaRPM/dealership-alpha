import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { buildIndustryWire, buildWeeklyReport } from '../src/app/config';
import { IndustryWire } from '../src/ui/HomeTab';
import { snapshotWorld, restoreWorld } from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * #178 reachability — news gating has to bite in the LIVE flow: a real world
 * ticking real days, real headlines held back from the Home screen, a real
 * subscription bought through the panel that opens them and bills for it, and
 * the whole thing surviving a save/load.
 *
 * Seeded, so "the wire withholds something" is deterministic rather than likely.
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

function runDays(bus: ReturnType<typeof createEventBus>, days: number): void {
  for (let d = 1; d <= days; d += 1) bus.publish('clock:day_started', { day: d });
}

function build(seed: number): { bus: ReturnType<typeof createEventBus>; world: World } {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed: seed, characterProfile: PROFILE });
  return { bus, world };
}

/** Force the career to a tier, the way the other reachability tests do. */
function setTier(world: World, tier: number): void {
  const state = world.tierManager.getSerializableState();
  world.tierManager.restoreState({ ...state, currentTier: tier });
}

/** Put a used car manager on the desk (UCM hireTier is 3). */
function hireUcm(world: World): void {
  const candidate = world.staffOrg.getCandidates('used-car-manager')[0];
  expect(candidate).toBeDefined();
  world.staffOrg.hire(candidate.candidateId);
}

describe('#178 news gating — live world', () => {
  it('withholds the paid + forward-call lanes from a cold Tier-1 lot', () => {
    const { bus, world } = build(178);
    runDays(bus, 90);

    const model = buildIndustryWire(world);
    expect(model.headlines.length).toBeGreaterThan(0);
    const locked = model.headlines.filter((h) => h.locked);
    expect(locked.length).toBeGreaterThan(0);
    // A locked row keeps its stamp and its voice, and leaks nothing of the
    // report itself — the tease is the mechanic.
    for (const row of locked) {
      expect(row.sourceLabel.length).toBeGreaterThan(0);
      expect(row.dayLabel.length).toBeGreaterThan(0);
      expect(row.lockId).not.toBeNull();
      expect(row.text).not.toMatch(/\{\w+\}/);
    }
    const raw = world.marketEconomy.news.getHeadlines();
    const lockedTexts = new Set(locked.map((r) => r.text));
    for (const h of raw) {
      if (lockedTexts.has(h.text)) throw new Error('a locked row leaked its report');
    }
    // …and the footer says what each closed door would take.
    const withheld = model.unlocks.filter((u) => u.withheldLabel != null);
    expect(withheld.length).toBeGreaterThan(0);
    for (const u of withheld) expect(u.hint.length).toBeGreaterThan(0);
  });

  it('does not perturb the engine: the same seed publishes the same wire either way', () => {
    // Gating is a READ-SIDE lens. Buying every subscription must not change one
    // roll, or replay (#122) would depend on what the player bought.
    const cold = build(178);
    const paid = build(178);
    for (const s of paid.world.marketIntel.subscriptions) {
      paid.world.marketIntel.setSubscribed(s.id, true);
    }
    const coldPublished: string[] = [];
    const paidPublished: string[] = [];
    cold.bus.subscribe('news:headline_published', (e) => coldPublished.push(e.text));
    paid.bus.subscribe('news:headline_published', (e) => paidPublished.push(e.text));

    runDays(cold.bus, 60);
    runDays(paid.bus, 60);

    expect(paidPublished.length).toBeGreaterThan(0);
    expect(paidPublished).toEqual(coldPublished);
  });

  it('opens the paid lanes when the subscriptions are bought at a tier that sells them', () => {
    const { bus, world } = build(178);
    setTier(world, 2);
    // Rival repricing is the event the paid competitor-tracking lane quantifies
    // — around town you hear THAT they moved, the tracker tells you by how much.
    for (let d = 1; d <= 40; d += 1) {
      bus.publish('clock:day_started', { day: d });
      bus.publish('competitor:price_changed', {
        day: d,
        competitorId: `rival-${d % 3}`,
        brand: 'Northgate Motors',
        oldPricing: 0.5,
        newPricing: d % 2 === 0 ? 0.62 : 0.41,
        segmentAffinity: { truck: 0.7, suv: 0.2, sedan: 0.1 },
      });
    }

    const subIds = new Set(world.marketIntel.subscriptions.map((s) => s.id));
    const before = buildIndustryWire(world);
    const paywalledBefore = before.headlines.filter(
      (h) => h.lockId != null && subIds.has(h.lockId),
    ).length;
    expect(paywalledBefore).toBeGreaterThan(0);

    for (const id of subIds) world.marketIntel.setSubscribed(id, true);
    const after = buildIndustryWire(world);
    expect(
      after.headlines.filter((h) => h.lockId != null && subIds.has(h.lockId)).length,
    ).toBe(0);
    // Money buys the data lanes and nothing else — the forward calls are a hire.
    expect(after.headlines.filter((h) => h.lockId === 'desk_manager').length).toBe(
      before.headlines.filter((h) => h.lockId === 'desk_manager').length,
    );
    expect(after.headlines.length).toBe(before.headlines.length);
  });

  it('bills the subscription every day it is on, and stops when cancelled', () => {
    // Two identical worlds ticked the same day: the only difference between
    // their cash is what the wire costs. (A single world's day-over-day spend
    // moves with rent/payroll cadence, which would hide the signal.)
    const cost =
      build(178).world.marketIntel.subscriptions.find((s) => s.id === 'auction_data')
        ?.dailyCost ?? 0;
    expect(cost).toBeGreaterThan(0);

    const plain = build(178);
    const paying = build(178);
    setTier(paying.world, 2);
    paying.world.marketIntel.setSubscribed('auction_data', true);

    plain.bus.publish('clock:day_started', { day: 1 });
    paying.bus.publish('clock:day_started', { day: 1 });
    expect(plain.world.economy.cash - paying.world.economy.cash).toBe(cost);

    // Cancelled, the two worlds spend the same again from that day on.
    paying.world.marketIntel.setSubscribed('auction_data', false);
    plain.bus.publish('clock:day_started', { day: 2 });
    paying.bus.publish('clock:day_started', { day: 2 });
    expect(plain.world.economy.cash - paying.world.economy.cash).toBe(cost);
  });

  it('opens the forward calls the day a used car manager is on the desk', () => {
    const { bus, world } = build(178);
    setTier(world, 3);
    runDays(bus, 90);

    expect(
      buildIndustryWire(world).headlines.some((h) => h.lockId === 'desk_manager'),
    ).toBe(true);

    hireUcm(world);
    expect(
      buildIndustryWire(world).headlines.some((h) => h.lockId === 'desk_manager'),
    ).toBe(false);
  });

  it('holds back the weekly column forward calls behind the same door', () => {
    const { bus, world } = build(178);
    setTier(world, 3);
    runDays(bus, 30);

    const locked = buildWeeklyReport(world);
    expect(locked).not.toBeNull();
    expect(locked?.callsLockedHint).not.toBeNull();
    expect(locked?.calls).toEqual([]);

    hireUcm(world);
    const open = buildWeeklyReport(world);
    expect(open?.callsLockedHint).toBeNull();
    // The recap half was never gated — the column's moves read either way.
    expect(open?.moves.length).toBe(locked?.moves.length);
  });

  it('carries the paid subscriptions through a save/load', () => {
    const { world } = build(178);
    setTier(world, 2);
    world.marketIntel.setSubscribed('competitor_tracking', true);
    const snap = snapshotWorld(world);

    const reloaded = build(178).world;
    expect(reloaded.marketIntel.activeSubscriptions()).toEqual([]);
    restoreWorld(snap, reloaded);
    expect(reloaded.marketIntel.activeSubscriptions()).toEqual([
      'competitor_tracking',
    ]);
    expect(
      reloaded.marketIntel
        .accessFor({ tier: 2, hasDeskManager: false })
        .canRead('competitor_watch', 'direct'),
    ).toBe(true);
  });
});

describe('#178 news gating — composition wiring', () => {
  it('is mounted: the Home wire gets the subscription toggle', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'screens', 'GameScreen.tsx'),
      'utf8',
    );
    expect(src).toMatch(/onToggleSubscription=\{/);
    expect(src).toMatch(/marketIntel\.setSubscribed/);
  });

  it('is billed: the world drives the daily debit off the clock', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'createWorld.ts'),
      'utf8',
    );
    expect(src).toMatch(/marketIntel\.advanceDay/);
  });

  it('is persisted: the world seam carries the subscriptions', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'worldSnapshot.ts'),
      'utf8',
    );
    expect(src).toMatch(/marketIntel: world\.marketIntel\.snapshot\(\)/);
    expect(src).toMatch(/world\.marketIntel\.restore/);
  });
});

describe('#178 news gating — panel behavior', () => {
  const LOCK = {
    id: 'auction_data',
    label: 'Auction data feed',
    hint: 'Subscribe to the auction data feed — $45 a day — to read what the block actually did.',
    blurb: "The block's actual numbers.",
    kind: 'subscription' as const,
    dailyCost: 45,
    available: true,
    active: false,
  };

  const MODEL = {
    headlines: [
      {
        id: '9#0',
        text: 'Auction block report filed a report you cannot read yet.',
        sourceLabel: 'Auction block report',
        reliability: 'direct' as const,
        reliabilityLabel: 'Confirmed',
        dayLabel: 'Today',
        locked: true,
        lockId: 'auction_data',
      },
    ],
    legend: [],
    unlocksHeading: "What you're not reading",
    unlocks: [
      {
        id: 'auction_data',
        label: LOCK.label,
        hint: LOCK.hint,
        blurb: LOCK.blurb,
        withheldLabel: '1 report',
        purchasable: true,
        active: false,
        costNote: null,
        actionLabel: 'Subscribe',
      },
    ],
  };

  it('shows the locked row and the door that would open it', () => {
    const { getByTestId, getByText } = render(<IndustryWire model={MODEL} />);
    expect(getByTestId('wire-headline-locked-9#0')).toBeTruthy();
    expect(getByTestId('wire-unlock-auction_data')).toBeTruthy();
    expect(getByText('1 report')).toBeTruthy();
    expect(getByText(LOCK.hint)).toBeTruthy();
  });

  it('buys the subscription from the panel', () => {
    const calls: Array<[string, boolean]> = [];
    const { getByTestId } = render(
      <IndustryWire
        model={MODEL}
        onToggleSubscription={(id, on) => calls.push([id, on])}
      />,
    );
    fireEvent.press(getByTestId('wire-unlock-action-auction_data'));
    expect(calls).toEqual([['auction_data', true]]);
  });

  it('offers to cancel an active subscription, and describes what it buys', () => {
    const active = {
      ...MODEL,
      unlocks: [
        {
          ...MODEL.unlocks[0],
          active: true,
          withheldLabel: null,
          costNote: 'Active — $45 a day',
          actionLabel: 'Cancel',
        },
      ],
    };
    const calls: Array<[string, boolean]> = [];
    const { getByTestId, getByText } = render(
      <IndustryWire
        model={active}
        onToggleSubscription={(id, on) => calls.push([id, on])}
      />,
    );
    expect(getByText('Active — $45 a day')).toBeTruthy();
    expect(getByText(LOCK.blurb)).toBeTruthy();
    fireEvent.press(getByTestId('wire-unlock-action-auction_data'));
    expect(calls).toEqual([['auction_data', false]]);
  });

  it('still shows the doors when nothing has come over the wire yet', () => {
    const { getByTestId } = render(
      <IndustryWire model={{ ...MODEL, headlines: [] }} />,
    );
    expect(getByTestId('wire-unlock-auction_data')).toBeTruthy();
  });

  it('renders a below-tier door with no button at all', () => {
    const belowTier = {
      ...MODEL,
      unlocks: [
        {
          ...MODEL.unlocks[0],
          purchasable: false,
          actionLabel: null,
          hint: 'The auction data feed sells to lots at Tier 2 and up.',
        },
      ],
    };
    const { queryByTestId, getByText } = render(
      <IndustryWire model={belowTier} onToggleSubscription={() => {}} />,
    );
    expect(queryByTestId('wire-unlock-action-auction_data')).toBeNull();
    expect(getByText(/Tier 2 and up/)).toBeTruthy();
  });
});

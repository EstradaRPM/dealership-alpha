import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { readAppCompositionSource } from './helpers/appComposition';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { SALES_ARCHETYPES } from '../src/game/CustomerPool';
import { createRng } from '../src/game/NPC/Rng';
import { HomeTab } from '../src/ui/HomeTab';
import type { DemandReadoutModel, DemandTargetingLever } from '../src/ui/DemandReadout';
import type { CharacterProfile } from '../src/game/CareerProgression';

// Anti-orphan (#198): the observed-mix readout must be reachable through the
// real game-logic → model → shell pipeline, and actually wired into App.tsx —
// not just an isolated component render. This is the guard against the
// recurring "mechanic built but never surfaced" failure.

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

const PERSONA_LABELS: Record<string, string> = Object.fromEntries(
  SALES_ARCHETYPES.map((a) => [a.personId, a.label]),
);

function targetingLeversFor(world: ReturnType<typeof createWorld>): DemandTargetingLever[] {
  return world.demandShaper.getInfluenceInputs().map((input) => ({
    id: input.id,
    label: input.label,
    lean: Object.entries(input.weights)
      .filter(([, weight]) => weight > 0)
      .map(([persona, weight]) => ({
        persona,
        label: PERSONA_LABELS[persona] ?? persona,
        weight,
      })),
  }));
}

function countDraws(
  world: ReturnType<typeof createWorld>,
  persona: string,
  seed: number,
): number {
  const rng = createRng(seed);
  let count = 0;
  for (let i = 0; i < 2_000; i++) {
    if (world.demandShaper.drawPersona(rng) === persona) count++;
  }
  return count;
}

function recordSeededArrivals(
  world: ReturnType<typeof createWorld>,
  seed: number,
  count: number,
): void {
  const rng = createRng(seed);
  for (let i = 0; i < count; i++) {
    world.demandShaper.recordArrival(world.demandShaper.drawPersona(rng));
  }
}

// Build a real world, stock the lot at the cold-start auction board (demand is
// gated on inventory depth, #128a — an empty lot draws nobody), then run a real
// Day 1 through the composed seams so the createWorld customerSource draws
// personas from DemandShaper and records each arrival.
function runRealDay() {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed: 42, characterProfile: PROFILE });
  // Buy the cheapest listings we can afford to give the lot enough depth to
  // draw traffic (cash is finite, so we stop when the next one is unaffordable).
  const listings = [...world.inventory.getAuctionListings()].sort(
    (a, b) => a.askingPrice - b.askingPrice,
  );
  for (const listing of listings) {
    if (world.economy.cash < listing.askingPrice) break;
    world.inventory.buyFromAuction(listing.id);
  }
  world.dayLoop.nextDay().runDay();
  return world;
}

describe('#198 demand readout — reachable through the live pipeline', () => {
  it('uses a seeded location-profile baseline instead of a uniform world mix', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 42, characterProfile: PROFILE });
    const baseline = world.demandShaper.snapshot().baselineMix;
    const values = SALES_ARCHETYPES.map((a) => baseline[a.personId]);
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it('wires inventory composition and reputation as live influence producers', () => {
    const busA = createEventBus();
    const truckWorld = createWorld({ bus: busA, masterSeed: 42, characterProfile: PROFILE });
    const beforeTruckDraws = countDraws(truckWorld, 'tradesperson', 777);
    const truckListing = truckWorld.inventory
      .getAuctionListings()
      .filter((l) => l.category === 'truck' && l.askingPrice <= truckWorld.economy.cash)
      .sort((a, b) => a.askingPrice - b.askingPrice)[0];
    expect(truckListing).toBeDefined();
    truckWorld.inventory.buyFromAuction(truckListing.id);
    expect(
      truckWorld.demandShaper
        .getInfluenceInputs()
        .some((input) => input.id === 'inventory-composition'),
    ).toBe(true);
    const afterTruckDraws = countDraws(truckWorld, 'tradesperson', 777);
    expect(afterTruckDraws).toBeGreaterThan(beforeTruckDraws);

    const busB = createEventBus();
    const reputationWorld = createWorld({ bus: busB, masterSeed: 42, characterProfile: PROFILE });
    const beforeRepMix = reputationWorld.demandShaper.getMix();
    busB.publish('reputation:satisfaction_hit', {
      day: 1,
      amount: -60,
      reason: 'test',
    });
    for (let day = 1; day <= 20; day++) {
      busB.publish('clock:overnight_reputation_drift', { day });
    }
    const afterRepMix = reputationWorld.demandShaper.getMix();
    expect(
      reputationWorld.demandShaper
        .getInfluenceInputs()
        .some((input) => input.id === 'reputation'),
    ).toBe(true);
    expect(afterRepMix.enthusiast).toBeGreaterThan(beforeRepMix.enthusiast);
  });

  it('reaches the advertising lever and drifts the observed readout after lag days', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 42, characterProfile: PROFILE });
    expect(
      world.demandControls.advertisingOptions.some((option) => option.id === 'local-radio'),
    ).toBe(true);

    const before = countDraws(world, 'young_family', 31337);
    world.demandControls.setAdvertisingCampaign('local-radio');
    expect(world.demandControls.getAdvertisingCampaignId()).toBe('local-radio');
    expect(countDraws(world, 'young_family', 31337)).toBe(before);

    bus.publish('clock:day_started', { day: 1 });
    const dayOne = countDraws(world, 'young_family', 31337);
    bus.publish('clock:day_started', { day: 2 });
    bus.publish('clock:day_started', { day: 3 });
    const full = countDraws(world, 'young_family', 31337);

    expect(dayOne).toBeGreaterThan(before);
    expect(full).toBeGreaterThan(dayOne);

    const baselineBus = createEventBus();
    const baseline = createWorld({
      bus: baselineBus,
      masterSeed: 42,
      characterProfile: PROFILE,
    });
    recordSeededArrivals(baseline, 9090, 60);
    recordSeededArrivals(world, 9090, 60);
    const baselineYoungFamily = baseline
      .demandShaper
      .getObservedMix()
      .find((entry) => entry.persona === 'young_family')!;
    const advertisedYoungFamily = world
      .demandShaper
      .getObservedMix()
      .find((entry) => entry.persona === 'young_family')!;
    expect(advertisedYoungFamily.count).toBeGreaterThan(baselineYoungFamily.count);

    const levers = targetingLeversFor(world);
    expect(levers.some((lever) => lever.label === 'Advertising: Local radio')).toBe(true);
  });

  it('records real arrivals via the createWorld spawn seam during a real day', () => {
    const world = runRealDay();
    const observed = world.demandShaper.getObservedMix();
    const total = observed.reduce((s, e) => s + e.count, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('renders the readout in the Home tab, assembled the App way', () => {
    const world = runRealDay();
    const observed = world.demandShaper.getObservedMix();
    const demandReadout: DemandReadoutModel = {
      entries: observed.map((e) => ({
        persona: e.persona,
        label: PERSONA_LABELS[e.persona] ?? e.persona,
        share: e.share,
        count: e.count,
        trend: e.trend,
      })),
      totalObserved: observed.reduce((s, e) => s + e.count, 0),
      targetingLevers: targetingLeversFor(world),
      coverageGap: { category: 'truck', label: 'trucks', wantedCount: 1, stockCount: 0 },
    };

    const state = world.dayLoop.state();
    expect(state.phase).toBe('MANAGERIAL');

    const { getAllByText, getByText } = render(
      <HomeTab state={state} demandReadout={demandReadout} />,
    );

    // The readout is mounted and shows the observed persona mix. (No internal
    // card title — the Market region header owns it, #257.)
    expect(getByText('Market')).toBeTruthy();
    expect(getByText('Young Family')).toBeTruthy();
    expect(getByText("Who You're Targeting")).toBeTruthy();
    expect(getAllByText(/Reputation|Inventory composition/).length).toBeGreaterThan(0);
    expect(getByText(/recent buyers wanted trucks; you\s*stock 0/i)).toBeTruthy();
  });

  it('App.tsx wires demandReadout from the live world into the Home tab', () => {
    const src = readAppCompositionSource();
    // Reads the live shaper and threads the model into the shell — the two
    // links that, if cut, would orphan the mechanic.
    expect(src).toMatch(/world\.demandShaper\.getObservedMix\(\)/);
    expect(src).toMatch(/targetingLevers: buildTargetingLevers\(world\)/);
    expect(src).toMatch(/coverageGap: buildCoverageGap\(demandEntries, lotVehicles\)/);
    expect(src).toMatch(/advertisingOptions: world\.demandControls\.advertisingOptions/);
    expect(src).toMatch(
      /onSelectAdvertisingCampaign: levers\.handleSelectAdvertisingCampaign/,
    );
    expect(src).toMatch(/demandReadout=\{demandReadout\}/);
  });
});

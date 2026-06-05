import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { SALES_ARCHETYPES } from '../src/game/CustomerPool';
import { DayLoopShell } from '../src/ui/DayLoopShell';
import type { DemandReadoutModel } from '../src/ui/DemandReadout';
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
  it('records real arrivals via the createWorld spawn seam during a real day', () => {
    const world = runRealDay();
    const observed = world.demandShaper.getObservedMix();
    const total = observed.reduce((s, e) => s + e.count, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('renders the readout in the MANAGERIAL shell, assembled the App way', () => {
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
    };

    const state = world.dayLoop.state();
    expect(state.phase).toBe('MANAGERIAL');

    const { getByText } = render(
      <DayLoopShell
        profile={PROFILE}
        state={state}
        onNextDay={() => {}}
        demandReadout={demandReadout}
      />,
    );

    // The readout is mounted and shows the observed persona mix.
    expect(getByText("Who's Been Walking In")).toBeTruthy();
    expect(getByText('Young Family')).toBeTruthy();
  });

  it('App.tsx wires demandReadout from the live world into DayLoopShell', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'App.tsx'),
      'utf8',
    );
    // Reads the live shaper and threads the model into the shell — the two
    // links that, if cut, would orphan the mechanic.
    expect(src).toMatch(/world\.demandShaper\.getObservedMix\(\)/);
    expect(src).toMatch(/demandReadout=\{demandReadout\}/);
  });
});

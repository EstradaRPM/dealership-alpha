import React from 'react';
import { readAppCompositionSource } from './helpers/appComposition';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { DayRecap, type DayRecapModel } from '../src/ui/DayRecap';
import { buildReveal } from '../src/ui/Reveal';
import type { CharacterProfile } from '../src/game/CareerProgression';

// Anti-orphan (#319): the Reveal renderer must be reachable through the real
// game-logic → day-close → recap-model → surface pipeline, and actually wired
// into App.tsx's composition layer — not just an isolated component render.

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

const CASH_BUFFER = 12_000;
const DAYS = 5;

describe('#319 The Reveal — reachable through the live day-close pipeline', () => {
  it('buildReveal composes off a real day-funnel + gross + match tally without throwing', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 7, characterProfile: PROFILE });
    if (!world.staffOrg.currentRoster.some((s) => s.role_id === 'salesperson')) {
      const candidate = world.staffOrg.getCandidates('salesperson')[0];
      if (candidate) world.staffOrg.hire(candidate.candidateId);
    }
    const listings = [...world.inventory.getAuctionListings()].sort(
      (a, b) => a.askingPrice - b.askingPrice,
    );
    for (const listing of listings) {
      if (world.economy.cash - listing.askingPrice < CASH_BUFFER) break;
      world.inventory.buyFromAuction(listing.id);
    }
    let gross = 0;
    let strong = 0;
    let matched = 0;
    bus.subscribe('deal:closed', ({ frontGross, backGross }) => {
      gross += frontGross + backGross;
    });
    bus.subscribe('staff:auto_resolved', ({ outcome, matchQuality }) => {
      if (outcome !== 'closed') return;
      matched += 1;
      if ((matchQuality ?? 0) >= 0.8) strong += 1;
    });

    for (let i = 0; i < DAYS; i++) {
      world.dayLoop.nextDay().runDay();
      const funnel = world.capacityManager.getDayFunnel();
      const reveal = buildReveal(funnel, gross, { strong, matched });
      expect(typeof reveal.scoreline).toBe('string');
      expect(reveal.scoreline.length).toBeGreaterThan(0);
      expect(reveal.reactions.length).toBeGreaterThan(0);
      gross = 0;
      strong = 0;
      matched = 0;
    }
  });

  it('the day-close recap card renders the Reveal scoreline', () => {
    const funnel = {
      potentialTraffic: 20,
      walkedIn: 14,
      gated: 0,
      staffEngaged: 8,
      sold: 6,
      leakCause: 'none' as const,
    };
    const recap: DayRecapModel = {
      day: 3,
      potentialTraffic: funnel.potentialTraffic,
      walkedIn: funnel.walkedIn,
      staffEngaged: funnel.staffEngaged,
      sold: funnel.sold,
      gross: 14_200,
      leakCause: funnel.leakCause,
      strongMatches: 6,
      matchedSales: 6,
      reveal: buildReveal(funnel, 14_200, { strong: 6, matched: 6 }),
    };
    const { getByText } = render(<DayRecap model={recap} />);
    expect(getByText(/Busy day — you had what the crowd wanted: 6 of 6 stuck\./)).toBeTruthy();
  });

  it('App composition wires the funnel/gross/match tally into buildReveal at day close', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/buildReveal\(funnel, grossTodayRef\.current, matchTallyRef\.current\)/);
    expect(src).toMatch(/reveal: buildReveal\(/);
  });
});

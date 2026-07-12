import React from 'react';
import { readAppCompositionSource } from './helpers/appComposition';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { DayRecap, type DayRecapModel } from '../src/ui/DayRecap';
import { buildReveal } from '../src/ui/Reveal';
import type { ClosedSale, WalkOff } from '../src/ui/Reveal';
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

  it('App composition wires the funnel/gross/match tally/closes/walk-offs into buildReveal at day close', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(
      /buildReveal\(\s*funnel,\s*grossTodayRef\.current,\s*matchTallyRef\.current,\s*closesRef\.current,\s*walkOffsRef\.current,?\s*\)/,
    );
    expect(src).toMatch(/reveal: buildReveal\(/);
  });
});

// Anti-orphan (#320): a standout individual close must reach the Reveal as a
// starred win reaction through the real game-logic → event → recap pipeline,
// not just via buildReveal called directly with hand-built fixtures.
describe('#320 starred win reactions — reachable through the live close flow', () => {
  it('a real closed deal produces a win-* reaction in the Reveal', () => {
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
    let closes: ClosedSale[] = [];
    bus.subscribe('deal:closed', ({ frontGross, backGross }) => {
      gross += frontGross + backGross;
    });
    bus.subscribe(
      'staff:auto_resolved',
      ({ outcome, matchQuality, customerId, vehicleCategory, archetypeLabel, grossImpact }) => {
        if (outcome !== 'closed') return;
        matched += 1;
        if ((matchQuality ?? 0) >= 0.8) strong += 1;
        if (vehicleCategory && archetypeLabel) {
          closes.push({
            customerId,
            archetypeLabel,
            vehicleCategory,
            matchQuality: matchQuality ?? 0,
            gross: grossImpact,
          });
        }
      },
    );

    let sawWinReaction = false;
    for (let i = 0; i < DAYS; i++) {
      world.dayLoop.nextDay().runDay();
      const funnel = world.capacityManager.getDayFunnel();
      const reveal = buildReveal(funnel, gross, { strong, matched }, closes);
      if (reveal.reactions.some((r) => r.id.startsWith('win-'))) sawWinReaction = true;
      gross = 0;
      strong = 0;
      matched = 0;
      closes = [];
    }
    expect(sawWinReaction).toBe(true);
  });

  it('App composition wires the win narrative into the live floor toast, not the generic string', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/text: winReactionText\(sale\)/);
    expect(src).toMatch(/closesRef\.current = \[\.\.\.closesRef\.current, sale\]/);
  });
});

// Anti-orphan (#321): a walked customer must reach the Reveal as a starred
// walk-off reaction through the real game-logic → event → recap pipeline, not
// just via buildReveal called directly with hand-built fixtures.
describe('#321 starred walk-off reactions — reachable through the live no_sale flow', () => {
  it('a real no_sale outcome produces a walk-* reaction in the Reveal', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 7, characterProfile: PROFILE });
    if (!world.staffOrg.currentRoster.some((s) => s.role_id === 'salesperson')) {
      const candidate = world.staffOrg.getCandidates('salesperson')[0];
      if (candidate) world.staffOrg.hire(candidate.candidateId);
    }
    // Deliberately do NOT stock the lot beyond whatever createWorld seeds —
    // a thin/mismatched lot maximizes no_fit walk-offs for this real pipeline.
    let gross = 0;
    let strong = 0;
    let matched = 0;
    let walkOffs: WalkOff[] = [];
    bus.subscribe('deal:closed', ({ frontGross, backGross }) => {
      gross += frontGross + backGross;
    });
    bus.subscribe(
      'staff:auto_resolved',
      ({ outcome, matchQuality, customerId, archetypeLabel, wantedCategory, reason }) => {
        if (outcome === 'closed') {
          matched += 1;
          if ((matchQuality ?? 0) >= 0.8) strong += 1;
          return;
        }
        if (archetypeLabel && reason) {
          walkOffs.push({ customerId, archetypeLabel, wantedCategory, reason });
        }
      },
    );

    let sawWalkReaction = false;
    for (let i = 0; i < DAYS; i++) {
      world.dayLoop.nextDay().runDay();
      const funnel = world.capacityManager.getDayFunnel();
      const reveal = buildReveal(funnel, gross, { strong, matched }, [], walkOffs);
      if (reveal.reactions.some((r) => r.id.startsWith('walk-'))) sawWalkReaction = true;
      gross = 0;
      strong = 0;
      matched = 0;
      walkOffs = [];
    }
    expect(sawWalkReaction).toBe(true);
  });

  it('App composition wires the loss narrative into the live floor toast and the walk-off tally', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/text: walkOffReactionText\(walkOff\)/);
    expect(src).toMatch(
      /walkOffsRef\.current = \[\.\.\.walkOffsRef\.current, walkOff\]/,
    );
    expect(src).toMatch(/kind: 'walk'/);
  });
});

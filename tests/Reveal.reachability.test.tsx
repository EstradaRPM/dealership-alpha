import React from 'react';
import { readAppCompositionSource } from './helpers/appComposition';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { DayRecap, type DayRecapModel } from '../src/ui/DayRecap';
import { buildReveal, isCrownworthyRecord } from '../src/ui/Reveal';
import type { ClosedSale, WalkOff, BrokenRecord } from '../src/ui/Reveal';
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
      /buildReveal\(\s*funnel,\s*dayGross,\s*matchTallyRef\.current,\s*closesRef\.current,\s*walkOffsRef\.current,\s*w\.getPrepBet\(\),\s*recordsRef\.current,?\s*\)/,
    );
    expect(src).toMatch(/reveal: buildReveal\(/);
    // #331: the day gross is the engine's, never a tally kept in the hook.
    expect(src).toMatch(/const dayGross = w\.records\.getDayTotals\(\)\.gross;/);
    expect(src).not.toMatch(/grossTodayRef/);
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

// Anti-orphan (#322): the captured morning bet must reach the Reveal as a
// bet→verdict scoreline through the real day-open → day-close pipeline — the
// bet is captured at the day-open verb (nextDay → captureDayStartPrepBet) and
// resolved by buildReveal, not hand-fed a fixture bet.
describe('#322 morning prep bet → verdict scoreline — reachable through the live day flow', () => {
  const PLAIN_MATCH =
    /(filled your lot and your floor\. Good match\.|the crowd wanted .+\. Poor match\.|Right lot, wrong result — .+, none stuck\.)/;

  it('a real day resolves the captured morning bet into a plain-match scoreline', () => {
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
    let walkOffs: WalkOff[] = [];
    bus.subscribe('deal:closed', ({ frontGross, backGross }) => {
      gross += frontGross + backGross;
    });
    bus.subscribe(
      'staff:auto_resolved',
      ({ outcome, matchQuality, customerId, vehicleCategory, archetypeLabel, wantedCategory, reason, grossImpact }) => {
        if (outcome === 'closed') {
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
          return;
        }
        if (archetypeLabel && reason) {
          walkOffs.push({ customerId, archetypeLabel, wantedCategory, reason });
        }
      },
    );

    let sawBetVerdict = false;
    for (let i = 0; i < DAYS; i++) {
      // Mirror the live day-open verb: nextDay() then captureDayStartPrepBet().
      const floor = world.dayLoop.nextDay();
      world.captureDayStartPrepBet();
      floor.runDay();
      const funnel = world.capacityManager.getDayFunnel();
      const prepBet = world.getPrepBet();
      expect(prepBet?.day).toBe(world.clock.currentDay);
      const reveal = buildReveal(funnel, gross, { strong, matched }, closes, walkOffs, prepBet);
      if (PLAIN_MATCH.test(reveal.scoreline)) sawBetVerdict = true;
      gross = 0;
      strong = 0;
      matched = 0;
      closes = [];
      walkOffs = [];
    }
    expect(sawBetVerdict).toBe(true);
  });

  it('App composition captures the bet at the day-open verb and feeds it to the Reveal', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/w\.dayLoop\.nextDay\(\);[\s\S]*?w\.captureDayStartPrepBet\(\);/);
    expect(src).toMatch(/walkOffsRef\.current,\s*w\.getPrepBet\(\),/);
  });
});

// Anti-orphan (#330): a broken high-water mark must reach the Reveal as a
// crowned reaction through the real Records → event → recap pipeline, not just
// via buildReveal called with hand-built fixtures.
describe('#330 crowned record reactions — reachable through the live records flow', () => {
  const RECORD_DAYS = 12;

  it('a real broken mark produces a crown-* reaction on the day-close Reveal', () => {
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
    let matched = 0;
    let records: BrokenRecord[] = [];
    bus.subscribe('deal:closed', ({ frontGross, backGross }) => {
      gross += frontGross + backGross;
    });
    bus.subscribe('staff:auto_resolved', ({ outcome }) => {
      if (outcome === 'closed') matched += 1;
    });
    // Exactly the useDayLoop accumulation: every break of the bite, unfiltered.
    bus.subscribe('records:broken', (r) => {
      records.push(r);
    });

    let sawCrown = false;
    let sawFirstEverMark = false;
    for (let i = 0; i < RECORD_DAYS; i++) {
      world.dayLoop.nextDay().runDay();
      const funnel = world.capacityManager.getDayFunnel();
      // Records settles the day inside floor:day_complete and is wired ahead of
      // the app's day-close handler, so every mark is already accumulated here.
      const reveal = buildReveal(funnel, gross, { strong: 0, matched }, [], [], null, records);
      if (records.some((r) => r.previousValue === null)) sawFirstEverMark = true;
      if (records.some(isCrownworthyRecord)) {
        expect(reveal.reactions.some((x) => x.id.startsWith('crown-'))).toBe(true);
        sawCrown = true;
      } else {
        expect(reveal.reactions.some((x) => x.id.startsWith('crown-'))).toBe(false);
      }
      gross = 0;
      matched = 0;
      records = [];
    }
    // The live career both sets first-ever marks and later beats them; only the
    // beats crown.
    expect(sawFirstEverMark).toBe(true);
    expect(sawCrown).toBe(true);
  });

  it('App composition accumulates records:broken per bite and feeds it to the Reveal', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/bus\.subscribe\('records:broken', onRecordBroken\)/);
    expect(src).toMatch(/recordsRef\.current = \[\]/);
    expect(src).toMatch(/w\.getPrepBet\(\),\s*recordsRef\.current,/);
  });
});

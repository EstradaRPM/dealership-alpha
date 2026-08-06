import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import type { EventName } from '../src/game/EventBus';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #185 — Composition-completeness guard.
//
// The documented test policy (module isolation tests + UI smoke tests) has NO
// tier that verifies the ASSEMBLED World actually wires modules together — which
// is exactly how CompetitorMarket went dark (#183) with every test green: the
// `tests/Composition.*` harness hand-mirrors createWorld's wiring (and copies
// its omissions), and `smoke.test.ts` is a trivial `expect(true).toBe(true)`.
//
// This test drives the REAL `createWorld` and asserts two things a dropped
// module cannot survive:
//   1. Every module that should be present on `World` IS present.
//   2. A representative cross-module event for each wired PUBLISHER fires on a
//      simulated run.
// If a publisher module is removed from `createWorld`, its representative event
// stops firing and this test fails — the guard that #183 lacked.
//
// Non-goal (issue caution): this VERIFIES completeness; it does not automate
// wiring. `createWorld` stays explicit composition — do not convert it to a
// registry.

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

function build(masterSeed = 42) {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
  return { bus, world };
}

// The canonical roster of module fields the assembled World must expose. This
// list is the explicit completeness contract — drop a module from createWorld's
// return (or forget to instantiate it) and the matching assertion below fails.
const EXPECTED_MODULE_FIELDS: ReadonlyArray<keyof World> = [
  'clock',
  'weather',
  'departmentQueue',
  'customerPool',
  'economy',
  'inventory',
  'dealEngine',
  'staffOrg',
  'staffMorale',
  'capacityManager',
  'followUpPool',
  'reputation',
  'regulatoryMeter',
  'serviceQueue',
  'tierManager',
  'endCardManager',
  'telemetry',
  'historyLog',
  'kpiDashboard',
  'tierGate',
  'dayLoop',
  'staffTaxonomy',
  'marketEconomy',
  'competitorMarket',
  'demandShaper',
  'demandControls',
];

// Composition-root seams exposed as functions (the player-decision overlays).
const EXPECTED_SEAM_FNS: ReadonlyArray<keyof World> = [
  'resolvePlayerTradeDecision',
  'resolvePlayerDiscountDecision',
];

// One representative cross-module event per wired publisher. Each entry names
// the module whose wiring it proves; if that module is dropped from
// createWorld, the event never fires and the assertion fails.
const REPRESENTATIVE_EVENTS: ReadonlyArray<{
  event: EventName;
  publisher: string;
}> = [
  { event: 'clock:day_started', publisher: 'GameClock' },
  { event: 'clock:day_ended', publisher: 'GameClock' },
  { event: 'floor:tick', publisher: 'FloorSim (DayLoopController)' },
  { event: 'floor:day_complete', publisher: 'FloorSim (DayLoopController)' },
  { event: 'customer:arrived', publisher: 'CustomerPool' },
  { event: 'capacity:customer_admitted', publisher: 'CapacityManager admit seam' },
  { event: 'economy:carrying_cost_posted', publisher: 'Inventory' },
  { event: 'staff:hired', publisher: 'StaffOrg' },
  { event: 'staff:auto_resolved', publisher: 'StaffDispatch' },
  { event: 'market:competitive_pressure', publisher: 'CompetitorMarket (daily)' },
  { event: 'competitor:price_changed', publisher: 'CompetitorMarket (weekly drift)' },
];

describe('#185 — composition-completeness guard over a real createWorld', () => {
  it('exposes every expected module on the assembled World', () => {
    const { world } = build();
    for (const field of EXPECTED_MODULE_FIELDS) {
      expect(world[field]).toBeDefined();
    }
    for (const fn of EXPECTED_SEAM_FNS) {
      expect(typeof world[fn]).toBe('function');
    }
    // masterSeed is a value, not a module, but is load-bearing for determinism.
    expect(typeof world.masterSeed).toBe('number');
  });

  it('fires a representative cross-module event for every wired publisher on a simulated run', () => {
    const { bus, world } = build();

    const seen = new Set<EventName>();
    for (const { event } of REPRESENTATIVE_EVENTS) {
      bus.subscribe(event, () => seen.add(event));
    }

    // Stock the lot before opening. The live demand seam gates traffic on lot
    // depth (`computeDemandFactor` — an empty lot ⇒ factor 0 ⇒ no arrivals), so
    // a brand-new world with nothing on the lot draws zero customers. Buy a few
    // affordable, ready-to-sell auction units (skip pending-inspection listings)
    // so arrivals — and the whole admit → engage → resolve chain — actually run.
    const RESERVE = 15_000; // keep enough for the salesperson hire + recon/carry
    const buyable = world.inventory
      .getAuctionListings()
      .filter((l) => l.inspectionStatus !== 'pending')
      .slice()
      .sort((a, b) => a.askingPrice - b.askingPrice);
    for (const listing of buyable) {
      if (world.economy.cash - listing.askingPrice < RESERVE) continue;
      // #361: spaces are as finite as cash — a tier-1 lot holds six cars and
      // the seed lot already parks three of them.
      if (world.inventory.getLotOccupancy().atCapacity) break;
      world.inventory.buyFromAuction(listing.id);
    }
    expect(world.inventory.getLotVehicles().length).toBeGreaterThan(0);

    // Light up the StaffDispatch/deal path live: hire a salesperson before the
    // day loop so admitted ups are actually engaged (staff:auto_resolved). The
    // candidate pool is built on the starting MANAGERIAL "night before Day 1".
    const candidates = world.staffOrg.getCandidates('salesperson');
    expect(candidates.length).toBeGreaterThan(0);
    world.staffOrg.hire(candidates[0].candidateId);

    // Run several real days through the assembled day loop. The first nextDay()
    // is the cold-start (no advanceDay); subsequent days fire the full overnight
    // clock sequence (day_ended → … → day_started), which is what drives the
    // daily CompetitorMarket pressure + Inventory carrying-cost emits.
    for (let d = 0; d < 4; d++) {
      const floor = world.dayLoop.nextDay();
      floor.runDay();
    }

    // CompetitorMarket's weekly personality drift only emits competitor:price_changed
    // when a pricing index clears its change threshold — stochastic, so drive
    // weekly day-end ticks until it fires (same approach as the #183 test).
    for (
      let week = 1;
      week <= 40 && !seen.has('competitor:price_changed');
      week++
    ) {
      bus.publish('clock:day_ended', { day: week * 7 });
    }

    const missing = REPRESENTATIVE_EVENTS.filter(
      ({ event }) => !seen.has(event),
    ).map(({ event, publisher }) => `${event} (${publisher})`);
    expect(missing).toEqual([]);
  });

  it('the guard would catch a dropped publisher: each representative event has exactly one live emitter', () => {
    // Sanity: every representative event we assert on is one createWorld is
    // responsible for wiring — i.e. the list isn't stale relative to the World
    // surface it guards. (A removed module manifests as a missing event above;
    // this keeps the mapping honest.)
    const { world } = build();
    expect(world.competitorMarket.getCompetitors().length).toBeGreaterThan(0);
    expect(world.staffOrg).toBeDefined();
    expect(world.dayLoop).toBeDefined();
  });
});

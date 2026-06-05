import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory } from '../src/game/Inventory';
import { createWorld } from '../src/createWorld';
import {
  snapshotWorld,
  restoreWorld,
  WORLD_SNAPSHOT_VERSION,
  type WorldSnapshot,
} from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #188 — the save/load tracer: the world-serialization seam proven end to end
// with the two smallest stateful values (GameClock.day + Economy.cash). Locks
// the WorldSnapshot contract shape every later #186 slice conforms to.

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

describe('GameClock snapshot/restore (#188)', () => {
  it('captures the current day and rehydrates it onto a fresh clock', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    clock.advanceDay();
    clock.advanceDay();
    expect(clock.currentDay).toBe(3);

    const snap = clock.snapshot();
    expect(snap).toEqual({ schemaVersion: 1, day: 3 });

    const fresh = createGameClock({ bus: createEventBus() });
    expect(fresh.currentDay).toBe(1);
    fresh.restore(snap);
    expect(fresh.currentDay).toBe(3);
    // Derived fields follow the restored day.
    expect(fresh.currentSeason).toBe(clock.currentSeason);
    expect(fresh.dayOfWeek).toBe(clock.dayOfWeek);
  });
});

describe('Economy snapshot/restore (#188)', () => {
  it('captures the cash balance and rehydrates it onto a fresh economy', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000 });
    economy.postRevenue(12_500, 'Sale');
    economy.postExpense(2_000, 'Recon');
    expect(economy.cash).toBe(60_500);

    const snap = economy.snapshot();
    expect(snap).toEqual({ schemaVersion: 1, cash: 60_500 });

    const fresh = createEconomy({ bus: createEventBus(), startingCash: 50_000 });
    expect(fresh.cash).toBe(50_000);
    fresh.restore(snap);
    expect(fresh.cash).toBe(60_500);
  });
});

describe('Inventory snapshot/restore (#189)', () => {
  function build(masterSeed = 7) {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 500_000 });
    const inventory = createInventory({ bus, masterSeed, economy });
    return { bus, economy, inventory };
  }

  // The AC: stock a lot, age the units + accrue carrying cost, then prove a
  // restore onto a fresh same-seed module reproduces the lot, aging clocks, and
  // carrying-cost accumulators exactly — not a recompute from scratch.
  it('round-trips lot vehicles, aging, and accrued carrying cost exactly', () => {
    const seed = 7;
    const { bus, inventory } = build(seed);

    // Open Day 1: the auction board generates, then buy a unit so it ages.
    bus.publish('clock:day_started', { day: 1 });
    const listing = inventory.getAuctionListings()[0];
    expect(listing).toBeDefined();
    inventory.buyFromAuction(listing.id);

    // Run several daily passes so the unit accrues recon + carrying cost.
    for (let day = 2; day <= 6; day++) {
      bus.publish('clock:day_started', { day });
    }

    const lotBefore = inventory.getLotVehicles();
    const boardBefore = inventory.getAuctionListings();
    const unit = lotBefore.find((v) => v.id === listing.id)!;
    expect(unit.daysInInventory).toBeGreaterThan(0);
    expect(unit.carryingCostToDate).toBeGreaterThan(0);

    const snap = inventory.snapshot();
    // SaveStore persists plain data — the blob must survive JSON.
    const reparsed = JSON.parse(JSON.stringify(snap)) as typeof snap;
    expect(reparsed).toEqual(snap);

    // A brand-new same-seed module boots with an empty lot...
    const { inventory: fresh } = build(seed);
    expect(fresh.getLotVehicles()).toEqual([]);
    expect(fresh.getAuctionListings()).toEqual([]);

    // ...until we restore the snapshot onto it.
    fresh.restore(reparsed);
    expect(fresh.getLotVehicles()).toEqual(lotBefore);
    expect(fresh.getAuctionListings()).toEqual(boardBefore);
  });

  it('round-trips a held (paid) inspection listing', () => {
    const seed = 7;
    const { bus, inventory } = build(seed);
    bus.publish('clock:day_started', { day: 1 });

    const target = inventory.getAuctionListings()[0];
    inventory.requestInspection(target.id);
    const held = inventory
      .getAuctionListings()
      .find((l) => l.id === target.id)!;
    expect(held.inspectionStatus).toBe('pending');

    const snap = inventory.snapshot();
    expect(snap.pendingInspections).toContainEqual(held);

    const { inventory: fresh } = build(seed);
    fresh.restore(snap);
    const restoredHeld = fresh
      .getAuctionListings()
      .find((l) => l.id === target.id)!;
    expect(restoredHeld).toEqual(held);
  });
});

describe('StaffOrg + StaffMorale snapshot/restore (#190)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  // The AC: hire staff + shift morale → snapshot → restore on a fresh same-seed
  // World → roster + morale match exactly (composites rehydrated, not recomputed
  // from a cold roster).
  it('round-trips the hired roster + morale through the world seam', () => {
    const seed = 909;
    const { bus, world: original } = build(seed);

    // Hire a salesperson off the candidate board.
    const candidate = original.staffOrg.getCandidates('salesperson')[0];
    expect(candidate).toBeDefined();
    original.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    // Shift morale away from the default via a recognized close.
    const baseline = original.staffMorale.getMorale(staffId);
    bus.publish('staff:auto_resolved', {
      customerId: 'c1',
      staffId,
      day: 1,
      outcome: 'closed',
      grossImpact: 2500,
    });
    const shifted = original.staffMorale.getMorale(staffId);
    expect(shifted).toBeGreaterThan(baseline);

    const snap = snapshotWorld(original);
    // SaveStore persists plain data — the blob must survive JSON.
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);

    // A brand-new same-seed World boots with an empty roster...
    const { world: rebuilt } = build(seed);
    expect(rebuilt.staffOrg.currentRoster).toEqual([]);

    // ...until we restore the snapshot onto it.
    restoreWorld(reparsed, rebuilt);

    const restored = rebuilt.staffOrg.currentRoster;
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(staffId);
    // Enumerable record matches the original exactly.
    expect({ ...restored[0] }).toEqual({ ...original.staffOrg.currentRoster[0] });
    // The non-enumerable composites are re-derived, not lost in the JSON trip.
    expect(restored[0].effectiveness).toBe(
      original.staffOrg.currentRoster[0].effectiveness,
    );
    expect(restored[0].trustworthiness).toBe(
      original.staffOrg.currentRoster[0].trustworthiness,
    );
    // Morale restored to the shifted value, not reset to the default.
    expect(rebuilt.staffMorale.getMorale(staffId)).toBe(shifted);
  });
});

describe('MarketEconomy + CompetitorMarket snapshot/restore (#191)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  // The AC: drift the economy (a comp via a real auction buy) + competitors
  // (weekly day_ended ticks) over N days → snapshot → restore on a fresh
  // same-seed World → market + competitor state match exactly.
  it('round-trips comp-history, shocks, and competitor drift through the world seam', () => {
    const seed = 5150;
    const { bus, world: original } = build(seed);

    // Day 1: open the lot and buy a unit → records a wholesale comp.
    bus.publish('clock:day_started', { day: 1 });
    const listing = original.inventory.getAuctionListings()[0];
    original.inventory.buyFromAuction(listing.id);

    // Run days 2..30 with both edges so competitors drift on each %7 tick and
    // the shock scheduler gets its daily roll.
    for (let day = 2; day <= 30; day++) {
      bus.publish('clock:day_started', { day });
      bus.publish('clock:day_ended', { day });
    }

    const snap = snapshotWorld(original);
    // SaveStore persists plain data — the blob must survive JSON.
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);

    // The drift actually moved state off the cold baseline (test is meaningful).
    const { world: cold } = build(seed);
    const coldSnap = snapshotWorld(cold);
    expect(snap.modules.competitorMarket).not.toEqual(
      coldSnap.modules.competitorMarket,
    );
    expect(snap.modules.marketEconomy).not.toEqual(
      coldSnap.modules.marketEconomy,
    );

    // Restore onto a fresh same-seed World...
    const { world: rebuilt } = build(seed);
    restoreWorld(reparsed, rebuilt);

    // ...market + competitor state match the original exactly.
    const restoredSnap = snapshotWorld(rebuilt);
    expect(restoredSnap.modules.marketEconomy).toEqual(
      snap.modules.marketEconomy,
    );
    expect(restoredSnap.modules.competitorMarket).toEqual(
      snap.modules.competitorMarket,
    );
    // The live competitor view (handed out by reference) reflects the restore.
    expect(rebuilt.competitorMarket.getCompetitors()).toEqual(
      original.competitorMarket.getCompetitors(),
    );
  });

  // Persisting the drift RNG cursor (not just the stats) keeps *future* drift
  // on the exact same trajectory the original world was on — so a save/load
  // never diverges the competitor world from a no-save playthrough.
  it('keeps competitor drift deterministic after restore (rng cursor persisted)', () => {
    const seed = 24601;
    const { bus, world: original } = build(seed);
    for (let day = 1; day <= 21; day++) {
      bus.publish('clock:day_started', { day });
      bus.publish('clock:day_ended', { day });
    }

    const snap = snapshotWorld(original);
    const { bus: busR, world: rebuilt } = build(seed);
    restoreWorld(snap, rebuilt);

    // Drive both worlds one more weekly tick from the snapshot point. With the
    // rng cursor restored, the day-28 drift consumes the same random draws.
    for (let day = 22; day <= 28; day++) {
      bus.publish('clock:day_started', { day });
      bus.publish('clock:day_ended', { day });
      busR.publish('clock:day_started', { day });
      busR.publish('clock:day_ended', { day });
    }

    expect(rebuilt.competitorMarket.getCompetitors()).toEqual(
      original.competitorMarket.getCompetitors(),
    );
  });
});

describe('snapshotWorld / restoreWorld seam (#188)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  it('emits the locked envelope shape', () => {
    const { world } = build(42);
    const snap = snapshotWorld(world);
    expect(snap.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(snap.modules.gameClock).toEqual({ schemaVersion: 1, day: 1 });
    expect(snap.modules.economy.schemaVersion).toBe(1);
    expect(typeof snap.modules.economy.cash).toBe('number');
    expect(snap.modules.inventory.schemaVersion).toBe(1);
    expect(Array.isArray(snap.modules.inventory.lotVehicles)).toBe(true);
    expect(snap.modules.staffOrg.schemaVersion).toBe(1);
    expect(Array.isArray(snap.modules.staffOrg.roster)).toBe(true);
    expect(snap.modules.staffMorale.schemaVersion).toBe(1);
    expect(Array.isArray(snap.modules.staffMorale.morale)).toBe(true);
    expect(snap.modules.marketEconomy.schemaVersion).toBe(1);
    expect(snap.modules.marketEconomy.compHistory.schemaVersion).toBe(1);
    expect(snap.modules.marketEconomy.shocks.schemaVersion).toBe(1);
    expect(snap.modules.competitorMarket.schemaVersion).toBe(1);
    expect(Array.isArray(snap.modules.competitorMarket.competitors)).toBe(true);
    expect(typeof snap.modules.competitorMarket.rngState).toBe('number');
  });

  it('round-trips a bought + aged lot through the world seam', () => {
    const seed = 4321;
    const { bus, world: original } = build(seed);

    // Open Day 1, buy a unit, then age it across a few daily passes.
    bus.publish('clock:day_started', { day: 1 });
    const listing = original.inventory.getAuctionListings()[0];
    original.inventory.buyFromAuction(listing.id);
    for (let day = 2; day <= 5; day++) {
      bus.publish('clock:day_started', { day });
    }
    const lotBefore = original.inventory.getLotVehicles();
    expect(lotBefore.length).toBeGreaterThan(0);

    const snap = snapshotWorld(original);

    const { world: rebuilt } = build(seed);
    restoreWorld(snap, rebuilt);
    expect(rebuilt.inventory.getLotVehicles()).toEqual(lotBefore);
  });

  it('is JSON-serializable round-trip (SaveStore persists plain data)', () => {
    const { world } = build(42);
    const snap = snapshotWorld(world);
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);
  });

  // The AC round-trip: advance N days + change cash → snapshot → a NEW World
  // built from the SAME seed (reset to night-before-Day-1) → restore → state
  // matches, rather than the seed-rebuilt cold start.
  it('restores day + cash onto a fresh same-seed World', () => {
    const seed = 1234;
    const { world: original } = build(seed);

    // Mutate both tracked values away from their cold-start defaults.
    original.clock.advanceDay();
    original.clock.advanceDay();
    original.clock.advanceDay();
    original.economy.postRevenue(8_750, 'Sale');
    const expectedDay = original.clock.currentDay; // 4
    const expectedCash = original.economy.cash;
    expect(expectedDay).toBe(4);

    const snap = snapshotWorld(original);

    // A brand-new World from the same seed boots at the cold start...
    const { world: rebuilt } = build(seed);
    expect(rebuilt.clock.currentDay).toBe(1);
    expect(rebuilt.economy.cash).not.toBe(expectedCash);

    // ...until we restore the snapshot onto it.
    restoreWorld(snap, rebuilt);
    expect(rebuilt.clock.currentDay).toBe(expectedDay);
    expect(rebuilt.economy.cash).toBe(expectedCash);
  });
});

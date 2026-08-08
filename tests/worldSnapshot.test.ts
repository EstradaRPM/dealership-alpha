import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory } from '../src/game/Inventory';
import { createReputation } from '../src/game/Reputation';
import { createTierManager } from '../src/game/CareerProgression';
import {
  createMultiSlotSaveStore,
  createInMemoryDriverFactory,
} from '../src/game/SaveStore';
import { createWorld } from '../src/createWorld';
import {
  snapshotWorld,
  restoreWorld,
  migrateWorldSnapshot,
  WORLD_SNAPSHOT_VERSION,
  type WorldSnapshot,
  type PersistedWorldSnapshot,
  type WorldSnapshotMigration,
} from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';
import { createDefaultRecordsSnapshot } from '../src/game/Records';
import {
  createDefaultFacilitySnapshot,
  ceilingsAtTier,
  loadFacilityData,
} from '../src/game/Facility';

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
    expect(snap).toEqual({
      schemaVersion: 1,
      cash: 60_500,
      inventoryAcquisitionSpend: 0,
      // #351: the ledger round-trips, so a P&L window that spans a save/load is
      // continuous instead of restarting empty.
      ledger: [
        { day: 1, type: 'revenue', amount: 12_500, label: 'Sale' },
        { day: 1, type: 'expense', amount: 2_000, label: 'Recon' },
      ],
    });

    const fresh = createEconomy({ bus: createEventBus(), startingCash: 50_000 });
    expect(fresh.cash).toBe(50_000);
    fresh.restore(snap);
    expect(fresh.cash).toBe(60_500);
  });

  it('round-trips the lifetime inventory-acquisition spend (#255)', () => {
    const economy = createEconomy({ bus: createEventBus(), startingCash: 100_000 });
    economy.postExpense(38_000, 'Auction purchase: v1', 'inventoryAcquisition');
    economy.postExpense(500, 'Inspection: v2'); // uncategorized → operating
    expect(economy.inventoryAcquisitionSpend).toBe(38_000);

    const fresh = createEconomy({ bus: createEventBus(), startingCash: 100_000 });
    fresh.restore(economy.snapshot());
    expect(fresh.cash).toBe(61_500);
    expect(fresh.inventoryAcquisitionSpend).toBe(38_000);
  });

  it('restores a pre-#255 snapshot (no acquisition field) to a zero counter', () => {
    const fresh = createEconomy({ bus: createEventBus(), startingCash: 10_000 });
    fresh.restore({ schemaVersion: 1, cash: 42_000 });
    expect(fresh.cash).toBe(42_000);
    expect(fresh.inventoryAcquisitionSpend).toBe(0);
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

  it('migrates pre-wage saves by stamping paidGrade from current grade', () => {
    // `paidGrade` (#353) lives inside the staffOrg blob, so it is that module's
    // schema problem, not an envelope bump: a save written before the wage book
    // simply lacks the field, and restore materializes it from what the person
    // is worth now. Behavior-neutral — they come back paid what they're
    // currently worth, so the raise trigger starts quiet exactly as at hire.
    const seed = 411;
    const { world: original } = build(seed);
    original.staffOrg.hire(original.staffOrg.getCandidates('salesperson')[0].candidateId);

    const snap = JSON.parse(JSON.stringify(snapshotWorld(original))) as WorldSnapshot;
    const roster = (snap.modules.staffOrg as unknown as { roster: Record<string, unknown>[] })
      .roster;
    expect(roster).toHaveLength(1);
    expect(roster[0].paidGrade).toBeDefined();
    // Age the save back: strip the field the way a pre-#353 save never had it.
    delete roster[0].paidGrade;

    const { world: rebuilt } = build(seed);
    restoreWorld(snap, rebuilt);

    const row = rebuilt.staffOrg.getPayBoard()[0];
    expect(row.paidGrade).toBe(row.grade);
    expect(row.dailyWage).toBeGreaterThan(0);
    expect(rebuilt.staffOrg.dailyPayroll).toBe(row.dailyWage);
  });

  it('round-trips an outstanding raise request and its cooldown', () => {
    // #356. A raise demand is a decision the player has been handed and not yet
    // made — losing it on reload would quietly answer it for them, and losing a
    // refusal cooldown would make reloading the way to stop someone re-asking.
    // Both live inside the staffOrg blob, so this is the module's own schema
    // business and needs no envelope bump.
    const seed = 3563;
    const { world: original } = build(seed);
    const candidate = original.staffOrg.getCandidates('salesperson')[2];
    original.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    // Put them on a grade they have outgrown, then let the morning ask.
    const staffSnap = original.staffOrg.snapshot();
    original.staffOrg.restore({
      ...staffSnap,
      // The agreed wage goes with the grade (#357) — `restore` reprices from
      // `paidGrade` when it is absent, which is the outgrown-rookie state.
      roster: staffSnap.roster.map((s) =>
        s.id === staffId ? { ...s, paidGrade: 1, paidWage: undefined } : s,
      ),
    });
    original.clock.advanceDay();
    const demand = original.staffOrg.getRaiseRequest(staffId);
    expect(demand).not.toBeNull();

    const snap = JSON.parse(JSON.stringify(snapshotWorld(original))) as WorldSnapshot;
    const { world: rebuilt } = build(seed);
    restoreWorld(snap, rebuilt);

    expect(rebuilt.staffOrg.getRaiseRequest(staffId)).toEqual(demand);

    // The cooldown half: refuse, save again, and the reloaded world stays quiet
    // the next morning rather than re-asking.
    original.staffOrg.refuseRaise(staffId);
    const refusedSnap = JSON.parse(
      JSON.stringify(snapshotWorld(original)),
    ) as WorldSnapshot;
    const { world: afterRefusal } = build(seed);
    restoreWorld(refusedSnap, afterRefusal);
    afterRefusal.clock.advanceDay();
    expect(afterRefusal.staffOrg.getRaiseRequest(staffId)).toBeNull();
  });

  it('round-trips an outstanding rival offer', () => {
    // #357. An offer with a deadline on it is the one piece of staff state a
    // reload could be used to game in either direction: lose it and the player
    // keeps someone a rival had already taken; lose the deadline and the
    // decision never expires. It rides the same staffOrg blob as the raise it
    // extends, so again no envelope bump.
    const seed = 3572;
    const { world: original } = build(seed);
    const candidate = original.staffOrg.getCandidates('salesperson')[0];
    original.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    // Let the world's own rivals make the approach — an offer crafted by hand
    // would round-trip a shape rather than the thing the game produces.
    let offer = null as ReturnType<typeof original.staffOrg.getRaiseRequest>;
    for (let i = 0; i < 200; i++) {
      original.clock.advanceDay();
      const request = original.staffOrg.getRaiseRequest(staffId);
      if (request?.rivalName !== undefined) {
        offer = request;
        break;
      }
      if (request) original.staffOrg.acceptRaise(staffId);
    }
    expect(offer).not.toBeNull();

    const snap = JSON.parse(JSON.stringify(snapshotWorld(original))) as WorldSnapshot;
    const { world: rebuilt } = build(seed);
    restoreWorld(snap, rebuilt);

    expect(rebuilt.staffOrg.getRaiseRequest(staffId)).toEqual(offer);
    // And the wage they are on comes back too — a matched offer pays over the
    // grade's book wage, so a reload that re-derived it would quietly cut
    // someone's pay.
    expect(rebuilt.staffOrg.getPayBoard()[0].dailyWage).toBe(
      original.staffOrg.getPayBoard()[0].dailyWage,
    );
  });

  it('round-trips newly hireable manager roles and keeps fired staff removed', () => {
    const seed = 204;
    const { world: original } = build(seed);
    original.tierManager.restoreState({
      currentTier: 3,
      businessName: '',
      accentColor: '#38bdf8',
      fontId: 'prestige',
      customersServed: 0,
    });

    const fniCandidate = original.staffOrg.getCandidates('f&i-manager')[0];
    const ucmCandidate = original.staffOrg.getCandidates('used-car-manager')[0];
    expect(fniCandidate).toBeDefined();
    expect(ucmCandidate).toBeDefined();

    original.staffOrg.hire(fniCandidate.candidateId);
    original.staffOrg.hire(ucmCandidate.candidateId);
    original.staffOrg.fire(fniCandidate.staff.id);

    const snap = JSON.parse(JSON.stringify(snapshotWorld(original))) as WorldSnapshot;
    const { world: rebuilt } = build(seed);
    restoreWorld(snap, rebuilt);

    expect(rebuilt.staffOrg.currentRoster.map((s) => s.role_id)).toEqual([
      'used-car-manager',
    ]);
    expect(
      rebuilt.staffOrg.currentRoster.some((s) => s.id === fniCandidate.staff.id),
    ).toBe(false);
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

describe('Reputation snapshot/restore (#192)', () => {
  it('captures the three scalars and rehydrates them onto a fresh reputation', () => {
    const bus = createEventBus();
    const reputation = createReputation({ bus });

    // Shift all three scalars off their cold-start defaults.
    reputation.setMarketingBudget(750);
    bus.publish('deal:closed', { /* bumps satisfaction + review */ } as never);
    bus.publish('reputation:satisfaction_hit', { day: 1, amount: -4, reason: 'test' });
    const satBefore = reputation.customerSatisfaction;
    const reviewBefore = reputation.reviewScore;

    const snap = reputation.snapshot();
    // v2 since #151 folded per-brand standings into the blob — the module's own
    // schemaVersion, not an envelope bump (the `modules` key set is unchanged).
    expect(snap.schemaVersion).toBe(2);
    expect(snap.marketingBudget).toBe(750);

    const fresh = createReputation({ bus: createEventBus() });
    expect(fresh.marketingBudget).toBe(0);
    fresh.restore(snap);
    expect(fresh.customerSatisfaction).toBe(satBefore);
    expect(fresh.reviewScore).toBe(reviewBefore);
    expect(fresh.marketingBudget).toBe(750);
  });
});

describe('TierManager snapshot/restore (#192, streak fields #250)', () => {
  // Stub config: 3 tiers, no thresholds (advancement is streak-based, #250).
  const STUB_CONFIG = {
    checkIntervalDays: 28,
    tiers: [
      { tier: 1, label: 'Gravel Yard', illustration: '🏚', caption: 'awaits' },
      { tier: 2, label: 'Paved Lot', illustration: '🏗', caption: 'shape' },
      { tier: 3, label: 'Small Showroom', illustration: '🏢', caption: 'protect' },
    ],
    accentOptions: [{ id: 'gold', label: 'Gold', color: '#c8a96e' }],
    fontOptions: [{ id: 'classic', label: 'Classic' }],
  };

  it('round-trips tier, business identity, career progress, and streak exactly', () => {
    const bus = createEventBus();
    const tm = createTierManager({
      bus,
      config: STUB_CONFIG,
      streaksByTier: { 1: 1, 2: 2, 3: 3 },
    });

    // Progress career (customersServed) + advance the tier off the gate verdict.
    for (let i = 0; i < 6; i++) {
      bus.publish('customer:resolved', {
        customerId: `c${i}`, outcome: 'closed', receptivity: 0.5,
        satisfaction: 1, retentionSeed: 0.5, heat: 0, agreedPrice: 0, frontGross: 0,
      });
    }
    bus.publish('tierGate:month_verdict', { day: 30, month: 1, tier: 1, overall: 'meet', faces: [] });
    bus.publish('tierGate:month_verdict', { day: 60, month: 2, tier: 2, overall: 'meet', faces: [] });
    tm.applyTierUp({ businessName: 'Revived Rides', accentColor: '#c8a96e', fontId: 'classic' });
    expect(tm.currentTier).toBe(2);
    expect(tm.monthStreak).toBe(1);

    const snap = tm.snapshot();
    expect(snap.schemaVersion).toBe(2);

    const tm2 = createTierManager({
      bus: createEventBus(),
      config: STUB_CONFIG,
      streaksByTier: { 1: 1, 2: 2, 3: 3 },
    });
    tm2.restore(snap);
    expect(tm2.currentTier).toBe(2);
    expect(tm2.businessName).toBe('Revived Rides');
    expect(tm2.accentColor).toBe('#c8a96e');
    expect(tm2.customersServed).toBe(6);
    expect(tm2.monthStreak).toBe(1);
  });
});

describe('Reputation + CareerProgression through the world seam (#192)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  // The AC: change reputation, rename, progress career → snapshot → restore on a
  // fresh same-seed World → reputation standing, business identity, and career
  // progress all match exactly.
  it('round-trips reputation, business identity, and career progress', () => {
    const seed = 7777;
    const { bus, world: original } = build(seed);

    original.reputation.setMarketingBudget(500);
    bus.publish('reputation:satisfaction_hit', { day: 1, amount: -6, reason: 'test' });
    original.tierManager.applyTierUp({
      businessName: 'Estrada Motors', accentColor: '#818cf8', fontId: 'prestige',
    });
    for (let i = 0; i < 12; i++) {
      bus.publish('customer:resolved', {
        customerId: `c${i}`, outcome: 'walk', receptivity: 0.3,
        satisfaction: 0, retentionSeed: 0.5, heat: 0, agreedPrice: 0, frontGross: 0,
      });
    }

    const satBefore = original.reputation.customerSatisfaction;
    const reviewBefore = original.reputation.reviewScore;
    const servedBefore = original.tierManager.customersServed;
    expect(servedBefore).toBe(12);

    const snap = snapshotWorld(original);
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);

    // Fresh same-seed World boots at the cold start...
    const { world: rebuilt } = build(seed);
    expect(rebuilt.tierManager.businessName).not.toBe('Estrada Motors');
    expect(rebuilt.reputation.marketingBudget).toBe(0);

    // ...until we restore the snapshot onto it.
    restoreWorld(reparsed, rebuilt);
    expect(rebuilt.reputation.customerSatisfaction).toBe(satBefore);
    expect(rebuilt.reputation.reviewScore).toBe(reviewBefore);
    expect(rebuilt.reputation.marketingBudget).toBe(500);
    expect(rebuilt.tierManager.businessName).toBe('Estrada Motors');
    expect(rebuilt.tierManager.accentColor).toBe('#818cf8');
    expect(rebuilt.tierManager.fontId).toBe('prestige');
    expect(rebuilt.tierManager.customersServed).toBe(servedBefore);
  });
});

describe('RegulatoryMeter through the world seam (#205)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  it('round-trips regulatory pressure through the world seam', () => {
    const seed = 205;
    const { bus, world: original } = build(seed);

    bus.publish('capacity:missed_opportunity', {
      day: 1,
      customerId: 'missed-1',
      label: 'Missed buyer',
    });
    const pressureBefore = original.regulatoryMeter.pressure;
    expect(pressureBefore).toBeGreaterThan(0);

    const snap = snapshotWorld(original);
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);

    const { world: rebuilt } = build(seed);
    expect(rebuilt.regulatoryMeter.pressure).toBe(0);
    restoreWorld(reparsed, rebuilt);

    expect(rebuilt.regulatoryMeter.pressure).toBe(pressureBefore);
    expect(rebuilt.regulatoryMeter.isTerminal).toBe(
      original.regulatoryMeter.isTerminal,
    );
    expect(rebuilt.regulatoryMeter.suspensionDaysRemaining).toBe(
      original.regulatoryMeter.suspensionDaysRemaining,
    );
  });
});

describe('FollowUpPool + queues + KPIDashboard + Telemetry through the world seam (#193)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  // #365 split back gross into products + reserve. That is a change INSIDE the
  // KPIDashboard blob, not to the set of `modules` keys, so per
  // docs/save-migration-recipe.md it belongs to the module's own restore and
  // the envelope version does not move. A save written before the split has
  // neither half, and materializing them as zeroes is the only honest reading:
  // the deal's `backGross` is real and stays whole, but nothing in the record
  // says how much of it was reserve, so it claims none.
  it('migrates pre-reserve KPI day records', () => {
    const { world } = build(4242);
    world.kpiDashboard.restore({
      schemaVersion: 1,
      dailyCarryingCost: 0,
      deals: [
        {
          day: 3,
          frontGross: 1_500,
          backGross: 900,
          daysInInventory: 12,
          agreedPrice: 20_000,
          paymentMethod: 'finance',
          downPayment: 6_000,
          term: 60,
          apr: 0.079,
        },
      ],
    });

    const snap = world.kpiDashboard.getSnapshot();
    expect(snap.unitsRetailed).toBe(1);
    expect(snap.avgBackGross).toBe(900);
    expect(snap.productGross).toBe(0);
    expect(snap.reserveGross).toBe(0);

    const [day] = world.kpiDashboard.getDailyTotals({ fromDay: 3, toDay: 3 });
    expect(day.backGross).toBe(900);
    expect(day.productGross).toBe(0);
    expect(day.reserveGross).toBe(0);

    // Re-snapshotting carries the materialized zeroes forward, so the blob is
    // current-shape after one save/load rather than staying pre-split forever.
    const [record] = world.kpiDashboard.snapshot().deals;
    expect(record.productGross).toBe(0);
    expect(record.reserveGross).toBe(0);
  });

  // The AC: enqueue follow-ups + service/dept work, accumulate KPIs + telemetry,
  // snapshot, then restore on a fresh same-seed World — all five modules match
  // exactly (queued work, open follow-ups, and accumulated metrics continuous).
  it('round-trips pending work + accumulated metrics through the world seam', () => {
    const seed = 31337;
    const { bus, world: original } = build(seed);

    // Telemetry on so the buffer accumulates as we drive the world.
    original.telemetry.setEnabled(true);

    // Day 1: open the lot, admit a customer (→ DepartmentQueue sales item),
    // and buy a unit (→ KPI carrying-cost reading later, inventory churn).
    bus.publish('clock:day_started', { day: 1 });
    bus.publish('capacity:customer_admitted', {
      day: 1,
      customerId: 'walkin-1',
      label: 'Tire-Kicker',
    });

    // A walked customer with leftover heat enters the FollowUpPool. The pool
    // owns session creation, so spawn a real one before resolving it as a walk.
    const walkerId = original.customerPool.spawnCustomer(
      'young_family', 'family_vehicle_search', 'Young Family',
    );
    bus.publish('customer:resolved', {
      customerId: walkerId, outcome: 'walk', receptivity: 0.4,
      satisfaction: 0, retentionSeed: 0.5, heat: 0.8, agreedPrice: 0, frontGross: 0,
    });
    expect(original.followUpPool.getFollowUps().length).toBeGreaterThan(0);

    // A closed deal so the KPIDashboard accumulates a real deal record.
    bus.publish('deal:closed', {
      frontGross: 1500, backGross: 900, daysInInventory: 12, agreedPrice: 20000,
      paymentMethod: 'finance', downPayment: 6000, term: 60, apr: 7.9,
    } as never);
    bus.publish('economy:carrying_cost_posted', { day: 1, totalCost: 137 } as never);

    const kpiBefore = original.kpiDashboard.getSnapshot();
    expect(kpiBefore.unitsRetailed).toBe(1);
    const salesBadgeBefore = original.departmentQueue.getBadgeCount('sales');
    expect(salesBadgeBefore).toBeGreaterThan(0);
    const telemetryCountBefore = original.telemetry.getEventCount();
    expect(telemetryCountBefore).toBeGreaterThan(0);

    const snap = snapshotWorld(original);
    // SaveStore persists plain data — the blob must survive JSON.
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);

    // A brand-new same-seed World boots with empty queues + zeroed metrics...
    const { world: rebuilt } = build(seed);
    expect(rebuilt.followUpPool.getFollowUps()).toEqual([]);
    expect(rebuilt.departmentQueue.getBadgeCount('sales')).toBe(0);
    expect(rebuilt.kpiDashboard.getSnapshot().unitsRetailed).toBe(0);
    expect(rebuilt.telemetry.getEventCount()).toBe(0);

    // ...until we restore the snapshot onto it.
    restoreWorld(reparsed, rebuilt);

    expect(rebuilt.followUpPool.getFollowUps()).toEqual(
      original.followUpPool.getFollowUps(),
    );
    expect(rebuilt.followUpPool.getArchived()).toEqual(
      original.followUpPool.getArchived(),
    );
    expect(rebuilt.departmentQueue.getBadges()).toEqual(
      original.departmentQueue.getBadges(),
    );
    expect(rebuilt.departmentQueue.getQueue('sales')).toEqual(
      original.departmentQueue.getQueue('sales'),
    );
    expect(rebuilt.kpiDashboard.getSnapshot()).toEqual(kpiBefore);
    expect(rebuilt.telemetry.getRawEvents()).toEqual(
      original.telemetry.getRawEvents(),
    );
    expect(rebuilt.telemetry.getMetrics()).toEqual(
      original.telemetry.getMetrics(),
    );
  });

  it('restores the ServiceQueue tier gate so Tier 2+ intake resumes after load', () => {
    const seed = 808;
    const { bus, world: original } = build(seed);

    // Reach Tier 2 so ServiceQueue starts producing intake.
    bus.publish('career:tier_up', { fromTier: 1, toTier: 2 } as never);
    expect(original.serviceQueue.snapshot().currentTier).toBe(2);

    const snap = snapshotWorld(original);

    // Fresh same-seed World is at Tier 1 (gate closed)...
    const { bus: busR, world: rebuilt } = build(seed);
    expect(rebuilt.serviceQueue.snapshot().currentTier).toBe(1);

    // ...restore reopens the gate, so the next morning produces service intake.
    restoreWorld(snap, rebuilt);
    expect(rebuilt.serviceQueue.snapshot().currentTier).toBe(2);
    busR.publish('clock:day_started', { day: 2 });
    expect(rebuilt.departmentQueue.getBadgeCount('service')).toBeGreaterThan(0);
  });

  it('advances the DepartmentQueue id counter past restored ids (no collisions)', () => {
    const seed = 4242;
    const { bus, world: original } = build(seed);
    bus.publish('clock:day_started', { day: 1 });
    bus.publish('capacity:customer_admitted', {
      day: 1, customerId: 'c-collide', label: 'Buyer',
    });
    const snap = snapshotWorld(original);

    const { bus: busR, world: rebuilt } = build(seed);
    restoreWorld(snap, rebuilt);

    // Enqueue fresh work post-restore; every id must stay unique.
    busR.publish('clock:day_started', { day: 2 });
    busR.publish('capacity:customer_admitted', {
      day: 2, customerId: 'c-new', label: 'Buyer',
    });
    const allIds = (['sales', 'service', 'bdc', 'office', 'lot'] as const)
      .flatMap((d) => rebuilt.departmentQueue.getQueue(d).map((i) => i.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe('DemandShaper through the world seam (#210)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  // The AC: save/load reproduces the demand "weather" the player was reading:
  // current baseline mix, active influence inputs, and trailing observed history.
  it('round-trips the mix and observed arrival history exactly', () => {
    const seed = 9876;
    const { world: original } = build(seed);
    original.demandShaper.setMix({
      sedan: 4,
      truck: 3,
      suv: 2,
    });
    original.demandShaper.recordArrival('truck');
    original.demandShaper.recordArrival('suv');
    original.demandShaper.recordArrival('truck');
    original.demandShaper.recordArrival('sedan');

    const snap = snapshotWorld(original);
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);
    expect(reparsed.modules.demandShaper).toEqual(
      original.demandShaper.snapshot(),
    );

    const { world: rebuilt } = build(seed);
    expect(rebuilt.demandShaper.getMix()).not.toEqual(
      original.demandShaper.getMix(),
    );
    expect(rebuilt.demandShaper.snapshot().observedHistory).toEqual([]);

    restoreWorld(reparsed, rebuilt);

    expect(rebuilt.demandShaper.snapshot()).toEqual(
      original.demandShaper.snapshot(),
    );
    expect(rebuilt.demandShaper.getObservedMix()).toEqual(
      original.demandShaper.getObservedMix(),
    );
  });

  it('round-trips advertising lever target and lag state through the world seam', () => {
    const seed = 9876;
    const { bus, world: original } = build(seed);
    original.demandControls.setAdvertisingCampaign('local-radio');
    bus.publish('clock:day_started', { day: 1 });

    const originalInput = original.demandShaper
      .getInfluenceInputs()
      .find((input) => input.producer === 'advertising')!;
    expect(originalInput).toBeDefined();
    expect(originalInput.weights.suv).toBeGreaterThan(0);
    expect(originalInput.weights.suv).toBeLessThan(
      originalInput.targetWeights.suv,
    );

    const snap = snapshotWorld(original);
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);

    const { world: rebuilt } = build(seed);
    expect(rebuilt.demandControls.getAdvertisingCampaignId()).toBe('none');
    restoreWorld(reparsed, rebuilt);

    expect(rebuilt.demandControls.getAdvertisingCampaignId()).toBe('local-radio');
    expect(
      rebuilt.demandShaper
        .getInfluenceInputs()
        .find((input) => input.producer === 'advertising'),
    ).toEqual(originalInput);
  });
});

describe('Multi-slot world persistence (#194)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  // The App wiring (#194): on a day boundary the world snapshot is autosaved
  // into the ACTIVE slot; on reload a fresh same-seed World is rebuilt and the
  // active slot's snapshot is restored onto it. This exercises that round-trip
  // at the store seam (App composes exactly this MultiSlotSaveStore + the
  // snapshotWorld/restoreWorld pair).
  it('autosaves the world into the active slot and restores it on reload', async () => {
    const seed = 111;
    const slots = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await slots.createSlot('Save 1'); // auto-activates

    const { world } = build(seed);
    world.clock.advanceDay();
    world.clock.advanceDay();
    world.economy.postRevenue(5_000, 'Sale');
    const expectedDay = world.clock.currentDay;
    const expectedCash = world.economy.cash;

    await slots.save(
      { character: PROFILE, masterSeed: seed, world: snapshotWorld(world) },
      { day: expectedDay, tier: world.tierManager.currentTier },
    );

    // Reload: the active slot's blob carries the seed + the world snapshot.
    const loaded = await slots.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.masterSeed).toBe(seed);

    // A brand-new same-seed World boots cold, then the snapshot restores it.
    const { world: rebuilt } = build(seed);
    expect(rebuilt.clock.currentDay).toBe(1);
    restoreWorld(loaded!.world as WorldSnapshot, rebuilt);
    expect(rebuilt.clock.currentDay).toBe(expectedDay);
    expect(rebuilt.economy.cash).toBe(expectedCash);

    // Slot metadata reflects the saved day for the picker (#195).
    const meta = (await slots.listSlots())[0];
    expect(meta.day).toBe(expectedDay);
  });

  it('keeps two slots fully independent — no world bleed', async () => {
    const slots = createMultiSlotSaveStore(createInMemoryDriverFactory());
    const a = await slots.createSlot('Game A'); // active
    const { world: wa } = build(111);
    wa.clock.advanceDay();
    wa.economy.postRevenue(1_000, 'Sale');
    await slots.save(
      { masterSeed: 111, world: snapshotWorld(wa) },
      { day: wa.clock.currentDay, tier: wa.tierManager.currentTier },
    );

    const b = await slots.createSlot('Game B');
    await slots.selectSlot(b.id);
    const { world: wb } = build(222);
    wb.economy.postExpense(2_000, 'Recon');
    await slots.save(
      { masterSeed: 222, world: snapshotWorld(wb) },
      { day: wb.clock.currentDay, tier: wb.tierManager.currentTier },
    );

    // The active slot (B) loads B's seed + world, untouched by A's save.
    const lb = await slots.load();
    expect(lb!.masterSeed).toBe(222);
    expect((lb!.world as WorldSnapshot).modules.gameClock.day).toBe(
      wb.clock.currentDay,
    );
    expect((lb!.world as WorldSnapshot).modules.economy.cash).toBe(
      wb.economy.cash,
    );

    // Switching back to A loads A's independent world — no bleed from B.
    await slots.selectSlot(a.id);
    const la = await slots.load();
    expect(la!.masterSeed).toBe(111);
    expect((la!.world as WorldSnapshot).modules.gameClock.day).toBe(
      wa.clock.currentDay,
    );
    expect((la!.world as WorldSnapshot).modules.economy.cash).toBe(
      wa.economy.cash,
    );
  });
});

describe('world-snapshot versioning + migrations (#196)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  it('stamps the current envelope version on every snapshot', () => {
    const { world } = build(42);
    expect(snapshotWorld(world).version).toBe(WORLD_SNAPSHOT_VERSION);
  });

  it('migrates pre-DemandShaper snapshots by adding a default shaper blob', () => {
    const { world } = build(4242);
    const current = snapshotWorld(world);
    const { demandShaper, regulatoryMeter, ...legacyModules } = current.modules;
    expect(demandShaper.schemaVersion).toBe(3);
    expect(regulatoryMeter.pressure).toBe(0);
    const persisted: PersistedWorldSnapshot = {
      version: 1,
      modules: legacyModules,
    };

    const migrated = migrateWorldSnapshot(persisted);

    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(migrated.modules.demandShaper).toEqual({
      schemaVersion: 3,
      baselineMix: {
        sedan: 1,
        truck: 1,
        suv: 1,
      },
      activeInputs: [],
      observedHistory: [],
    });
    expect(migrated.modules.regulatoryMeter).toEqual({
      pressure: 0,
      isTerminal: false,
      suspensionDaysRemaining: 0,
    });
  });

  it('migrates a v19 snapshot by materializing an unsubscribed MarketIntel (#178)', () => {
    const { world } = build(178);
    const current = snapshotWorld(world);
    const { marketIntel, ...legacyModules } = current.modules;
    expect(marketIntel.schemaVersion).toBe(1);

    const persisted: PersistedWorldSnapshot = { version: 19, modules: legacyModules };
    const migrated = migrateWorldSnapshot(persisted);

    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    // Behavior-neutral: a loaded career is subscribed to nothing, which is what
    // it was already paying for.
    expect(migrated.modules.marketIntel).toEqual({
      schemaVersion: 1,
      activeSubscriptions: [],
    });
    // …and every pre-existing blob rides through untouched.
    expect(migrated.modules.gameClock).toEqual(current.modules.gameClock);
    expect(migrated.modules.records).toEqual(current.modules.records);
  });

  it('round-trips built facility capacity (#358)', () => {
    const { world } = build(358);
    const built = world.facility.getBuilt();
    // A fresh Tier-1 world holds the tier's constants — the numbers the retired
    // `baysByTier` was giving it.
    expect(built).toEqual(world.facility.getCeilings());

    const persisted = JSON.parse(
      JSON.stringify(snapshotWorld(world)),
    ) as PersistedWorldSnapshot;
    const { world: rebuilt } = build(358);
    restoreWorld(persisted, rebuilt);
    expect(rebuilt.facility.getBuilt()).toEqual(built);
  });

  it('round-trips an in-flight construction job (#359)', () => {
    const { world } = build(359);
    // Stand the store below its ceiling — the state a tier-up leaves it in —
    // then buy the block that closes the gap.
    const ceiling = world.facility.getCeilings();
    world.facility.restore({
      schemaVersion: 2,
      built: { ...world.facility.getBuilt(), lotSpaces: ceiling.lotSpaces - 1 },
      jobs: [],
      jobSeq: 0,
    });
    expect(world.facility.build('lotSpaces').ok).toBe(true);
    const inFlight = world.facility.getJobs();
    expect(inFlight).toHaveLength(1);

    const persisted = JSON.parse(
      JSON.stringify(snapshotWorld(world)),
    ) as PersistedWorldSnapshot;
    const { world: rebuilt } = build(359);
    restoreWorld(persisted, rebuilt);

    // The landing day rides through unchanged — a reload must not restart the
    // clock on a job the player has already paid for.
    expect(rebuilt.facility.getJobs()).toEqual(inFlight);
    expect(rebuilt.facility.getBuilt().lotSpaces).toBe(ceiling.lotSpaces - 1);
  });

  it("migrates pre-facility saves to the tier's constant capacity (#358)", () => {
    const { world } = build(3581);
    const current = snapshotWorld(world);
    const { facility, ...legacyModules } = current.modules;
    expect(facility.schemaVersion).toBe(2);

    // A v20 save that had reached Tier 3: the migration must read that save's
    // ACTUAL tier, not default to 1, or the store would silently lose the bays
    // it had been running on.
    const persisted: PersistedWorldSnapshot = {
      version: 20,
      modules: {
        ...legacyModules,
        tierManager: { ...current.modules.tierManager, currentTier: 3 },
      },
    };
    const migrated = migrateWorldSnapshot(persisted);

    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(migrated.modules.facility).toEqual(createDefaultFacilitySnapshot(3));
    // Those ARE the numbers a Tier-3 store was already running.
    expect(migrated.modules.facility.built.serviceBays).toBe(
      ceilingsAtTier(loadFacilityData(), 3).serviceBays,
    );
    // …and every pre-existing blob rides through untouched.
    expect(migrated.modules.gameClock).toEqual(current.modules.gameClock);
  });

  // The AC round-trip: write a save at version N, bump the runtime to N+1 with a
  // registered migration, load → the older snapshot upgrades correctly.
  it('upgrades an older snapshot through a registered migration on load', () => {
    const seed = 9001;
    const { world } = build(seed);
    world.clock.advanceDay();
    world.economy.postRevenue(3_000, 'Sale');

    // A current snapshot persisted to "disk" and read back as plain data.
    const v2 = snapshotWorld(world);
    const persisted = JSON.parse(JSON.stringify(v2)) as PersistedWorldSnapshot;
    expect(persisted.version).toBe(WORLD_SNAPSHOT_VERSION);

    // Simulate a future schema change one version past the current envelope: it
    // adds a module key via a registered step (injected so we needn't ship a
    // real future version).
    const future = WORLD_SNAPSHOT_VERSION + 1;
    const migrations: Record<number, WorldSnapshotMigration> = {
      [WORLD_SNAPSHOT_VERSION]: (snap) => ({
        version: future,
        modules: { ...snap.modules, widgets: { schemaVersion: 1, count: 0 } },
      }),
    };

    const migrated = migrateWorldSnapshot(persisted, migrations, future);
    expect(migrated.version).toBe(future);
    // Pre-existing module blobs survive the bump untouched...
    expect(migrated.modules.gameClock).toEqual(v2.modules.gameClock);
    expect(migrated.modules.economy).toEqual(v2.modules.economy);
    // ...and the new key is materialized at its default.
    expect((migrated.modules as Record<string, unknown>).widgets).toEqual({
      schemaVersion: 1,
      count: 0,
    });
  });

  it('is a no-op pass-through for a snapshot already at the current version', () => {
    const { world } = build(7);
    const snap = snapshotWorld(world);
    expect(migrateWorldSnapshot(snap)).toEqual(snap);
  });

  it('fails safe on a snapshot written by a newer runtime', () => {
    const { world } = build(7);
    const fromFuture = {
      ...snapshotWorld(world),
      version: WORLD_SNAPSHOT_VERSION + 1,
    };
    expect(() => migrateWorldSnapshot(fromFuture)).toThrow(/newer game version/);
    // The same guard protects the restore funnel, so a too-new blob never
    // half-rehydrates onto a live World.
    const { world: target } = build(7);
    expect(() => restoreWorld(fromFuture, target)).toThrow(/newer game version/);
  });

  it('fails safe when a migration step is missing (no silent corruption)', () => {
    const { world } = build(7);
    const v1 = snapshotWorld(world);
    // Runtime claims two versions ahead but only the *upper* step exists; the
    // gap at the current version must throw rather than restore a shape
    // mismatched to the current modules.
    const gap = WORLD_SNAPSHOT_VERSION; // missing step: gap → gap+1
    const upper = WORLD_SNAPSHOT_VERSION + 1; // present step: upper → upper+1
    const migrations: Record<number, WorldSnapshotMigration> = {
      [upper]: (snap) => ({ ...snap, version: upper + 1 }),
    };
    expect(() => migrateWorldSnapshot(v1, migrations, upper + 1)).toThrow(
      new RegExp(`No world-snapshot migration registered from v${gap}`),
    );
  });

  it('round-trips the captured morning prep bet through the world seam (#322)', () => {
    const { world } = build(7);
    world.dayLoop.nextDay();
    world.captureDayStartPrepBet();
    const bet = world.getPrepBet();
    expect(bet?.day).toBe(world.clock.currentDay);

    // Survives a JSON round-trip and rehydrates identically onto a fresh World.
    const persisted = JSON.parse(
      JSON.stringify(snapshotWorld(world)),
    ) as PersistedWorldSnapshot;
    expect(persisted.modules.prepBet).toEqual(bet);
    const { world: target } = build(7);
    restoreWorld(persisted, target);
    expect(target.getPrepBet()).toEqual(bet);
  });

  it('migrates pre-#322 snapshots to a null prep bet (S1 scoreline fallback)', () => {
    const { world } = build(4242);
    const current = snapshotWorld(world);
    const { prepBet, ...legacyModules } = current.modules;
    const persisted: PersistedWorldSnapshot = {
      version: 15,
      modules: legacyModules,
    };
    const migrated = migrateWorldSnapshot(persisted);
    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(migrated.modules.prepBet).toBeNull();
  });

  it('round-trips career high-water marks through the world seam (#329)', () => {
    const { bus, world } = build(7);
    // Drive a real record through the live world's bus, not the module direct.
    bus.publish('clock:day_started', { day: world.clock.currentDay });
    bus.publish('deal:closed', {
      customerId: 'c1',
      vehicleId: 'v1',
      agreedPrice: 22_000,
      frontGross: 2_400,
      backGross: 900,
      productGross: 900,
      reserveGross: 0,
      daysInInventory: 12,
      paymentMethod: 'cash',
      downPayment: 22_000,
      loanAmount: 0,
      term: 0,
      apr: 0,
    });
    bus.publish('floor:day_complete', {
      day: world.clock.currentDay,
      ticks: 1,
      totalArrivals: 1,
    });
    const marks = world.records.getMarks();
    expect(marks.bestSingleDeal?.value).toBe(2_400);
    expect(marks.bestDayGross?.value).toBe(3_300);

    const persisted = JSON.parse(
      JSON.stringify(snapshotWorld(world)),
    ) as PersistedWorldSnapshot;
    const { world: target } = build(7);
    restoreWorld(persisted, target);
    expect(target.records.getMarks()).toEqual(marks);
    expect(target.records.currentStreak).toBe(1);
  });

  // #331: the running day gross the HUD shows is read off Records, so a mid-day
  // reload must show the same figure it showed before the save — the old
  // in-hook tally reset to $0 while the engine's did not.
  it('a mid-day reload keeps the running day gross the HUD reads (#331)', () => {
    const { bus, world } = build(11);
    bus.publish('clock:day_started', { day: world.clock.currentDay });
    for (const [front, back] of [
      [1_500, 600],
      [900, 300],
    ] as const) {
      bus.publish('deal:closed', {
        customerId: 'c1',
        vehicleId: 'v1',
        agreedPrice: 20_000,
        frontGross: front,
        backGross: back,
        productGross: back,
        reserveGross: 0,
        daysInInventory: 8,
        paymentMethod: 'cash',
        downPayment: 20_000,
        loanAmount: 0,
        term: 0,
        apr: 0,
      });
    }
    // Saved mid-day: the floor never closed.
    expect(world.records.getDayTotals()).toEqual({ gross: 3_300, units: 2 });

    const persisted = JSON.parse(
      JSON.stringify(snapshotWorld(world)),
    ) as PersistedWorldSnapshot;
    const { world: target } = build(11);
    restoreWorld(persisted, target);

    expect(target.records.getDayTotals()).toEqual({ gross: 3_300, units: 2 });
  });

  it('migrates pre-#329 snapshots to an empty scoreboard', () => {
    const { world } = build(4242);
    const current = snapshotWorld(world);
    const { records, ...legacyModules } = current.modules;
    const persisted: PersistedWorldSnapshot = {
      version: 16,
      modules: legacyModules,
    };
    const migrated = migrateWorldSnapshot(persisted);
    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(migrated.modules.records).toEqual(createDefaultRecordsSnapshot());
    // Behavior-neutral: nothing in the sim branches on a mark.
    expect(migrated.modules.records.marks.bestDayGross).toBeNull();
  });

  it('migrates pre-#177 snapshots to no standing weekly column', () => {
    const { world } = build(4242);
    const current = snapshotWorld(world);
    const { weekly, ...legacyMarketEconomy } =
      current.modules.marketEconomy as unknown as Record<string, unknown>;
    const persisted: PersistedWorldSnapshot = {
      version: 18,
      modules: {
        ...current.modules,
        marketEconomy: { ...legacyMarketEconomy, schemaVersion: 2 },
      },
    };
    const migrated = migrateWorldSnapshot(persisted);
    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(migrated.modules.marketEconomy.schemaVersion).toBe(3);
    // A loaded career opens a fresh week on its next tick rather than
    // back-filling a column from days the player never saw reported.
    expect(migrated.modules.marketEconomy.weekly.active).toBeNull();
    expect(migrated.modules.marketEconomy.weekly.weekStartDay).toBeNull();
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
    // Bumped to 2 by #176 (the heat monitor + industry wire joined the blob),
    // to 3 by #177 (the weekly market report).
    expect(snap.modules.marketEconomy.schemaVersion).toBe(3);
    expect(snap.modules.marketEconomy.compHistory.schemaVersion).toBe(1);
    expect(snap.modules.marketEconomy.shocks.schemaVersion).toBe(1);
    expect(snap.modules.marketEconomy.heat.schemaVersion).toBe(1);
    expect(snap.modules.marketEconomy.news.schemaVersion).toBe(1);
    expect(Array.isArray(snap.modules.marketEconomy.news.headlines)).toBe(true);
    expect(snap.modules.marketEconomy.weekly.schemaVersion).toBe(1);
    expect(snap.modules.marketEconomy.weekly.active).toBeNull();
    expect(snap.modules.competitorMarket.schemaVersion).toBe(1);
    expect(Array.isArray(snap.modules.competitorMarket.competitors)).toBe(true);
    expect(typeof snap.modules.competitorMarket.rngState).toBe('number');
    expect(typeof snap.modules.regulatoryMeter.pressure).toBe('number');
    expect(typeof snap.modules.regulatoryMeter.isTerminal).toBe('boolean');
    expect(typeof snap.modules.regulatoryMeter.suspensionDaysRemaining).toBe('number');
    expect(snap.modules.demandShaper.schemaVersion).toBe(3);
    expect(Array.isArray(snap.modules.demandShaper.activeInputs)).toBe(true);
    expect(Array.isArray(snap.modules.demandShaper.observedHistory)).toBe(true);
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

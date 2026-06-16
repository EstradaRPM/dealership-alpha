import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { createEconomy } from '../src/game/Economy';
import { createMarketEconomy } from '../src/game/MarketEconomy';
import {
  createInventory,
  loadVehicleData,
  loadStartingInventoryConfig,
  generateStartingInventory,
  type SeedCandidateVehicle,
} from '../src/game/Inventory';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #296 — day-one frontline seed. New saves seed a small, fair, frontline-ready
// starting lot (1 SUV / 1 truck / 1 sedan), value-banded + condition-capped +
// recon-complete, deterministic from masterSeed and persisted via the snapshot.

const STARTING_CASH = 50_000;
const NO_OVERNIGHT = { weeklyRent: 0, weeklyPayrollStub: 0 };
const VEHICLE_DATA = loadVehicleData();
const SEED_CONFIG = loadStartingInventoryConfig();

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

/** Live MarketEconomy book/retail providers, adapted to the seed candidate shape. */
function valueFns(masterSeed: number) {
  const me = createMarketEconomy({ masterSeed });
  return {
    bookValueFn: (v: SeedCandidateVehicle) =>
      me.bookValueFn(v as unknown as Parameters<typeof me.bookValueFn>[0]),
    retailValueFn: (v: SeedCandidateVehicle) =>
      me.marketPriceFn(v as unknown as Parameters<typeof me.marketPriceFn>[0]),
  };
}

function makeSeededInventory(masterSeed: number) {
  const bus = createEventBus();
  const economy = createEconomy({
    bus,
    startingCash: STARTING_CASH,
    config: NO_OVERNIGHT,
  });
  const { bookValueFn, retailValueFn } = valueFns(masterSeed);
  const inventory = createInventory({
    bus,
    masterSeed,
    economy,
    vehicleData: VEHICLE_DATA,
    startingInventory: () =>
      generateStartingInventory({ masterSeed, bookValueFn, retailValueFn }),
  });
  return { bus, economy, inventory };
}

describe('generateStartingInventory (#296)', () => {
  it('produces exactly one value-banded unit per configured slot', () => {
    const { bookValueFn, retailValueFn } = valueFns(99);
    const specs = generateStartingInventory({
      masterSeed: 99,
      bookValueFn,
      retailValueFn,
    });

    expect(specs).toHaveLength(SEED_CONFIG.slots.length);
    const cats = specs.map((s) => s.category).sort();
    expect(cats).toEqual(['sedan', 'suv', 'truck']);

    specs.forEach((spec, i) => {
      const slot = SEED_CONFIG.slots[i];
      expect(spec.category).toBe(slot.category);
      // Never rough — no hidden-lemon tail in the starter set.
      expect(['clean', 'average']).toContain(spec.condition);
      // Retail lands inside the slot's value band.
      const lo = slot.targetRetail * (1 - slot.tolerancePct);
      const hi = slot.targetRetail * (1 + slot.tolerancePct);
      expect(spec.suggestedRetail).toBeGreaterThanOrEqual(lo);
      expect(spec.suggestedRetail).toBeLessThanOrEqual(hi);
      // Cost basis (book) sits below retail → real day-one equity.
      expect(spec.purchasePrice).toBeLessThan(spec.suggestedRetail);
      expect(spec.reconEstimate).toBeGreaterThan(0);
    });
  });

  it('is deterministic in masterSeed (same seed → identical lot)', () => {
    const a = generateStartingInventory({ masterSeed: 7, ...valueFns(7) });
    const b = generateStartingInventory({ masterSeed: 7, ...valueFns(7) });
    expect(b).toEqual(a);
  });

  it('keeps total starting equity in-band across many seeds (no jackpot/beater trio)', () => {
    const loTotal = SEED_CONFIG.slots.reduce(
      (s, slot) => s + slot.targetRetail * (1 - slot.tolerancePct),
      0,
    );
    const hiTotal = SEED_CONFIG.slots.reduce(
      (s, slot) => s + slot.targetRetail * (1 + slot.tolerancePct),
      0,
    );
    for (let seed = 1; seed <= 25; seed++) {
      const specs = generateStartingInventory({ masterSeed: seed, ...valueFns(seed) });
      const total = specs.reduce((s, v) => s + v.suggestedRetail, 0);
      expect(total).toBeGreaterThanOrEqual(loTotal);
      expect(total).toBeLessThanOrEqual(hiTotal);
    }
  });
});

describe('Inventory seeding (#296)', () => {
  it('seeds 3 recon-complete, frontline-ready units with no t=0 cash debit', () => {
    const { economy, inventory } = makeSeededInventory(5);
    const lot = inventory.getLotVehicles();

    expect(lot).toHaveLength(3);
    // Already-owned opening stock: starting cash is untouched by the seed.
    expect(economy.cash).toBe(STARTING_CASH);

    for (const v of lot) {
      expect(v.reconStatus).toBe('complete');
      expect(v.reconCost).toBe(v.reconEstimate);
      expect(v.reconDaysRemaining).toBe(0);
      expect(v.reconBucket).toBe('within');
      expect(v.condition).not.toBe('rough');
      // Owned at t=0 and sellable at open (exempt from the #295 hold).
      expect(v.arrivalDay).toBe(0);
      expect(v.frontlineDay).toBe(0);
      // Default ask sits at market (suggestion-only — no UCM at game start).
      expect(v.askingPrice).toBe(v.suggestedRetail);
    }
    expect(lot.map((v) => v.category).sort()).toEqual(['sedan', 'suv', 'truck']);
  });

  it('omitting the dep leaves an empty opening lot (test-harness default)', () => {
    const bus = createEventBus();
    const economy = createEconomy({
      bus,
      startingCash: STARTING_CASH,
      config: NO_OVERNIGHT,
    });
    const inventory = createInventory({
      bus,
      masterSeed: 5,
      economy,
      vehicleData: VEHICLE_DATA,
    });
    expect(inventory.getLotVehicles()).toHaveLength(0);
  });

  it('survives a snapshot/restore round-trip', () => {
    const { inventory } = makeSeededInventory(11);
    const snap = inventory.snapshot();

    // Fresh same-seed inventory, restored from the snapshot.
    const { inventory: restored } = makeSeededInventory(11);
    restored.restore(snap);
    expect(restored.getLotVehicles()).toEqual(inventory.getLotVehicles());
  });
});

describe('Starting inventory in the live world (#296)', () => {
  it('a fresh world opens with exactly 3 frontline-ready seed units, cash unchanged', () => {
    const world = createWorld({
      bus: createEventBus(),
      masterSeed: 1234,
      characterProfile: PROFILE,
    });
    const lot = world.inventory.getLotVehicles();

    expect(lot).toHaveLength(3);
    // The seed posts no acquisition debit — cash is untouched but for the normal
    // Day-1 prep-pass floorplan carry (~$57 across 3 units, the cold-start
    // managerial_prep accrual). A cash *purchase* of the lot would drop cash by
    // tens of thousands; this guards that it didn't. (The rigorous no-debit proof
    // is the createInventory-level test above, which fires no clock events.)
    expect(world.economy.cash).toBeGreaterThan(STARTING_CASH - 500);
    expect(world.economy.cash).toBeLessThanOrEqual(STARTING_CASH);
    for (const v of lot) {
      // Sellable on Day 1 (the clock opens on Day 1).
      expect(v.frontlineDay).toBeLessThanOrEqual(1);
      expect(v.reconStatus).toBe('complete');
      expect(v.condition).not.toBe('rough');
    }
  });

  it('is deterministic across two same-seed worlds', () => {
    const a = createWorld({
      bus: createEventBus(),
      masterSeed: 4242,
      characterProfile: PROFILE,
    }).inventory.getLotVehicles();
    const b = createWorld({
      bus: createEventBus(),
      masterSeed: 4242,
      characterProfile: PROFILE,
    }).inventory.getLotVehicles();
    expect(b).toEqual(a);
  });
});

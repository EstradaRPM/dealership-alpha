import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
import type { LotVehicle } from '../src/game/Inventory';
import { createCustomerPool } from '../src/game/CustomerPool';
import { createDealEngine } from '../src/game/DealEngine';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';

const MASTER_SEED = 77;
const STARTING_CASH = 100_000;
const NO_OVERHEAD = { weeklyRent: 0, weeklyPayrollStub: 0 };
const vehicleData = loadVehicleData();
const npcDeps = {
  masterSeed: MASTER_SEED,
  personArchetypes: loadPersonArchetypes(),
  visitArchetypes: loadVisitArchetypes(),
  traits: loadTraitTaxonomy(),
};

function makeSetup() {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
  const inventory = createInventory({ bus, masterSeed: MASTER_SEED, economy, vehicleData });
  const pool = createCustomerPool({ bus, npcDeps });
  const dealEngine = createDealEngine({ bus, inventory, economy });
  return { bus, clock, economy, inventory, pool, dealEngine };
}

// ── closeDeal — validation ────────────────────────────────────────────────────

describe('DealEngine.closeDeal — validation', () => {
  it('throws when bus/inventory/economy deps are missing', () => {
    const engine = createDealEngine();
    expect(() =>
      engine.closeDeal({ customerId: 'x', vehicleId: 'y', agreedPrice: 10_000 })
    ).toThrow(/bus|inventory|economy/i);
  });

  it('throws for unknown vehicleId', () => {
    const { clock, dealEngine, pool } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    const id = session.customerId;
    pool.dispatch(id, 'GREET');
    pool.dispatch(id, 'QUALIFY');
    pool.dispatch(id, 'DEMO');
    pool.dispatch(id, 'NEGOTIATE');
    expect(() =>
      dealEngine.closeDeal({ customerId: id, vehicleId: 'no-such-vehicle', agreedPrice: 10_000 })
    ).toThrow(/no lot vehicle/i);
  });
});

// ── closeDeal — full end-to-end vertical slice ────────────────────────────────

describe('DealEngine.closeDeal — end-to-end', () => {
  function setupNegotiating() {
    const setup = makeSetup();
    const { clock, inventory, pool } = setup;

    // Day 1: customer arrives, buy a vehicle from auction
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    // Advance customer to NEGOTIATING
    const [session] = pool.getSessions();
    const customerId = session.customerId;
    pool.dispatch(customerId, 'GREET');
    pool.dispatch(customerId, 'QUALIFY');
    pool.dispatch(customerId, 'DEMO');
    pool.dispatch(customerId, 'NEGOTIATE');

    return { ...setup, customerId, vehicleId: listing.id, listing };
  }

  it('returns ClosedDealResult with correct front gross', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const agreedPrice = listing.askingPrice + 2_000;

    const result = dealEngine.closeDeal({ customerId, vehicleId, agreedPrice });

    expect(result.agreedPrice).toBe(agreedPrice);
    expect(result.purchasePrice).toBe(listing.askingPrice);
    // #162: lot vehicle's reconCost is now running sunk recon (starts at 0,
    // grows daily during recon). These tests sell same-day-ish without
    // advancing days, so sunk recon = 0.
    expect(result.reconCost).toBe(0);
    expect(result.frontGross).toBe(agreedPrice - listing.askingPrice - 0);
    expect(result.backGross).toBe(0);
  });

  it('customer stage transitions to CLOSED', () => {
    const { pool, dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const agreedPrice = listing.askingPrice + 1_000;

    dealEngine.closeDeal({ customerId, vehicleId, agreedPrice });

    expect(pool.getSession(customerId)?.stage).toBe('CLOSED');
  });

  it('vehicle is removed from lot', () => {
    const { inventory, dealEngine, customerId, vehicleId, listing } = setupNegotiating();

    dealEngine.closeDeal({ customerId, vehicleId, agreedPrice: listing.askingPrice + 500 });

    expect(inventory.getLotVehicle(vehicleId)).toBeUndefined();
    expect(inventory.getLotVehicles()).toHaveLength(0);
  });

  it('cash increases by agreed price (net after purchase cost)', () => {
    const { economy, inventory, dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const cashAfterPurchase = economy.cash;
    const agreedPrice = listing.askingPrice + 3_000;

    dealEngine.closeDeal({ customerId, vehicleId, agreedPrice });

    expect(economy.cash).toBe(cashAfterPurchase + agreedPrice);
  });

  it('publishes deal:closed with correct payload', () => {
    const { bus, dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const agreedPrice = listing.askingPrice + 1_500;
    const events: Array<{ customerId: string; frontGross: number; backGross: number }> = [];
    bus.subscribe('deal:closed', (e) => events.push(e));

    dealEngine.closeDeal({ customerId, vehicleId, agreedPrice });

    expect(events).toHaveLength(1);
    expect(events[0].customerId).toBe(customerId);
    expect(events[0].frontGross).toBe(agreedPrice - listing.askingPrice - 0);
    expect(events[0].backGross).toBe(0);
  });

  it('publishes inventory:vehicle_sold', () => {
    const { bus, dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const soldEvents: Array<{ vehicleId: string }> = [];
    bus.subscribe('inventory:vehicle_sold', (e) => soldEvents.push(e));

    dealEngine.closeDeal({ customerId, vehicleId, agreedPrice: listing.askingPrice });

    expect(soldEvents).toHaveLength(1);
    expect(soldEvents[0].vehicleId).toBe(vehicleId);
  });

  it('customer:resolved is published with outcome closed', () => {
    const { bus, dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const resolved: Array<{ outcome: string }> = [];
    bus.subscribe('customer:resolved', (e) => resolved.push(e));

    dealEngine.closeDeal({ customerId, vehicleId, agreedPrice: listing.askingPrice });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].outcome).toBe('closed');
  });

  it('front gross can be negative (sold below cost)', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const agreedPrice = listing.askingPrice - 500;

    const result = dealEngine.closeDeal({ customerId, vehicleId, agreedPrice });

    expect(result.frontGross).toBeLessThan(0);
  });
});

// ── closeDeal — lemon-law exposure producer (#271) ────────────────────────────

describe('DealEngine.closeDeal — lemon-law exposure (#271)', () => {
  function makeLotVehicle(overrides: Partial<LotVehicle>): LotVehicle {
    return {
      id: 'v1',
      templateId: 't1',
      brand: 'brand-x',
      year: 2020,
      make: 'Make',
      model: 'Model',
      trim: '',
      mileage: 50_000,
      condition: 'average',
      conditionReport: '',
      purchasePrice: 10_000,
      reconCost: 0,
      category: 'sedan',
      arrivalDay: 1,
      frontlineDay: 1,
      daysInInventory: 0,
      carryingCostToDate: 0,
      dailyCarryingCost: 0,
      aged: false,
      suggestedRetail: 12_000,
      askingPrice: 12_000,
      reconStatus: 'in_progress',
      reconEstimate: 1_000,
      reconRealizedCost: 4_000,
      reconDaysRemaining: 3,
      reconDaysTotal: 5,
      reconBucket: 'within',
      ...overrides,
    };
  }

  function setupWithVehicle(vehicle: LotVehicle) {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const inventory = {
      getLotVehicle: () => vehicle,
      sellVehicle: jest.fn(() => vehicle),
    };
    const dealEngine = createDealEngine({
      bus,
      inventory,
      economy,
      getCurrentDay: () => 7,
    });
    const incidents: Array<{ day: number; customerId: string }> = [];
    bus.subscribe('regulatory:lemon_law_incident', (e) => incidents.push(e));
    return { bus, dealEngine, incidents };
  }

  it('emits a lemon-law incident when an un-reconditioned major-tail lemon is retailed', () => {
    const { dealEngine, incidents } = setupWithVehicle(
      makeLotVehicle({ reconStatus: 'in_progress', reconBucket: 'major' }),
    );

    dealEngine.closeDeal({ customerId: 'cust-1', vehicleId: 'v1', agreedPrice: 12_000 });

    expect(incidents).toEqual([{ day: 7, customerId: 'cust-1' }]);
  });

  it('emits for a catastrophic lemon sold as-is past a paused recon surprise', () => {
    const { dealEngine, incidents } = setupWithVehicle(
      makeLotVehicle({ reconStatus: 'paused_for_decision', reconBucket: 'catastrophic' }),
    );

    dealEngine.closeDeal({ customerId: 'cust-2', vehicleId: 'v1', agreedPrice: 12_000 });

    expect(incidents).toHaveLength(1);
  });

  it('does NOT emit when the tail-bucket defect was reconditioned (recon complete)', () => {
    const { dealEngine, incidents } = setupWithVehicle(
      makeLotVehicle({ reconStatus: 'complete', reconBucket: 'catastrophic' }),
    );

    dealEngine.closeDeal({ customerId: 'cust-3', vehicleId: 'v1', agreedPrice: 12_000 });

    expect(incidents).toHaveLength(0);
  });

  it('does NOT emit for an un-reconditioned unit with a clean (within) recon', () => {
    const { dealEngine, incidents } = setupWithVehicle(
      makeLotVehicle({ reconStatus: 'in_progress', reconBucket: 'within' }),
    );

    dealEngine.closeDeal({ customerId: 'cust-4', vehicleId: 'v1', agreedPrice: 12_000 });

    expect(incidents).toHaveLength(0);
  });
});

// ── closeDeal — payment-packing fraud producer (#327) ─────────────────────────

describe('DealEngine.closeDeal — payment-packing fraud (#327)', () => {
  const FRAUD_CONFIG = { schemaVersion: 1, packFraction: 0.35 };

  // A plain, non-lemon lot vehicle (clean recon) so only the fraud path is under
  // test. Prices are read from the real F&I catalog, so use real product ids.
  function makeVehicle(): LotVehicle {
    return {
      id: 'v1',
      templateId: 't1',
      brand: 'brand-x',
      year: 2020,
      make: 'Make',
      model: 'Model',
      trim: '',
      mileage: 50_000,
      condition: 'average',
      conditionReport: '',
      purchasePrice: 5_000,
      reconCost: 0,
      category: 'sedan',
      arrivalDay: 1,
      frontlineDay: 1,
      daysInInventory: 0,
      carryingCostToDate: 0,
      dailyCarryingCost: 0,
      aged: false,
      suggestedRetail: 6_000,
      askingPrice: 6_000,
      reconStatus: 'complete',
      reconEstimate: 0,
      reconRealizedCost: 0,
      reconDaysRemaining: 0,
      reconDaysTotal: 0,
      reconBucket: 'within',
    };
  }

  function setup() {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const vehicle = makeVehicle();
    const inventory = {
      getLotVehicle: () => vehicle,
      sellVehicle: jest.fn(() => vehicle),
    };
    const dealEngine = createDealEngine({
      bus,
      inventory,
      economy,
      getCurrentDay: () => 7,
      fraudConfig: FRAUD_CONFIG,
    });
    const flags: Array<{ day: number; customerId: string; vehicleId: string }> = [];
    bus.subscribe('deal:fraud_flag', (e) => flags.push(e));
    return { dealEngine, flags };
  }

  // vsc 1495 + gap 695 + tireWheel 795 = 2985 of F&I burden.
  const HEAVY_FNI = [
    { productId: 'vsc', price: 1495 },
    { productId: 'gap', price: 695 },
    { productId: 'tireWheel', price: 795 },
  ];

  it('flags a financed deal packed with F&I beyond the price fraction', () => {
    const { dealEngine, flags } = setup();

    // 2985 burden on a 6000 car = 49.75% > 35%.
    dealEngine.closeDeal({
      customerId: 'cust-1',
      vehicleId: 'v1',
      agreedPrice: 6_000,
      fniProducts: HEAVY_FNI,
      paymentMethod: 'finance',
      downPayment: 500,
      loanAmount: 5_500,
      term: 60,
      apr: 0.09,
    });

    expect(flags).toEqual([{ day: 7, customerId: 'cust-1', vehicleId: 'v1' }]);
  });

  it('does NOT flag when the same F&I is a small fraction of a pricier car', () => {
    const { dealEngine, flags } = setup();

    // 2985 burden on a 20000 car = 14.9% < 35%.
    dealEngine.closeDeal({
      customerId: 'cust-2',
      vehicleId: 'v1',
      agreedPrice: 20_000,
      fniProducts: HEAVY_FNI,
      paymentMethod: 'finance',
      downPayment: 2_000,
      loanAmount: 18_000,
      term: 60,
      apr: 0.09,
    });

    expect(flags).toHaveLength(0);
  });

  it('does NOT flag a cash deal — a cash sale cannot pack a payment', () => {
    const { dealEngine, flags } = setup();

    dealEngine.closeDeal({
      customerId: 'cust-3',
      vehicleId: 'v1',
      agreedPrice: 6_000,
      fniProducts: HEAVY_FNI,
      paymentMethod: 'cash',
    });

    expect(flags).toHaveLength(0);
  });

  it('does NOT flag a financed deal with no F&I attached', () => {
    const { dealEngine, flags } = setup();

    dealEngine.closeDeal({
      customerId: 'cust-4',
      vehicleId: 'v1',
      agreedPrice: 6_000,
      paymentMethod: 'finance',
      downPayment: 500,
      loanAmount: 5_500,
      term: 60,
      apr: 0.09,
    });

    expect(flags).toHaveLength(0);
  });
});

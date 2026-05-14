import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
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
    expect(result.reconCost).toBe(listing.reconCost);
    expect(result.frontGross).toBe(agreedPrice - listing.askingPrice - listing.reconCost);
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
    expect(events[0].frontGross).toBe(agreedPrice - listing.askingPrice - listing.reconCost);
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

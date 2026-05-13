import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
import { generateAuctionListings } from '../src/game/Inventory/auctionGenerator';

const MASTER_SEED = 99;
const STARTING_CASH = 50000;
const vehicleData = loadVehicleData();

const NO_OVERNIGHT_CONFIG = { weeklyRent: 0, weeklyPayrollStub: 0 };

function makeSetup(initialDay = 0, startingCash = STARTING_CASH) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const economy = createEconomy({ bus, startingCash, config: NO_OVERNIGHT_CONFIG });
  const inventory = createInventory({ bus, masterSeed: MASTER_SEED, economy, vehicleData });
  return { bus, clock, economy, inventory };
}

// ── Auction listing generation ────────────────────────────────────────────────

describe('Inventory — auction listing generation', () => {
  it('no listings before day starts', () => {
    const { inventory } = makeSetup();
    expect(inventory.getAuctionListings()).toHaveLength(0);
  });

  it('listings appear on clock:day_started', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    expect(inventory.getAuctionListings().length).toBeGreaterThanOrEqual(3);
    expect(inventory.getAuctionListings().length).toBeLessThanOrEqual(6);
  });

  it('listings are deterministic for the same seed+day', () => {
    const listingsA = generateAuctionListings(5, MASTER_SEED, vehicleData);
    const listingsB = generateAuctionListings(5, MASTER_SEED, vehicleData);
    expect(listingsA.map((l) => l.id)).toEqual(listingsB.map((l) => l.id));
    expect(listingsA.map((l) => l.askingPrice)).toEqual(listingsB.map((l) => l.askingPrice));
  });

  it('different days produce different listings', () => {
    const day1 = generateAuctionListings(1, MASTER_SEED, vehicleData);
    const day2 = generateAuctionListings(2, MASTER_SEED, vehicleData);
    expect(day1.map((l) => l.id)).not.toEqual(day2.map((l) => l.id));
  });

  it('each listing has required fields', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    for (const listing of inventory.getAuctionListings()) {
      expect(listing.id).toBeTruthy();
      expect(listing.year).toBeGreaterThan(2010);
      expect(listing.make).toBeTruthy();
      expect(listing.model).toBeTruthy();
      expect(listing.mileage).toBeGreaterThan(0);
      expect(['clean', 'average', 'rough']).toContain(listing.condition);
      expect(listing.conditionReport).toBeTruthy();
      expect(listing.askingPrice).toBeGreaterThan(0);
      expect(listing.reconCost).toBeGreaterThan(0);
    }
  });

  it('listings refresh each day', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const day1Ids = inventory.getAuctionListings().map((l) => l.id);
    clock.advanceDay();
    const day2Ids = inventory.getAuctionListings().map((l) => l.id);
    expect(day1Ids).not.toEqual(day2Ids);
  });
});

// ── Purchase flow ─────────────────────────────────────────────────────────────

describe('Inventory — purchase flow', () => {
  it('buying a listing moves it to lot inventory', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    expect(inventory.getLotVehicles()).toHaveLength(1);
    expect(inventory.getLotVehicles()[0].id).toBe(listing.id);
  });

  it('bought listing is removed from auction', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const listings = inventory.getAuctionListings();
    const [first] = listings;
    inventory.buyFromAuction(first.id);
    expect(inventory.getAuctionListings().find((l) => l.id === first.id)).toBeUndefined();
    expect(inventory.getAuctionListings()).toHaveLength(listings.length - 1);
  });

  it('cash is deducted from Economy by asking price', () => {
    const { clock, economy, inventory } = makeSetup();
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    expect(economy.cash).toBe(STARTING_CASH - listing.askingPrice);
  });

  it('getLotVehicle returns the purchased vehicle by id', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    const v = inventory.getLotVehicle(listing.id);
    expect(v).toBeDefined();
    expect(v!.make).toBe(listing.make);
    expect(v!.purchasePrice).toBe(listing.askingPrice);
    expect(v!.reconCost).toBe(listing.reconCost);
  });

  it('throws when buying an unknown listing id', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    expect(() => inventory.buyFromAuction('no-such-id')).toThrow();
  });

  it('throws when insufficient cash', () => {
    const { clock, inventory } = makeSetup(0, 0);
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    expect(() => inventory.buyFromAuction(listing.id)).toThrow(/[Ii]nsufficient/);
  });

  it('publishes inventory:vehicle_purchased with cost and vehicleId', () => {
    const { bus, clock, inventory } = makeSetup();
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    const events: Array<{ vehicleId: string; cost: number }> = [];
    bus.subscribe('inventory:vehicle_purchased', (e) => events.push(e));
    inventory.buyFromAuction(listing.id);
    expect(events).toHaveLength(1);
    expect(events[0].vehicleId).toBe(listing.id);
    expect(events[0].cost).toBe(listing.askingPrice);
  });
});

// ── DII aging ─────────────────────────────────────────────────────────────────

describe('Inventory — DII aging', () => {
  it('vehicle starts at 0 DII on day of purchase', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    const v = inventory.getLotVehicle(listing.id);
    expect(v!.daysInInventory).toBe(0);
  });

  it('DII increments by 1 each day after purchase', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();           // day 1
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    clock.advanceDay();           // day 2 — DII = 1
    expect(inventory.getLotVehicle(listing.id)!.daysInInventory).toBe(1);

    clock.advanceDay();           // day 3 — DII = 2
    expect(inventory.getLotVehicle(listing.id)!.daysInInventory).toBe(2);
  });

  it('DII ages all lot vehicles independently', () => {
    const { clock, inventory } = makeSetup();

    clock.advanceDay();           // day 1
    const [first] = inventory.getAuctionListings();
    inventory.buyFromAuction(first.id);

    clock.advanceDay();           // day 2: first is at DII 1, buy second
    const [second] = inventory.getAuctionListings();
    inventory.buyFromAuction(second.id);

    clock.advanceDay();           // day 3: first=2, second=1
    expect(inventory.getLotVehicle(first.id)!.daysInInventory).toBe(2);
    expect(inventory.getLotVehicle(second.id)!.daysInInventory).toBe(1);
  });
});

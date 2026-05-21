import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import {
  createInventory,
  loadVehicleData,
  loadInventoryConfig,
} from '../src/game/Inventory';
import type { Inventory } from '../src/game/Inventory';

const STARTING_CASH = 200_000;
const NO_OVERNIGHT = { weeklyRent: 0, weeklyPayrollStub: 0 };
const VEHICLE_DATA = loadVehicleData();
const INV_CFG = loadInventoryConfig();

function makeSetup(masterSeed = 42) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({
    bus,
    startingCash: STARTING_CASH,
    config: NO_OVERNIGHT,
  });
  const inventory = createInventory({
    bus,
    masterSeed,
    economy,
    vehicleData: VEHICLE_DATA,
  });
  return { bus, clock, economy, inventory };
}

function firstListing(inv: Inventory) {
  const [l] = inv.getAuctionListings();
  if (!l) throw new Error('expected at least one listing');
  return l;
}

describe('Inventory — paid inspection (#164)', () => {
  it('requestInspection posts the inspection cost as an Economy expense', () => {
    const { clock, economy, inventory } = makeSetup();
    clock.advanceDay();
    const startCash = economy.cash;
    const listing = firstListing(inventory);
    inventory.requestInspection(listing.id);
    expect(economy.cash).toBe(startCash - INV_CFG.inspection.cost);
  });

  it('marks the listing pending with availableDay = currentDay + daysToComplete', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const listing = firstListing(inventory);
    inventory.requestInspection(listing.id);
    const updated = inventory
      .getAuctionListings()
      .find((l) => l.id === listing.id);
    expect(updated?.inspectionStatus).toBe('pending');
    expect(updated?.inspectionAvailableDay).toBe(
      1 + INV_CFG.inspection.daysToComplete,
    );
  });

  it('blocks purchase while the inspection is pending', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const listing = firstListing(inventory);
    inventory.requestInspection(listing.id);
    expect(() => inventory.buyFromAuction(listing.id)).toThrow(/pending/);
  });

  it('survives the day rollover and resolves to a tightened band', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const listing = firstListing(inventory);
    inventory.requestInspection(listing.id);

    clock.advanceDay();
    const completed = inventory
      .getAuctionListings()
      .find((l) => l.id === listing.id);
    expect(completed?.inspectionStatus).toBe('completed');
    expect(completed?.inspectionResult).toBeDefined();

    const result = completed!.inspectionResult!;
    expect(result.reconHigh).toBeGreaterThanOrEqual(result.reconLow);
    // Band half-width is bounded by halfWidthFraction × realized; with the
    // default 0.05 the spread should be small relative to the estimate.
    const spread = result.reconHigh - result.reconLow;
    const ceiling = Math.ceil(
      (listing.reconCost * INV_CFG.inspection.halfWidthFraction * 4) + 2,
    );
    expect(spread).toBeLessThanOrEqual(ceiling);
  });

  it('inspected listing is purchasable on the morning the result lands', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const listing = firstListing(inventory);
    inventory.requestInspection(listing.id);

    clock.advanceDay();
    inventory.buyFromAuction(listing.id);
    expect(inventory.getLotVehicle(listing.id)).toBeDefined();
  });

  it('inspected-but-unpurchased listings expire after their availability day', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const listing = firstListing(inventory);
    inventory.requestInspection(listing.id);

    clock.advanceDay(); // result lands
    clock.advanceDay(); // no purchase → expires
    const stillThere = inventory
      .getAuctionListings()
      .find((l) => l.id === listing.id);
    expect(stillThere).toBeUndefined();
  });

  it('inspection result is deterministic from masterSeed + listingId', () => {
    const a = makeSetup(123);
    a.clock.advanceDay();
    const listingA = firstListing(a.inventory);
    a.inventory.requestInspection(listingA.id);
    a.clock.advanceDay();

    const b = makeSetup(123);
    b.clock.advanceDay();
    const listingB = firstListing(b.inventory);
    b.inventory.requestInspection(listingB.id);
    b.clock.advanceDay();

    const rA = a.inventory
      .getAuctionListings()
      .find((l) => l.id === listingA.id)!.inspectionResult!;
    const rB = b.inventory
      .getAuctionListings()
      .find((l) => l.id === listingB.id)!.inspectionResult!;
    expect(rA.reconLow).toBe(rB.reconLow);
    expect(rA.reconHigh).toBe(rB.reconHigh);
  });

  it('throws on unknown listing id', () => {
    const { inventory } = makeSetup();
    expect(() => inventory.requestInspection('nope')).toThrow();
  });

  it('is idempotent — a second requestInspection on a pending listing is a no-op', () => {
    const { clock, economy, inventory } = makeSetup();
    clock.advanceDay();
    const listing = firstListing(inventory);
    inventory.requestInspection(listing.id);
    const cashAfterFirst = economy.cash;
    inventory.requestInspection(listing.id);
    expect(economy.cash).toBe(cashAfterFirst);
  });
});

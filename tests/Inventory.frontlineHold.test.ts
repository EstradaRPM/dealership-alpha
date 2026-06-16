import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import {
  createInventory,
  loadVehicleData,
  loadInventoryConfig,
} from '../src/game/Inventory';
import type {
  Inventory,
  InventorySnapshot,
  LotVehicle,
  TradeAcquisitionInput,
} from '../src/game/Inventory';

const STARTING_CASH = 500_000;
const NO_OVERNIGHT = { weeklyRent: 0, weeklyPayrollStub: 0 };
const VEHICLE_DATA = loadVehicleData();
const HOLD = loadInventoryConfig().frontlineHoldDays;

function makeSetup(masterSeed = 7) {
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

const TRADE_VEHICLE: TradeAcquisitionInput['currentVehicle'] = {
  templateId: 'sedan-midsize',
  brand: 'vanda',
  make: 'Honda',
  model: 'Accord',
  year: 2018,
  mileage: 62_000,
  condition: 'average',
  category: 'sedan',
  loanPayoff: 9_000,
};

function buyFirstListing(inventory: Inventory, day: number): LotVehicle {
  const [listing] = inventory.getAuctionListings();
  inventory.buyFromAuction(listing.id);
  return inventory.getLotVehicles().find((v) => v.arrivalDay === day)!;
}

describe('Inventory — frontline-hold on acquired vehicles (#295)', () => {
  it('config default hold is 2 days', () => {
    expect(HOLD).toBe(2);
  });

  it('an auction buy stamps frontlineDay = arrivalDay + frontlineHoldDays', () => {
    const { bus, inventory } = makeSetup();
    bus.publish('clock:day_started', { day: 5 });
    const v = buyFirstListing(inventory, 5);
    expect(v.arrivalDay).toBe(5);
    expect(v.frontlineDay).toBe(5 + HOLD);
  });

  it('a customer trade stamps the SAME hold — auction and trade behave identically', () => {
    const { bus, inventory } = makeSetup();
    bus.publish('clock:day_started', { day: 5 });
    const v = inventory.acquireFromTrade({
      customerId: 'cust-1',
      currentVehicle: TRADE_VEHICLE,
      agreedAllowance: 12_500,
      staffConfidence: 0.8,
    });
    expect(v.arrivalDay).toBe(5);
    expect(v.frontlineDay).toBe(5 + HOLD);
  });

  it('a held unit still appears in getLotVehicles and accrues carrying cost during the hold', () => {
    const { bus, inventory } = makeSetup();
    bus.publish('clock:day_started', { day: 1 });
    const v = buyFirstListing(inventory, 1);
    expect(v.frontlineDay).toBe(1 + HOLD);

    // Advance one day inside the hold window: still on the lot, carrying accrued.
    bus.publish('clock:day_started', { day: 2 });
    const held = inventory.getLotVehicle(v.id)!;
    expect(held).toBeDefined();
    expect(held.frontlineDay).toBe(1 + HOLD); // 2 < frontlineDay (still held)
    expect(held.carryingCostToDate).toBeGreaterThan(0);
  });

  it('frontlineDay round-trips through snapshot/restore', () => {
    const { bus, inventory } = makeSetup();
    bus.publish('clock:day_started', { day: 3 });
    const v = buyFirstListing(inventory, 3);
    const snap = inventory.snapshot();

    const fresh = makeSetup();
    fresh.inventory.restore(snap);
    const restored = fresh.inventory.getLotVehicle(v.id)!;
    expect(restored.frontlineDay).toBe(v.frontlineDay);
  });

  it('migration: a pre-#295 saved unit (no frontlineDay) restores to arrivalDay — immediately sellable, not permanently held', () => {
    const { inventory } = makeSetup();
    // Hand-build a legacy snapshot lacking frontlineDay (cast through unknown,
    // mirroring a save written before this field existed).
    const legacyVehicle = {
      id: 'legacy-1',
      templateId: 'base_sedan',
      brand: 'generic',
      year: 2019,
      make: 'generic',
      model: 'Sedan',
      trim: 'LX',
      mileage: 40_000,
      condition: 'clean' as const,
      conditionReport: 'clean',
      purchasePrice: 9_000,
      reconCost: 0,
      category: 'sedan' as const,
      arrivalDay: 4,
      daysInInventory: 0,
      carryingCostToDate: 0,
      dailyCarryingCost: 0,
      aged: false,
      suggestedRetail: 11_000,
      askingPrice: 11_000,
      reconStatus: 'complete' as const,
      reconEstimate: 0,
      reconRealizedCost: 0,
      reconDaysRemaining: 0,
      reconDaysTotal: 0,
      reconBucket: 'within' as const,
    };
    const legacySnap = {
      schemaVersion: 1,
      currentDay: 10,
      lastPreparedDay: 10,
      auctionListings: [],
      pendingInspections: [],
      lotVehicles: [legacyVehicle],
    } as unknown as InventorySnapshot;

    inventory.restore(legacySnap);
    const restored = inventory.getLotVehicle('legacy-1')!;
    expect(restored.frontlineDay).toBe(4); // defaulted to arrivalDay, not undefined
  });
});

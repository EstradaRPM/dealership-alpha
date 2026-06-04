import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import {
  createInventory,
  loadVehicleData,
  loadInventoryConfig,
  computeDailyCarryingCost,
  floorplanAprForTier,
} from '../src/game/Inventory';
import type { Inventory, LotVehicle, CarryingConfig } from '../src/game/Inventory';

const STARTING_CASH = 1_000_000;
const NO_OVERNIGHT = { weeklyRent: 0, weeklyPayrollStub: 0 };
const VEHICLE_DATA = loadVehicleData();
const BASE_CONFIG = loadInventoryConfig();

const CARRYING: CarryingConfig = {
  baselineApr: 0.09,
  aprByTier: { '1': 0.09, '2': 0.075, '3': 0.06 },
  insurancePerDay: 5,
  overheadPerDay: 8,
  reconFadePerDay: 3,
  agedThresholdDays: 45,
};

function makeSetup(opts: { masterSeed?: number; getTier?: () => number; agedThresholdDays?: number } = {}) {
  const { masterSeed = 42, getTier, agedThresholdDays } = opts;
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERNIGHT });
  const inventoryConfig =
    agedThresholdDays === undefined
      ? BASE_CONFIG
      : { ...BASE_CONFIG, carrying: { ...BASE_CONFIG.carrying, agedThresholdDays } };
  const carryingEvents: { day: number; totalCost: number; vehicleCount: number }[] = [];
  bus.subscribe('economy:carrying_cost_posted', (e) => carryingEvents.push(e));
  const expenseEvents: { day: number; amount: number; label: string }[] = [];
  bus.subscribe('economy:expense_posted', (e) => expenseEvents.push(e));
  const inventory: Inventory = createInventory({
    bus,
    masterSeed,
    economy,
    vehicleData: VEHICLE_DATA,
    inventoryConfig,
    getTier,
  });
  return { bus, clock, economy, inventory, carryingEvents, expenseEvents };
}

function buyFirst(setup: ReturnType<typeof makeSetup>): LotVehicle {
  setup.clock.advanceDay();
  const [listing] = setup.inventory.getAuctionListings();
  setup.inventory.buyFromAuction(listing.id);
  return setup.inventory.getLotVehicle(listing.id)!;
}

describe('computeDailyCarryingCost (#173)', () => {
  it('sums floorplan interest + flat insurance + flat overhead', () => {
    const cost = computeDailyCarryingCost({
      bookValue: 10_000,
      apr: 0.09,
      reconComplete: false,
      config: CARRYING,
    });
    // 10000 × 0.09 / 365 = 2.466 floorplan + 5 + 8 = 15.466 → 15
    expect(cost).toBe(15);
  });

  it('adds recon fade only once recon is complete', () => {
    const args = { bookValue: 10_000, apr: 0.09, config: CARRYING };
    const sitting = computeDailyCarryingCost({ ...args, reconComplete: true });
    const inRecon = computeDailyCarryingCost({ ...args, reconComplete: false });
    expect(sitting - inRecon).toBe(CARRYING.reconFadePerDay);
  });

  it('floorplan interest scales with book value', () => {
    const lo = computeDailyCarryingCost({ bookValue: 5_000, apr: 0.09, reconComplete: false, config: CARRYING });
    const hi = computeDailyCarryingCost({ bookValue: 50_000, apr: 0.09, reconComplete: false, config: CARRYING });
    expect(hi).toBeGreaterThan(lo);
  });
});

describe('floorplanAprForTier (#173)', () => {
  it('returns the tier-specific APR (better tier → cheaper money)', () => {
    expect(floorplanAprForTier(CARRYING, 1)).toBe(0.09);
    expect(floorplanAprForTier(CARRYING, 3)).toBe(0.06);
    expect(floorplanAprForTier(CARRYING, 2)).toBeLessThan(floorplanAprForTier(CARRYING, 1));
  });

  it('falls back to baselineApr for an unlisted tier', () => {
    expect(floorplanAprForTier(CARRYING, 9)).toBe(CARRYING.baselineApr);
  });
});

describe('Inventory — daily carrying cost accrual (#173)', () => {
  it('posts an aggregate carrying-cost expense + event once a unit is on the lot', () => {
    const setup = makeSetup();
    buyFirst(setup);
    setup.carryingEvents.length = 0; // ignore the empty-lot day-1 tick
    setup.clock.advanceDay(); // day 2 — the unit accrues

    const last = setup.carryingEvents.at(-1)!;
    expect(last.vehicleCount).toBe(1);
    expect(last.totalCost).toBeGreaterThan(0);

    const posted = setup.expenseEvents.find((e) =>
      e.label.startsWith('Floorplan & carrying cost'),
    );
    expect(posted).toBeDefined();
    expect(posted!.amount).toBe(last.totalCost);
  });

  it('accumulates carryingCostToDate and exposes the daily burn per unit', () => {
    const setup = makeSetup();
    const v = buyFirst(setup);
    setup.clock.advanceDay(); // day 2
    const d2 = setup.inventory.getLotVehicle(v.id)!;
    expect(d2.dailyCarryingCost).toBeGreaterThan(0);
    expect(d2.carryingCostToDate).toBe(d2.dailyCarryingCost);

    setup.clock.advanceDay(); // day 3
    const d3 = setup.inventory.getLotVehicle(v.id)!;
    expect(d3.carryingCostToDate).toBe(d2.carryingCostToDate + d3.dailyCarryingCost);
  });

  it('flags a unit aged once days-on-lot crosses the threshold', () => {
    const setup = makeSetup({ agedThresholdDays: 2 });
    const v = buyFirst(setup); // arrivalDay 1
    setup.clock.advanceDay(); // day 2 → daysInInventory 1, not aged
    expect(setup.inventory.getLotVehicle(v.id)!.aged).toBe(false);
    setup.clock.advanceDay(); // day 3 → daysInInventory 2, still not > 2
    expect(setup.inventory.getLotVehicle(v.id)!.aged).toBe(false);
    setup.clock.advanceDay(); // day 4 → daysInInventory 3 > 2 → aged
    expect(setup.inventory.getLotVehicle(v.id)!.aged).toBe(true);
  });

  it('reports a zero-burn event on a day the lot is empty (no expense posted)', () => {
    const setup = makeSetup();
    setup.clock.advanceDay(); // day 1, empty lot
    const ev = setup.carryingEvents.at(-1)!;
    expect(ev.vehicleCount).toBe(0);
    expect(ev.totalCost).toBe(0);
    expect(
      setup.expenseEvents.some((e) => e.label.startsWith('Floorplan & carrying cost')),
    ).toBe(false);
  });

  it('a better tier accrues less floorplan interest for the same unit', () => {
    const t1 = makeSetup({ masterSeed: 7, getTier: () => 1 });
    const t3 = makeSetup({ masterSeed: 7, getTier: () => 3 });
    const v1 = buyFirst(t1);
    const v3 = buyFirst(t3);
    t1.clock.advanceDay();
    t3.clock.advanceDay();
    expect(t3.inventory.getLotVehicle(v3.id)!.dailyCarryingCost).toBeLessThan(
      t1.inventory.getLotVehicle(v1.id)!.dailyCarryingCost,
    );
  });

  it('is deterministic: identical state on day N posts identical carry', () => {
    const a = makeSetup({ masterSeed: 99 });
    const b = makeSetup({ masterSeed: 99 });
    buyFirst(a);
    buyFirst(b);
    for (let i = 0; i < 4; i++) {
      a.clock.advanceDay();
      b.clock.advanceDay();
    }
    expect(a.carryingEvents).toEqual(b.carryingEvents);
  });
});

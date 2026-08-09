import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import type { LedgerEntry } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';

/**
 * #374 — the P&L is accrual. A car's cost sits in stock until the car leaves,
 * and then it is relieved on the day it left. These tests drive the real
 * Inventory through its barrel, because "buying stock is not a loss" is only
 * true if the *other* half actually happens at the sale.
 */

const STARTING_CASH = 500_000;
const NO_OVERHEAD = { weeklyRent: 0 };
const COST_OF_SALE = 'Cost of Vehicles Sold';

const vehicleData = loadVehicleData();

function makeStore() {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const economy = createEconomy({
    bus,
    startingCash: STARTING_CASH,
    config: NO_OVERHEAD,
    getCurrentDay: () => clock.currentDay,
  });
  const inventory = createInventory({ bus, masterSeed: 42, economy, vehicleData });
  return { bus, clock, economy, inventory };
}

/** Buy the first listing off the board and return the unit that landed. */
function buyOne(store: ReturnType<typeof makeStore>) {
  store.clock.advanceDay(); // the board stocks overnight; the buy lands on day 2
  const [listing] = store.inventory.getAuctionListings();
  store.inventory.buyFromAuction(listing.id);
  const vehicle = store.inventory.getLotVehicle(listing.id)!;
  return { listing, vehicle };
}

function reliefEntries(entries: readonly LedgerEntry[]): readonly LedgerEntry[] {
  return entries.filter((e) => e.label === COST_OF_SALE);
}

describe('Economy — accrual P&L (#374)', () => {
  it("relieves the unit's acquisition price at the close, not at the buy", () => {
    const store = makeStore();
    const { listing, vehicle } = buyOne(store);

    // Day 2: bought. The money left the bank and the P&L says nothing yet.
    expect(store.economy.getPnL(2, 2).totalExpenses).toBe(0);

    store.clock.advanceDay(); // → day 3
    store.inventory.sellVehicle(vehicle.id, 20_000);

    const dayOfSale = store.economy.getPnL(3, 3);
    const relief = reliefEntries(dayOfSale.entries);
    expect(relief).toHaveLength(1);
    expect(relief[0].amount).toBe(listing.askingPrice);
    expect(relief[0].day).toBe(3);
    expect(relief[0].nonCash).toBe(true);
  });

  it('a cost-of-sale entry moves no cash', () => {
    const store = makeStore();
    const { vehicle } = buyOne(store);

    // Inventory posts no sale revenue — DealEngine does — so this isolates the
    // relief. If it debited cash, the store would pay for the same car twice.
    const cashBefore = store.economy.cash;
    store.inventory.sellVehicle(vehicle.id, 20_000);
    expect(store.economy.cash).toBe(cashBefore);
  });

  it('recon is expensed once, not twice', () => {
    const store = makeStore();
    const { listing, vehicle } = buyOne(store);

    // Let recon run so there is a sunk cost to double-count.
    store.clock.advanceDay();
    store.clock.advanceDay();
    const reconned = store.inventory.getLotVehicle(vehicle.id)!;
    expect(reconned.reconCost).toBeGreaterThan(0);

    store.inventory.sellVehicle(vehicle.id, 20_000);

    // The relief is the acquisition price alone. Recon was already charged as
    // operating spend on the days it was incurred (#255's category boundary),
    // so relieving the full cost basis would bill the store for it twice.
    const relief = reliefEntries(store.economy.getPnL(1, 99).entries);
    expect(relief).toHaveLength(1);
    expect(relief[0].amount).toBe(listing.askingPrice);
    expect(relief[0].amount).toBeLessThan(reconned.purchasePrice + reconned.reconCost);
  });

  it('a wholesaled unit is relieved too', () => {
    const store = makeStore();
    const { listing, vehicle } = buyOne(store);

    store.inventory.wholesaleVehicle(vehicle.id);

    // A dump at a haircut is still a unit that left the lot, so its cost stops
    // sitting in stock. Without this the release valve would read as pure
    // profit on the statement.
    const relief = reliefEntries(store.economy.getPnL(1, 99).entries);
    expect(relief).toHaveLength(1);
    expect(relief[0].amount).toBe(listing.askingPrice);
  });

  it('unsold stock costs the P&L nothing', () => {
    const store = makeStore();
    buyOne(store);

    // Three cars bought and none sold: the old cash-basis read called that a
    // five-figure loss. The store simply owns three cars.
    const pnl = store.economy.getPnL(1, 99);
    expect(reliefEntries(pnl.entries)).toHaveLength(0);
    expect(pnl.entries.some((e) => e.category === 'inventoryAcquisition')).toBe(false);
  });
});

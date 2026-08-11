import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * #380 — the store's worth: cash on hand plus what the cars on the lot cost.
 *
 * The point of the figure is that a *purchase* is a move, not a loss. Every
 * assertion here is that one rule seen from a different door: buying leaves the
 * total still, retailing a car for more than it cost raises it by the gross,
 * and dumping one for less lowers it by exactly the loss the release valve
 * quoted. If a future slice makes any of those three drift, the number stops
 * being checkable by a player adding two figures the game shows them, which is
 * the whole reason it exists.
 */

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

function makeWorld(masterSeed = 4041) {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
  return { bus, world };
}

/** The cheapest listing the store can actually afford, so the buy never throws. */
function affordableListingId(world: ReturnType<typeof makeWorld>['world']): string {
  const affordable = world.inventory
    .getAuctionListings()
    .filter((l) => l.askingPrice <= world.economy.cash)
    .sort((a, b) => a.askingPrice - b.askingPrice);
  expect(affordable.length).toBeGreaterThan(0);
  return affordable[0].id;
}

describe('#380 the store is worth its cash plus its stock', () => {
  it('one number, one place', () => {
    const { world } = makeWorld();
    const worth = world.getStoreWorth();

    // The getter is the only place the addition happens. Both halves are the
    // live module reads, and the total is carried rather than left to a caller
    // — two surfaces summing their own is exactly the failure this prevents.
    expect(worth.cash).toBe(world.economy.cash);
    expect(worth.stockValue).toBe(world.inventory.getStockValue());
    expect(worth.total).toBe(worth.cash + worth.stockValue);

    // The stock half is cost basis — what the store has in its cars — not a
    // market appraisal, which would drift the total on a day nobody played.
    const basis = world.inventory
      .getLotVehicles()
      .reduce((sum, v) => sum + v.purchasePrice + v.reconCost, 0);
    expect(worth.stockValue).toBe(basis);
  });

  it('buying a car moves money, it does not burn it', () => {
    const { world } = makeWorld();
    const before = world.getStoreWorth();
    const listingId = affordableListingId(world);
    const price = world.inventory
      .getAuctionListings()
      .find((l) => l.id === listingId)!.askingPrice;

    world.inventory.buyFromAuction(listingId);
    const after = world.getStoreWorth();

    // Cash fell by the price and the lot rose by it. The headline number the
    // player reads every morning went down; what the store is worth did not.
    expect(after.cash).toBe(before.cash - price);
    expect(after.stockValue).toBe(before.stockValue + price);
    expect(after.total).toBe(before.total);
  });

  it('a profitable sale is worth more than the car was', () => {
    const { world } = makeWorld();
    const unit = world.inventory.getLotVehicles()[0];
    expect(unit).toBeTruthy();

    const before = world.getStoreWorth();
    const result = world.dealEngine.closeDeal({
      customerId: 'cust-net-worth',
      vehicleId: unit.id,
      agreedPrice: unit.purchasePrice + unit.reconCost + 3_500,
      paymentMethod: 'cash',
    });
    const after = world.getStoreWorth();

    // The car left the lot at its cost basis and the money came in at the
    // selling price; the difference between those two IS the front gross.
    expect(result.frontGross).toBe(3_500);
    expect(after.total - before.total).toBe(result.frontGross);
  });

  it('the release valve costs what it costs', () => {
    const { world } = makeWorld();
    const unit = world.inventory.getLotVehicles()[0];
    const quote = world.inventory.getWholesaleQuote(unit.id)!;
    // The valve exists to realize a loss on purpose (#362) — that is the case
    // worth pinning, because it is the one where the total must fall.
    expect(quote.gain).toBeLessThan(0);

    const before = world.getStoreWorth();
    world.inventory.wholesaleVehicle(unit.id);
    const after = world.getStoreWorth();

    expect(after.total - before.total).toBe(quote.gain);
  });

  it('a store with no cars is worth its cash', () => {
    const { world } = makeWorld();
    for (const v of world.inventory.getLotVehicles()) {
      world.inventory.wholesaleVehicle(v.id);
    }
    const worth = world.getStoreWorth();

    expect(world.inventory.getLotVehicles()).toHaveLength(0);
    expect(worth.stockValue).toBe(0);
    expect(worth.total).toBe(worth.cash);
  });
});

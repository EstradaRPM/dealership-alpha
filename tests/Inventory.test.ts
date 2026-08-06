import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import {
  createInventory,
  loadVehicleData,
  loadInventoryConfig,
} from '../src/game/Inventory';
import type { TradeAcquisitionInput } from '../src/game/Inventory';
import { generateAuctionListings } from '../src/game/Inventory/auctionGenerator';

const MASTER_SEED = 99;
const STARTING_CASH = 50000;
const vehicleData = loadVehicleData();

const NO_OVERNIGHT_CONFIG = { weeklyRent: 0 };

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

  it('listings appear on clock:day_started (early-game board is fat)', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    expect(inventory.getAuctionListings().length).toBeGreaterThanOrEqual(12);
    expect(inventory.getAuctionListings().length).toBeLessThanOrEqual(18);
  });

  it('opening days yield a viable bootstrap board, then settle to steady-state (#129)', () => {
    const eg = vehicleData.auctionConfig.earlyGame!;
    for (let day = 1; day <= eg.throughDay; day++) {
      const n = generateAuctionListings(day, MASTER_SEED, vehicleData).length;
      expect(n).toBeGreaterThanOrEqual(eg.minListings);
      expect(n).toBeLessThanOrEqual(eg.maxListings);
    }
    const steady = generateAuctionListings(eg.throughDay + 1, MASTER_SEED, vehicleData).length;
    expect(steady).toBeGreaterThanOrEqual(vehicleData.auctionConfig.minListings);
    expect(steady).toBeLessThanOrEqual(vehicleData.auctionConfig.maxListings);
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
    // #162: reconCost is now the running sunk cost (0 at purchase); the
    // auction-listed estimate lives on reconEstimate.
    expect(v!.reconCost).toBe(0);
    expect(v!.reconEstimate).toBe(listing.reconCost);
    expect(v!.reconStatus).toBe('in_progress');
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

// ── Pricing surface (#120) ────────────────────────────────────────────────────

describe('Inventory — pricing surface', () => {
  it('a freshly bought vehicle defaults askingPrice to suggestedRetail', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    const v = inventory.getLotVehicle(listing.id)!;
    expect(v.suggestedRetail).toBe(listing.askingPrice + listing.reconCost);
    expect(v.askingPrice).toBe(v.suggestedRetail);
  });

  it('setAskingPrice updates the lot vehicle (rounded, clamped at 0)', () => {
    const { clock, inventory } = makeSetup();
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    inventory.setAskingPrice(listing.id, 18_499.6);
    expect(inventory.getLotVehicle(listing.id)!.askingPrice).toBe(18_500);

    inventory.setAskingPrice(listing.id, -500);
    expect(inventory.getLotVehicle(listing.id)!.askingPrice).toBe(0);
  });

  it('setAskingPrice on an unknown vehicleId is a no-op', () => {
    const { inventory } = makeSetup();
    expect(() => inventory.setAskingPrice('no-such-id', 1000)).not.toThrow();
  });
});

// ── The lot cap on buying (#361, A2 R2) ──────────────────────────────────────
//
// Lot size is CSV tier truth and nothing enforced it, so "match your inventory
// to demand" had no squeeze in it. R2: **the lot cap governs buying, and a
// trade always lands.** One number, checked at the bid; no overflow lot, no
// forced dump, no new vehicle state.

const CAP_TRADE: TradeAcquisitionInput = {
  customerId: 'cust-1',
  currentVehicle: {
    templateId: 'sedan-midsize',
    brand: 'vanda',
    make: 'Honda',
    model: 'Accord',
    year: 2018,
    mileage: 62_000,
    condition: 'average',
    category: 'sedan',
    loanPayoff: 9_000,
  },
  agreedAllowance: 12_500,
  staffConfidence: 0.8,
};

/**
 * A lot whose built spaces the test moves, plus an optional UCM auto-source.
 * `builtSpaces` is a mutable box because the point of several of these cases is
 * that the cap is read LIVE — construction landing must reopen buying with no
 * further player action.
 */
function makeCappedSetup(
  builtSpaces: { value: number },
  autoSourceFn?: (listings: readonly { id: string }[]) => readonly string[],
) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({
    bus,
    startingCash: 500_000,
    config: NO_OVERNIGHT_CONFIG,
  });
  const inventory = createInventory({
    bus,
    masterSeed: MASTER_SEED,
    economy,
    vehicleData,
    getBuiltLotSpaces: () => builtSpaces.value,
    autoSourceFn,
  });
  return { bus, clock, economy, inventory };
}

describe('Inventory — the lot cap on buying (#361)', () => {
  it('a unit in prep occupies a space like any other', () => {
    const built = { value: 4 };
    const { clock, inventory } = makeCappedSetup(built);
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    // Recon outstanding AND inside the #295 frontline hold — the two states a
    // player might read as "not on the lot yet". There is no off-lot place in
    // the model: the car is sitting on your lot costing you money.
    const bought = inventory.getLotVehicle(listing.id)!;
    expect(bought.reconStatus).toBe('in_progress');
    expect(bought.frontlineDay).toBeGreaterThan(bought.arrivalDay);

    expect(inventory.getLotOccupancy()).toEqual({
      occupied: 1,
      built: 4,
      spacesOpen: 3,
      atCapacity: false,
    });
  });

  it('refuses an auction buy with no space for it', () => {
    const built = { value: 2 };
    const { clock, inventory } = makeCappedSetup(built);
    clock.advanceDay();
    const [a, b, c] = inventory.getAuctionListings();
    inventory.buyFromAuction(a.id);
    inventory.buyFromAuction(b.id);

    expect(inventory.getLotOccupancy().atCapacity).toBe(true);
    expect(() => inventory.buyFromAuction(c.id)).toThrow(/[Nn]o space/);
    // A refusal changes nothing: the listing is still on the board and the
    // unit never landed.
    expect(inventory.getLotVehicles()).toHaveLength(2);
    expect(inventory.getAuctionListings().some((l) => l.id === c.id)).toBe(true);
  });

  it("the UCM's auto-source stops at the lot cap", () => {
    const built = { value: 3 };
    // The desk picks six; three spaces exist. You cannot win six cars into
    // three spaces, and a full lot is a normal morning — the desk stops rather
    // than throwing.
    const { clock, inventory } = makeCappedSetup(built, (listings) =>
      listings.slice(0, 6).map((l) => l.id),
    );
    expect(() => clock.advanceDay()).not.toThrow();
    expect(inventory.getLotVehicles()).toHaveLength(3);
    expect(inventory.getLotOccupancy().atCapacity).toBe(true);
  });

  it('a trade lands at the cap and may put the lot over', () => {
    const built = { value: 1 };
    const { clock, inventory } = makeCappedSetup(built);
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    expect(inventory.getLotOccupancy().atCapacity).toBe(true);

    // Part of a sale already made — refusing it would unwind a closed deal.
    expect(() => inventory.acquireFromTrade(CAP_TRADE)).not.toThrow();
    const over = inventory.getLotOccupancy();
    expect(over.occupied).toBe(2);
    expect(over.built).toBe(1);
    expect(over.spacesOpen).toBe(0);
  });

  it('buying stays frozen while the lot is over capacity', () => {
    const built = { value: 2 };
    const { clock, inventory } = makeCappedSetup(built);
    clock.advanceDay();
    const [first, second, next] = inventory.getAuctionListings();
    inventory.buyFromAuction(first.id);
    inventory.buyFromAuction(second.id);
    const traded = inventory.acquireFromTrade(CAP_TRADE);
    expect(inventory.getLotOccupancy().occupied).toBe(3);

    expect(() => inventory.buyFromAuction(next.id)).toThrow(/[Nn]o space/);
    // Back at the cap is still frozen — "under" is the rule, not "not over".
    inventory.sellVehicle(traded.id);
    expect(inventory.getLotOccupancy()).toMatchObject({
      occupied: 2,
      built: 2,
      atCapacity: true,
    });
    expect(() => inventory.buyFromAuction(next.id)).toThrow(/[Nn]o space/);

    // One more out and the lane opens.
    inventory.sellVehicle(first.id);
    expect(inventory.getLotOccupancy().atCapacity).toBe(false);
    expect(() => inventory.buyFromAuction(next.id)).not.toThrow();
  });

  it('new spaces reopen the auction', () => {
    const built = { value: 1 };
    const { clock, inventory } = makeCappedSetup(built);
    clock.advanceDay();
    const [first, next] = inventory.getAuctionListings();
    inventory.buyFromAuction(first.id);
    expect(() => inventory.buyFromAuction(next.id)).toThrow(/[Nn]o space/);

    // A construction job landed — the cap is read live, so nothing else has to
    // happen for the lane to open.
    built.value = 2;
    expect(inventory.getLotOccupancy()).toEqual({
      occupied: 1,
      built: 2,
      spacesOpen: 1,
      atCapacity: false,
    });
    expect(() => inventory.buyFromAuction(next.id)).not.toThrow();
  });

  it('no Facility wired means no cap — the pre-#361 harness is unchanged', () => {
    const { clock, inventory } = makeSetup(0, 500_000);
    clock.advanceDay();
    for (const listing of inventory.getAuctionListings().slice(0, 5)) {
      inventory.buyFromAuction(listing.id);
    }
    expect(inventory.getLotVehicles()).toHaveLength(5);
    expect(inventory.getLotOccupancy().atCapacity).toBe(false);
  });
});

// ── The wholesale release valve (#362, A2 R2) ────────────────────────────────
//
// The only path that turned a unit back into cash was abandoning recon after a
// surprise, so being lot-locked with three units nobody wants was a dead end.
// This is the valve on its own merits — the player picks the unit and sees the
// number before committing, because it is the one action that realizes a loss
// on purpose.

const HAIRCUT = loadInventoryConfig().wholesale.haircutPct;

/** A lot whose book value the test controls, so "off book" is provable. */
function makeWholesaleSetup(book: number, builtSpaces?: { value: number }) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({
    bus,
    startingCash: 500_000,
    config: NO_OVERNIGHT_CONFIG,
  });
  const inventory = createInventory({
    bus,
    masterSeed: MASTER_SEED,
    economy,
    vehicleData,
    bookValueFn: () => book,
    ...(builtSpaces ? { getBuiltLotSpaces: () => builtSpaces.value } : {}),
  });
  return { bus, clock, economy, inventory };
}

describe('Inventory — the wholesale release valve (#362)', () => {
  it('wholesaling a unit takes it off the lot and pays cash', () => {
    const { bus, clock, economy, inventory } = makeWholesaleSetup(12_000);
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    const before = economy.cash;

    const wholesaled: Array<{ vehicleId: string; proceeds: number; make: string }> = [];
    bus.subscribe('inventory:vehicle_wholesaled', (e) => wholesaled.push(e));

    const quote = inventory.wholesaleVehicle(listing.id);

    expect(inventory.getLotVehicle(listing.id)).toBeUndefined();
    expect(economy.cash).toBe(before + quote.proceeds);
    // A wholesale is NOT a retail sale: it names the unit on its own event so
    // the history feed can say which car went and what it cost to let it go.
    expect(wholesaled).toHaveLength(1);
    expect(wholesaled[0].vehicleId).toBe(listing.id);
    expect(wholesaled[0].proceeds).toBe(quote.proceeds);
    expect(wholesaled[0].make).toBe(listing.make);
  });

  it('proceeds come off book value, not the asking price', () => {
    const { clock, inventory } = makeWholesaleSetup(12_000);
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    // The ask is what you HOPE a retail customer pays. A wholesale buyer is
    // buying to resell and prices off book — so moving the ask to the moon
    // must not move the offer by a dollar.
    const atMarket = inventory.getWholesaleQuote(listing.id)!;
    inventory.setAskingPrice(listing.id, 999_999);
    const dreaming = inventory.getWholesaleQuote(listing.id)!;

    expect(dreaming.proceeds).toBe(atMarket.proceeds);
    expect(dreaming.proceeds).toBe(Math.round(12_000 * (1 - HAIRCUT)));
    expect(dreaming.bookValue).toBe(12_000);
  });

  it('states the loss against cost basis before anything commits', () => {
    const { clock, economy, inventory } = makeWholesaleSetup(12_000);
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);
    const parked = inventory.getLotVehicle(listing.id)!;
    const cashBefore = economy.cash;

    const quote = inventory.getWholesaleQuote(listing.id)!;
    expect(quote.costBasis).toBe(parked.purchasePrice + parked.reconCost);
    expect(quote.gain).toBe(quote.proceeds - quote.costBasis);

    // Quoting is a read. Nothing left the lot and no money moved.
    expect(inventory.getLotVehicle(listing.id)).toBeDefined();
    expect(economy.cash).toBe(cashBefore);
    expect(inventory.getWholesaleQuote('nobody')).toBeUndefined();
  });

  it('a unit still in prep can be wholesaled', () => {
    const { clock, inventory } = makeWholesaleSetup(12_000);
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    // Recon outstanding AND inside the #295 frontline hold — the two states a
    // second ceiling would have been written against. There is no second
    // ceiling: recon is a cost and the hold is about who may be SHOWN the car,
    // and the units you most want to dump are exactly the ones you regret.
    const parked = inventory.getLotVehicle(listing.id)!;
    expect(parked.reconStatus).toBe('in_progress');
    expect(parked.frontlineDay).toBeGreaterThan(parked.arrivalDay);

    expect(() => inventory.wholesaleVehicle(listing.id)).not.toThrow();
    expect(inventory.getLotVehicles()).toHaveLength(0);
  });

  it('wholesaling out of an overrun reopens the auction', () => {
    const built = { value: 2 };
    const { clock, inventory } = makeWholesaleSetup(12_000, built);
    clock.advanceDay();
    const [first, second, next] = inventory.getAuctionListings();
    inventory.buyFromAuction(first.id);
    inventory.buyFromAuction(second.id);
    // A trade always lands, and is the one way over the cap (#361).
    const traded = inventory.acquireFromTrade(CAP_TRADE);
    expect(() => inventory.buyFromAuction(next.id)).toThrow(/[Nn]o space/);

    // Back AT the cap is still frozen — "under" is the rule, not "not over".
    inventory.wholesaleVehicle(traded.id);
    expect(inventory.getLotOccupancy()).toMatchObject({ occupied: 2, atCapacity: true });
    expect(() => inventory.buyFromAuction(next.id)).toThrow(/[Nn]o space/);

    // One more out and the lane opens with no further player action.
    inventory.wholesaleVehicle(first.id);
    expect(inventory.getLotOccupancy().atCapacity).toBe(false);
    expect(() => inventory.buyFromAuction(next.id)).not.toThrow();
  });

  it('refuses an id that is not on the lot', () => {
    const { inventory } = makeWholesaleSetup(12_000);
    expect(() => inventory.wholesaleVehicle('nobody')).toThrow(/No lot vehicle/);
  });
});

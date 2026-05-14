import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
import { createCustomerPool } from '../src/game/CustomerPool';
import { createDealEngine } from '../src/game/DealEngine';
import { loadFniProducts } from '../src/game/DealEngine';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';

const MASTER_SEED = 42;
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

function setupNegotiating() {
  const setup = makeSetup();
  const { clock, inventory, pool } = setup;

  clock.advanceDay();
  const [listing] = inventory.getAuctionListings();
  inventory.buyFromAuction(listing.id);

  const [session] = pool.getSessions();
  const customerId = session.customerId;
  pool.dispatch(customerId, 'GREET');
  pool.dispatch(customerId, 'QUALIFY');
  pool.dispatch(customerId, 'DEMO');
  pool.dispatch(customerId, 'NEGOTIATE');

  return { ...setup, customerId, vehicleId: listing.id, listing };
}

// ── getFniProducts ─────────────────────────────────────────────────────────────

describe('DealEngine.getFniProducts', () => {
  it('returns VSC and GAP products', () => {
    const { dealEngine } = makeSetup();
    const products = dealEngine.getFniProducts();
    const ids = products.map((p) => p.id);
    expect(ids).toContain('vsc');
    expect(ids).toContain('gap');
    expect(products).toHaveLength(2);
  });

  it('each product has id, label, shortLabel, defaultPrice, cost', () => {
    const { dealEngine } = makeSetup();
    for (const p of dealEngine.getFniProducts()) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(typeof p.shortLabel).toBe('string');
      expect(typeof p.defaultPrice).toBe('number');
      expect(typeof p.cost).toBe('number');
      expect(p.defaultPrice).toBeGreaterThan(p.cost);
    }
  });
});

// ── loadFniProducts ────────────────────────────────────────────────────────────

describe('loadFniProducts', () => {
  it('loads a catalog with schemaVersion and products array', () => {
    const catalog = loadFniProducts();
    expect(catalog.schemaVersion).toBeGreaterThan(0);
    expect(Array.isArray(catalog.products)).toBe(true);
    expect(catalog.products.length).toBeGreaterThan(0);
  });
});

// ── closeDeal back gross — no F&I ─────────────────────────────────────────────

describe('DealEngine.closeDeal — back gross (no F&I)', () => {
  it('backGross is 0 when no fniProducts attached', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const result = dealEngine.closeDeal({ customerId, vehicleId, agreedPrice: listing.askingPrice });
    expect(result.backGross).toBe(0);
    expect(result.fniProducts).toHaveLength(0);
  });

  it('backGross is 0 when fniProducts is empty array', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const result = dealEngine.closeDeal({
      customerId,
      vehicleId,
      agreedPrice: listing.askingPrice,
      fniProducts: [],
    });
    expect(result.backGross).toBe(0);
  });
});

// ── closeDeal back gross — VSC only ───────────────────────────────────────────

describe('DealEngine.closeDeal — back gross (VSC only)', () => {
  it('backGross equals VSC price minus VSC cost', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const catalog = loadFniProducts();
    const vsc = catalog.products.find((p) => p.id === 'vsc')!;
    const attachedPrice = vsc.defaultPrice;

    const result = dealEngine.closeDeal({
      customerId,
      vehicleId,
      agreedPrice: listing.askingPrice,
      fniProducts: [{ productId: 'vsc', price: attachedPrice }],
    });

    expect(result.backGross).toBe(attachedPrice - vsc.cost);
    expect(result.fniProducts).toHaveLength(1);
    expect(result.fniProducts[0].productId).toBe('vsc');
  });

  it('front gross is unaffected by F&I', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const catalog = loadFniProducts();
    const vsc = catalog.products.find((p) => p.id === 'vsc')!;

    const result = dealEngine.closeDeal({
      customerId,
      vehicleId,
      agreedPrice: listing.askingPrice + 1_000,
      fniProducts: [{ productId: 'vsc', price: vsc.defaultPrice }],
    });

    expect(result.frontGross).toBe(1_000 - listing.reconCost);
    expect(result.backGross).toBe(vsc.defaultPrice - vsc.cost);
  });
});

// ── closeDeal back gross — VSC + GAP ─────────────────────────────────────────

describe('DealEngine.closeDeal — back gross (VSC + GAP)', () => {
  it('backGross is sum of both products gross', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const catalog = loadFniProducts();
    const vsc = catalog.products.find((p) => p.id === 'vsc')!;
    const gap = catalog.products.find((p) => p.id === 'gap')!;

    const result = dealEngine.closeDeal({
      customerId,
      vehicleId,
      agreedPrice: listing.askingPrice,
      fniProducts: [
        { productId: 'vsc', price: vsc.defaultPrice },
        { productId: 'gap', price: gap.defaultPrice },
      ],
    });

    const expected = (vsc.defaultPrice - vsc.cost) + (gap.defaultPrice - gap.cost);
    expect(result.backGross).toBe(expected);
  });

  it('hand-computed: VSC $1495 cost $495, GAP $695 cost $195 → back $1500', () => {
    const { dealEngine, customerId, vehicleId, listing } = setupNegotiating();

    const result = dealEngine.closeDeal({
      customerId,
      vehicleId,
      agreedPrice: listing.askingPrice,
      fniProducts: [
        { productId: 'vsc', price: 1495 },
        { productId: 'gap', price: 695  },
      ],
    });

    // VSC: 1495 - 495 = 1000, GAP: 695 - 195 = 500, total = 1500
    expect(result.backGross).toBe(1500);
  });
});

// ── economy cash includes F&I revenue ─────────────────────────────────────────

describe('DealEngine.closeDeal — economy cash with F&I', () => {
  it('cash increases by agreedPrice plus sum of F&I product prices', () => {
    const { economy, dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const cashAfterPurchase = economy.cash;
    const agreedPrice = listing.askingPrice + 2_000;
    const vscPrice = 1495;
    const gapPrice = 695;

    dealEngine.closeDeal({
      customerId,
      vehicleId,
      agreedPrice,
      fniProducts: [
        { productId: 'vsc', price: vscPrice },
        { productId: 'gap', price: gapPrice },
      ],
    });

    expect(economy.cash).toBe(cashAfterPurchase + agreedPrice + vscPrice + gapPrice);
  });
});

// ── deal:closed event carries backGross ────────────────────────────────────────

describe('DealEngine.closeDeal — deal:closed event with F&I', () => {
  it('deal:closed event backGross matches computed back gross', () => {
    const { bus, dealEngine, customerId, vehicleId, listing } = setupNegotiating();
    const events: Array<{ backGross: number }> = [];
    bus.subscribe('deal:closed', (e) => events.push(e));

    dealEngine.closeDeal({
      customerId,
      vehicleId,
      agreedPrice: listing.askingPrice,
      fniProducts: [
        { productId: 'vsc', price: 1495 },
        { productId: 'gap', price: 695  },
      ],
    });

    expect(events[0].backGross).toBe(1500);
  });
});

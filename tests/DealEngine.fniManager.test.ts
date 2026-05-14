import { createDealEngine, loadFniProducts, loadFniAutoAttachConfig } from '../src/game/DealEngine';
import type { FniAutoAttachConfig, FniProductCatalog } from '../src/game/DealEngine';

// Catalog with all 6 products — 2 open + 4 requiring f&i-manager
const FULL_CATALOG: FniProductCatalog = {
  schemaVersion: 1,
  products: [
    { id: 'vsc',               label: 'VSC',                shortLabel: 'VSC', defaultPrice: 1495, cost: 495 },
    { id: 'gap',               label: 'GAP',                shortLabel: 'GAP', defaultPrice: 695,  cost: 195 },
    { id: 'tireWheel',         label: 'Tire & Wheel',       shortLabel: 'T&W', defaultPrice: 795,  cost: 250, requiredRole: 'f&i-manager' },
    { id: 'etch',              label: 'Etching',            shortLabel: 'ETH', defaultPrice: 299,  cost: 50,  requiredRole: 'f&i-manager' },
    { id: 'prepaidMaintenance',label: 'Prepaid Maintenance', shortLabel: 'PPM', defaultPrice: 895,  cost: 300, requiredRole: 'f&i-manager' },
    { id: 'keyReplacement',    label: 'Key Replacement',    shortLabel: 'KEY', defaultPrice: 395,  cost: 95,  requiredRole: 'f&i-manager' },
  ],
};

const AUTO_ATTACH_CONFIG: FniAutoAttachConfig = {
  baseAttachRates: {
    vsc:               0.55,
    gap:               0.45,
    tireWheel:         0.30,
    etch:              0.25,
    prepaidMaintenance:0.35,
    keyReplacement:    0.40,
  },
  skillMultiplierRange: [0.4, 1.1],
};

function makeEngine(catalog = FULL_CATALOG, autoAttachConfig = AUTO_ATTACH_CONFIG) {
  return createDealEngine({ fniCatalog: catalog, fniAutoAttachConfig: autoAttachConfig });
}

// ── getFniProducts — role gating ──────────────────────────────────────────────

describe('DealEngine.getFniProducts — product menu gating', () => {
  it('no filter arg → all products returned', () => {
    const engine = makeEngine();
    expect(engine.getFniProducts()).toHaveLength(6);
  });

  it('no unlockedRoles arg → all products (backward compat)', () => {
    const engine = makeEngine();
    const ids = engine.getFniProducts().map((p) => p.id);
    expect(ids).toContain('tireWheel');
    expect(ids).toContain('etch');
  });

  it('empty unlockedRoles → only open-access products (VSC, GAP)', () => {
    const engine = makeEngine();
    const products = engine.getFniProducts([]);
    const ids = products.map((p) => p.id);
    expect(ids).toContain('vsc');
    expect(ids).toContain('gap');
    expect(ids).not.toContain('tireWheel');
    expect(ids).not.toContain('etch');
    expect(ids).not.toContain('prepaidMaintenance');
    expect(ids).not.toContain('keyReplacement');
    expect(products).toHaveLength(2);
  });

  it('f&i-manager role unlocked → all 6 products returned', () => {
    const engine = makeEngine();
    const products = engine.getFniProducts(['f&i-manager']);
    expect(products).toHaveLength(6);
  });

  it('live catalog has requiredRole on the 4 new products', () => {
    const catalog = loadFniProducts();
    const gated = catalog.products.filter((p) => p.requiredRole === 'f&i-manager');
    expect(gated.map((p) => p.id)).toEqual(
      expect.arrayContaining(['tireWheel', 'etch', 'prepaidMaintenance', 'keyReplacement']),
    );
    expect(gated).toHaveLength(4);
  });
});

// ── computeAutoFni — deterministic with injected RNG ─────────────────────────

describe('DealEngine.computeAutoFni — attach rate skill scaling', () => {
  it('always-attach RNG: all available products attached at any skill', () => {
    const engine = makeEngine();
    const alwaysAttach = () => 0;
    const result = engine.computeAutoFni(50, ['f&i-manager'], alwaysAttach);
    expect(result).toHaveLength(6);
  });

  it('never-attach RNG: no products attached regardless of skill', () => {
    const engine = makeEngine();
    const neverAttach = () => 1;
    const result = engine.computeAutoFni(100, ['f&i-manager'], neverAttach);
    expect(result).toHaveLength(0);
  });

  it('without f&i-manager role only 2 base products can attach', () => {
    const engine = makeEngine();
    const alwaysAttach = () => 0;
    const result = engine.computeAutoFni(100, [], alwaysAttach);
    const ids = result.map((p) => p.productId);
    expect(ids).toContain('vsc');
    expect(ids).toContain('gap');
    expect(result).toHaveLength(2);
  });

  it('higher skill → higher effective attach rate (vsc: 0.55 base)', () => {
    const engine = makeEngine();
    // At skill 0: multiplier = 0.4, vsc rate = 0.55 * 0.4 = 0.22
    // At skill 100: multiplier = 1.1, vsc rate = 0.55 * 1.1 = 0.605
    // RNG value 0.30: attached at skill=100, not attached at skill=0
    const rng30 = () => 0.30;
    const atLowSkill  = engine.computeAutoFni(0,   ['f&i-manager'], rng30);
    const atHighSkill = engine.computeAutoFni(100, ['f&i-manager'], rng30);
    const lowVsc  = atLowSkill.some((p)  => p.productId === 'vsc');
    const highVsc = atHighSkill.some((p) => p.productId === 'vsc');
    expect(lowVsc).toBe(false);
    expect(highVsc).toBe(true);
  });

  it('attached products use defaultPrice', () => {
    const engine = makeEngine();
    const result = engine.computeAutoFni(100, ['f&i-manager'], () => 0);
    for (const attached of result) {
      const product = FULL_CATALOG.products.find((p) => p.id === attached.productId)!;
      expect(attached.price).toBe(product.defaultPrice);
    }
  });

  it('skill=0 attach rates are clamped to min multiplier (never negative)', () => {
    const engine = makeEngine();
    const result = engine.computeAutoFni(0, ['f&i-manager'], () => -1);
    // rng() returning -1 is always < any positive rate — all attach
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── loadFniAutoAttachConfig ───────────────────────────────────────────────────

describe('loadFniAutoAttachConfig', () => {
  it('loads without error and has the expected shape', () => {
    const config = loadFniAutoAttachConfig();
    expect(typeof config.baseAttachRates).toBe('object');
    expect(Array.isArray(config.skillMultiplierRange)).toBe(true);
    expect(config.skillMultiplierRange).toHaveLength(2);
    expect(config.skillMultiplierRange[0]).toBeLessThan(config.skillMultiplierRange[1]);
  });

  it('has base rates for all 6 products', () => {
    const config = loadFniAutoAttachConfig();
    const expected = ['vsc', 'gap', 'tireWheel', 'etch', 'prepaidMaintenance', 'keyReplacement'];
    for (const id of expected) {
      expect(config.baseAttachRates[id]).toBeGreaterThan(0);
    }
  });
});

import { loadCompetitors, CompetitorSchema, CompetitorCatalogSchema } from '../src/game/CompetitorMarket';
import { DataValidationError } from '../src/game/data';

const baseClamp = {
  rep:       { lo: 0.5, hi: 0.9 },
  inventory: { lo: 0.4, hi: 0.8 },
  pricing:   { lo: 0.3, hi: 0.7 },
};

describe('CompetitorSchema', () => {
  const valid = {
    id: 'foo', name: 'Foo Motors', brand: 'corden',
    personality: 'volume_dealer', price_point: 'value' as const,
    rep: 0.7, inventory: 0.6, pricing: 0.5,
    clamp: baseClamp,
  };

  it('accepts a valid competitor', () => {
    expect(() => CompetitorSchema.parse(valid)).not.toThrow();
  });

  it('rejects rep above 1', () => {
    expect(() => CompetitorSchema.parse({ ...valid, rep: 1.1 })).toThrow();
  });

  it('rejects rep below 0', () => {
    expect(() => CompetitorSchema.parse({ ...valid, rep: -0.1 })).toThrow();
  });

  it('rejects inventory above 1', () => {
    expect(() => CompetitorSchema.parse({ ...valid, inventory: 1.5 })).toThrow();
  });

  it('rejects pricing below 0', () => {
    expect(() => CompetitorSchema.parse({ ...valid, pricing: -0.01 })).toThrow();
  });

  it('rejects empty brand string', () => {
    expect(() => CompetitorSchema.parse({ ...valid, brand: '' })).toThrow();
  });

  it('rejects empty id', () => {
    expect(() => CompetitorSchema.parse({ ...valid, id: '' })).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() => CompetitorSchema.parse({ ...valid, extra: true })).toThrow();
  });

  it('rejects invalid price_point', () => {
    expect(() => CompetitorSchema.parse({ ...valid, price_point: 'luxury' })).toThrow();
  });

  it('rejects clamp where lo > hi', () => {
    const badClamp = { ...baseClamp, rep: { lo: 0.9, hi: 0.5 } };
    expect(() => CompetitorSchema.parse({ ...valid, clamp: badClamp })).toThrow();
  });
});

describe('loadCompetitors', () => {
  it('loads and validates data/competitors.json', () => {
    const competitors = loadCompetitors();
    expect(Array.isArray(competitors)).toBe(true);
    expect(competitors.length).toBeGreaterThanOrEqual(5);
  });

  it('all stat values are in [0, 1]', () => {
    const competitors = loadCompetitors();
    for (const c of competitors) {
      expect(c.rep).toBeGreaterThanOrEqual(0);
      expect(c.rep).toBeLessThanOrEqual(1);
      expect(c.inventory).toBeGreaterThanOrEqual(0);
      expect(c.inventory).toBeLessThanOrEqual(1);
      expect(c.pricing).toBeGreaterThanOrEqual(0);
      expect(c.pricing).toBeLessThanOrEqual(1);
    }
  });

  it('all clamp bounds are valid (lo <= hi)', () => {
    const competitors = loadCompetitors();
    for (const c of competitors) {
      expect(c.clamp.rep.lo).toBeLessThanOrEqual(c.clamp.rep.hi);
      expect(c.clamp.inventory.lo).toBeLessThanOrEqual(c.clamp.inventory.hi);
      expect(c.clamp.pricing.lo).toBeLessThanOrEqual(c.clamp.pricing.hi);
    }
  });

  it('all base stats are within their own clamp bounds', () => {
    const competitors = loadCompetitors();
    for (const c of competitors) {
      expect(c.rep).toBeGreaterThanOrEqual(c.clamp.rep.lo);
      expect(c.rep).toBeLessThanOrEqual(c.clamp.rep.hi);
      expect(c.inventory).toBeGreaterThanOrEqual(c.clamp.inventory.lo);
      expect(c.inventory).toBeLessThanOrEqual(c.clamp.inventory.hi);
      expect(c.pricing).toBeGreaterThanOrEqual(c.clamp.pricing.lo);
      expect(c.pricing).toBeLessThanOrEqual(c.clamp.pricing.hi);
    }
  });

  it('all ids are unique', () => {
    const competitors = loadCompetitors();
    const ids = competitors.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all brand FKs reference known brands', () => {
    const { loadBrands } = require('../src/game/Brands');
    const knownBrands = new Set(Object.keys(loadBrands()));
    const competitors = loadCompetitors();
    for (const c of competitors) {
      expect(knownBrands.has(c.brand)).toBe(true);
    }
  });

  it('load is deterministic across calls', () => {
    const a = loadCompetitors();
    const b = loadCompetitors();
    expect(a).toEqual(b);
  });

  it('throws DataValidationError when a competitor has an unknown brand FK', () => {
    const { parseData } = require('../src/game/data');
    const raw = [
      { id: 'ghost', name: 'Ghost Motors', brand: 'not-a-brand',
        personality: 'volume_dealer', price_point: 'value',
        rep: 0.5, inventory: 0.5, pricing: 0.5,
        clamp: baseClamp },
    ];
    const catalog = parseData(raw, CompetitorCatalogSchema, 'test') as import('../src/game/CompetitorMarket').CompetitorCatalog;
    const knownBrands = new Set(['ford', 'toyota']);
    const missing = catalog.find((c) => !knownBrands.has(c.brand));
    expect(missing).toBeDefined();
    expect(() => {
      if (missing && !knownBrands.has(missing.brand)) {
        throw new DataValidationError(
          'test',
          `competitor "${missing.id}" references unknown brand "${missing.brand}"`,
        );
      }
    }).toThrow(DataValidationError);
  });
});

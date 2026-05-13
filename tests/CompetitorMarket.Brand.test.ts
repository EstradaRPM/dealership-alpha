import { loadBrands } from '../src/game/CompetitorMarket';
import { BrandCatalogSchema, BrandEntrySchema } from '../src/game/CompetitorMarket/schemas/brand';
import { DataValidationError } from '../src/game/data';

const VALID_SPACED_LEAN = {
  safety: 0.7,
  performance: 0.5,
  appearance: 0.4,
  comfort: 0.5,
  economy: 0.35,
  dependability: 0.8,
};

describe('BrandCatalogSchema', () => {
  it('accepts valid brand entry', () => {
    const entry = {
      segment_affinity: { truck: 0.9, economy: 0.4 },
      market_draw: 0.18,
      spaced_lean: VALID_SPACED_LEAN,
    };
    expect(() => BrandEntrySchema.parse(entry)).not.toThrow();
  });

  it('rejects affinity value above 1', () => {
    const entry = {
      segment_affinity: { truck: 1.5 },
      market_draw: 0.5,
      spaced_lean: VALID_SPACED_LEAN,
    };
    expect(() => BrandEntrySchema.parse(entry)).toThrow();
  });

  it('rejects market_draw above 1', () => {
    const entry = {
      segment_affinity: { truck: 0.9 },
      market_draw: 2.0,
      spaced_lean: VALID_SPACED_LEAN,
    };
    expect(() => BrandEntrySchema.parse(entry)).toThrow();
  });

  it('rejects negative affinity value', () => {
    const entry = {
      segment_affinity: { truck: -0.1 },
      market_draw: 0.5,
      spaced_lean: VALID_SPACED_LEAN,
    };
    expect(() => BrandEntrySchema.parse(entry)).toThrow();
  });

  it('rejects spaced_lean value above 1', () => {
    const entry = {
      segment_affinity: { truck: 0.9 },
      market_draw: 0.5,
      spaced_lean: { ...VALID_SPACED_LEAN, performance: 1.5 },
    };
    expect(() => BrandEntrySchema.parse(entry)).toThrow();
  });

  it('rejects missing spaced_lean', () => {
    const entry = {
      segment_affinity: { truck: 0.9 },
      market_draw: 0.5,
    };
    expect(() => BrandEntrySchema.parse(entry)).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    const entry = {
      segment_affinity: { truck: 0.9 },
      market_draw: 0.5,
      spaced_lean: VALID_SPACED_LEAN,
      extra: true,
    };
    expect(() => BrandEntrySchema.parse(entry)).toThrow();
  });

  it('throws DataValidationError via catalog schema on invalid input', () => {
    expect(() =>
      BrandCatalogSchema.parse({ corden: { segment_affinity: { truck: 2 }, market_draw: 0.1, spaced_lean: VALID_SPACED_LEAN } }),
    ).toThrow();
  });
});

describe('loadBrands', () => {
  it('loads and validates data/brands.json', () => {
    const brands = loadBrands();
    expect(typeof brands).toBe('object');
    expect(Object.keys(brands).length).toBeGreaterThan(0);
  });

  it('all affinity values are in [0, 1]', () => {
    const brands = loadBrands();
    for (const [, entry] of Object.entries(brands)) {
      expect(entry.market_draw).toBeGreaterThanOrEqual(0);
      expect(entry.market_draw).toBeLessThanOrEqual(1);
      for (const [, val] of Object.entries(entry.segment_affinity)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every brand has at least one segment affinity entry', () => {
    const brands = loadBrands();
    for (const [, entry] of Object.entries(brands)) {
      expect(Object.keys(entry.segment_affinity).length).toBeGreaterThan(0);
    }
  });

  it('all spaced_lean values are in [0, 1]', () => {
    const brands = loadBrands();
    for (const [, entry] of Object.entries(brands)) {
      for (const [, val] of Object.entries(entry.spaced_lean)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('throws DataValidationError for invalid input', () => {
    const { parseData } = require('../src/game/data');
    const { BrandCatalogSchema: schema } = require('../src/game/CompetitorMarket/schemas/brand');
    expect(() =>
      parseData({ corden: { segment_affinity: { truck: 99 }, market_draw: 0.1 } }, schema, 'test'),
    ).toThrow(DataValidationError);
  });
});

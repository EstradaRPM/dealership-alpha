import {
  computeAnchor,
  createProviders,
  loadMarketAnchorConfig,
  loadMarketConditionModsConfig,
  loadMarketDepreciationCurvesConfig,
  loadMarketMarkupConfig,
  loadMarketSegmentFallbackConfig,
  type AnchorVehicleInput,
  type MarketVehicleInput,
} from '../src/game/MarketEconomy';
import { loadBrandTiersConfig } from '../src/game/SalesProcess';

const deps = {
  anchorConfig: loadMarketAnchorConfig(),
  fallbackConfig: loadMarketSegmentFallbackConfig(),
  curvesConfig: loadMarketDepreciationCurvesConfig(),
  conditionConfig: loadMarketConditionModsConfig(),
  brandTiers: loadBrandTiersConfig(),
  markupConfig: loadMarketMarkupConfig(),
};

const civicAtRef: AnchorVehicleInput = {
  templateId: 'vanda_sedan',
  brand: 'vanda',
  year: deps.curvesConfig.referenceYear,
  mileage: deps.curvesConfig.referenceMileage,
  category: 'sedan',
  condition: 'average',
};

describe('MarketEconomy.computeAnchor (#155)', () => {
  it('is pure: same input → same output', () => {
    expect(computeAnchor(civicAtRef, deps)).toBe(computeAnchor(civicAtRef, deps));
  });

  it('per-template hit returns baseAnchor at reference year + average condition', () => {
    expect(computeAnchor(civicAtRef, deps)).toBe(
      deps.anchorConfig.templates.vanda_sedan.baseAnchor,
    );
  });

  it('falls back to (category × brandTier) when templateId is unknown', () => {
    const unknownTemplate: AnchorVehicleInput = {
      ...civicAtRef,
      templateId: 'no_such_template',
    };
    const expected =
      deps.fallbackConfig.fallbacks.sedan.mainstream.baseAnchor;
    expect(computeAnchor(unknownTemplate, deps)).toBe(expected);
  });

  it('uses "mainstream" tier when brand is unknown', () => {
    const unknownBrand: AnchorVehicleInput = {
      ...civicAtRef,
      templateId: 'no_such_template',
      brand: 'no_such_brand',
    };
    const mainstreamFallback =
      deps.fallbackConfig.fallbacks.sedan.mainstream.baseAnchor;
    expect(computeAnchor(unknownBrand, deps)).toBe(mainstreamFallback);
  });

  it('year curve depreciates monotonically with age then floors', () => {
    const ages = [0, 2, 5, 10, 20, 50];
    const values = ages.map((age) =>
      computeAnchor({ ...civicAtRef, year: deps.curvesConfig.referenceYear - age }, deps),
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
    const shape = deps.curvesConfig.curves.sedan;
    const base = deps.anchorConfig.templates.vanda_sedan.baseAnchor;
    expect(values[values.length - 1]).toBe(base * shape.floor);
  });

  it('clean > average > rough by the condition multipliers', () => {
    const clean = computeAnchor({ ...civicAtRef, condition: 'clean' }, deps);
    const average = computeAnchor({ ...civicAtRef, condition: 'average' }, deps);
    const rough = computeAnchor({ ...civicAtRef, condition: 'rough' }, deps);
    expect(clean).toBeGreaterThan(average);
    expect(average).toBeGreaterThan(rough);
    expect(clean / average).toBeCloseTo(deps.conditionConfig.modifiers.clean, 10);
    expect(rough / average).toBeCloseTo(deps.conditionConfig.modifiers.rough, 10);
  });

  it('throws on a category with no fallback table', () => {
    expect(() =>
      computeAnchor(
        { ...civicAtRef, templateId: 'no_such', category: 'spaceship' },
        deps,
      ),
    ).toThrow(/no anchor/);
  });
});

describe('MarketEconomy.createProviders (#155)', () => {
  const providers = createProviders(deps);
  const civic: MarketVehicleInput = {
    purchasePrice: 11_000,
    reconCost: 800,
    templateId: 'vanda_sedan',
    brand: 'vanda',
    year: deps.curvesConfig.referenceYear,
    mileage: deps.curvesConfig.referenceMileage,
    category: 'sedan',
    condition: 'average',
  };

  it('vehicleCostFn = purchasePrice + reconCost (design-locked unchanged)', () => {
    expect(providers.vehicleCostFn(civic)).toBe(11_800);
  });

  it('bookValueFn equals computeAnchor (segmentHeat=0 placeholder)', () => {
    expect(providers.bookValueFn(civic)).toBe(computeAnchor(civic, deps));
  });

  it('marketPriceFn = round(bookValue × markup) for category × brandTier', () => {
    const markup = deps.markupConfig.markups.sedan.mainstream;
    expect(providers.marketPriceFn(civic)).toBe(
      Math.round(computeAnchor(civic, deps) * markup),
    );
  });

  it('produces a population-midpoint output comparable to the static stub midpoint', () => {
    // The static stub midpoint for a typical mainstream sedan is roughly
    // (purchase + recon) × 1.25 ≈ 14_750 for the fixture above. The live
    // anchor + markup must land in the same neighborhood so #94 calibration —
    // and any future apples-to-apples cross-checks — don't drift wildly when
    // composition swaps the seams.
    const live = providers.marketPriceFn(civic);
    expect(live).toBeGreaterThan(11_000);
    expect(live).toBeLessThan(20_000);
  });
});

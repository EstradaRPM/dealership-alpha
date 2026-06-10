import { vehicleSpaced } from '../src/game/SalesProcess';
import type {
  VehicleSpacedConfig,
  BrandTiersConfig,
} from '../src/game/SalesProcess';

const vehicleSpacedConfig: VehicleSpacedConfig = {
  schemaVersion: 1,
  categoryBase: {
    sedan: {
      safety: 0.5,
      performance: 0.3,
      appearance: 0.4,
      comfort: 0.45,
      economy: 0.8,
      dependability: 0.7,
    },
  },
  templateOverrides: {
    vanda_sedan: { economy: 0.9, dependability: 0.85 },
  },
  yearModifier: {
    referenceYear: 2020,
    perYearDelta: { safety: 0.02, appearance: 0.01, comfort: 0.01 },
    maxAbs: 0.1,
  },
};

const brandTiersConfig: BrandTiersConfig = {
  schemaVersion: 1,
  tiers: {
    luxury: { modifier: { appearance: 0.1, dependability: -0.1 } },
    mainstream: { modifier: {} },
  },
  brands: { vanda: 'mainstream', lancroft: 'luxury' },
};

const deps = { vehicleSpacedConfig, brandTiersConfig };

describe('vehicleSpaced accessor', () => {
  it('layer 1: resolves the category base for a template with no override', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'vanda', year: 2020 },
      deps,
    );
    // No override, mainstream brand (empty modifier), reference year → pure base.
    expect(v).toEqual(vehicleSpacedConfig.categoryBase.sedan);
  });

  it('inherit default: an unknown template falls back to the category base', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'brand_new_template', brand: 'vanda', year: 2020 },
      deps,
    );
    expect(v.economy).toBeCloseTo(0.8);
    expect(v.dependability).toBeCloseTo(0.7);
  });

  it('layer 2: per-template override replaces the named axes only', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'vanda_sedan', brand: 'vanda', year: 2020 },
      deps,
    );
    expect(v.economy).toBeCloseTo(0.9);
    expect(v.dependability).toBeCloseTo(0.85);
    // Untouched axis stays at base.
    expect(v.safety).toBeCloseTo(0.5);
  });

  it('layer 3: brand-tier modifier is added on top of base', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'lancroft', year: 2020 },
      deps,
    );
    expect(v.appearance).toBeCloseTo(0.4 + 0.1);
    expect(v.dependability).toBeCloseTo(0.7 - 0.1);
  });

  it('layer 3: an unknown brand contributes no tier modifier', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'tesla', year: 2020 },
      deps,
    );
    expect(v).toEqual(vehicleSpacedConfig.categoryBase.sedan);
  });

  it('layer 4: year modifier is deterministic and signed by year gap', () => {
    const newer = vehicleSpaced(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'vanda', year: 2023 },
      deps,
    );
    const older = vehicleSpaced(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'vanda', year: 2017 },
      deps,
    );
    expect(newer.safety).toBeCloseTo(0.5 + 0.02 * 3);
    expect(older.safety).toBeCloseTo(0.5 + 0.02 * -3);
    // Pure: same input → same output.
    expect(
      vehicleSpaced(
        { category: 'sedan', templateId: 'generic_sedan', brand: 'vanda', year: 2023 },
        deps,
      ),
    ).toEqual(newer);
  });

  it('layer 4: year modifier is bounded by maxAbs', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'vanda', year: 2100 },
      deps,
    );
    // 0.02 * 80 = 1.6, clamped to +0.1 before the final [0,1] clamp.
    expect(v.safety).toBeCloseTo(0.5 + 0.1);
  });

  it('clamps every axis to [0,1] after all layers', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'vanda', year: 1900 },
      deps,
    );
    expect(v.safety).toBeGreaterThanOrEqual(0);
    expect(v.appearance).toBeGreaterThanOrEqual(0);
  });

  it('all four layers compose for a fully-specified vehicle', () => {
    const v = vehicleSpaced(
      { category: 'sedan', templateId: 'vanda_sedan', brand: 'lancroft', year: 2022 },
      deps,
    );
    // base.appearance 0.4, no template override on appearance, +luxury 0.1,
    // +year 0.01*2 = 0.02 → 0.52
    expect(v.appearance).toBeCloseTo(0.4 + 0.1 + 0.02);
    // economy: template override 0.9, no tier/year delta → 0.9
    expect(v.economy).toBeCloseTo(0.9);
  });

  it('throws on an unknown category', () => {
    expect(() =>
      vehicleSpaced(
        { category: 'spaceship', templateId: 'x', brand: 'vanda', year: 2020 },
        deps,
      ),
    ).toThrow(/no category base/);
  });

  it('works against the bundled config with no injected deps', () => {
    const v = vehicleSpaced({
      category: 'truck',
      templateId: 'corden_truck',
      brand: 'corden',
      year: 2021,
    });
    for (const n of Object.values(v)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});

import {
  SalesProcessConfigSchema,
  VehicleSpacedConfigSchema,
  BrandTiersConfigSchema,
  CustomerNonnegotiablesConfigSchema,
  loadSalesProcessConfig,
  loadVehicleSpacedConfig,
  loadBrandTiersConfig,
  loadCustomerNonnegotiablesConfig,
} from '../src/game/SalesProcess';

describe('SalesProcess data loaders', () => {
  it('loads and validates the bundled sales-process.json', () => {
    const c = loadSalesProcessConfig();
    expect(c.schemaVersion).toBe(1);
    expect(c.gates.length).toBeGreaterThan(0);
    expect(c.calibration.positiveMin).toBeGreaterThan(0);
  });

  it('loads and validates the bundled vehicle-spaced.json', () => {
    const c = loadVehicleSpacedConfig();
    expect(c.categoryBase.sedan.economy).toBeGreaterThan(0);
  });

  it('loads and validates the bundled brand-tiers.json', () => {
    const c = loadBrandTiersConfig();
    expect(Object.keys(c.brands).length).toBeGreaterThan(0);
  });

  it('loads and validates the bundled customer-nonnegotiables.json', () => {
    const c = loadCustomerNonnegotiablesConfig();
    expect(c.axes).toHaveLength(6);
    expect(c.remainingAxisWantProbability).toBeGreaterThanOrEqual(0);
  });
});

describe('SalesProcess schemas reject malformed input', () => {
  it('rejects a SPACED vector value outside [0,1]', () => {
    expect(() =>
      VehicleSpacedConfigSchema.parse({
        schemaVersion: 1,
        categoryBase: {
          sedan: {
            safety: 1.5,
            performance: 0.3,
            appearance: 0.3,
            comfort: 0.3,
            economy: 0.3,
            dependability: 0.3,
          },
        },
        templateOverrides: {},
      }),
    ).toThrow();
  });

  it('rejects an unsupported schemaVersion', () => {
    expect(() =>
      SalesProcessConfigSchema.parse({ schemaVersion: 2 }),
    ).toThrow();
  });

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      SalesProcessConfigSchema.parse({
        schemaVersion: 1,
        gates: ['GREET'],
        rng: { seedNamespace: 'x', jitterBand: 0.1 },
        walk: { trustCollapseFloor: 0.1, patienceFloor: 0 },
        close: { buyThreshold: 0.7, softThreshold: 0.5, trustFloor: 0.4 },
        price: {
          reservationBase: 1.0,
          valueLift: 0.3,
          sensitivityDrag: 0.3,
          minGross: 0,
          overageAllowed: 0,
          framingWeight: 0.15,
        },
        calibration: {
          positiveMin: 0.85,
          apatheticMin: 0.1,
          apatheticMax: 0.12,
          negativeDealMin: 0.03,
          negativeDealMax: 0.05,
        },
        bogus: true,
      }),
    ).toThrow();
  });

  it('rejects a brand-tiers make pointing at an undefined tier', () => {
    expect(() =>
      BrandTiersConfigSchema.parse({
        schemaVersion: 1,
        tiers: { mainstream: { modifier: {} } },
        makes: { Honda: 'platinum' },
      }),
    ).toThrow();
  });

  it('rejects a nonnegotiables axes list that is not length 6', () => {
    expect(() =>
      CustomerNonnegotiablesConfigSchema.parse({
        schemaVersion: 1,
        axes: ['safety'],
        nonnegotiableCountWeights: { '1': 0.6, '2': 0.4 },
        remainingAxisWantProbability: 0.5,
        visitArchetypeBias: {},
      }),
    ).toThrow();
  });
});

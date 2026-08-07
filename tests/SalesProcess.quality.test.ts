import {
  resolutionQuality,
  resolveSalesProcess,
  closeAndPrice,
  makeSalespersonProfile,
  loadSalesProcessConfig,
  type SalesProcessResolution,
  type SalesProcessConfig,
  type SpacedVector,
  SalesProcessConfigSchema,
} from '../src/game/SalesProcess';

/**
 * `resolutionQuality` (#363) is the ONE definition of the three scalars
 * `customer:resolved` carries. It exists because `CustomerPool` held the only
 * copy, ran against a stub vehicle, and therefore threw away the live floor's
 * honest measurement of the same visit.
 */

const NEUTRAL: SpacedVector = {
  safety: 0.5,
  performance: 0.5,
  appearance: 0.5,
  comfort: 0.5,
  economy: 0.5,
  dependability: 0.5,
};

function runResolution(effectiveness: number): SalesProcessResolution {
  return resolveSalesProcess({
    masterSeed: 7,
    customerId: 'c1',
    day: 1,
    skill: makeSalespersonProfile({}, { effectiveness, trustworthiness: effectiveness }),
    customerDifficulty: 0.3,
    archetypeImpatience: 0.25,
    initialPatience: 1,
    customerSpaced: NEUTRAL,
    vehicleSpaced: NEUTRAL,
    visitArchetypeId: 'family_suv_upgrade',
  });
}

describe('resolutionQuality — the customer’s read on the visit (#363)', () => {
  const config: SalesProcessConfig = loadSalesProcessConfig();

  it('receptivity is the trust meter, untouched', () => {
    const resolution = runResolution(0.9);
    const q = resolutionQuality({ resolution });
    expect(q.receptivity).toBe(resolution.meters.trustIntegrity);
  });

  it('a walk is neutral, not negative — it is an absent review, not a bad one', () => {
    const resolution = runResolution(0.9);
    expect(resolutionQuality({ resolution }).satisfaction).toBe(0);
  });

  it('a buy reads positive and a low-trust forced close reads negative', () => {
    const resolution = runResolution(0.9);
    const base = {
      objectiveDeal: 0.8,
      realizedPrice: 20_000,
      frontGross: 2_000,
      closeable: true,
      highFiResistance: false,
      priceFormation: {} as never,
    };
    const happy = { ...base, outcome: 'buy' as const, badReview: false };
    const forced = { ...base, outcome: 'buy' as const, badReview: true };

    expect(resolutionQuality({ resolution, close: happy }).satisfaction).toBe(1);
    expect(resolutionQuality({ resolution, close: forced }).satisfaction).toBe(-1);
  });

  it('the retention seed blends trust with the deal, by the weights in data', () => {
    const resolution = runResolution(0.9);
    const close = closeAndPrice({
      meters: resolution.meters,
      skill: makeSalespersonProfile({}, { effectiveness: 0.9, trustworthiness: 0.9 }),
      priceSensitivity: 0.4,
      vehicle: { purchasePrice: 8_000, reconCost: 500 },
    });
    const { trustWeight, dealWeight } = config.retention;

    expect(resolutionQuality({ resolution, close }).retentionSeed).toBeCloseTo(
      resolution.meters.trustIntegrity * trustWeight +
        close.objectiveDeal * dealWeight,
      10,
    );
    // No offer was ever formed ⇒ trust alone.
    expect(resolutionQuality({ resolution }).retentionSeed).toBeCloseTo(
      resolution.meters.trustIntegrity * trustWeight,
      10,
    );
  });

  it('the schema refuses retention weights that do not sum to 1', () => {
    const bad = {
      ...config,
      retention: { trustWeight: 0.6, dealWeight: 0.6 },
    };
    expect(() => SalesProcessConfigSchema.parse(bad)).toThrow();
  });
});

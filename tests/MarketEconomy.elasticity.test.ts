import {
  demandMultiplier,
  predictDaysToSell,
  loadDemandElasticityConfig,
  loadDaysToSellCurvesConfig,
  createMarketEconomy,
  type ElasticityInput,
  type DaysToSellInput,
  type AnchorVehicleInput,
} from '../src/game/MarketEconomy';

const elasticity = loadDemandElasticityConfig();
const curves = loadDaysToSellCurvesConfig();
const elasticityDeps = { config: elasticity };

function elInput(overrides: Partial<ElasticityInput> = {}): ElasticityInput {
  return {
    benchmarkPrice: 20000,
    askingPrice: 20000,
    segmentHeat: 0,
    ...overrides,
  };
}

describe('demandMultiplier — the shared elasticity model (#276)', () => {
  it('is pure: same input → same output', () => {
    const a = demandMultiplier(elInput({ askingPrice: 21000 }), elasticityDeps);
    const b = demandMultiplier(elInput({ askingPrice: 21000 }), elasticityDeps);
    expect(a).toEqual(b);
  });

  it('at-benchmark, neutral heat → 1.0 baseline demand', () => {
    const out = demandMultiplier(elInput(), elasticityDeps);
    expect(out.pricePosition).toBe(0);
    expect(out.priceMultiplier).toBeCloseTo(1, 10);
    expect(out.heatMultiplier).toBeCloseTo(1, 10);
    expect(out.demandMultiplier).toBeCloseTo(1, 10);
  });

  it('above market bites demand (<1), below market lifts it (>1)', () => {
    const above = demandMultiplier(
      elInput({ askingPrice: 24000 }),
      elasticityDeps,
    ).demandMultiplier;
    const below = demandMultiplier(
      elInput({ askingPrice: 18000 }),
      elasticityDeps,
    ).demandMultiplier;
    expect(above).toBeLessThan(1);
    expect(below).toBeGreaterThan(1);
  });

  it('demand is monotonically decreasing as the ask rises', () => {
    let prev = Infinity;
    for (let pct = 0.7; pct <= 1.5; pct += 0.05) {
      const d = demandMultiplier(
        elInput({ askingPrice: 20000 * pct }),
        elasticityDeps,
      ).demandMultiplier;
      expect(d).toBeLessThanOrEqual(prev);
      prev = d;
    }
  });

  it('hotter segment raises demand at the same ask', () => {
    const cold = demandMultiplier(elInput({ segmentHeat: -0.1 }), elasticityDeps)
      .demandMultiplier;
    const neutral = demandMultiplier(elInput({ segmentHeat: 0 }), elasticityDeps)
      .demandMultiplier;
    const hot = demandMultiplier(elInput({ segmentHeat: 0.1 }), elasticityDeps)
      .demandMultiplier;
    expect(hot).toBeGreaterThan(neutral);
    expect(neutral).toBeGreaterThan(cold);
  });

  it('multipliers stay strictly positive across the sweep (no zero/negative demand)', () => {
    for (let pct = 0.2; pct <= 3; pct += 0.1) {
      const d = demandMultiplier(
        elInput({ askingPrice: 20000 * pct, segmentHeat: -0.3 }),
        elasticityDeps,
      ).demandMultiplier;
      expect(d).toBeGreaterThan(0);
    }
  });

  it('degrades to a neutral price position on a non-positive benchmark', () => {
    const out = demandMultiplier(
      elInput({ benchmarkPrice: 0, askingPrice: 30000, segmentHeat: 0.1 }),
      elasticityDeps,
    );
    expect(out.pricePosition).toBe(0);
    expect(out.priceMultiplier).toBeCloseTo(1, 10);
    // Heat is still honored even when the benchmark is unusable.
    expect(out.heatMultiplier).toBeGreaterThan(1);
  });
});

describe('predictDaysToSell derives entirely from the shared model (#276)', () => {
  function dtsInput(overrides: Partial<DaysToSellInput> = {}): DaysToSellInput {
    return {
      marketPrice: 20000,
      askingPrice: 20000,
      segment: 'sedan',
      segmentHeat: 0,
      daysOnLot: 0,
      compObservations: 0,
      ...overrides,
    };
  }

  // The prediction must equal baseline / demandMultiplier × agingMult so the
  // pricing screen number can never drift from the one demand model FloorSim
  // will draw arrivals from.
  it('expectedDays == round(baseline / demandMultiplier) (no aging)', () => {
    const baseline = curves.segmentBaselines.sedan;
    for (const pct of [0.8, 0.95, 1.0, 1.1, 1.3]) {
      for (const heat of [-0.1, 0, 0.15]) {
        const ask = 20000 * pct;
        const { demandMultiplier: dm } = demandMultiplier(
          { benchmarkPrice: 20000, askingPrice: ask, segmentHeat: heat },
          elasticityDeps,
        );
        const expected = Math.max(
          curves.bounds.minDays,
          Math.min(curves.bounds.maxDays, Math.round(baseline / dm)),
        );
        const out = predictDaysToSell(
          dtsInput({ askingPrice: ask, segmentHeat: heat }),
          { config: curves, elasticity },
        );
        expect(out.expectedDays).toBe(expected);
      }
    }
  });

  it('responds to ask-vs-benchmark in the same direction as the shared model', () => {
    const cheaper = predictDaysToSell(dtsInput({ askingPrice: 18000 }), {
      config: curves,
      elasticity,
    }).expectedDays;
    const atMarket = predictDaysToSell(dtsInput({ askingPrice: 20000 }), {
      config: curves,
      elasticity,
    }).expectedDays;
    const dearer = predictDaysToSell(dtsInput({ askingPrice: 24000 }), {
      config: curves,
      elasticity,
    }).expectedDays;
    expect(cheaper).toBeLessThan(atMarket);
    expect(atMarket).toBeLessThan(dearer);
  });
});

describe('MarketEconomy wiring reads the shared model (#276)', () => {
  const market = createMarketEconomy();
  const civic: AnchorVehicleInput & { daysOnLot?: number } = {
    templateId: 'vanda_sedan',
    brand: 'vanda',
    year: 2020,
    mileage: 40000,
    category: 'sedan',
    condition: 'average',
  };

  it('the wired prediction matches the pure engine fed the same shared config', () => {
    const { marketPrice } = market.valuationFor(civic);
    const ask = Math.round(marketPrice * 1.1);
    const wired = market.predictDaysToSell(civic, ask).expectedDays;
    const pure = predictDaysToSell(
      {
        marketPrice,
        askingPrice: ask,
        segment: 'sedan',
        segmentHeat: 0,
        daysOnLot: 0,
        compObservations: 0,
      },
      { config: curves, elasticity },
    ).expectedDays;
    expect(wired).toBe(pure);
  });
});

describe('demandMultiplierFor — the FloorSim arrival seam reads the one model (#279 S7)', () => {
  const market = createMarketEconomy();
  const civic: AnchorVehicleInput = {
    templateId: 'vanda_sedan',
    brand: 'vanda',
    year: 2020,
    mileage: 40000,
    category: 'sedan',
    condition: 'average',
  };
  const benchmark = market.valuationFor(civic).marketPrice;

  it('at-market ⇒ ≈1, above ⇒ <1 (less traffic), below ⇒ >1 (more)', () => {
    expect(market.demandMultiplierFor(civic, benchmark)).toBeCloseTo(1, 6);
    expect(
      market.demandMultiplierFor(civic, Math.round(benchmark * 1.15)),
    ).toBeLessThan(1);
    expect(
      market.demandMultiplierFor(civic, Math.round(benchmark * 0.9)),
    ).toBeGreaterThan(1);
  });

  it('arrivals respond to the SAME curve days-to-sell predicts from', () => {
    // A richer demand multiplier must mean a faster predicted sale, and vice
    // versa — the one-model promise (Pillar 3): screen and floor never diverge.
    const cheapAsk = Math.round(benchmark * 0.9);
    const dearAsk = Math.round(benchmark * 1.15);
    const cheapDemand = market.demandMultiplierFor(civic, cheapAsk);
    const dearDemand = market.demandMultiplierFor(civic, dearAsk);
    expect(cheapDemand).toBeGreaterThan(dearDemand);
    expect(market.predictDaysToSell(civic, cheapAsk).expectedDays).toBeLessThan(
      market.predictDaysToSell(civic, dearAsk).expectedDays,
    );
  });

  it('elasticity is conditioned by heat: hotter segment tolerates the ask better', () => {
    // Same ask, two heats injected via the pure model with the seam's resolved
    // benchmark — a hot segment yields more demand than a cold one (Pillar 4).
    const ask = Math.round(benchmark * 1.1);
    const hot = demandMultiplier(
      { benchmarkPrice: benchmark, askingPrice: ask, segmentHeat: 0.2 },
      elasticityDeps,
    ).demandMultiplier;
    const cold = demandMultiplier(
      { benchmarkPrice: benchmark, askingPrice: ask, segmentHeat: -0.2 },
      elasticityDeps,
    ).demandMultiplier;
    expect(hot).toBeGreaterThan(cold);
  });
});

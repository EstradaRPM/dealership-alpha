import {
  predictDaysToSell,
  loadDaysToSellCurvesConfig,
  createMarketEconomy,
  type DaysToSellInput,
  type AnchorVehicleInput,
} from '../src/game/MarketEconomy';

const config = loadDaysToSellCurvesConfig();
const deps = { config };

const sedanBaseline = config.segmentBaselines.sedan;

function base(overrides: Partial<DaysToSellInput> = {}): DaysToSellInput {
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

describe('predictDaysToSell — pure engine (#174)', () => {
  it('is pure: same input → same output', () => {
    const a = predictDaysToSell(base({ askingPrice: 21000 }), deps);
    const b = predictDaysToSell(base({ askingPrice: 21000 }), deps);
    expect(a).toEqual(b);
  });

  it('at-market → baseline days for the segment', () => {
    expect(predictDaysToSell(base(), deps).expectedDays).toBe(
      Math.round(sedanBaseline),
    );
  });

  it('falls back to defaultBaselineDays for an unknown segment', () => {
    const out = predictDaysToSell(base({ segment: 'spaceship' }), deps);
    expect(out.expectedDays).toBe(Math.round(config.defaultBaselineDays));
  });

  describe('price-position sweep', () => {
    it('+20% above market → 3–5× baseline', () => {
      const out = predictDaysToSell(
        base({ askingPrice: 20000 * 1.2 }),
        deps,
      );
      const ratio = out.expectedDays / sedanBaseline;
      expect(ratio).toBeGreaterThanOrEqual(3);
      expect(ratio).toBeLessThanOrEqual(5);
    });

    it('−10% below market → ~0.5× baseline', () => {
      const out = predictDaysToSell(
        base({ askingPrice: 20000 * 0.9 }),
        deps,
      );
      const ratio = out.expectedDays / sedanBaseline;
      expect(ratio).toBeGreaterThan(0.4);
      expect(ratio).toBeLessThan(0.6);
    });

    it('is monotonic: higher ask never sells faster', () => {
      let prev = -Infinity;
      for (let pct = 0.7; pct <= 1.5; pct += 0.05) {
        const days = predictDaysToSell(
          base({ askingPrice: 20000 * pct }),
          deps,
        ).expectedDays;
        expect(days).toBeGreaterThanOrEqual(prev);
        prev = days;
      }
    });

    it('clamps to configured bounds at extreme positions', () => {
      const wildHigh = predictDaysToSell(
        base({ askingPrice: 20000 * 3 }),
        deps,
      );
      const fireSale = predictDaysToSell(
        base({ askingPrice: 20000 * 0.2 }),
        deps,
      );
      expect(wildHigh.expectedDays).toBeLessThanOrEqual(config.bounds.maxDays);
      expect(fireSale.expectedDays).toBeGreaterThanOrEqual(config.bounds.minDays);
    });
  });

  describe('segment-heat sweep', () => {
    it('hotter segment sells faster (fewer days) at the same ask', () => {
      const cold = predictDaysToSell(base({ segmentHeat: -0.1 }), deps).expectedDays;
      const neutral = predictDaysToSell(base({ segmentHeat: 0 }), deps).expectedDays;
      const hot = predictDaysToSell(base({ segmentHeat: 0.1 }), deps).expectedDays;
      expect(hot).toBeLessThan(neutral);
      expect(neutral).toBeLessThan(cold);
    });
  });

  describe('days-on-lot', () => {
    it('aged inventory takes nonlinearly longer', () => {
      const fresh = predictDaysToSell(base({ daysOnLot: 0 }), deps).expectedDays;
      const aged = predictDaysToSell(base({ daysOnLot: 30 }), deps).expectedDays;
      const stale = predictDaysToSell(base({ daysOnLot: 60 }), deps).expectedDays;
      expect(aged).toBeGreaterThan(fresh);
      // Nonlinear: the jump from 30→60 exceeds the jump from 0→30.
      expect(stale - aged).toBeGreaterThan(aged - fresh);
    });
  });

  describe('confidence', () => {
    it('is highest at-market and falls as the ask extrapolates above market', () => {
      const atMarket = predictDaysToSell(base(), deps).confidence;
      const above = predictDaysToSell(base({ askingPrice: 20000 * 1.3 }), deps)
        .confidence;
      const wildAbove = predictDaysToSell(base({ askingPrice: 20000 * 1.8 }), deps)
        .confidence;
      expect(above).toBeLessThan(atMarket);
      expect(wildAbove).toBeLessThan(above);
    });

    it('above-market loses confidence faster than the symmetric below-market move', () => {
      const above = predictDaysToSell(base({ askingPrice: 20000 * 1.2 }), deps)
        .confidence;
      const below = predictDaysToSell(base({ askingPrice: 20000 * 0.8 }), deps)
        .confidence;
      expect(above).toBeLessThan(below);
    });

    it('rises with the number of live comps backing the estimate', () => {
      const noComps = predictDaysToSell(base({ compObservations: 0 }), deps)
        .confidence;
      const someComps = predictDaysToSell(base({ compObservations: 6 }), deps)
        .confidence;
      const manyComps = predictDaysToSell(base({ compObservations: 50 }), deps)
        .confidence;
      expect(someComps).toBeGreaterThan(noComps);
      expect(manyComps).toBeGreaterThan(someComps);
      expect(manyComps).toBeLessThanOrEqual(1);
    });

    it('stays within [0, 1] across the sweep', () => {
      for (let pct = 0.2; pct <= 3; pct += 0.1) {
        const c = predictDaysToSell(base({ askingPrice: 20000 * pct }), deps)
          .confidence;
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    });
  });

  it('degrades gracefully on a non-positive market price', () => {
    const out = predictDaysToSell(base({ marketPrice: 0 }), deps);
    expect(out.expectedDays).toBe(Math.round(sedanBaseline));
    expect(out.confidence).toBe(0);
  });
});

describe('MarketEconomy.predictDaysToSell — wired (#174)', () => {
  // Pure-engine MarketEconomy (no bus/seed) → neutral heat, empty comp window.
  const market = createMarketEconomy();

  const civic: AnchorVehicleInput & { daysOnLot?: number } = {
    templateId: 'honda_civic',
    make: 'Honda',
    year: 2020,
    mileage: 40000,
    category: 'sedan',
    condition: 'average',
  };

  it('resolves market price internally: at the quoted market price → baseline', () => {
    const { marketPrice } = market.valuationFor(civic);
    const out = market.predictDaysToSell(civic, marketPrice);
    expect(out.expectedDays).toBe(Math.round(sedanBaseline));
  });

  it('listing above the resolved market price slows the sale', () => {
    const { marketPrice } = market.valuationFor(civic);
    const atMarket = market.predictDaysToSell(civic, marketPrice).expectedDays;
    const above = market.predictDaysToSell(
      civic,
      Math.round(marketPrice * 1.15),
    ).expectedDays;
    expect(above).toBeGreaterThan(atMarket);
  });

  it('threads daysOnLot through from the vehicle', () => {
    const { marketPrice } = market.valuationFor(civic);
    const fresh = market.predictDaysToSell(
      { ...civic, daysOnLot: 0 },
      marketPrice,
    ).expectedDays;
    const aged = market.predictDaysToSell(
      { ...civic, daysOnLot: 45 },
      marketPrice,
    ).expectedDays;
    expect(aged).toBeGreaterThan(fresh);
  });

  it('is deterministic across calls', () => {
    const { marketPrice } = market.valuationFor(civic);
    expect(market.predictDaysToSell(civic, marketPrice)).toEqual(
      market.predictDaysToSell(civic, marketPrice),
    );
  });
});

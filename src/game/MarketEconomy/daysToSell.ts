import {
  loadDaysToSellCurvesConfig,
  type DaysToSellCurvesConfig,
  type DemandElasticityConfig,
} from './schemas';
import { demandMultiplier } from './elasticity';

/**
 * Slice #174 — days-to-sell prediction engine.
 *
 * A pure, deterministic estimate of how long a vehicle takes to sell at a given
 * ask, given its market position and current segment heat. No RNG: same input →
 * same output. The MarketEconomy factory exposes the convenience method
 * `predictDaysToSell(vehicle, askingPrice)` that resolves marketPrice + heat +
 * comp count from live state and delegates here; this module is the testable
 * core and never touches the anchor/provider machinery itself.
 *
 * Slice #276 (Pricing/Demand spine S4): the price/heat response is no longer
 * computed locally — it reads the ONE shared `demandMultiplier` elasticity
 * model (`elasticity.ts`), the same model FloorSim arrivals will draw from
 * (S5/S7). `expectedDays = baseline / demandMultiplier × agingMult`, so the
 * pricing screen's prediction and the floor's actual traffic can never diverge.
 */
export interface DaysToSellInput {
  /** Honest retail market price for the vehicle (heat-inclusive). */
  readonly marketPrice: number;
  /** The price the dealer is listing at. */
  readonly askingPrice: number;
  /** Vehicle segment/category — selects the baseline curve. */
  readonly segment: string;
  /**
   * Current fractional segment heat (e.g. +0.05 = +5%). Hot segment → faster.
   * This is a *demand* effect independent of price position: a hot segment
   * sells faster even at-market.
   */
  readonly segmentHeat: number;
  /** Days the vehicle has already sat on the lot. Aged → nonlinearly slower. Default 0. */
  readonly daysOnLot?: number;
  /**
   * Count of live comps backing the market estimate. More observed comps →
   * higher confidence. Default 0 (cold start — relies on the closed-form anchor).
   */
  readonly compObservations?: number;
}

export interface DaysToSellPrediction {
  /** Expected days-to-sell, integer, clamped to the configured bounds. */
  readonly expectedDays: number;
  /** Confidence in the estimate, in [0, 1]. Low when extrapolating wildly above market. */
  readonly confidence: number;
}

export interface DaysToSellDeps {
  readonly config?: DaysToSellCurvesConfig;
  /** The shared price-elasticity model config (slice #276). */
  readonly elasticity?: DemandElasticityConfig;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Pure days-to-sell estimate, derived from the shared elasticity model.
 *
 * ```
 * demandMult   = demandMultiplier(ask vs market, heat)   -- the ONE shared model (#276)
 * agingMult    = 1 + weight × (daysOnLot / referenceDays)^exponent
 * expectedDays = clamp(round(baseline / demandMult × agingMult), min, max)
 * ```
 *
 * `baseline / demandMult`: more demand (hot segment or below-market ask) → sells
 * in fewer days; less demand (above-market ask) → more days. This is the same
 * `demandMultiplier` FloorSim will scale arrivals by (S5/S7), so the screen's
 * promise and the floor's traffic stay one model. Calibrated (see
 * data/demand-elasticity.json) so at-market → baseline, +20% → ~4×, −10% → 0.5×.
 */
export function predictDaysToSell(
  input: DaysToSellInput,
  deps: DaysToSellDeps = {},
): DaysToSellPrediction {
  const config = deps.config ?? loadDaysToSellCurvesConfig();
  const baseline =
    config.segmentBaselines[input.segment] ?? config.defaultBaselineDays;

  // A non-positive market price is a data/config fault upstream; fall back to
  // the baseline at minimum confidence rather than dividing by zero.
  if (input.marketPrice <= 0) {
    return {
      expectedDays: clamp(
        Math.round(baseline),
        config.bounds.minDays,
        config.bounds.maxDays,
      ),
      confidence: 0,
    };
  }

  const { pricePosition, demandMultiplier: demandMult } = demandMultiplier(
    {
      benchmarkPrice: input.marketPrice,
      askingPrice: input.askingPrice,
      segmentHeat: input.segmentHeat,
    },
    { config: deps.elasticity },
  );

  const daysOnLot = Math.max(0, input.daysOnLot ?? 0);
  const agingMult =
    1 +
    config.aging.weight *
      Math.pow(daysOnLot / config.aging.referenceDays, config.aging.exponent);

  const expectedDays = clamp(
    Math.round((baseline / demandMult) * agingMult),
    config.bounds.minDays,
    config.bounds.maxDays,
  );

  // Confidence: falls as the ask extrapolates away from the honest market
  // (above-market weighted heavier — overpricing into thin air is the riskiest
  // call), and rises with the number of live comps backing the estimate.
  const c = config.confidence;
  const extrapolation =
    pricePosition >= 0
      ? pricePosition * c.aboveWeight
      : -pricePosition * c.belowWeight;
  const confFromPrice = Math.exp(-c.priceSensitivity * extrapolation);
  const comps = Math.max(0, input.compObservations ?? 0);
  const compFactor =
    c.compFloor +
    (1 - c.compFloor) * (comps / (comps + c.compHalfSaturation));
  const confidence = clamp(confFromPrice * compFactor, 0, 1);

  return { expectedDays, confidence };
}

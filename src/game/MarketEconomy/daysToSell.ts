import {
  loadDaysToSellCurvesConfig,
  type DaysToSellCurvesConfig,
} from './schemas';

/**
 * Slice #174 — days-to-sell prediction engine.
 *
 * A pure, deterministic estimate of how long a vehicle takes to sell at a given
 * ask, given its market position and current segment heat. No RNG: same input →
 * same output. The MarketEconomy factory exposes the convenience method
 * `predictDaysToSell(vehicle, askingPrice)` that resolves marketPrice + heat +
 * comp count from live state and delegates here; this module is the testable
 * core and never touches the anchor/provider machinery itself.
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
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Pure days-to-sell estimate.
 *
 * ```
 * pricePosition = (asking - market) / market
 * priceMult     = exp(sensitivity[above|below] × pricePosition)   -- >market slower, <market faster
 * heatMult      = exp(-heatSensitivity × segmentHeat)             -- hot segment faster
 * agingMult     = 1 + weight × (daysOnLot / referenceDays)^exponent
 * expectedDays  = clamp(round(baseline × priceMult × heatMult × agingMult), min, max)
 * ```
 *
 * Calibrated (see data/days-to-sell-curves.json) so at-market → baseline,
 * +20% → ~4×, −10% → 0.5×.
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

  const pricePosition = (input.askingPrice - input.marketPrice) / input.marketPrice;
  const priceSensitivity =
    pricePosition >= 0
      ? config.priceSensitivity.above
      : config.priceSensitivity.below;
  const priceMult = Math.exp(priceSensitivity * pricePosition);

  const heatMult = Math.exp(-config.heatSensitivity * input.segmentHeat);

  const daysOnLot = Math.max(0, input.daysOnLot ?? 0);
  const agingMult =
    1 +
    config.aging.weight *
      Math.pow(daysOnLot / config.aging.referenceDays, config.aging.exponent);

  const expectedDays = clamp(
    Math.round(baseline * priceMult * heatMult * agingMult),
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

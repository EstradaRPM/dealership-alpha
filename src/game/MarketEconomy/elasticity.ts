import {
  loadDemandElasticityConfig,
  type DemandElasticityConfig,
} from './schemas';

/**
 * Slice #276 (Pricing/Demand spine S4) — the ONE price-elasticity demand model.
 *
 * Given a vehicle's ask measured against its competitor benchmark (the honest,
 * heat-inclusive market price per Pillar 2) plus the current segment heat, this
 * returns a *relative demand multiplier*: how much faster/slower demand flows
 * versus the at-benchmark, neutral-heat baseline (1.0).
 *
 * This is the single shared read-side model the design spine demands
 * (`docs/planning/pricing-demand-spine.md` Pillar 3). It has two consumers:
 *   - `predictDaysToSell` (this slice) — the pricing screen's honest prediction
 *     reads `baseline / demandMultiplier`, so a higher ask predicts a slower
 *     sale through THIS model, not a disconnected display formula.
 *   - FloorSim arrival draw (slices S5/S7, not yet wired) — will scale traffic
 *     by the same multiplier so the predicted number becomes a real promise.
 *
 * Pure and deterministic: same input → same output, no RNG, no live state.
 */
export interface ElasticityInput {
  /**
   * The competitor benchmark / honest retail market price for the vehicle
   * (heat-inclusive). Above-vs-below this number is what the curve bites on.
   * Demoted from "what customers pay" to a benchmark per Pillar 2.
   */
  readonly benchmarkPrice: number;
  /** The price the dealer is listing at. */
  readonly askingPrice: number;
  /**
   * Current fractional segment heat (e.g. +0.05 = +5%). Hot segment → more
   * demand, independent of price position: a hot segment moves faster even
   * at-benchmark.
   */
  readonly segmentHeat: number;
}

export interface ElasticityResult {
  /** `(askingPrice - benchmarkPrice) / benchmarkPrice`. >0 above market. */
  readonly pricePosition: number;
  /**
   * Demand response to price position alone. `1` at-benchmark, `<1` above
   * market (the bite), `>1` below market (the lift). Strictly positive,
   * monotonically decreasing in `pricePosition`.
   */
  readonly priceMultiplier: number;
  /** Demand response to segment heat alone. `1` at neutral heat, `>1` hot. */
  readonly heatMultiplier: number;
  /**
   * Combined relative demand multiplier (`priceMultiplier × heatMultiplier`).
   * `1` = the at-benchmark, neutral-heat baseline. The single number both the
   * days-to-sell prediction and (later) FloorSim arrivals scale against.
   */
  readonly demandMultiplier: number;
}

export interface ElasticityDeps {
  readonly config?: DemandElasticityConfig;
}

/**
 * The price-elasticity curve.
 *
 * ```
 * pricePosition   = (asking - benchmark) / benchmark
 * priceMultiplier = exp(-sensitivity[above|below] × pricePosition)
 * heatMultiplier  = exp( heatSensitivity × segmentHeat)
 * demandMultiplier = priceMultiplier × heatMultiplier
 * ```
 *
 * Exponential so the multipliers stay strictly positive and monotonic, and so
 * `above`/`below` sensitivities can be tuned asymmetrically (the curve bites
 * hard above market, eases below — Pillar 4). Calibrated (see
 * `data/demand-elasticity.json`) so at-benchmark → 1.0, +20% → ~0.25×
 * (sells in ~4× the time), −10% → ~2× (sells in ~0.5× the time).
 *
 * A non-positive benchmark is a data/config fault upstream; rather than divide
 * by zero, the model degrades to the neutral-price baseline (price position 0)
 * while still honoring heat.
 */
export function demandMultiplier(
  input: ElasticityInput,
  deps: ElasticityDeps = {},
): ElasticityResult {
  const config = deps.config ?? loadDemandElasticityConfig();

  const pricePosition =
    input.benchmarkPrice > 0
      ? (input.askingPrice - input.benchmarkPrice) / input.benchmarkPrice
      : 0;

  const sensitivity =
    pricePosition >= 0
      ? config.priceSensitivity.above
      : config.priceSensitivity.below;
  const priceMultiplier = Math.exp(-sensitivity * pricePosition);

  const heatMultiplier = Math.exp(config.heatSensitivity * input.segmentHeat);

  return {
    pricePosition,
    priceMultiplier,
    heatMultiplier,
    demandMultiplier: priceMultiplier * heatMultiplier,
  };
}

import {
  loadPricingStrategiesConfig,
  type PricingStrategiesConfig,
} from './schemas';

/**
 * Pricing-suggestion engine (#154, folded into #175).
 *
 * Pure, deterministic helpers behind the real-time pricing screen: the
 * staff-suggested list price for a given strategy, the market-position
 * classification of any ask, and the competitor comparables panel. No RNG, no
 * I/O — same inputs → same outputs. The MarketEconomy factory supplies the live
 * book/market numbers (`valuationFor`); this module turns those plus the
 * player's strategy posture into the numbers the screen renders.
 */

export type PricingStrategyId = string;

/** Where an ask sits relative to honest market, coarsened for the indicator. */
export type PricePosition =
  | 'fire-sale'
  | 'below-market'
  | 'at-market'
  | 'above-market'
  | 'wishful';

export interface SuggestListPriceInput {
  /** Honest book value (heat-inclusive) from the live providers. */
  readonly bookValue: number;
  /** Honest retail market price from the live providers. */
  readonly marketPrice: number;
  /** The dealership's chosen list-price posture. */
  readonly strategy: PricingStrategyId;
}

export interface SuggestListPriceResult {
  /** The recommended list price — the market target, floored at book + gross. */
  readonly suggestedPrice: number;
  /** Floor: `book × (1 + targetMarkupPct)` — the gross the dealer won't undercut. */
  readonly floor: number;
  /** Market target: `market × marketAggression` — the strategy's posture vs. market. */
  readonly marketTarget: number;
  /** True when the gross floor bound the suggestion (market target was below it). */
  readonly floored: boolean;
}

export interface PricingSuggestionDeps {
  readonly config?: PricingStrategiesConfig;
}

function resolveConfig(deps?: PricingSuggestionDeps): PricingStrategiesConfig {
  return deps?.config ?? loadPricingStrategiesConfig();
}

/**
 * The staff-suggested list price for a strategy. The strategy's market posture
 * (`market × marketAggression`) sets the target; the gross floor
 * (`book × (1 + targetMarkupPct)`) is the minimum the dealer will list at, so
 * even a Value posture never lists below cost-plus-target on a thin-margin unit.
 *
 * Falls back to the configured default strategy if an unknown id is passed
 * (defensive — a stale persisted id is not a crash).
 */
export function suggestListPrice(
  input: SuggestListPriceInput,
  deps?: PricingSuggestionDeps,
): SuggestListPriceResult {
  const config = resolveConfig(deps);
  const entry =
    config.strategies[input.strategy] ??
    config.strategies[config.defaultStrategy];
  const floor = Math.round(input.bookValue * (1 + entry.targetMarkupPct));
  const marketTarget = Math.round(input.marketPrice * entry.marketAggression);
  const floored = floor > marketTarget;
  return {
    suggestedPrice: Math.max(floor, marketTarget),
    floor,
    marketTarget,
    floored,
  };
}

/**
 * Classify an ask against honest market using the configured ratio bands.
 * `marketPrice <= 0` is treated as `wishful` (no honest reference to beat).
 */
export function classifyPricePosition(
  askingPrice: number,
  marketPrice: number,
  deps?: PricingSuggestionDeps,
): PricePosition {
  if (marketPrice <= 0) return 'wishful';
  const bands = resolveConfig(deps).positionBands;
  const ratio = askingPrice / marketPrice;
  if (ratio < bands.fireSale) return 'fire-sale';
  if (ratio < bands.belowMarket) return 'below-market';
  if (ratio <= bands.atMarket) return 'at-market';
  if (ratio <= bands.aboveMarket) return 'above-market';
  return 'wishful';
}

/**
 * Narrow structural shape of a competitor for the comparables panel — satisfied
 * by `CompetitorMarket`'s `Competitor` without an import, keeping MarketEconomy
 * decoupled (same pattern as `AnchorVehicleInput`).
 */
export interface ComparableCompetitorInput {
  readonly id: string;
  readonly name: string;
  readonly price_point: string;
  /** Relative price lean in [0,1]; 0.5 = at-market. */
  readonly pricing: number;
}

export interface CompetitorComp {
  readonly id: string;
  readonly name: string;
  readonly pricePoint: string;
  /** This competitor's comparable asking price for the unit. */
  readonly price: number;
}

/**
 * Derive each competitor's comparable asking price for a unit at the given
 * honest market price. A competitor's `pricing` lean maps linearly onto a
 * `±competitorSpread` band: 0.5 → market, 1.0 → market × (1 + spread),
 * 0.0 → market × (1 − spread). Static in v1 — comps don't move with the
 * player's own ask, so the screen computes them once.
 */
export function deriveCompetitorComps(
  marketPrice: number,
  competitors: readonly ComparableCompetitorInput[],
  deps?: PricingSuggestionDeps,
): CompetitorComp[] {
  const spread = resolveConfig(deps).competitorSpread;
  return competitors.map((c) => ({
    id: c.id,
    name: c.name,
    pricePoint: c.price_point,
    price: Math.round(marketPrice * (1 + (c.pricing - 0.5) * 2 * spread)),
  }));
}

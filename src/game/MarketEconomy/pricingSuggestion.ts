import {
  loadPricingStrategiesConfig,
  type PricingStrategiesConfig,
} from './schemas';
import { signedSkillDrift, type SkillDriftConfig } from '../NPC';

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
 * Execution-fidelity drift inputs for the auto-priced intake ask (channel-desk
 * M5, #292). When the standing policy is unlocked the UCM *aims* at the
 * strategy's suggested target; skill governs the gap. A green-but-gated UCM
 * mis-prices off the target (two-sided scatter — too high sits, too low leaves
 * money); a sharp UCM nails it. Omit (legacy/tests) ⇒ the ask sits exactly at
 * the suggested target (no drift). Deterministic in `(ucmPricingSkill, seed)`.
 */
export interface IntakeAskDrift {
  /** Top UCM `pricing` skill (0–100) — drives the drift span. */
  readonly ucmPricingSkill: number;
  /** Per-(vehicle, day) seed the composition root derives — replay-safe (#122). */
  readonly seed: number;
  /** `managerGates.executionDrift.pricing`. */
  readonly config: SkillDriftConfig;
}

export interface IntakeAskInput extends SuggestListPriceInput {
  /**
   * True once the standing auto-pricing policy is unlocked (Pricing/Demand
   * spine S13, #285 — a Used-Car Manager on staff). When unlocked, intake
   * stamps the strategy's book↔market target; when locked, the strategy is
   * suggestion-only and intake sits at the honest market suggestion.
   */
  readonly automationUnlocked: boolean;
  /**
   * Execution-fidelity drift on the auto-priced target (M5, #292). Applied only
   * on the unlocked path; omit ⇒ the ask sits exactly at the suggested target.
   */
  readonly drift?: IntakeAskDrift;
}

/**
 * The default `askingPrice` an incoming unit is stamped with at intake
 * (Pricing/Demand spine S13, #285). The strategy toggle graduates from a
 * suggestion into a *standing policy* once automation is unlocked: a UCM on
 * staff lets the desk auto-price the book to the chosen posture. Below that
 * gate the toggle is suggestion-only, so the default ask sits at the honest
 * market suggestion (the pre-S13 behavior) and the player prices by hand.
 *
 * Execution-fidelity drift (M5, #292): when unlocked and `drift` is supplied the
 * realized ask scatters off the suggested target by a skill-scaled, seeded
 * fraction (`signedSkillDrift`), clamped at the gross floor — a green UCM
 * mis-prices, a sharp one nails the target. Omit `drift` ⇒ exactly the target.
 *
 * Pure, deterministic — the composition root resolves `bookValue`/`marketPrice`
 * from the live providers and the unlock gate from the roster, then this turns
 * those into the one number Inventory stamps.
 */
export function resolveIntakeAsk(
  input: IntakeAskInput,
  deps?: PricingSuggestionDeps,
): number {
  if (!input.automationUnlocked) return Math.round(input.marketPrice);
  const suggestion = suggestListPrice(input, deps);
  if (!input.drift) return suggestion.suggestedPrice;
  // M5 (#292): the UCM aims at the suggested target; skill governs the gap. The
  // realized ask scatters off it (two-sided mis-price), but never below the
  // gross floor — a sloppy desk still won't list under cost-plus-target.
  const { ucmPricingSkill, seed, config } = input.drift;
  const drifted =
    suggestion.suggestedPrice *
    (1 + signedSkillDrift(ucmPricingSkill, seed, config));
  return Math.max(suggestion.floor, Math.round(drifted));
}

/**
 * Whether the standing auto-pricing policy is unlocked (channel-desk M2, #289 —
 * reframes #285's presence gate onto the UCM's `pricing` skill threshold). The
 * *acting* capability is earned: a Used-Car Manager whose top `pricing` skill
 * meets the data-driven threshold runs the standing policy; below it (or with no
 * UCM, `ucmPricingSkill == null`) the toggle is suggestion-only and the player
 * prices by hand. Intel precision (#284, the *advise* side) stays free on UCM
 * presence — only this act gate scales with skill. Pure; the composition root
 * supplies the top UCM pricing skill (from the roster) and the threshold (from
 * `tunables.managerGates.actThresholds.pricing`). The cliff at the threshold is
 * the earned-stripes beat, by design (see manager-roles-channel-desk.md §3).
 */
export function isAutoPricingUnlocked(
  ucmPricingSkill: number | null,
  threshold: number,
): boolean {
  return ucmPricingSkill != null && ucmPricingSkill >= threshold;
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
 * 0.0 → market × (1 − spread). Static for now — comps don't move with the
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

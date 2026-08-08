import { createRng } from '../Rng';
import { loadTunables } from '../data';

/**
 * Contractual deal-kill (#367) — the teeth on the F&I posture (grill Q3, I8).
 *
 * Without them "More per deal" is strictly better than the other two positions
 * and the dial is not a decision. A contract written past the safe markup
 * frontier doesn't get bought: the lender passes on the paper, or the customer
 * rate-shops it and leaves. Aggressive markup therefore means fewer financed
 * deals actually stick — the same volume x margin shape the pricing lean has.
 *
 * There is exactly ONE curve and no per-lender branching. It is deliberately
 * separate from the *structural* kill, which needed no machinery at all: the
 * payment is built at the marked-up rate (#365), so an over-marked deal already
 * fails the `ptiCap` / `maxTerm` / `ltvCeiling` gate that has always been there
 * (grill I3). This module is the other half — the deal the customer *could*
 * afford that the lender still won't buy.
 */
export interface FniDealKillConfig {
  /** Markup at or under which nothing falls through, in points of APR. */
  readonly safeFrontierPts: number;
  /** How far past the frontier markup must go to reach the full rate. */
  readonly fullKillRangePts: number;
  /** Fall-through rate at (and past) the end of that range. */
  readonly maxFallThroughRate: number;
}

/** Reads the deal-kill curve from the `fniDealKill` section of tunables. */
export function loadFniDealKillConfig(): FniDealKillConfig {
  return loadTunables().fniDealKill;
}

/**
 * Probability that a contract written at `markupPts` never gets bought.
 *
 * Linear from zero at the frontier to `maxFallThroughRate` a full kill-range
 * past it, then flat. Pure — the *roll* is seeded by the caller, this is the
 * number it rolls against, which is also what lets #370's peak meter read the
 * curve without re-deriving it.
 *
 * At or under the frontier the answer is exactly zero, and that is load-bearing
 * rather than incidental: the Balanced posture sits on the frontier and the
 * unstaffed ambient markup sits under it, so the store the whole calibration
 * corpus measures never loses a deal to this. It is the reach past Balanced
 * that costs something. It also means a subprime buyer cannot be over-marked at
 * all — their lender caps markup below the frontier — so the most desperate
 * customer is not the one you can gouge.
 *
 * The frontier is flat today; #369 lets `finance_structuring` extend it, which
 * is how a better F&I manager makes the aggressive posture safer (grill Q5).
 */
export function fallThroughProbability(
  markupPts: number,
  config: FniDealKillConfig = loadFniDealKillConfig(),
): number {
  const over = markupPts - config.safeFrontierPts;
  if (over <= 0) return 0;
  const ramp = Math.min(1, over / config.fullKillRangePts);
  return config.maxFallThroughRate * ramp;
}

/**
 * Whether this financed deal falls through. Deterministic: the caller derives
 * the seed per (customer, day) so a #122 replay reproduces the same answer.
 *
 * Mirrors `rollCustomerCounterResponse` — the roll lives here with the curve,
 * the seed is derived at the flow seam that knows which customer and which day.
 */
export function rollFinanceFallThrough(
  markupPts: number,
  seed: number,
  config: FniDealKillConfig = loadFniDealKillConfig(),
): boolean {
  const probability = fallThroughProbability(markupPts, config);
  if (probability <= 0) return false;
  return createRng(seed)() < probability;
}

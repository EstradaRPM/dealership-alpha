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
  /** Markup at or under which nothing falls through, with no F&I desk. */
  readonly safeFrontierPts: number;
  /** How far past the frontier markup must go to reach the full rate. */
  readonly fullKillRangePts: number;
  /** Fall-through rate at (and past) the end of that range. */
  readonly maxFallThroughRate: number;
  /** How far a reference-grade structurer pushes the frontier out (#369). */
  readonly structuringFrontierMaxPts: number;
  /** The `finance_structuring` skill (0–100) that earns the full extension. */
  readonly structuringSkillReference: number;
}

/** Reads the deal-kill curve from the `fniDealKill` section of tunables. */
export function loadFniDealKillConfig(): FniDealKillConfig {
  return loadTunables().fniDealKill;
}

/**
 * The markup this store can write before the lender starts passing (#369).
 *
 * The one monotonic relation Q5 asked for: a better structurer packages the
 * same aggressive rate into paper a lender will actually buy, so the frontier
 * slides out with `finance_structuring` and the peak of the posture dial slides
 * with it. Linear from the bare `safeFrontierPts` at skill 0 to a full
 * `structuringFrontierMaxPts` past it at the reference skill, then flat — a
 * manager cannot out-structure the lender indefinitely.
 *
 * `null` (no F&I manager on the desk) is NOT skill 0 dressed up: it is the
 * store with no finance office, and it gets the bare frontier. Both answers
 * coincide numerically today, and they are written separately anyway because a
 * future extension that is nonzero at skill 0 must not silently grant itself to
 * a store that never hired anyone.
 *
 * Pure, so #370's peak meter can read where this store's frontier sits without
 * closing a deal.
 */
export function resolveSafeFrontierPts(
  financeStructuringSkill: number | null,
  config: FniDealKillConfig = loadFniDealKillConfig(),
): number {
  if (financeStructuringSkill === null) return config.safeFrontierPts;
  const reach = financeStructuringSkill / config.structuringSkillReference;
  const clamped = reach < 0 ? 0 : reach > 1 ? 1 : reach;
  return config.safeFrontierPts + config.structuringFrontierMaxPts * clamped;
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
 * `financeStructuringSkill` is the F&I manager's composite on the desk, or
 * `null` when the store has no finance office (#369) — it moves the frontier
 * this is measured against, and nothing else. Defaulting it to `null` is the
 * honest default rather than a convenience: a caller that names no desk has no
 * desk, which is the answer every pre-#369 harness was measured with.
 */
export function fallThroughProbability(
  markupPts: number,
  config: FniDealKillConfig = loadFniDealKillConfig(),
  financeStructuringSkill: number | null = null,
): number {
  const over = markupPts - resolveSafeFrontierPts(financeStructuringSkill, config);
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
  financeStructuringSkill: number | null = null,
): boolean {
  const probability = fallThroughProbability(markupPts, config, financeStructuringSkill);
  if (probability <= 0) return false;
  return createRng(seed)() < probability;
}

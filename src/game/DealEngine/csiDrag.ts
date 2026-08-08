import { loadTunables } from '../data';

/**
 * CSI drag (#368) — the second, slower tooth on the F&I posture (grill Q3
 * secondary, I9).
 *
 * Deal-kill (#367) costs you the deal you were working. This costs you the
 * *next* customer: a buyer who was marked up hard scores the store lower, store
 * satisfaction already feeds arrival rates through `Reputation` →
 * `CustomerPool`, so gouging thins the crowd. Both teeth measure the same thing
 * — how far past a fair markup the contract was written — so the player learns
 * ONE frontier to read the dial, not two.
 *
 * The hit is on the MARKUP, never on the products. Attaching a menu is the F&I
 * desk's job; over-marking the rate is the gouge. A cash deal has no markup and
 * therefore no drag, at any attach.
 *
 * Chargebacks are a later refinement layer on this same variable (grill Q3) and
 * are deliberately not here.
 */
export interface FniCsiDragConfig {
  /** Markup at or under which a buyer feels fairly dealt with, in points of APR. */
  readonly fairMarkupPts: number;
  /** How far past that line markup must go to reach the full hit. */
  readonly fullDragRangePts: number;
  /** Satisfaction delta at (and past) the end of that range. Negative. */
  readonly maxSatisfactionHit: number;
}

/** Reads the drag curve from the `fniCsiDrag` section of tunables. */
export function loadFniCsiDragConfig(): FniCsiDragConfig {
  return loadTunables().fniCsiDrag;
}

/**
 * How far past the fair line a markup must sit before it counts as one — a
 * representation guard, NOT a balance number, which is why it is here and not
 * in `data/`.
 *
 * The caller judges the markup the contract was actually written at, and the
 * only honest source for that is `customerRate − buyRate`. That subtraction
 * does not round-trip in binary floating point: the Tier-C buy rate plus the
 * Balanced posture's 1.75 points comes back as 0.017500000000000016, which is
 * *over* a 0.0175 line by 1.6e-17. Without this guard the Balanced posture
 * would publish a ~1e-15 satisfaction hit on every financed close — invisible
 * as a number and fatal as a fact, because satisfaction feeds arrival rates and
 * the whole pre-#368 calibration corpus would stop reproducing.
 *
 * A billionth of a point of APR is far below any markup the game can express
 * and far above the noise, so nothing real is ever swallowed by it.
 */
const RATE_EPSILON = 1e-9;

/**
 * The store-satisfaction delta a deal closed at `markupPts` leaves behind.
 * Zero (never positive) at or under the fair line, ramping linearly to
 * `maxSatisfactionHit` a full drag-range past it, then flat.
 *
 * Flat past the end for the same reason the kill curve is: a delta that kept
 * growing would eventually be a wall rather than a trade-off. Zero at or under
 * the line is load-bearing in the same way too — the Balanced posture sits on
 * it and the unstaffed ambient markup sits under it, so the whole existing
 * calibration corpus measures a store that never takes this hit. It is the
 * reach past Balanced that costs something.
 *
 * Pure, so #370's peak meter can read the cost of a posture without closing a
 * deal to find out.
 */
export function markupSatisfactionHit(
  markupPts: number,
  config: FniCsiDragConfig = loadFniCsiDragConfig(),
): number {
  const over = markupPts - config.fairMarkupPts;
  if (over <= RATE_EPSILON) return 0;
  const ramp = Math.min(1, over / config.fullDragRangePts);
  return config.maxSatisfactionHit * ramp;
}

import { z } from 'zod';
import { parseData } from '../data';

/**
 * Per-brand standing (#151, B2 I6). How the store's record selling a make moves,
 * and how much a shopper cares. Sign-checked by schema: a bonus that could be
 * negative (or a penalty that could be positive) would mean a bad delivery
 * *helps* the brand, and would read as balance rather than a dropped minus sign.
 *
 * **These four magnitudes are calibration placeholders, owed to a C2-class pass
 * (#286) and not to the design.** The #180 live harness demonstrably cannot pick
 * them: at `matchWeight` 0.05 and 0.15 the measured distribution shifts by the
 * same amount in the same direction, and at 0.001 it is unchanged — the term
 * either flips a near-tie or it does not, and flipping one re-routes the whole
 * seeded run. See `data/market-calibration.json#live._doc`.
 */
const BrandReputationSchema = z.object({
  /** Applied per clean closed deal on that make. */
  closedDealBonus: z.number().positive(),
  /** Applied instead when the close was a low-trust forced one (`badReview`). */
  badReviewPenalty: z.number().negative(),
  /** Per-night pull back toward neutral, as a fraction of the standing. */
  driftRate: z.number().min(0).max(1),
  /**
   * How far a full ±1 standing moves the `pickVehicleFor` argmax score, whose
   * other terms (want-axis fit, price penalty) are unit-scaled. A tilt between
   * comparable units, never the term that decides the match.
   */
  matchWeight: z.number().nonnegative(),
});

const ReputationConfigSchema = z.object({
  startingSatisfaction: z.number(),
  startingReviewScore: z.number(),
  satisfactionMin: z.number(),
  satisfactionMax: z.number(),
  closedDealSatisfactionBonus: z.number(),
  closedDealReviewBonus: z.number(),
  walkSatisfactionPenalty: z.number(),
  reviewDriftRate: z.number().min(0).max(1),
  satisfactionEquilibrium: z.number(),
  satisfactionDriftRate: z.number().min(0).max(1),
  baseDailyDemand: z.number().nonnegative(),
  demandReviewSlope: z.number(),
  marketingSaturation: z.number().positive(),
  marketingMaxBoost: z.number().nonnegative(),
  brandReputation: BrandReputationSchema,
  seasonDemandMultiplier: z.record(z.string(), z.number().nonnegative()),
  dayOfWeekDemandMultiplier: z.record(z.string(), z.number().nonnegative()),
});

export type ReputationConfig = z.infer<typeof ReputationConfigSchema>;

export function loadReputationConfig(): ReputationConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { reputation: unknown }).reputation;
  return parseData(raw, ReputationConfigSchema, 'data/tunables.json#reputation');
}

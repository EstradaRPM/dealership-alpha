import { z } from 'zod';
import { parseData } from '../data/loadJson';

/** Job categories in early→late drift order; the car's age selects which one a
 *  returning owner is due for (#300). Mirrors the four Service parts categories
 *  the downstream ServiceDemand/PartsInventory work will stock against. */
export const JOB_CATEGORIES = [
  'oil_filters',
  'tires_brakes',
  'drivetrain',
  'electronics',
] as const;

// InstalledBase tunables (#298, #300). `loyaltySeedScale` maps a deal's
// satisfaction-at-sale `retentionSeed` ∈ [0,1] onto an owner's initial loyalty
// (`loyalty = clamp01(retentionSeed × loyaltySeedScale)`). `returnCadence` is
// the service-due interval (game days) per powertrain — EVs cycle least often.
// `jobCategoryDrift` is the ordered age→category ladder (each band applies while
// ageDays < untilAgeDays; the final band omits untilAgeDays as the catch-all).
// `returnRoll` carries the convenience/price-sensitivity terms of the return
// probability. All ship as identity/placeholder values; the S14 balance pass
// (#286) tunes them without touching code.
// Not `.strict()`: the JSON carries a `_doc` annotation that Zod strips.
const ReturnCadenceSchema = z.object({
  ice: z.number().int().positive(),
  hybrid: z.number().int().positive(),
  ev: z.number().int().positive(),
});

const JobCategoryBandSchema = z.object({
  category: z.enum(JOB_CATEGORIES),
  /** Upper age bound (exclusive) this band applies under. Omitted on the final
   *  catch-all band. */
  untilAgeDays: z.number().int().positive().optional(),
});

const ReturnRollSchema = z.object({
  convenience: z.number().min(0),
  priceSensitivity: z.number().min(0),
});

// #306 service-outcome feedback. Loyalty/CSI deltas per outcome (all magnitudes
// non-negative; the resolver signs the penalties). `fairPostureThreshold` is the
// pricing-posture [0,1] above which a closed ticket counts as gouging (drops
// loyalty/CSI + dings Reputation) instead of a fair-price win. The `reputation*`
// terms are the satisfaction-hit amounts (≤ 0) fed to Reputation on the three
// CSI signals (misses, long waits / unserved, gouging).
const FeedbackSchema = z.object({
  goodLoyaltyBonus: z.number().min(0),
  goodCsiBonus: z.number().min(0),
  missLoyaltyPenalty: z.number().min(0),
  missCsiPenalty: z.number().min(0),
  unservedLoyaltyPenalty: z.number().min(0),
  unservedCsiPenalty: z.number().min(0),
  gougeLoyaltyPenalty: z.number().min(0),
  gougeCsiPenalty: z.number().min(0),
  fairPostureThreshold: z.number().min(0).max(1),
  reputationMissHit: z.number().max(0),
  reputationUnservedHit: z.number().max(0),
  reputationGougeHit: z.number().max(0),
});

// #306 permanent defection: an owner leaves the base for good once either
// counter reaches its threshold (sustained bad experiences OR sustained
// non-returns).
const DefectionSchema = z.object({
  badVisitsToDefect: z.number().int().positive(),
  noReturnsToDefect: z.number().int().positive(),
});

// #306 repeat-buyer leads: a loyal owner whose car has aged past `ageOutDays`
// (and whose loyalty clears `minLoyalty`) re-enters Sales as a warm lead.
const RepeatBuyerSchema = z.object({
  ageOutDays: z.number().int().positive(),
  minLoyalty: z.number().min(0).max(1),
});

const InstalledBaseConfigSchema = z.object({
  loyaltySeedScale: z.number().nonnegative(),
  returnCadence: ReturnCadenceSchema,
  jobCategoryDrift: z.array(JobCategoryBandSchema).min(1),
  returnRoll: ReturnRollSchema,
  feedback: FeedbackSchema,
  defection: DefectionSchema,
  repeatBuyer: RepeatBuyerSchema,
});

export type InstalledBaseConfig = z.infer<typeof InstalledBaseConfigSchema>;

export function loadInstalledBaseConfig(): InstalledBaseConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { installedBase: unknown })
    .installedBase;
  return parseData(
    raw,
    InstalledBaseConfigSchema,
    'data/tunables.json#installedBase',
  );
}

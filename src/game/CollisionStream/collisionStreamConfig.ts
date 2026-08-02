import { z } from 'zod';
import { parseData } from '../data';

/** The four Body-Shop collision job/parts categories, in a fixed order the mix
 *  composes + draws over. */
export const BODY_SHOP_JOB_CATEGORIES = [
  'windows_glass',
  'doors_panels',
  'interior_trim',
  'paint',
] as const;

/** The three powertrain keys the conquest draw samples over. */
export const COLLISION_POWERTRAINS = ['ice', 'hybrid', 'ev'] as const;

// A full weight over the four collision job categories.
const JobWeightsSchema = z.object({
  windows_glass: z.number(),
  doors_panels: z.number(),
  interior_trim: z.number(),
  paint: z.number(),
});

// A partial lean — only the categories a season/condition nudges need an entry.
const JobLeanSchema = JobWeightsSchema.partial();

const PowertrainMixSchema = z.object({
  ice: z.number().nonnegative(),
  hybrid: z.number().nonnegative(),
  ev: z.number().nonnegative(),
});

const ConditionKeys = ['clear', 'cloudy', 'rain', 'snow', 'storm'] as const;
const SeasonKeys = ['spring', 'summer', 'fall', 'winter'] as const;

const conditionRecord = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    clear: value,
    cloudy: value,
    rain: value,
    snow: value,
    storm: value,
  });

const seasonRecord = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    spring: value,
    summer: value,
    fall: value,
    winter: value,
  });

// CollisionStream tunables (#313). Two seeded Poisson streams feed the day's
// collision draw: a STEADY insurance-DRP referral stream (mild weather spike,
// rep-independent, scaled by leaning insurance) and a LUMPY retail/conquest
// stream (full weather spike, reputation-dominant, scaled by leaning retail) plus
// a small installed-base tie. The job mix is `jobSplit` + the day's seasonal +
// condition leans + per-category RNG variance. `jobRevenue` is the base ticket
// revenue per category; `channel` carries the margin profile (insurance jobs are
// rate-capped below book, retail jobs carry the fatter structural margin). All
// values ship as placeholders — the S14 balance pass (#286) tunes them without
// touching code. Not `.strict()`: the JSON carries a `_doc` annotation Zod strips.
const CollisionStreamConfigSchema = z.object({
  schemaVersion: z.literal(1),
  jobRevenue: JobWeightsSchema,
  volume: z.object({
    /** Base lumpy retail/conquest collision rate (expected/day before spikes). */
    conquestBase: z.number().nonnegative(),
    /** Base steady insurance-DRP referral rate (expected/day before posture). */
    referralBase: z.number().nonnegative(),
    /** Reputation scaling of the conquest stream (the conquest-dominant lever). */
    repGain: z.number().nonnegative(),
    /** How much leaning retail grows the conquest stream. */
    retailLeanBonus: z.number().nonnegative(),
    /** Per-owner additive to the conquest rate (the small installed-base tie). */
    baseTie: z.number().nonnegative(),
    /** Cap on the total installed-base-tie additive. */
    baseTieCap: z.number().nonnegative(),
    /** Safety clamp on either Poisson mean (guards a corrupt config). */
    maxLambda: z.number().positive(),
  }),
  weatherSpike: z.object({
    byCondition: conditionRecord(z.number().nonnegative()),
    bySeason: seasonRecord(z.number().nonnegative()),
    /** Insurance spike is `1 + (fullSpike − 1) × insuranceDamping` ⇒ steadier
     *  than the retail spike (insurance volume is a contract relationship). */
    insuranceDamping: z.number().min(0).max(1),
  }),
  channel: z.object({
    /** Revenue multiplier for insurance jobs (< 1: the insurer dictates a capped
     *  rate; price-insensitive). */
    insuranceRateCap: z.number().nonnegative(),
    /** Revenue multiplier for retail jobs (the fatter structural margin). */
    retailMarginMultiplier: z.number().nonnegative(),
  }),
  mix: z.object({
    jobSplit: JobWeightsSchema,
    seasonalLean: seasonRecord(JobLeanSchema),
    conditionLean: conditionRecord(JobLeanSchema),
    rngVariance: z.number().min(0),
    vehicleCategories: z.record(z.string(), z.number().nonnegative()).refine(
      (r) => Object.keys(r).length > 0,
      { message: 'vehicleCategories needs at least one category' },
    ),
    powertrainMix: PowertrainMixSchema,
  }),
});

export type CollisionStreamConfig = z.infer<typeof CollisionStreamConfigSchema>;

export function loadCollisionStreamConfig(): CollisionStreamConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/bodyshop-demand.json');
  return parseData(raw, CollisionStreamConfigSchema, 'data/bodyshop-demand.json');
}

export { ConditionKeys, SeasonKeys };

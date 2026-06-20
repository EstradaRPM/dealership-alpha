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

const InstalledBaseConfigSchema = z.object({
  loyaltySeedScale: z.number().nonnegative(),
  returnCadence: ReturnCadenceSchema,
  jobCategoryDrift: z.array(JobCategoryBandSchema).min(1),
  returnRoll: ReturnRollSchema,
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

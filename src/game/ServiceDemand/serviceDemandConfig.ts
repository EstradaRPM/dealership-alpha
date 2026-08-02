import { z } from 'zod';
import { parseData } from '../data';
import { JOB_CATEGORIES } from '../InstalledBase';

/** The three powertrain keys ServiceDemand skews + draws over. Mirrors the
 *  InstalledBase `OwnerPowertrain` union; declared here for the config schema. */
export const POWERTRAINS = ['ice', 'hybrid', 'ev'] as const;

// A full weight over the four job categories (early→late drift order).
const JobCategoryWeightsSchema = z.object({
  oil_filters: z.number(),
  tires_brakes: z.number(),
  drivetrain: z.number(),
  electronics: z.number(),
});

// A partial lean — only the categories a season nudges need an entry.
const JobCategoryLeanSchema = JobCategoryWeightsSchema.partial();

const PowertrainSkewSchema = z.object({
  ice: JobCategoryWeightsSchema,
  hybrid: JobCategoryWeightsSchema,
  ev: JobCategoryWeightsSchema,
});

const PowertrainMixSchema = z.object({
  ice: z.number().nonnegative(),
  hybrid: z.number().nonnegative(),
  ev: z.number().nonnegative(),
});

// ServiceDemand tunables (#302). The conquest stream's job/parts-category mix is
// composed from `usualSplit` (the consumable-heavy base) + the day's
// `seasonalLean` (season read from Weather) + a base-age drift (older installed
// fleet shifts work toward drivetrain/electronics) + a powertrain skew (weighted
// by the installed base's powertrain distribution; EVs trade oil work for
// electronics) + per-category RNG variance. `jobRevenue` is the base ticket
// revenue per category; `conquest` scales the daily floor of fresh walk-ins by
// reputation × service-marketing. All values ship as placeholders — the S14
// balance pass (#286) tunes them without touching code.
// Not `.strict()`: the JSON carries a `_doc` annotation that Zod strips.
const ServiceDemandConfigSchema = z.object({
  schemaVersion: z.literal(1),
  usualSplit: JobCategoryWeightsSchema,
  jobRevenue: JobCategoryWeightsSchema,
  conquest: z.object({
    floor: z.number().int().nonnegative(),
    scale: z.number().nonnegative(),
  }),
  baseAgeDrift: z.object({
    referenceAgeDays: z.number().positive(),
    categoryShift: JobCategoryWeightsSchema,
  }),
  powertrainSkew: PowertrainSkewSchema,
  conquestPowertrainMix: PowertrainMixSchema,
  conquestVehicleCategories: z.record(z.string(), z.number().nonnegative()).refine(
    (r) => Object.keys(r).length > 0,
    { message: 'conquestVehicleCategories needs at least one category' },
  ),
  seasonalLean: z.object({
    spring: JobCategoryLeanSchema,
    summer: JobCategoryLeanSchema,
    fall: JobCategoryLeanSchema,
    winter: JobCategoryLeanSchema,
  }),
  rngVariance: z.number().min(0),
});

export type ServiceDemandConfig = z.infer<typeof ServiceDemandConfigSchema>;

export function loadServiceDemandConfig(): ServiceDemandConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/service-demand.json');
  return parseData(raw, ServiceDemandConfigSchema, 'data/service-demand.json');
}

// Re-export the job-category ladder ServiceDemand composes over. ServiceDemand is
// a downstream consumer of InstalledBase's returning-owner stream, so it shares
// that module's category contract rather than declaring a parallel union.
export { JOB_CATEGORIES };

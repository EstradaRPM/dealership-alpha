import { z } from 'zod';
import { parseData } from '../data/loadJson';
import { JOB_CATEGORIES } from '../InstalledBase';

// One retention-arm campaign: a daily-cost lever that lifts the installed
// base's return rate. `returnLift` is added to the return roll's `convenience`
// term (clamped in `returnProbability`), so it both raises return rate and
// slows the sustained-non-return defection path.
const RetentionCampaignSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  blurb: z.string(),
  dailyCost: z.number().nonnegative(),
  returnLift: z.number().min(0).max(1),
});

// ServiceMarketing tunables (#307, parent #297). Two arms, distinct from sales
// advertising: a list of mutually-exclusive retention campaigns, and a single
// category-targeted conquest special (the player aims it at a job category).
// `volumeBoost` scales ServiceDemand's conquest-volume input; `categoryBias`
// multiplies the promoted category's weight in the incoming mix by
// `1 + categoryBias`. Both arms debit `dailyCost` from Economy each day.
// Not `.strict()`: the JSON carries a `_doc` annotation that Zod strips.
const ServiceMarketingConfigSchema = z.object({
  schemaVersion: z.literal(1),
  retentionCampaigns: z
    .array(RetentionCampaignSchema)
    .refine((arr) => new Set(arr.map((c) => c.id)).size === arr.length, {
      message: 'retentionCampaigns ids must be unique',
    }),
  conquestSpecial: z.object({
    dailyCost: z.number().nonnegative(),
    volumeBoost: z.number().min(0).max(1),
    categoryBias: z.number().nonnegative(),
  }),
});

export type RetentionCampaign = z.infer<typeof RetentionCampaignSchema>;
export type ServiceMarketingConfig = z.infer<typeof ServiceMarketingConfigSchema>;

export function loadServiceMarketingConfig(): ServiceMarketingConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/service-marketing.json');
  return parseData(raw, ServiceMarketingConfigSchema, 'data/service-marketing.json');
}

// Re-export the job-category ladder the conquest arm targets. ServiceMarketing
// is a downstream consumer of InstalledBase's category contract, so it shares
// that module's union rather than declaring a parallel one.
export { JOB_CATEGORIES };

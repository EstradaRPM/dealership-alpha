import { z } from 'zod';
import { parseData } from '../data/loadJson';

// Per-collision-job display label, keyed by the Body-Shop parts/job ladder
// (windows/glass, doors/panels, interior trim, paint). BodyShopQueue derives the
// queue/economy memo label from the due job category since the enriched
// CollisionStream stream carries the category, not prose.
const JobLabelsSchema = z.object({
  windows_glass: z.string().min(1),
  doors_panels: z.string().min(1),
  interior_trim: z.string().min(1),
  paint: z.string().min(1),
});

// BodyShopQueue tunables (#312, parent #297) — the Tier-3 mirror of
// ServiceQueueConfig. Intake flows from CollisionStream (#313); the queue only
// carries the Tier gate plus the collision-job → display-label map.
const BodyShopQueueConfigSchema = z.object({
  minTierRequired: z.number().int().min(1),
  jobLabels: JobLabelsSchema,
});

export type BodyShopQueueConfig = z.infer<typeof BodyShopQueueConfigSchema>;

export function loadBodyShopQueueConfig(): BodyShopQueueConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/bodyshop-intake.json');
  return parseData(raw, BodyShopQueueConfigSchema, 'data/bodyshop-intake.json');
}

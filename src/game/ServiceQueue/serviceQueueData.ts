import { z } from 'zod';
import { parseData } from '../data';

// Per-job-category display label, keyed by the InstalledBase JobCategory ladder.
// ServiceQueue derives the queue/economy memo label from the due job category
// since the enriched ServiceDemand stream carries the category, not prose.
const JobLabelsSchema = z.object({
  oil_filters: z.string().min(1),
  tires_brakes: z.string().min(1),
  drivetrain: z.string().min(1),
  electronics: z.string().min(1),
});

// ServiceQueue tunables (#303, parent #297). The synthetic seed×day intake table
// is retired — daily intake flows from ServiceDemand. ServiceQueue only carries
// the Tier gate plus the job-category → display-label map.
const ServiceQueueConfigSchema = z.object({
  minTierRequired: z.number().int().min(1),
  jobLabels: JobLabelsSchema,
});

export type ServiceQueueConfig = z.infer<typeof ServiceQueueConfigSchema>;

export function loadServiceQueueConfig(): ServiceQueueConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/service-intake.json');
  return parseData(raw, ServiceQueueConfigSchema, 'data/service-intake.json');
}

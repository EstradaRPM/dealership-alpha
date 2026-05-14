import { z } from 'zod';
import { parseData } from '../data/loadJson';

const ServiceIntakeItemDefSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  baseRevenue: z.number().min(0),
});

const ServiceQueueConfigSchema = z.object({
  intakeItems: z.array(ServiceIntakeItemDefSchema).min(1),
  dailyIntakeMin: z.number().int().min(1),
  dailyIntakeMax: z.number().int().min(1),
  minTierRequired: z.number().int().min(1),
});

export type ServiceQueueConfig = z.infer<typeof ServiceQueueConfigSchema>;

export function loadServiceQueueConfig(): ServiceQueueConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/service-intake.json');
  return parseData(raw, ServiceQueueConfigSchema, 'data/service-intake.json');
}

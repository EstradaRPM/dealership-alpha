import { z } from 'zod';
import { parseData } from '../data';

export const CustomerTunablesSchema = z
  .object({
    schemaVersion: z.literal(1),
    followUp: z
      .object({
        decayPerNight: z.number().nonnegative(),
        callbackFailurePenalty: z.number().nonnegative().optional(),
        maxBdcTasksPerMorning: z.number().int().positive().optional(),
      })
      .strict(),
  })
  .strict();

export type CustomerTunables = z.infer<typeof CustomerTunablesSchema>;

export function loadCustomerTunables(): CustomerTunables {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/customer-tunables.json');
  return parseData(raw, CustomerTunablesSchema, 'data/customer-tunables.json');
}

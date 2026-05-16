import { z } from 'zod';
import { parseData } from './loadJson';

export const TunablesSchema = z.object({
  schemaVersion: z.literal(1),
  clock: z.object({
    minutesPerTick: z.number().int().positive(),
    ticksPerDay: z.number().int().positive(),
    daysPerMonth: z.number().int().positive(),
  }),
  economy: z.object({
    startingCash: z.number().nonnegative(),
    dailyOverheadBase: z.number().nonnegative(),
  }),
});

export type Tunables = z.infer<typeof TunablesSchema>;

export function loadTunables(): Tunables {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/tunables.json');
  return parseData(raw, TunablesSchema, 'data/tunables.json');
}

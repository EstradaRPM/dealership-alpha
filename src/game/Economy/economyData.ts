import { z } from 'zod';
import { parseData } from '../data/loadJson';

const EconomyConfigSchema = z.object({
  weeklyRent: z.number().positive(),
  weeklyPayrollStub: z.number().nonnegative(),
});

export type EconomyConfig = z.infer<typeof EconomyConfigSchema>;

export function loadEconomyConfig(): EconomyConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { economy: { tier1: unknown } }).economy.tier1;
  return parseData(raw, EconomyConfigSchema, 'data/tunables.json#economy.tier1');
}

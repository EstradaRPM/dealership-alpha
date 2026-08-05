import { z } from 'zod';
import { parseData } from '../data';

const EconomyConfigSchema = z.object({
  weeklyRent: z.number().positive(),
  // `weeklyPayrollStub` is GONE (#353). It was a flat $800/week that made your
  // fifth hire cost nothing. Payroll is now the sum of the roster's daily
  // wages, owned by StaffOrg (the source of truth for who is on payroll) and
  // posted here through `forceDebit`. Two numbers that could disagree about
  // what staff cost is exactly the bug this deletion prevents.
});

export type EconomyConfig = z.infer<typeof EconomyConfigSchema>;

export function loadEconomyConfig(): EconomyConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { economy: { tier1: unknown } }).economy.tier1;
  return parseData(raw, EconomyConfigSchema, 'data/tunables.json#economy.tier1');
}

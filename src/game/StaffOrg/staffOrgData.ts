import { z } from 'zod';
import { parseData } from '../data/loadJson';

const StaffOrgConfigSchema = z.object({
  hiringCostByTier: z.record(z.string().min(1), z.number().nonnegative()),
  candidatesPerRole: z.number().int().positive(),
  // dealership-tier (1/2/3) → max total roster headcount
  headcountCapByTier: z.record(z.string().min(1), z.number().int().nonnegative()),
});

export type StaffOrgConfig = z.infer<typeof StaffOrgConfigSchema>;

export function loadStaffOrgConfig(): StaffOrgConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffOrg: unknown }).staffOrg;
  return parseData(raw, StaffOrgConfigSchema, 'data/tunables.json#staffOrg');
}

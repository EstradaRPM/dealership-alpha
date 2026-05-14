import { z } from 'zod';
import { parseData } from '../data/loadJson';

const CapacityConfigSchema = z.object({
  facilityTierBaseCapacity: z.record(z.string(), z.number().int().nonnegative()),
  staffContributionByTier: z.record(z.string(), z.number().int().nonnegative()),
  missedOpportunitySatisfactionHit: z.number(),
});

export type CapacityConfig = z.infer<typeof CapacityConfigSchema>;

export function loadCapacityConfig(): CapacityConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { capacity: unknown }).capacity;
  return parseData(raw, CapacityConfigSchema, 'data/tunables.json#capacity');
}

export function getStaffContribution(roleId: string, config: CapacityConfig): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const roles = require('../../../data/staff-roles.json') as Record<string, { tier: string }>;
  const role = roles[roleId];
  if (!role) return 0;
  return config.staffContributionByTier[role.tier] ?? 0;
}

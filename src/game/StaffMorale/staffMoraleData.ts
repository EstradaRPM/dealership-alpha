import { z } from 'zod';
import { parseData } from '../data';

const StaffMoraleConfigSchema = z.object({
  defaultMorale: z.number().min(0).max(100),
  moraleCeiling: z.number().min(0).max(100),
  moraleFloor: z.number().min(0).max(100),
  quitRiskThreshold: z.number().min(0).max(100),
  quitRiskRate: z.number().min(0).max(1),
  workloadCapacityPerStaff: z.number().int().positive(),
  workloadOverloadPenalty: z.number(),
  workloadIdleBonus: z.number(),
  recognitionBonus: z.number(),
  payVsMarketBonus: z.number(),
  moraleMultiplierMin: z.number().min(0),
  moraleMultiplierMax: z.number().min(0),
});

export type StaffMoraleConfig = z.infer<typeof StaffMoraleConfigSchema>;

export function loadStaffMoraleConfig(): StaffMoraleConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffMorale: unknown }).staffMorale;
  return parseData(raw, StaffMoraleConfigSchema, 'data/tunables.json#staffMorale');
}

import { z } from 'zod';
import { parseData } from '../data';

const ReputationConfigSchema = z.object({
  startingSatisfaction: z.number(),
  startingReviewScore: z.number(),
  satisfactionMin: z.number(),
  satisfactionMax: z.number(),
  closedDealSatisfactionBonus: z.number(),
  closedDealReviewBonus: z.number(),
  walkSatisfactionPenalty: z.number(),
  reviewDriftRate: z.number().min(0).max(1),
  satisfactionEquilibrium: z.number(),
  satisfactionDriftRate: z.number().min(0).max(1),
  baseDailyDemand: z.number().nonnegative(),
  demandReviewSlope: z.number(),
  marketingSaturation: z.number().positive(),
  marketingMaxBoost: z.number().nonnegative(),
  seasonDemandMultiplier: z.record(z.string(), z.number().nonnegative()),
  dayOfWeekDemandMultiplier: z.record(z.string(), z.number().nonnegative()),
});

export type ReputationConfig = z.infer<typeof ReputationConfigSchema>;

export function loadReputationConfig(): ReputationConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { reputation: unknown }).reputation;
  return parseData(raw, ReputationConfigSchema, 'data/tunables.json#reputation');
}

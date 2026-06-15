import { z } from 'zod';
import { parseData } from '../data/loadJson';

const StaffDispatchConfigSchema = z.object({
  // Per-tick floor-drain throughput (#101): sales items a salesperson works
  // per FloorSim tick, lerped by effectiveness. Fractional; accumulated.
  minDrainPerTick: z.number().min(0),
  maxDrainPerTick: z.number().min(0),
  // Pricing/Demand spine S9 (#281): the unstaffed discount buy/walk event.
  discountEvent: z.object({
    // Fraction of below-floor, unstaffed discount situations that surface as an
    // interactive manager-attention event. Rare by default — most price-gap ups
    // simply walk; only a slice becomes a player decision. A hired sales-manager
    // auto-adjudicates and is never gated by this rate.
    escalationRate: z.number().min(0).max(1),
    // How many counter-offers (above their target) a customer will entertain
    // before walking, scaled by agreeableness across [min,max] with seeded
    // jitter: a disagreeable buyer walks after one swing-and-a-miss; an agreeable
    // one haggles back and forth.
    minCounterAttempts: z.number().int().min(0),
    maxCounterAttempts: z.number().int().min(1),
    // Each prior rejected counter ("swing and a miss") subtracts this much from
    // the next counter's acceptance probability — the customer cools off.
    missPenalty: z.number().min(0).max(1),
  }),
});

export type StaffDispatchConfig = z.infer<typeof StaffDispatchConfigSchema>;

export function loadStaffDispatchConfig(): StaffDispatchConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffDispatch: unknown }).staffDispatch;
  return parseData(raw, StaffDispatchConfigSchema, 'data/tunables.json#staffDispatch');
}

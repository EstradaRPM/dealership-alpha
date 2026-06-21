import { z } from 'zod';
import { parseData } from '../data/loadJson';

const ServiceDispatchConfigSchema = z.object({
  minAutoResolveRate: z.number().min(0).max(1),
  maxAutoResolveRate: z.number().min(0).max(1),
  minRevenueMultiplier: z.number().min(0),
  maxRevenueMultiplier: z.number().min(0),
  // Per-tick floor-drain throughput (#101): service items an advisor works
  // per FloorSim tick, lerped by effectiveness. Fractional; accumulated.
  minDrainPerTick: z.number().min(0),
  maxDrainPerTick: z.number().min(0),
  // #304 parts gate. The tier at/above which the rush emergency-order path is
  // unlocked (PRD #297 story 13 — "as my operation matures"); below it an
  // under-stock job is a flat miss. Placeholder pending calibration (#286).
  rushUnlockTier: z.number().int().min(1),
  // The CSI hit a missed (under-stocked, turned-away) job emits, feeding base
  // health / Reputation. Placeholder magnitude pending calibration (#286).
  missCsiHit: z.number().min(0),
});

export type ServiceDispatchConfig = z.infer<typeof ServiceDispatchConfigSchema>;

export function loadServiceDispatchConfig(): ServiceDispatchConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { serviceDispatch: unknown }).serviceDispatch;
  return parseData(raw, ServiceDispatchConfigSchema, 'data/tunables.json#serviceDispatch');
}

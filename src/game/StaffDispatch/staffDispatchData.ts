import { z } from 'zod';
import { parseData } from '../data/loadJson';

const StaffDispatchConfigSchema = z.object({
  exceptionFlagRates: z.record(z.string().min(1), z.number().min(0).max(1)),
  gmExceptionFlagRates: z.record(z.string().min(1), z.number().min(0).max(1)),
  minAutoResolveRate: z.number().min(0).max(1),
  maxAutoResolveRate: z.number().min(0).max(1),
  minCloseRate: z.number().min(0).max(1),
  maxCloseRate: z.number().min(0).max(1),
  baseAutoGross: z.number().positive(),
  minGrossModifier: z.number().min(0).max(1),
  // Per-tick floor-drain throughput (#101): sales items a salesperson works
  // per FloorSim tick, lerped by effectiveness. Fractional; accumulated.
  minDrainPerTick: z.number().min(0),
  maxDrainPerTick: z.number().min(0),
});

export type StaffDispatchConfig = z.infer<typeof StaffDispatchConfigSchema>;

export function loadStaffDispatchConfig(): StaffDispatchConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffDispatch: unknown }).staffDispatch;
  return parseData(raw, StaffDispatchConfigSchema, 'data/tunables.json#staffDispatch');
}

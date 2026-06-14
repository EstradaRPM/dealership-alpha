import { z } from 'zod';
import { parseData } from '../data/loadJson';

const StaffDispatchConfigSchema = z.object({
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

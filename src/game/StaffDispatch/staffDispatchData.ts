import { z } from 'zod';
import { parseData } from '../data/loadJson';

const StaffDispatchConfigSchema = z.object({
  exceptionFlagRates: z.record(z.string().min(1), z.number().min(0).max(1)),
  gmExceptionFlagRates: z.record(z.string().min(1), z.number().min(0).max(1)),
  minCloseRate: z.number().min(0).max(1),
  maxCloseRate: z.number().min(0).max(1),
  baseAutoGross: z.number().positive(),
  minGrossModifier: z.number().min(0).max(1),
  // Per-tick floor-drain throughput (#101): sales items a salesperson works
  // per FloorSim tick, lerped by effectiveness. Fractional; accumulated.
  minDrainPerTick: z.number().min(0),
  maxDrainPerTick: z.number().min(0),
  // Forced-exception threshold scaling (#103): each dramatic-case flag rate is
  // raised to an exponent lerped by best-salesperson effectiveness (the
  // f(skill × role tier) dial). Exponent ≥ 1 ⇒ rate^exp ≤ rate, so higher
  // skill ⇒ rarer escalations (a guaranteed rate of 1.0 stays guaranteed).
  exceptionSkillExpMin: z.number().min(1),
  exceptionSkillExpMax: z.number().min(1),
});

export type StaffDispatchConfig = z.infer<typeof StaffDispatchConfigSchema>;

export function loadStaffDispatchConfig(): StaffDispatchConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffDispatch: unknown }).staffDispatch;
  return parseData(raw, StaffDispatchConfigSchema, 'data/tunables.json#staffDispatch');
}

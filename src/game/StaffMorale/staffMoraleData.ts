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
  /**
   * The two halves of the nightly pay-vs-market read (#356). It replaced
   * `payVsMarketBonus`, a single number applied **unconditionally** every
   * payroll night — a placeholder wearing a mechanic's name, since it compared
   * nothing. Now the comparison is real: paid wage against the wage the
   * member's *current* grade asks for, which is the same comparison that fires
   * the raise request.
   *
   * The signs are schema, not convention. A positive `paidBelowMarketPenalty`
   * would mean underpaying someone cheers them up, and it would read as a
   * balance decision rather than a dropped minus sign.
   */
  paidAtMarketBonus: z.number().positive(),
  paidBelowMarketPenalty: z.number().negative(),
  /** Answering a raise request (#356) — accepting lifts, refusing costs. */
  raiseAcceptedBonus: z.number().positive(),
  raiseRefusedPenalty: z.number().negative(),
  moraleMultiplierMin: z.number().min(0),
  moraleMultiplierMax: z.number().min(0),
});

export type StaffMoraleConfig = z.infer<typeof StaffMoraleConfigSchema>;

export function loadStaffMoraleConfig(): StaffMoraleConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffMorale: unknown }).staffMorale;
  return parseData(raw, StaffMoraleConfigSchema, 'data/tunables.json#staffMorale');
}

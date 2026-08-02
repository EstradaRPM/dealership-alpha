import { z } from 'zod';
import { parseData } from '../data';

// Skill-gated condition-read tunables (#163). The pure read math lives in
// conditionRead.ts; these knobs are the only magic numbers.
//
// - min/maxHalfWidthFraction: band half-width as a fraction of estimate at
//   max/min skill. High skill (1.0) → ±minHalfWidth × estimate; low skill (0)
//   → ±maxHalfWidth × estimate. Lerped by `confidence^widthSkillExponent` so
//   the band tightens faster as skill approaches the cap.
// - maxBiasFraction: at zero skill, the band center can be off realized by
//   up to ±maxBiasFraction × estimate. Lerps linearly to 0 at max skill.
const ConditionReadConfigSchema = z
  .object({
    minHalfWidthFraction: z.number().nonnegative(),
    maxHalfWidthFraction: z.number().nonnegative(),
    maxBiasFraction: z.number().nonnegative(),
    widthSkillExponent: z.number().positive(),
  })
  .strict();

const StaffOrgConfigSchema = z.object({
  hiringCostByTier: z.record(z.string().min(1), z.number().nonnegative()),
  candidatesPerRole: z.number().int().positive(),
  // dealership-tier (1/2/3) → max total roster headcount
  headcountCapByTier: z.record(z.string().min(1), z.number().int().nonnegative()),
  conditionRead: ConditionReadConfigSchema,
});

export type ConditionReadConfig = z.infer<typeof ConditionReadConfigSchema>;

export type StaffOrgConfig = z.infer<typeof StaffOrgConfigSchema>;

export function loadStaffOrgConfig(): StaffOrgConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffOrg: unknown }).staffOrg;
  return parseData(raw, StaffOrgConfigSchema, 'data/tunables.json#staffOrg');
}

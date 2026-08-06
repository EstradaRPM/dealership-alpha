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
  candidatesPerRole: z.number().int().positive(),
  // The hire fee is NOT here. #355 replaced the flat `hiringCostByTier`
  // (worker 500 / customer-facing 1000 / manager 2500 / gm 5000) with
  // `hireFeeMultiple × the candidate's daily wage`, read from
  // `data/staff-pay.json` — one number prices both signing them and keeping
  // them, so a grade-5 can never sign for what a greenpea signs for. The old
  // key is gone from the JSON and the schema both.
  // The headcount ceiling is NOT here. #352 replaced the flat
  // `headcountCapByTier` with the per-role slot table in
  // `data/staff-slots.json` (see `staffSlots.ts`); the cap is the sum of the
  // tier's role slots. Two caps that can disagree is a bug waiting, so the old
  // key is gone from the JSON and the schema both.
  conditionRead: ConditionReadConfigSchema,
});

export type ConditionReadConfig = z.infer<typeof ConditionReadConfigSchema>;

export type StaffOrgConfig = z.infer<typeof StaffOrgConfigSchema>;

export function loadStaffOrgConfig(): StaffOrgConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { staffOrg: unknown }).staffOrg;
  return parseData(raw, StaffOrgConfigSchema, 'data/tunables.json#staffOrg');
}

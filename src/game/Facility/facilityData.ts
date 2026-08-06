import { z } from 'zod';
import { parseData } from '../data';
import type { FacilityCapacity } from './types';

/**
 * The per-tier **ceiling** table for physical capacity (#358, A2 R1).
 *
 * These were per-tier constants until this slice: `serviceDispatch.baysByTier`
 * and `bodyShopDispatch.baysByTier` in `data/tunables.json`, read straight off
 * the facility tier, plus a lot size that was not modelled at all. They are now
 * the *most* a tier lets you build; what is actually standing is owned state on
 * the `Facility` module.
 *
 * Counts are the tier CSV's own numbers — lot 6/12/35/75/120 (the CSV's lot-size
 * row) and the two bay rows the retired tunables carried — which is tier truth
 * per the progression canon.
 *
 * Two things the source does not say, resolved here the same way the staff slot
 * table resolves them (`StaffOrg/staffSlots.ts`):
 *
 * - **The table is monotonic**, and `FacilityCeilingSchema` refuses a file that
 *   decreases. A tier never takes capacity away; you arrive at a new tier
 *   holding what you built at the last one.
 * - **A row states all seven tiers.** Where the source stops (service bays at
 *   T3, lot spaces and body bays at T5) the last value repeats rather than
 *   falling to zero — a missing tier key would read as "no capacity", which
 *   silently shuts a whole department instead of failing loudly. Those repeated
 *   tail values are placeholders pending calibration (C2, #286), not design.
 */
export type FacilityCeilingTable = z.infer<typeof FacilityCeilingSchema>;

/** The tier ladder is T1–T7 (issue #1's product definition). */
const TIER_IDS = ['1', '2', '3', '4', '5', '6', '7'] as const;

export const MAX_TIER = TIER_IDS.length;

const TierRowSchema = z
  .object({
    '1': z.number().int().nonnegative(),
    '2': z.number().int().nonnegative(),
    '3': z.number().int().nonnegative(),
    '4': z.number().int().nonnegative(),
    '5': z.number().int().nonnegative(),
    '6': z.number().int().nonnegative(),
    '7': z.number().int().nonnegative(),
  })
  .strict();

export const FacilityCeilingSchema = z
  .object({
    lotSpaces: TierRowSchema,
    serviceBays: TierRowSchema,
    bodyBays: TierRowSchema,
  })
  .strict()
  .superRefine((table, ctx) => {
    for (const [kind, row] of Object.entries(table)) {
      for (let i = 1; i < TIER_IDS.length; i++) {
        const prev = row[TIER_IDS[i - 1]];
        const next = row[TIER_IDS[i]];
        if (next < prev) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [kind, TIER_IDS[i]],
            message: `Facility ceilings are monotonic: "${kind}" drops from ${prev} at tier ${TIER_IDS[i - 1]} to ${next} at tier ${TIER_IDS[i]}. A tier never takes capacity away.`,
          });
        }
      }
    }
  });

export function loadFacilityCeilings(): FacilityCeilingTable {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../../data/facility.json') as unknown;
  return parseData(raw, FacilityCeilingSchema, 'data/facility.json');
}

/**
 * The ceiling on every capacity kind at `tier`. Tier is clamped into the ladder
 * rather than read straight, so an out-of-range tier can never resolve to "no
 * capacity" — that failure mode reads as a balance decision instead of a bug.
 */
export function ceilingsAtTier(
  table: FacilityCeilingTable,
  tier: number,
): FacilityCapacity {
  const key = String(
    Math.max(1, Math.min(Math.trunc(tier), MAX_TIER)),
  ) as (typeof TIER_IDS)[number];
  return {
    lotSpaces: table.lotSpaces[key],
    serviceBays: table.serviceBays[key],
    bodyBays: table.bodyBays[key],
  };
}

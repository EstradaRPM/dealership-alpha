import { z } from 'zod';
import { parseData } from '../data';
import {
  FACILITY_CAPACITY_KINDS,
  type FacilityBuildSpec,
  type FacilityCapacity,
  type FacilityCapacityKind,
} from './types';

/**
 * The Facility module's catalog: the per-tier **ceiling** on physical capacity
 * (#358, A2 R1) and what it costs to build into that ceiling (#359).
 *
 * The ceilings were per-tier constants until #358: `serviceDispatch.baysByTier`
 * and `bodyShopDispatch.baysByTier` in `data/tunables.json`, read straight off
 * the facility tier, plus a lot size that was not modelled at all. They are now
 * the *most* a tier lets you build; what is actually standing is owned state on
 * the `Facility` module, and the gap between the two is bought.
 *
 * Counts are the tier CSV's own numbers — lot 6/12/35/75/120 (the CSV's lot-size
 * row) and the two bay rows the retired tunables carried — which is tier truth
 * per the progression canon.
 *
 * Two things the source does not say, resolved here the same way the staff slot
 * table resolves them (`StaffOrg/staffSlots.ts`):
 *
 * - **The table is monotonic**, and `FacilityDataSchema` refuses a file that
 *   decreases. A tier never takes capacity away; you arrive at a new tier
 *   holding what you built at the last one.
 * - **A row states all seven tiers.** Where the source stops (service bays at
 *   T3, lot spaces and body bays at T5) the last value repeats rather than
 *   falling to zero — a missing tier key would read as "no capacity", which
 *   silently shuts a whole department instead of failing loudly. Those repeated
 *   tail values are placeholders pending calibration (C2, #286), not design.
 */
export type FacilityDataTable = z.infer<typeof FacilityDataSchema>;

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

/**
 * What one construction job buys, per capacity kind (#359, A2 R1).
 *
 * Flat across the ladder on purpose — a service bay costs what a service bay
 * costs. A per-tier price table would be a second number to read beside the
 * ceiling table, and would make the same purchase mean two different decisions
 * depending on where the player was standing.
 *
 * `days` is what makes this a decision rather than a checkbook: instant capacity
 * collapses it to "do I have the cash", while a build delay makes you buy
 * capacity *ahead* of demand — the actual dealership decision. Same idiom as the
 * #295 frontline hold. Costs and days are placeholders pending calibration
 * (C2, #286), not design.
 */
const BuildSpecSchema = z
  .object({
    /** Units per job. Clamped down to the room left under the ceiling. */
    blockSize: z.number().int().positive(),
    unitCost: z.number().int().positive(),
    days: z.number().int().positive(),
  })
  .strict();

export const FacilityDataSchema = z
  .object({
    lotSpaces: TierRowSchema,
    serviceBays: TierRowSchema,
    bodyBays: TierRowSchema,
    construction: z
      .object({
        lotSpaces: BuildSpecSchema,
        serviceBays: BuildSpecSchema,
        bodyBays: BuildSpecSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((table, ctx) => {
    for (const kind of FACILITY_CAPACITY_KINDS) {
      const row = table[kind];
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

export function loadFacilityData(): FacilityDataTable {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../../data/facility.json') as unknown;
  return parseData(raw, FacilityDataSchema, 'data/facility.json');
}

/**
 * The ceiling on every capacity kind at `tier`. Tier is clamped into the ladder
 * rather than read straight, so an out-of-range tier can never resolve to "no
 * capacity" — that failure mode reads as a balance decision instead of a bug.
 */
export function ceilingsAtTier(
  table: FacilityDataTable,
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

/** What one job of `kind` buys and costs. */
export function buildSpecFor(
  table: FacilityDataTable,
  kind: FacilityCapacityKind,
): FacilityBuildSpec {
  return table.construction[kind];
}

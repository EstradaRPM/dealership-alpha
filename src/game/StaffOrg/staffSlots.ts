import { z } from 'zod';
import { parseData } from '../data';

/**
 * The per-role, per-tier **slot table** (#352, A2 R1 + C1 R3).
 *
 * A slot is a desk the store has room for. Tier-up hands you the desks
 * outright — empty and waiting — and the count is what stops the player buying
 * five A-players: they do not have five slots. This replaced the flat
 * `staffOrg.headcountCapByTier` ({1:4, 2:8, 3:16}), which let a Tier-1 gravel
 * yard field four salespeople.
 *
 * Counts come from the tier CSV's "Staff" row
 * (`docs/planning/Gameplay Loops and Dealership progression tiers.csv`), which
 * is tier truth per the progression canon.
 *
 * Two things the CSV does not say, resolved here:
 *
 * - **The table is monotonic.** The CSV stops repeating `f&i-manager` at T4/T5;
 *   that is an omission in the source, not a removal. A tier never takes away a
 *   desk the previous tier opened, and `StaffSlotTableSchema` refuses a file
 *   that decreases.
 * - **Promotion-only roles get rows too.** `lot-porter` and `technician` are
 *   worker-tier — reached by promotion, never hired cold (`src/app/config.ts`
 *   filters them out of the hiring surface), so their slots gate *promotion*.
 *   Each mirrors the role it promotes into: the bench that feeds a desk is as
 *   wide as the desk it feeds. `technician` is therefore 0 at T1, where no
 *   service department exists yet.
 *
 * Roles that do not exist in the game yet (`new-car-manager` at T4,
 * `bdc-manager` at T5) carry their CSV rows unused, so the tier that builds
 * them changes data rather than code. The CSV's single "Bodyshop & Service
 * Manager" is two roles in `data/staff-roles.json` today; both carry a row
 * because a role the hiring surface offers must never hold 0 slots at that tier
 * (that is the A1 regression class — engine-hireable, UI-invisible — inverted).
 * Which of the two survives is the still-open fixed-ops fork at phase 15.
 */
export type StaffSlotTable = z.infer<typeof StaffSlotTableSchema>;

/**
 * The tier ladder is T1–T7 (issue #1's product definition), so a slot row
 * states all seven explicitly — a missing tier key would silently read as "no
 * slots", which makes every role unhireable rather than failing loudly.
 */
const TIER_IDS = ['1', '2', '3', '4', '5', '6', '7'] as const;

export const MAX_TIER = TIER_IDS.length;

const SlotRowSchema = z
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

export const StaffSlotTableSchema = z
  .record(z.string().min(1), SlotRowSchema)
  .superRefine((table, ctx) => {
    for (const [roleId, row] of Object.entries(table)) {
      for (let i = 1; i < TIER_IDS.length; i++) {
        const prev = row[TIER_IDS[i - 1]];
        const next = row[TIER_IDS[i]];
        if (next < prev) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [roleId, TIER_IDS[i]],
            message: `Slot counts are monotonic: "${roleId}" drops from ${prev} at tier ${TIER_IDS[i - 1]} to ${next} at tier ${TIER_IDS[i]}. A tier never takes away a desk.`,
          });
        }
      }
    }
  });

export function loadStaffSlots(): StaffSlotTable {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../../data/staff-slots.json') as unknown;
  return parseData(raw, StaffSlotTableSchema, 'data/staff-slots.json');
}

/**
 * How many desks the store has for `roleId` at `tier`. Tier is clamped into the
 * ladder rather than read straight, so an out-of-range tier can never resolve
 * to "0 slots" — that failure mode locks the player out of hiring entirely and
 * looks like a balance decision instead of a bug.
 */
export function slotTotalFor(
  table: StaffSlotTable,
  roleId: string,
  tier: number,
): number | undefined {
  const row = table[roleId];
  if (!row) return undefined;
  const clamped = Math.max(1, Math.min(Math.trunc(tier), MAX_TIER));
  return row[String(clamped) as (typeof TIER_IDS)[number]];
}

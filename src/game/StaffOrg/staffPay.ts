import { z } from 'zod';
import { parseData } from '../data';

/**
 * The **salary book** (#353, C1 R1): what one person costs per day, as a
 * function of the two things the player can already see — their **grade**
 * (1–5) and their **role**. That is the entire pay model. Draw-against-
 * commission was considered and rejected at the C1 gate (four comp structures
 * to learn one line item); see `docs/planning/staff-teeth-design.md` §2 R1.
 *
 * It replaced `economy.tier1.weeklyPayrollStub` — a flat $800/week that made
 * your fifth hire cost nothing. The wage is charged **daily**, whether the
 * floor produced or not, so a fixed cost sits against variable revenue in the
 * same beat the player reads the day's gross.
 *
 * Three fields:
 *
 * - `gradeBands` — the four lower edges that split the 0–1 ability ratio into
 *   grades 1–5. Four edges, five grades; see `gradeFor`.
 * - `hireFeeMultiple` — how many days of wage the one-time signing fee costs
 *   (#355). Carried here rather than in `staffOrg.hiringCostByTier` — now
 *   **deleted** — because a grade-5 must cost more to sign *and* more to keep
 *   from one number, and a second price table drifts from this one.
 * - `raiseCooldownDays` — how long a refused member waits before asking again
 *   (#356). In the pay book because it is a term of the wage negotiation, not a
 *   morale constant: what it delays is the next *ask*, and the ask is priced
 *   entirely off `dailyWageByRole` + `gradeBands` above.
 * - `rivalOffers` — the poaching half of the same negotiation (#357): how often
 *   a rival comes for someone, what they offer, and how long the player has.
 * - `dailyWageByRole` — role → wage at each grade.
 *
 * Roles that do not exist in the game yet (`new-car-manager` at T4,
 * `bdc-manager` at T5) carry rows so the tier that builds them changes data
 * rather than code — the same stance `staffSlots.ts` takes.
 *
 * **Magnitudes are placeholders anchored to the performance ladder's
 * units/PVR bands** (`docs/planning/staff-performance-ladder.md`), not balance.
 * Real calibration is the C2 campaign (#286); tuning them before the drain was
 * real would have been tuning a different game. The salesperson row is the
 * design doc's own worked example — grade 3 = $340/day, grade 4 = $520/day.
 */
export type StaffPayTable = z.infer<typeof StaffPayTableSchema>;

/**
 * The ladder ships under the word **grade**, never "tier" — dealership tiers
 * own that word (locked, `staff-performance-ladder.md:24`).
 */
export const MIN_GRADE = 1;
export const MAX_GRADE = 5;

const GRADE_IDS = ['1', '2', '3', '4', '5'] as const;

/**
 * A role's wage at each of the five grades. All five are stated explicitly: a
 * missing grade key would read as `undefined` and surface as a wage of NaN in
 * the ledger, so it has to fail at load.
 */
const WageRowSchema = z
  .object({
    '1': z.number().positive(),
    '2': z.number().positive(),
    '3': z.number().positive(),
    '4': z.number().positive(),
    '5': z.number().positive(),
  })
  .strict();

/**
 * The rival-offer terms (#357, C1 R2's closing paragraph). Poaching is not a
 * second mechanic — it is the raise prompt with a name and a deadline on it —
 * so its three numbers live in the pay book beside the wages they are quoted
 * against.
 */
const RivalOfferSchema = z
  .object({
    /**
     * The chance per day that a **grade-5** member is approached. Scaled
     * linearly by grade (`chance × grade / 5`), so rivals come for the people
     * worth having and come for them more often the better they are. One
     * number rather than a chance plus a "who is poachable" floor: a floor is a
     * second rule the player would have to infer from an absence.
     */
    dailyChanceAtTopGrade: z.number().min(0).max(1),
    /**
     * What the rival offers, as a multiple of what someone at that grade asks
     * for. **At least 1** by schema: a rival offering less than the person's
     * own asking wage is not a poach, and would render as a prompt whose
     * "Match" button is cheaper than doing nothing.
     */
    wagePremium: z.number().min(1),
    /**
     * How many days the player has. The offer arrives on day D and, unanswered,
     * takes them on the morning of `D + deadlineDays` — so at least one whole
     * day to decide, enforced here rather than left to a 0 that would make the
     * prompt and the departure the same beat.
     */
    deadlineDays: z.number().int().positive(),
  })
  .strict();

export const StaffPayTableSchema = z
  .object({
    gradeBands: z.array(z.number().min(0).max(1)).length(GRADE_IDS.length - 1),
    hireFeeMultiple: z.number().positive(),
    // Whole days, and at least one: a zero-day cooldown lets a refused member
    // ask again the next morning, which turns a decision into a nag.
    raiseCooldownDays: z.number().int().positive(),
    rivalOffers: RivalOfferSchema,
    dailyWageByRole: z.record(z.string().min(1), WageRowSchema),
  })
  .strict()
  .superRefine((table, ctx) => {
    for (let i = 1; i < table.gradeBands.length; i++) {
      if (table.gradeBands[i] <= table.gradeBands[i - 1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gradeBands', i],
          message: `Grade bands must strictly increase: edge ${i} (${table.gradeBands[i]}) is not above edge ${i - 1} (${table.gradeBands[i - 1]}). Overlapping edges make a grade unreachable.`,
        });
      }
    }
    // A better person never costs less. Without this a transposed digit
    // produces a table where the cheap hire is the strong one, which reads as
    // a balance decision instead of a typo.
    for (const [roleId, row] of Object.entries(table.dailyWageByRole)) {
      for (let i = 1; i < GRADE_IDS.length; i++) {
        const prev = row[GRADE_IDS[i - 1]];
        const next = row[GRADE_IDS[i]];
        if (next < prev) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dailyWageByRole', roleId, GRADE_IDS[i]],
            message: `Wages rise with grade: "${roleId}" drops from ${prev} at grade ${GRADE_IDS[i - 1]} to ${next} at grade ${GRADE_IDS[i]}.`,
          });
        }
      }
    }
  });

export function loadStaffPay(): StaffPayTable {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../../data/staff-pay.json') as unknown;
  return parseData(raw, StaffPayTableSchema, 'data/staff-pay.json');
}

/**
 * The grade a `ratio` falls in — a banded read of ability, **derived, never
 * stored as a second source of truth** (C1 internal call 1).
 *
 * `ratio` is the 0–1 `effectiveness` composite expressed as a fraction of the
 * ceiling that person's own skill set can reach. The unit scale is what makes
 * the bands mean the same thing in every role: the raw composite is a weighted
 * *sum* whose range depends on how many axes the role grants (1.5 for a
 * three-axis salesperson, 3.7 for a six-axis used-car manager), so absolute
 * edges against it would make every manager a grade 5 and cap every
 * salesperson. The wage table already carries the role dimension; grade answers
 * only "how close is this person to as good as they get at *their* job".
 *
 * The shipped edges put the performance ladder's own anchors where the ladder
 * says they belong: its green profile (0.35) reads as grade 2 and its mature
 * reference (0.75) as grade 4 (`staff-performance-ladder.md:27`).
 */
export function gradeFor(ratio: number, bands: readonly number[]): number {
  let grade = MIN_GRADE;
  for (const edge of bands) {
    if (ratio >= edge) grade += 1;
  }
  return grade;
}

/**
 * What `roleId` costs per day at `grade`. `undefined` for a role the pay book
 * does not name — the caller turns that into a loud throw, same as an unknown
 * role in the slot table. Grade is clamped into the ladder rather than read
 * straight, so an out-of-range grade can never resolve to a missing wage.
 */
export function dailyWageFor(
  table: StaffPayTable,
  roleId: string,
  grade: number,
): number | undefined {
  const row = table.dailyWageByRole[roleId];
  if (!row) return undefined;
  const clamped = Math.max(MIN_GRADE, Math.min(Math.trunc(grade), MAX_GRADE));
  return row[String(clamped) as (typeof GRADE_IDS)[number]];
}

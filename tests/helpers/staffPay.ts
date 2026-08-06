import { loadStaffTaxonomy } from '../../src/game/NPC';
import type { StaffPayTable } from '../../src/game/StaffOrg';

const taxonomy = loadStaffTaxonomy();

/** The shipped band edges, so a helper table still grades people realistically. */
const BANDS = [0.32, 0.46, 0.6, 0.76];

/**
 * A pay book (#353) paying `dailyWage` for every role at every grade.
 *
 * Same reasoning as `slotsEverywhere`: a test that is not *about* wages should
 * not go red the next time someone tunes `data/staff-pay.json`, and a flat wage
 * makes "payroll = headcount × wage" arithmetic the assertion can state
 * directly. Tests that ARE about the wage curve state their own table inline.
 */
/**
 * Rival offers **off** (#357). Same reasoning as the flat wage: a suite that is
 * not about poaching should not have someone walk out of it on day 40 because
 * `data/staff-pay.json` was tuned. A zero daily chance is the honest "no rival
 * came" rather than a special-cased disable flag; the suites that ARE about
 * poaching pass their own terms (`POACHING` below).
 */
const NO_POACHING = { dailyChanceAtTopGrade: 0, wagePremium: 1.2, deadlineDays: 3 };

/**
 * Rival offers **certain for a grade-5 member** — the chance is scaled by
 * `grade / 5`, so a top-grade roster is approached the first morning. A test
 * about what an offer *does* should not also be a test of whether one fired;
 * the seeded frequency has its own test.
 */
export const POACHING = { dailyChanceAtTopGrade: 1, wagePremium: 1.2, deadlineDays: 3 };

export function flatPay(dailyWage: number): StaffPayTable {
  return {
    gradeBands: BANDS,
    hireFeeMultiple: 5,
    raiseCooldownDays: 7,
    rivalOffers: NO_POACHING,
    dailyWageByRole: Object.fromEntries(
      Object.keys(taxonomy.roles).map((roleId) => [
        roleId,
        { '1': dailyWage, '2': dailyWage, '3': dailyWage, '4': dailyWage, '5': dailyWage },
      ]),
    ),
  };
}

/**
 * A pay book that charges nothing — the wage equivalent of `NO_OVERHEAD`. For
 * suites that hire staff to exercise something else entirely (dispatch,
 * morale, the sales floor) and assert cash balances that predate the drain.
 */
export function noPay(): StaffPayTable {
  return flatPay(0);
}

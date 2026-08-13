import { z } from 'zod';
import { parseData } from '../data';

/**
 * The facility's catalog (#392). Two numbers: what money costs and the
 * lender's day-count convention. Both live in `data/credit-facility.json` so a
 * retune of the price of money touches no code.
 */
export const CreditFacilityDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string(),
    _stepsDoc: z.string(),
    /**
     * The rungs a draw or a repayment is offered at, as fractions of the
     * store's limit (#393). Ascending and ending at the whole line, so the
     * coarsest offer is always "all of it" and no rung can be quietly larger
     * than the ceiling it is a fraction of.
     */
    drawFractions: z.array(z.number().positive().max(1)).nonempty(),
    /** Annual rate as a decimal. Unsecured, so dearer than the floorplan. */
    apr: z.number().nonnegative(),
    /**
     * The lender's day count. Positive by schema — a zero here would make the
     * daily rate infinite, and a file that divides by nothing should be
     * refused at load rather than discovered as a NaN on the ledger.
     */
    daysPerYear: z.number().int().positive(),
  })
  .strict()
  .refine(
    (d) => d.drawFractions.every((f, i) => i === 0 || f > d.drawFractions[i - 1]),
    { message: 'drawFractions must ascend' },
  )
  .refine((d) => d.drawFractions[d.drawFractions.length - 1] === 1, {
    message: 'the last drawFraction must be the whole line',
  });

export type CreditFacilityDataTable = z.infer<typeof CreditFacilityDataSchema>;

export function loadCreditFacilityData(): CreditFacilityDataTable {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../../data/credit-facility.json') as unknown;
  return parseData(raw, CreditFacilityDataSchema, 'data/credit-facility.json');
}

/**
 * A day's interest on a standing balance, in whole dollars — the ONE rule, in
 * one pure function so the posted charge and the number a surface previews
 * cannot be computed two ways.
 *
 * Rounded like every other money figure in the engine (`computeDailyCarryingCost`
 * is the precedent). A balance small enough to round to nothing costs nothing:
 * a $0 ledger line is noise, not a charge.
 */
export function dailyInterestOn(
  drawn: number,
  data: CreditFacilityDataTable,
): number {
  if (drawn <= 0) return 0;
  return Math.round((drawn * data.apr) / data.daysPerYear);
}

/**
 * The whole-dollar amounts this store's facility is drawn and repaid in (#393)
 * — the catalog's fractions resolved against its own limit, ascending.
 *
 * Resolved in the engine rather than on the screen for the same reason
 * `maxRepayment` is: a surface that multiplied the limit by a fraction would be
 * a second place that decides how coarse borrowing is, and the two would drift
 * the first time the catalog moved. Duplicates collapse (a small line can round
 * two fractions to the same dollar) and a zero rung is dropped — an amount that
 * would be refused `invalid-amount` is not an offer.
 */
export function drawStepsFor(
  limit: number,
  data: CreditFacilityDataTable,
): readonly number[] {
  const amounts = data.drawFractions.map((f) => Math.round(limit * f));
  return [...new Set(amounts)].filter((a) => a > 0).sort((a, b) => a - b);
}

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
    /** Annual rate as a decimal. Unsecured, so dearer than the floorplan. */
    apr: z.number().nonnegative(),
    /**
     * The lender's day count. Positive by schema — a zero here would make the
     * daily rate infinite, and a file that divides by nothing should be
     * refused at load rather than discovered as a NaN on the ledger.
     */
    daysPerYear: z.number().int().positive(),
  })
  .strict();

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

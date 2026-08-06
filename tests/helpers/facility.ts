import { createEventBus } from '../../src/game/EventBus';
import {
  createFacility,
  type Facility,
  type FacilityDataTable,
} from '../../src/game/Facility';

/**
 * A `Facility` for suites that only ever READ capacity — the department
 * dispatch tests, which take the module purely as the one bay truth.
 *
 * It gets a private bus (so no construction can land under it), a spender with
 * no money (so a stray purchase would refuse rather than quietly succeed) and a
 * fixed day. Anything exercising construction itself should build its own deps.
 */
export function readOnlyFacility(
  getTier: () => number,
  data?: FacilityDataTable,
): Facility {
  return createFacility({
    bus: createEventBus(),
    getTier,
    economy: { cash: 0, postExpense: () => {} },
    getCurrentDay: () => 1,
    ...(data ? { data } : {}),
  });
}

import { loadStaffTaxonomy } from '../../src/game/NPC';
import type { StaffSlotTable } from '../../src/game/StaffOrg';

const taxonomy = loadStaffTaxonomy();

/**
 * A slot table (#352) with `count` desks for every role at every tier.
 *
 * Tests that are not *about* scarcity say so with this: a hire, promotion or
 * dispatch test that inherits the shipped `data/staff-slots.json` goes red the
 * next time someone tunes a tier's headcount, which teaches the wrong lesson
 * about what broke. Tests that ARE about scarcity state their own table inline
 * so the assertion reads against numbers you can see.
 */
export function slotsEverywhere(count: number): StaffSlotTable {
  return Object.fromEntries(
    Object.keys(taxonomy.roles).map((roleId) => [
      roleId,
      { '1': count, '2': count, '3': count, '4': count, '5': count, '6': count, '7': count },
    ]),
  );
}

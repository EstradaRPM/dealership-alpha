import {
  loadStaffSlots,
  slotTotalFor,
  StaffSlotTableSchema,
  MAX_TIER,
} from '../src/game/StaffOrg';
import { loadStaffTaxonomy } from '../src/game/NPC';
import { buildHiringRoleOptions } from '../src/app/config';

// #352 — the per-role slot table is staff-teeth's scarcity cap (C1 R3) and the
// thing tier-up hands you outright (A2 R1). Counts come from the tier CSV's
// "Staff" row; these tests lock the properties that make the file safe to tune.

const TIERS = Array.from({ length: MAX_TIER }, (_, i) => i + 1);
const table = loadStaffSlots();
const taxonomy = loadStaffTaxonomy();

describe('data/staff-slots.json', () => {
  it('loads a slot count for every hireable role at every tier', () => {
    for (const roleId of Object.keys(taxonomy.roles)) {
      for (const tier of TIERS) {
        const total = slotTotalFor(table, roleId, tier);
        expect(total).toBeDefined();
        expect(Number.isInteger(total)).toBe(true);
        expect(total).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('slot counts never decrease as tier rises', () => {
    // The CSV stops repeating `f&i-manager` at T4/T5 — an omission in the
    // source, not a removal. A tier never takes away a desk it opened.
    for (const roleId of Object.keys(table)) {
      for (let tier = 2; tier <= MAX_TIER; tier++) {
        expect(slotTotalFor(table, roleId, tier)).toBeGreaterThanOrEqual(
          slotTotalFor(table, roleId, tier - 1)!,
        );
      }
    }
  });

  it('refuses a file whose slot count drops at a higher tier', () => {
    const decreasing = {
      salesperson: { '1': 3, '2': 3, '3': 2, '4': 2, '5': 2, '6': 2, '7': 2 },
    };
    expect(StaffSlotTableSchema.safeParse(decreasing).success).toBe(false);
  });

  it('refuses a role row missing a tier', () => {
    // A missing tier key would read as "no slots", which locks the player out
    // of hiring that role and looks like balance rather than a broken file.
    const short = { salesperson: { '1': 1, '2': 2, '3': 3 } };
    expect(StaffSlotTableSchema.safeParse(short).success).toBe(false);
  });

  it('opens at least one desk for every role the hiring surface offers', () => {
    // The A1 regression class inverted: a job the UI advertises and the engine
    // has no room for would throw the moment the player pressed Hire.
    for (const tier of TIERS) {
      for (const option of buildHiringRoleOptions(tier)) {
        expect(slotTotalFor(table, option.id, tier)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('opens no desk before the role can be hired', () => {
    // A desk with nobody eligible to sit at it is a slot board row the player
    // can do nothing about.
    for (const roleId of Object.keys(taxonomy.roles)) {
      const hireTier = taxonomy.roles[roleId].hireTier;
      if (hireTier === undefined) continue;
      for (let tier = 1; tier < hireTier; tier++) {
        expect(slotTotalFor(table, roleId, tier)).toBe(0);
      }
    }
  });

  it('carries the CSV tier ladder for the sales floor', () => {
    // Row "Staff": 1 → 2 → 3 → 6 → 10 salespeople, flat through T6/T7 (the
    // upper tiers are "fully staffed store from the previous tier" + a GM).
    expect(TIERS.map((t) => slotTotalFor(table, 'salesperson', t))).toEqual([
      1, 2, 3, 6, 10, 10, 10,
    ]);
    // T3 opens the UCM, the F&I manager and the body-shop advisor.
    expect(slotTotalFor(table, 'used-car-manager', 3)).toBe(1);
    expect(slotTotalFor(table, 'f&i-manager', 3)).toBe(1);
    expect(slotTotalFor(table, 'body-shop-advisor', 3)).toBe(1);
    // ...and T4 doubles the two advisor desks.
    expect(slotTotalFor(table, 'service-advisor', 4)).toBe(2);
    expect(slotTotalFor(table, 'body-shop-advisor', 4)).toBe(2);
  });

  it('clamps a tier outside the ladder instead of reading as no slots', () => {
    expect(slotTotalFor(table, 'salesperson', 0)).toBe(
      slotTotalFor(table, 'salesperson', 1),
    );
    expect(slotTotalFor(table, 'salesperson', MAX_TIER + 3)).toBe(
      slotTotalFor(table, 'salesperson', MAX_TIER),
    );
  });

  it('has no slot row for a role that does not exist', () => {
    expect(slotTotalFor(table, 'chief-vibes-officer', 1)).toBeUndefined();
  });
});

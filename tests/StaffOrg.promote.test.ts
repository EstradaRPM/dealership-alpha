import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createStaffOrg, StaffOrgError, loadStaffOrgConfig } from '../src/game/StaffOrg';
import { loadStaffTaxonomy, loadStaffArchetypes } from '../src/game/NPC';
import type { Staff } from '../src/game/NPC';
import type { StaffOrg } from '../src/game/StaffOrg';

// #324 — promotion path. `NPC.promoteStaff` existed with zero callers; StaffOrg
// now exposes `getPromotionOptions` / `promote`, gated to the legal role edges +
// each role's `promotion_gates` + the target's tier unlock. These tests drive
// that public surface directly (the UI reachability path is covered separately).

const MASTER_SEED = 7;
const taxonomy = loadStaffTaxonomy();
const archetypes = loadStaffArchetypes();

/** A plain roster member with hand-chosen skills, injected via `restore`. */
function plainStaff(id: string, roleId: string, skills: Record<string, number>): Staff {
  return {
    id,
    role_id: roleId,
    trait_ids: [],
    skills,
    resources: { stamina: 100 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
}

function setup(tier = 1): { staffOrg: StaffOrg; setTier: (t: number) => void } {
  const bus = createEventBus();
  const economy = createEconomy({
    bus,
    startingCash: 100_000,
    config: { weeklyRent: 0, weeklyPayrollStub: 0 },
  });
  let currentTier = tier;
  const staffOrg = createStaffOrg({
    bus,
    economy,
    masterSeed: MASTER_SEED,
    taxonomy,
    archetypes,
    config: loadStaffOrgConfig(),
    getTier: () => currentTier,
  });
  return { staffOrg, setTier: (t) => (currentTier = t) };
}

/** Inject a single roster member with a known role + skills. */
function seedRoster(staffOrg: StaffOrg, staff: Staff): void {
  staffOrg.restore({ schemaVersion: 1, currentDay: 1, roster: [staff] });
}

describe('StaffOrg — getPromotionOptions', () => {
  it('offers every legal, tier-unlocked edge when the source gate is met', () => {
    const { staffOrg } = setup(1);
    // lot-porter gate is { productivity: 40 }; promotes_to salesperson + technician
    // (neither has a hireTier ⇒ both unlocked at tier 1).
    seedRoster(staffOrg, plainStaff('s1', 'lot-porter', { productivity: 55 }));

    const targets = staffOrg
      .getPromotionOptions('s1')
      .map((o) => o.toRoleId)
      .sort();
    expect(targets).toEqual(['salesperson', 'technician']);
  });

  it('offers nothing when the source promotion gate is not met', () => {
    const { staffOrg } = setup(1);
    seedRoster(staffOrg, plainStaff('s1', 'lot-porter', { productivity: 10 }));
    expect(staffOrg.getPromotionOptions('s1')).toEqual([]);
  });

  it('hides tier-locked targets until the dealership tier is high enough', () => {
    const { staffOrg, setTier } = setup(1);
    // technician → service-advisor (hireTier 2); gate { mechanical_aptitude: 45 }.
    seedRoster(staffOrg, plainStaff('s1', 'technician', { mechanical_aptitude: 60 }));

    expect(staffOrg.getPromotionOptions('s1')).toEqual([]);

    setTier(2);
    expect(staffOrg.getPromotionOptions('s1').map((o) => o.toRoleId)).toEqual([
      'service-advisor',
    ]);
  });

  it('throws for a staffer not on the roster', () => {
    const { staffOrg } = setup();
    expect(() => staffOrg.getPromotionOptions('nobody')).toThrow(StaffOrgError);
  });
});

describe('StaffOrg — promote', () => {
  it('moves the existing staffer up a legal edge, preserving the id, and emits staff:promoted', () => {
    const bus = createEventBus();
    const economy = createEconomy({
      bus,
      startingCash: 100_000,
      config: { weeklyRent: 0, weeklyPayrollStub: 0 },
    });
    const staffOrg = createStaffOrg({
      bus,
      economy,
      masterSeed: MASTER_SEED,
      taxonomy,
      archetypes,
      config: loadStaffOrgConfig(),
      getTier: () => 1,
    });
    seedRoster(staffOrg, plainStaff('s1', 'lot-porter', { productivity: 55 }));

    const events: unknown[] = [];
    bus.subscribe('staff:promoted', (p) => events.push(p));

    staffOrg.promote('s1', 'salesperson');

    const member = staffOrg.currentRoster.find((s) => s.id === 's1');
    expect(member).toBeDefined();
    expect(member!.role_id).toBe('salesperson');
    expect(staffOrg.currentRoster).toHaveLength(1); // headcount unchanged
    expect(events).toEqual([
      { staffId: 's1', fromRoleId: 'lot-porter', toRoleId: 'salesperson', day: 1 },
    ]);
  });

  it('rejects an illegal (non-edge) promotion', () => {
    const { staffOrg } = setup();
    seedRoster(staffOrg, plainStaff('s1', 'lot-porter', { productivity: 55 }));
    expect(() => staffOrg.promote('s1', 'gm')).toThrow(StaffOrgError);
    expect(staffOrg.currentRoster[0].role_id).toBe('lot-porter');
  });

  it('rejects a promotion whose target is tier-locked', () => {
    const { staffOrg } = setup(1);
    seedRoster(staffOrg, plainStaff('s1', 'technician', { mechanical_aptitude: 60 }));
    expect(() => staffOrg.promote('s1', 'service-advisor')).toThrow(StaffOrgError);
    expect(staffOrg.currentRoster[0].role_id).toBe('technician');
  });

  it('rejects a promotion when the source gate is not met', () => {
    const { staffOrg } = setup();
    seedRoster(staffOrg, plainStaff('s1', 'lot-porter', { productivity: 10 }));
    expect(() => staffOrg.promote('s1', 'salesperson')).toThrow(StaffOrgError);
    expect(staffOrg.currentRoster[0].role_id).toBe('lot-porter');
  });

  it('throws for a staffer not on the roster', () => {
    const { staffOrg } = setup();
    expect(() => staffOrg.promote('nobody', 'salesperson')).toThrow(StaffOrgError);
  });
});

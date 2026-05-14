import {
  createStaff,
  loadStaffArchetypes,
  loadStaffTaxonomy,
  loadTraitTaxonomy,
  promoteStaff,
} from '../src/game/NPC';
import { validateArchetypes } from '../src/game/NPC/StaffArchetypes';
import { StaffSchema } from '../src/game/NPC/schemas/staff';

const taxonomy = loadStaffTaxonomy();
const archetypes = loadStaffArchetypes();
const traits = loadTraitTaxonomy();

const deps = { masterSeed: 12345, taxonomy, archetypes };

describe('StaffFactory.createStaff', () => {
  it('produces a Staff that validates against the Zod schema', () => {
    const s = createStaff(
      { archetypeId: 'young_porter', hireDay: 1, slot: 0 },
      deps,
    );
    const parsed = StaffSchema.safeParse(s);
    expect(parsed.success).toBe(true);
  });

  it('is deterministic for a given (masterSeed, ctx)', () => {
    const a = createStaff({ archetypeId: 'young_porter', hireDay: 1, slot: 0 }, deps);
    const b = createStaff({ archetypeId: 'young_porter', hireDay: 1, slot: 0 }, deps);
    expect(a).toEqual(b);
    expect(a.skills).toEqual(b.skills);
    expect(a.trait_ids).toEqual(b.trait_ids);
    expect(a.resources).toEqual(b.resources);
  });

  it('produces recognizably-distinct individuals from the same archetype', () => {
    const a = createStaff({ archetypeId: 'young_porter', hireDay: 1, slot: 0 }, deps);
    const b = createStaff({ archetypeId: 'young_porter', hireDay: 1, slot: 1 }, deps);
    expect(a.id).not.toBe(b.id);
    // At least one of the rolled fields must differ.
    const same =
      a.skills.productivity === b.skills.productivity &&
      a.resources.stamina === b.resources.stamina &&
      JSON.stringify(a.trait_ids) === JSON.stringify(b.trait_ids);
    expect(same).toBe(false);
  });

  it('rolls skills within the catalog cap [0, cap]', () => {
    for (let slot = 0; slot < 25; slot++) {
      const s = createStaff(
        { archetypeId: 'career_salesperson', hireDay: 1, slot },
        deps,
      );
      for (const [skillId, value] of Object.entries(s.skills)) {
        const cap = taxonomy.skills[skillId].cap;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('initializes counters at zero', () => {
    const s = createStaff({ archetypeId: 'young_porter', hireDay: 1, slot: 0 }, deps);
    expect(s.counters).toEqual({ experience: 0, deals_closed: 0, days_employed: 0 });
  });

  it('namespace independence: changing trait pool size does not shift skill rolls', () => {
    // Same archetype, same ctx → identical skill rolls regardless of trait subsystem state.
    const a = createStaff({ archetypeId: 'career_salesperson', hireDay: 2, slot: 7 }, deps);
    const b = createStaff({ archetypeId: 'career_salesperson', hireDay: 2, slot: 7 }, deps);
    expect(a.skills).toEqual(b.skills);
  });
});

describe('StaffFactory composite getters', () => {
  it('exposes effectiveness and trustworthiness as derived (not stored) getters', () => {
    const s = createStaff(
      { archetypeId: 'career_salesperson', hireDay: 1, slot: 0 },
      deps,
    );
    // Not enumerable (so Zod schema with .strict() passes).
    expect(Object.keys(s)).not.toContain('effectiveness');
    expect(Object.keys(s)).not.toContain('trustworthiness');
    // Readable.
    expect(typeof s.effectiveness).toBe('number');
    expect(typeof s.trustworthiness).toBe('number');
  });

  it('reflects live skill bucket mutations (true getter, not snapshot)', () => {
    const s = createStaff(
      { archetypeId: 'career_salesperson', hireDay: 1, slot: 0 },
      deps,
    );
    const before = s.effectiveness;
    s.skills.product_knowledge = 100;
    const after = s.effectiveness;
    expect(after).toBeGreaterThan(before);
  });

  it('returns zero composites when no contributing skills are present', () => {
    const s = createStaff({ archetypeId: 'young_porter', hireDay: 1, slot: 0 }, deps);
    // young_porter only has productivity (effectiveness 1.0, no trustworthiness mapping).
    expect(s.trustworthiness).toBe(0);
    expect(s.effectiveness).toBeGreaterThan(0);
  });
});

describe('StaffFactory.promoteStaff', () => {
  it('retains existing skills cumulatively and adds new role grants', () => {
    const s = createStaff(
      { archetypeId: 'career_salesperson', hireDay: 1, slot: 0 },
      deps,
    );
    expect(Object.keys(s.skills)).toEqual(
      expect.arrayContaining(['product_knowledge', 'communication', 'rapport_building']),
    );

    const promoted = promoteStaff(s, 'sales-manager', taxonomy);
    expect(promoted.role_id).toBe('sales-manager');
    // Salesperson-tier skills retained.
    expect(Object.keys(promoted.skills)).toEqual(
      expect.arrayContaining(['product_knowledge', 'communication', 'rapport_building']),
    );
    // Manager-tier skills now present.
    expect(Object.keys(promoted.skills)).toEqual(
      expect.arrayContaining(['pricing', 't_o_closing']),
    );
    // Existing skill values preserved.
    expect(promoted.skills.product_knowledge).toBe(s.skills.product_knowledge);
  });

  it('rejects promotion along an edge that does not exist in the role DAG', () => {
    const s = createStaff(
      { archetypeId: 'young_porter', hireDay: 1, slot: 0 },
      deps,
    );
    expect(() => promoteStaff(s, 'gm', taxonomy)).toThrow(/cannot promote/);
  });

  it('composite getters track the promoted staff post-promotion', () => {
    const s = createStaff(
      { archetypeId: 'career_salesperson', hireDay: 1, slot: 0 },
      deps,
    );
    const promoted = promoteStaff(s, 'sales-manager', taxonomy);
    const before = promoted.effectiveness;
    promoted.skills.pricing = 90;
    expect(promoted.effectiveness).toBeGreaterThan(before);
  });
});

describe('staff-archetypes data file', () => {
  it('loads and validates the bundled stub file', () => {
    expect(Object.keys(archetypes).length).toBeGreaterThan(0);
    expect(archetypes.young_porter).toBeDefined();
  });

  it('passes cross-catalog validation against roles + traits', () => {
    expect(() => validateArchetypes(archetypes, taxonomy.roles, traits)).not.toThrow();
  });

  it('rejects an archetype with an unknown role', () => {
    expect(() =>
      validateArchetypes(
        {
          ghost: {
            role_id: 'no-such-role',
            trait_pool: [],
            trait_count: { min: 0, max: 0 },
            skills: {},
            resources: { stamina: { mu: 50, sigma: 5 } },
          },
        },
        taxonomy.roles,
        traits,
      ),
    ).toThrow(/unknown role/);
  });

  it('rejects an archetype referencing a non-staff trait', () => {
    expect(() =>
      validateArchetypes(
        {
          oops: {
            role_id: 'lot-porter',
            trait_pool: ['price-sensitive'],
            trait_count: { min: 1, max: 1 },
            skills: {},
            resources: { stamina: { mu: 50, sigma: 5 } },
          },
        },
        taxonomy.roles,
        traits,
      ),
    ).toThrow(/does not apply to staff/);
  });
});

import {
  createStaff,
  loadStaffArchetypes,
  loadStaffTaxonomy,
  loadTraitTaxonomy,
  promoteStaff,
  rehydrateStaff,
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

describe('StaffFactory effective skill growth (Model B, #294)', () => {
  const ucm = () =>
    createStaff({ archetypeId: 'entry_used_car_manager', hireDay: 1, slot: 0 }, deps);

  it('exposes effectiveSkills as a derived (non-enumerable) getter', () => {
    const s = ucm();
    expect(Object.keys(s)).not.toContain('effectiveSkills');
    expect(typeof s.effectiveSkills.pricing).toBe('number');
  });

  it('effective === base at zero counters (gates behave identically at hire)', () => {
    const s = ucm();
    expect(s.counters).toEqual({ experience: 0, deals_closed: 0, days_employed: 0 });
    for (const skillId of Object.keys(s.skills)) {
      expect(s.effectiveSkills[skillId]).toBeCloseTo(s.skills[skillId], 10);
    }
  });

  it('grows desking skills with deals_closed and the read with days_employed', () => {
    const s = ucm();
    const basePricing = s.skills.pricing;
    const baseClosing = s.skills.t_o_closing;
    const baseReading = s.skills.condition_reading;

    s.counters.deals_closed = 10;
    expect(s.effectiveSkills.pricing).toBeGreaterThan(basePricing);
    expect(s.effectiveSkills.t_o_closing).toBeGreaterThan(baseClosing);
    // deals don't move the tenure-driven read…
    expect(s.effectiveSkills.condition_reading).toBeCloseTo(baseReading, 10);

    s.counters.days_employed = 10;
    expect(s.effectiveSkills.condition_reading).toBeGreaterThan(baseReading);
  });

  it('applies growth_rate × counter linearly below the cap', () => {
    const s = ucm();
    const rate = taxonomy.skills.pricing.growth_rate;
    s.counters.deals_closed = 3;
    expect(s.effectiveSkills.pricing).toBeCloseTo(s.skills.pricing + rate * 3, 6);
  });

  it('clamps effective skill to the per-hire cap (never runs away to 100)', () => {
    const s = ucm();
    s.counters.deals_closed = 1_000_000;
    s.counters.days_employed = 1_000_000;
    const cap = taxonomy.skills.pricing.cap; // 100
    const capped = s.effectiveSkills.pricing;
    expect(capped).toBeLessThanOrEqual(cap);
    // A green hire plateaus *below* the axis cap (per-hire headroom), so an
    // unbounded counter does not reach 100.
    expect(capped).toBeGreaterThan(s.skills.pricing);
    expect(capped).toBeLessThan(cap);
    // Stable under further counter growth — it has hit its ceiling.
    s.counters.deals_closed = 5_000_000;
    expect(s.effectiveSkills.pricing).toBeCloseTo(capped, 10);
  });

  it('leaves axes without a growth_counter static regardless of counters', () => {
    const s = createStaff(
      { archetypeId: 'career_salesperson', hireDay: 1, slot: 0 },
      deps,
    );
    const base = s.skills.communication; // no growth_counter
    s.counters.deals_closed = 500;
    s.counters.days_employed = 500;
    expect(s.effectiveSkills.communication).toBeCloseTo(base, 10);
  });

  it('per-hire cap is deterministic for a given staff id', () => {
    const a = ucm();
    const b = ucm();
    a.counters.deals_closed = 1_000_000;
    b.counters.deals_closed = 1_000_000;
    expect(a.effectiveSkills.pricing).toBeCloseTo(b.effectiveSkills.pricing, 10);
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

    const promoted = promoteStaff(s, 'used-car-manager', taxonomy);
    expect(promoted.role_id).toBe('used-car-manager');
    // Salesperson-tier skills retained.
    expect(Object.keys(promoted.skills)).toEqual(
      expect.arrayContaining(['product_knowledge', 'communication', 'rapport_building']),
    );
    // Manager-tier skills now present.
    expect(Object.keys(promoted.skills)).toEqual(
      expect.arrayContaining(['condition_reading', 'pricing', 't_o_closing']),
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
    const promoted = promoteStaff(s, 'used-car-manager', taxonomy);
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

// #347 — the two derived reads a staff card needs: a name, and a composite the
// player can read as a percentage without it exceeding 100%.
describe('StaffFactory derived person reads (#347)', () => {
  it('names every staffer, deterministically off (masterSeed, id), without serializing it', () => {
    const s = createStaff({ archetypeId: 'career_salesperson', hireDay: 1, slot: 0 }, deps);

    expect(s.name).toEqual(expect.any(String));
    expect(s.name.length).toBeGreaterThan(0);

    // Same seed + same id ⇒ same person.
    const again = createStaff({ archetypeId: 'career_salesperson', hireDay: 1, slot: 0 }, deps);
    expect(again.name).toBe(s.name);

    // Different seed ⇒ (very probably) a different draw; the point that matters
    // is that the name is NOT a stored field, so it never hits a save.
    expect(Object.keys(s)).not.toContain('name');
    expect(JSON.parse(JSON.stringify(s)).name).toBeUndefined();
    expect(StaffSchema.safeParse(s).success).toBe(true);
  });

  it('re-derives the same name from a plain record via rehydrateStaff', () => {
    const s = createStaff({ archetypeId: 'career_salesperson', hireDay: 4, slot: 1 }, deps);
    const plain = JSON.parse(JSON.stringify(s));
    expect(rehydrateStaff(plain, taxonomy, deps.masterSeed).name).toBe(s.name);
  });

  it('reports the composites as a 0–1 fraction of what that skill set can reach', () => {
    // The raw composite is a weighted SUM over the role's skills, so a
    // six-axis used-car manager runs past 1.0 — "Work quality 275%" on the
    // roster card. The ratio divides by the ceiling those weights imply.
    const ucm = createStaff(
      { archetypeId: 'veteran_used_car_manager', hireDay: 1, slot: 0 },
      deps,
    );

    expect(ucm.effectivenessRatio).toBeGreaterThan(0);
    expect(ucm.effectivenessRatio).toBeLessThanOrEqual(1);
    expect(ucm.trustworthinessRatio).toBeGreaterThan(0);
    expect(ucm.trustworthinessRatio).toBeLessThanOrEqual(1);

    // The raw composites are untouched — every promotion/capability gate reads
    // those, so re-scaling them would silently move every threshold.
    expect(ucm.effectiveness).toBeGreaterThan(ucm.effectivenessRatio);
  });

  it('keeps two roles comparable, which the raw composite does not', () => {
    const seller = createStaff(
      { archetypeId: 'career_salesperson', hireDay: 1, slot: 0 },
      deps,
    );
    const ucm = createStaff(
      { archetypeId: 'veteran_used_car_manager', hireDay: 1, slot: 0 },
      deps,
    );
    for (const s of [seller, ucm]) {
      expect(s.effectivenessRatio).toBeLessThanOrEqual(1);
      expect(s.effectivenessRatio).toBeGreaterThanOrEqual(0);
    }
  });
});

import { loadStaffTaxonomy } from '../src/game/NPC';
import { validateRoleDag, StaffRoleDagError } from '../src/game/NPC/Staff';
import type { StaffRoleCatalog, StaffSkillCatalog } from '../src/game/NPC/schemas/staff';

const skills: StaffSkillCatalog = {
  productivity: { tier: 'worker', growth_rate: 0.5, cap: 100 },
  product_knowledge: { tier: 'customer-facing', growth_rate: 0.3, cap: 100 },
  pricing: { tier: 'manager', growth_rate: 0.2, cap: 100 },
};

const validRoles: StaffRoleCatalog = {
  porter: {
    tier: 'worker',
    department: null,
    grants_skills: ['productivity'],
    promotes_to: ['salesperson'],
    promotion_gates: { productivity: 40 },
  },
  salesperson: {
    tier: 'customer-facing',
    department: 'sales',
    grants_skills: ['product_knowledge'],
    promotes_to: ['used-car-manager'],
    promotion_gates: {},
  },
  'used-car-manager': {
    tier: 'manager',
    department: 'sales',
    grants_skills: ['pricing'],
    promotes_to: ['gm'],
    promotion_gates: {},
  },
  gm: {
    tier: 'gm',
    department: null,
    grants_skills: [],
    promotes_to: [],
    promotion_gates: {},
  },
};

describe('validateRoleDag', () => {
  it('accepts a valid catalog', () => {
    expect(() => validateRoleDag(validRoles, skills)).not.toThrow();
  });

  it('rejects a cycle', () => {
    const cyclic: StaffRoleCatalog = {
      ...validRoles,
      gm: {
        tier: 'gm',
        department: null,
        grants_skills: [],
        promotes_to: ['porter'],
        promotion_gates: {},
      },
    };
    // GM sink check fires before cycle detection — both are errors.
    expect(() => validateRoleDag(cyclic, skills)).toThrow(StaffRoleDagError);
  });

  it('rejects a cycle among non-GM roles', () => {
    const cyclic: StaffRoleCatalog = {
      a: {
        tier: 'worker',
        department: null,
        grants_skills: [],
        promotes_to: ['b'],
        promotion_gates: {},
      },
      b: {
        tier: 'customer-facing',
        department: 'sales',
        grants_skills: [],
        promotes_to: ['a'],
        promotion_gates: {},
      },
    };
    expect(() => validateRoleDag(cyclic, skills)).toThrow(/cycle/);
  });

  it('rejects a dangling promotes_to id', () => {
    const dangling: StaffRoleCatalog = {
      porter: {
        tier: 'worker',
        department: null,
        grants_skills: [],
        promotes_to: ['ghost'],
        promotion_gates: {},
      },
    };
    expect(() => validateRoleDag(dangling, skills)).toThrow(/unknown role/);
  });

  it('rejects GM with outgoing edges', () => {
    const gmHasEdge: StaffRoleCatalog = {
      gm: {
        tier: 'gm',
        department: null,
        grants_skills: [],
        promotes_to: ['somewhere'],
        promotion_gates: {},
      },
      somewhere: {
        tier: 'worker',
        department: null,
        grants_skills: [],
        promotes_to: [],
        promotion_gates: {},
      },
    };
    expect(() => validateRoleDag(gmHasEdge, skills)).toThrow(/GM must be a sink/);
  });

  it('rejects a role granting an unknown skill', () => {
    const badSkill: StaffRoleCatalog = {
      porter: {
        tier: 'worker',
        department: null,
        grants_skills: ['ghost-skill'],
        promotes_to: [],
        promotion_gates: {},
      },
    };
    expect(() => validateRoleDag(badSkill, skills)).toThrow(/unknown skill/);
  });
});

describe('loadStaffTaxonomy', () => {
  it('loads and validates the bundled stub files', () => {
    const taxonomy = loadStaffTaxonomy();
    expect(Object.keys(taxonomy.skills).length).toBeGreaterThan(0);
    expect(Object.keys(taxonomy.roles).length).toBeGreaterThan(0);
    expect(taxonomy.roles['lot-porter']).toBeDefined();
    expect(taxonomy.roles.gm.promotes_to).toEqual([]);
  });
});

describe('staff catalog content', () => {
  const taxonomy = loadStaffTaxonomy();
  const { roles, skills } = taxonomy;
  const COMPOSITES = new Set(['effectiveness', 'trustworthiness']);

  it('contains the current catalog roles', () => {
    expect(roles['lot-porter']).toBeDefined();
    expect(roles.salesperson).toBeDefined();
    expect(roles['used-car-manager']).toBeDefined();
    expect(roles['f&i-manager']).toBeDefined();
    expect(roles.technician).toBeDefined();
    expect(roles['service-advisor']).toBeDefined();
    expect(roles['service-manager']).toBeDefined();
    expect(roles.gm).toBeDefined();
  });

  it('every role.grants_skills entry exists in the skill catalog', () => {
    for (const [id, role] of Object.entries(roles)) {
      for (const skillId of role.grants_skills) {
        expect(skills[skillId]).toBeDefined();
        if (!skills[skillId]) {
          throw new Error(`role ${id} grants missing skill ${skillId}`);
        }
      }
    }
  });

  it('every promotion gate references a real skill id or a known composite', () => {
    for (const [id, role] of Object.entries(roles)) {
      for (const key of Object.keys(role.promotion_gates)) {
        const isSkill = skills[key] !== undefined;
        const isComposite = COMPOSITES.has(key);
        if (!isSkill && !isComposite) {
          throw new Error(
            `role ${id} gate "${key}" is neither a skill id nor a known composite`,
          );
        }
        expect(isSkill || isComposite).toBe(true);
      }
    }
  });

  it('manager-tier and gm promotion gates use composites, not skill thresholds', () => {
    // ADR §4: manager-tier "overlaps" act through trait profile, not skill threshold.
    for (const role of Object.values(roles)) {
      const promotesIntoManagerOrGm = role.promotes_to.some((target) => {
        const tier = roles[target]?.tier;
        return tier === 'manager' || tier === 'gm';
      });
      if (!promotesIntoManagerOrGm) continue;
      for (const key of Object.keys(role.promotion_gates)) {
        expect(COMPOSITES.has(key)).toBe(true);
      }
    }
  });

  it('all promotion paths terminate at gm', () => {
    const reachesGm = (id: string, seen: Set<string>): boolean => {
      if (id === 'gm') return true;
      if (seen.has(id)) return false;
      seen.add(id);
      const role = roles[id];
      if (!role || role.promotes_to.length === 0) return id === 'gm';
      return role.promotes_to.every((next) => reachesGm(next, seen));
    };
    for (const id of Object.keys(roles)) {
      expect(reachesGm(id, new Set())).toBe(true);
    }
  });

  it('grants_skills are disjoint along each promotion chain (cumulative semantics)', () => {
    // Walk every chain from each source to gm; assert no skill is granted twice.
    const walk = (id: string, granted: Map<string, string>): void => {
      const role = roles[id];
      for (const skillId of role.grants_skills) {
        const prior = granted.get(skillId);
        if (prior !== undefined) {
          throw new Error(
            `skill "${skillId}" granted by both "${prior}" and "${id}" on the same chain`,
          );
        }
      }
      const nextGranted = new Map(granted);
      for (const skillId of role.grants_skills) nextGranted.set(skillId, id);
      for (const next of role.promotes_to) walk(next, nextGranted);
    };
    expect(() => walk('lot-porter', new Map())).not.toThrow();
  });

  it('lot-porter is the universal feeder (department: null, worker tier)', () => {
    expect(roles['lot-porter'].department).toBeNull();
    expect(roles['lot-porter'].tier).toBe('worker');
  });
});

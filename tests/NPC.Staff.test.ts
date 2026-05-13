import {
  loadStaffTaxonomy,
  validateRoleDag,
  StaffRoleDagError,
} from '../src/game/NPC';
import type {
  StaffRoleCatalog,
  StaffSkillCatalog,
} from '../src/game/NPC';

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
    promotes_to: ['sales-manager'],
    promotion_gates: {},
  },
  'sales-manager': {
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

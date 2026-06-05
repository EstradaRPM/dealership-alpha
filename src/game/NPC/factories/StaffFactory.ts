import { createRng, deriveSeed, type SeedContext } from '../Rng';
import type {
  Staff,
  StaffRoleCatalog,
  StaffSkillCatalog,
} from '../schemas/staff';
import type { StaffArchetypeCatalog } from '../schemas/staff-archetype';
import type { StaffTaxonomy } from '../StaffTaxonomy';

export const STAFF_FACTORY_NAMESPACE = 'npc.staff.factory';

export interface CreateStaffContext extends SeedContext {
  archetypeId: string;
  hireDay: number;
  slot: number;
}

export interface CreateStaffDeps {
  masterSeed: number;
  taxonomy: StaffTaxonomy;
  archetypes: StaffArchetypeCatalog;
}

export interface StaffWithComposites extends Staff {
  readonly effectiveness: number;
  readonly trustworthiness: number;
}

function gaussian(rng: () => number, mu: number, sigma: number): number {
  // Box-Muller. Guard against u1 === 0 (would produce -Infinity).
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function rollSkill(rng: () => number, mu: number, sigma: number, cap: number): number {
  const v = gaussian(rng, mu, sigma);
  if (v < 0) return 0;
  if (v > cap) return cap;
  return v;
}

function pickTraits(
  rng: () => number,
  pool: readonly string[],
  min: number,
  max: number,
): string[] {
  const count = min + Math.floor(rng() * (max - min + 1));
  const available = [...pool];
  const chosen: string[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(rng() * available.length);
    chosen.push(available[idx]);
    available.splice(idx, 1);
  }
  return chosen;
}

function computeComposite(
  staff: Staff,
  skills: StaffSkillCatalog,
  key: 'effectiveness' | 'trustworthiness',
): number {
  let total = 0;
  for (const [skillId, value] of Object.entries(staff.skills)) {
    const def = skills[skillId];
    if (!def) continue;
    const weight = def.composite_mapping?.[key];
    if (weight === undefined) continue;
    total += (value / def.cap) * weight;
  }
  return total;
}

function attachComposites(
  plain: Staff,
  skills: StaffSkillCatalog,
): StaffWithComposites {
  Object.defineProperty(plain, 'effectiveness', {
    get: () => computeComposite(plain, skills, 'effectiveness'),
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(plain, 'trustworthiness', {
    get: () => computeComposite(plain, skills, 'trustworthiness'),
    enumerable: false,
    configurable: true,
  });
  return plain as StaffWithComposites;
}

/**
 * Re-attach the non-enumerable composite getters (`effectiveness`,
 * `trustworthiness`) to a plain `Staff` record that lost them in transit —
 * e.g. a roster rehydrated from a JSON save (#190). Pure derivation from the
 * record's `skills` + the taxonomy, identical to the math `createStaff` runs,
 * so a rehydrated record is indistinguishable from a freshly-rolled one.
 */
export function rehydrateStaff(
  staff: Staff,
  taxonomy: StaffTaxonomy,
): StaffWithComposites {
  return attachComposites(staff, taxonomy.skills);
}

export function createStaff(
  ctx: CreateStaffContext,
  deps: CreateStaffDeps,
): StaffWithComposites {
  const { masterSeed, taxonomy, archetypes } = deps;
  const archetype = archetypes[ctx.archetypeId];
  if (!archetype) {
    throw new Error(`Unknown archetype "${ctx.archetypeId}"`);
  }
  const role = taxonomy.roles[archetype.role_id];
  if (!role) {
    throw new Error(`Archetype "${ctx.archetypeId}" references unknown role "${archetype.role_id}"`);
  }

  const seedFor = (subNamespace: string): number =>
    deriveSeed(masterSeed, `${STAFF_FACTORY_NAMESPACE}.${subNamespace}`, ctx);

  const rngTraits = createRng(seedFor('traits'));
  const trait_ids = pickTraits(
    rngTraits,
    archetype.trait_pool,
    archetype.trait_count.min,
    archetype.trait_count.max,
  );

  const skills: Record<string, number> = {};
  for (const [skillId, dist] of Object.entries(archetype.skills)) {
    const def = taxonomy.skills[skillId];
    const cap = def?.cap ?? 100;
    const rng = createRng(seedFor(`skill.${skillId}`));
    skills[skillId] = rollSkill(rng, dist.mu, dist.sigma, cap);
  }

  const rngStamina = createRng(seedFor('resource.stamina'));
  const stamina = rollSkill(rngStamina, archetype.resources.stamina.mu, archetype.resources.stamina.sigma, 100);
  const resources: Staff['resources'] = { stamina };
  if (archetype.resources.morale) {
    const rngMorale = createRng(seedFor('resource.morale'));
    resources.morale = rollSkill(
      rngMorale,
      archetype.resources.morale.mu,
      archetype.resources.morale.sigma,
      100,
    );
  }

  const id = `staff:${ctx.archetypeId}:${ctx.hireDay}:${ctx.slot}`;

  const plain: Staff = {
    id,
    role_id: archetype.role_id,
    trait_ids,
    skills,
    resources,
    counters: {
      experience: 0,
      deals_closed: 0,
      days_employed: 0,
    },
  };

  return attachComposites(plain, taxonomy.skills);
}

export function promoteStaff(
  staff: Staff,
  toRoleId: string,
  taxonomy: StaffTaxonomy,
): StaffWithComposites {
  const target = taxonomy.roles[toRoleId];
  if (!target) {
    throw new Error(`Cannot promote to unknown role "${toRoleId}"`);
  }
  const current = taxonomy.roles[staff.role_id];
  if (!current) {
    throw new Error(`Staff has unknown current role "${staff.role_id}"`);
  }
  if (!current.promotes_to.includes(toRoleId)) {
    throw new Error(
      `Role "${staff.role_id}" cannot promote to "${toRoleId}" (not an outgoing edge)`,
    );
  }

  // Cumulative: keep all existing skills; add new role's grants_skills at 0
  // if not already present. Skills accumulate across the promotion chain.
  const nextSkills: Record<string, number> = { ...staff.skills };
  for (const skillId of target.grants_skills) {
    if (!(skillId in nextSkills)) {
      nextSkills[skillId] = 0;
    }
  }

  const next: Staff = {
    ...staff,
    role_id: toRoleId,
    skills: nextSkills,
  };

  return attachComposites(next, taxonomy.skills);
}

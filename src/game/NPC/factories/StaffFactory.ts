import { createRng, deriveSeed, type SeedContext } from '../../Rng';
import { rollPersonName } from './PersonNameFactory';
import type {
  Staff,
  StaffRoleCatalog,
  StaffSkill,
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
  /**
   * The person's name (#347). Like the composites below it is a non-enumerable
   * *derived* getter — `rollPersonName(masterSeed, staff.id)` — so it never
   * serializes and needs no migration, and a rehydrated roster comes back with
   * the same people it was saved with. See `PersonNameFactory`.
   */
  readonly name: string;
  readonly effectiveness: number;
  readonly trustworthiness: number;
  /**
   * The two composites re-expressed as a fraction of the ceiling **this
   * person's own skill set** can reach (#347). `effectiveness` is a weighted
   * *sum* over the skills a role grants, so its range is the sum of those
   * weights — 1.5 for a three-skill salesperson, 3.7 for a used-car manager
   * who accumulated six axes through promotion. Read as a percentage it
   * produced "Work quality 275%" on the roster card, and it made two people in
   * different roles incomparable. Dividing by the ceiling answers the question
   * a staff card actually asks: how close is this person to as good as they
   * get at *their* job. The raw composites stay exactly as they are — every
   * promotion/capability gate reads those, and re-scaling them would be a
   * balance change (C1/C2 own the gate thresholds).
   */
  readonly effectivenessRatio: number;
  readonly trustworthinessRatio: number;
  /**
   * Channel-desk M7 (#294) — Model B *effective* skill per axis, derived (never
   * mutated) from `base + growth(counter)` clamped to the per-hire cap. This is
   * what every capability gate/refinement reads (S12, M2–M6). The dormant
   * `counters` only change overnight (StaffOrg's `clock:day_ended` accrual), so
   * each read of this getter is constant within an open day ⇒ replay-safe
   * (#122). Like `effectiveness`/`trustworthiness` it is a non-enumerable
   * derived getter, so it never serializes (no save migration).
   */
  readonly effectiveSkills: Readonly<Record<string, number>>;
}

export const SKILL_CAP_HEADROOM_NAMESPACE = 'npc.staff.skillCapHeadroom';

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

/**
 * A composite expressed as a fraction of its own ceiling — the 0–1 read (#347).
 * Each skill contributes at most its `composite_mapping` weight (the term is
 * `value/cap × weight`, and `value ≤ cap`), so the ceiling is the sum of the
 * mapped weights. Zero when the staffer carries no skill that maps onto this
 * composite.
 *
 * Takes the skill values rather than the `Staff` record so the same formula
 * serves both readings (#353): the `effectivenessRatio` getter passes the
 * **base** skills (what every promotion/capability gate is calibrated against),
 * and StaffOrg's grade derivation passes the **grown** `effectiveSkills`, so a
 * person's grade climbs with tenure while the gates stay where they were.
 */
export function compositeRatio(
  skillValues: Readonly<Record<string, number>>,
  skills: StaffSkillCatalog,
  key: 'effectiveness' | 'trustworthiness',
): number {
  let total = 0;
  let ceiling = 0;
  for (const [skillId, value] of Object.entries(skillValues)) {
    const def = skills[skillId];
    if (!def) continue;
    const weight = def.composite_mapping?.[key];
    if (weight === undefined) continue;
    total += (value / def.cap) * weight;
    ceiling += weight;
  }
  return ceiling > 0 ? total / ceiling : 0;
}

/**
 * Channel-desk M7 (#294) — the per-hire growth ceiling on one skill axis,
 * rolled deterministically from the staff id (`min(skill cap, base +
 * max(0, gaussian(headroom)))`). Seeded so a given hire's cap is stable across
 * the game's lifetime and reproducible on reload (the cap is derived, never
 * stored ⇒ no migration). A cheap hire plateaus low; you keep them or replace
 * with a higher-cap pro.
 */
function rollPerHireCap(
  masterSeed: number,
  staffId: string,
  skillId: string,
  base: number,
  def: StaffSkill,
): number {
  if (!def.cap_headroom) return Math.min(def.cap, base);
  const seed = deriveSeed(masterSeed, SKILL_CAP_HEADROOM_NAMESPACE, {
    staffId,
    skillId,
  });
  const rng = createRng(seed);
  const headroom = Math.max(0, gaussian(rng, def.cap_headroom.mu, def.cap_headroom.sigma));
  return Math.min(def.cap, base + headroom);
}

/**
 * Channel-desk M7 (#294) — Model B effective skill on one axis:
 * `clamp(base + growth_rate × counter, base, perHireCap)`. With zero counters
 * (a fresh hire) effective === base, so the M2–M6 gates behave identically at
 * hire time; growth only accrues as the dormant counters tick up overnight.
 */
export function effectiveSkillValue(
  staff: Staff,
  skillId: string,
  def: StaffSkill | undefined,
  masterSeed: number,
): number {
  const base = staff.skills[skillId] ?? 0;
  if (!def) return base;
  const perHireCap = rollPerHireCap(masterSeed, staff.id, skillId, base, def);
  const growth = def.growth_counter
    ? def.growth_rate * (staff.counters[def.growth_counter] ?? 0)
    : 0;
  return Math.min(perHireCap, base + growth);
}

/** Effective skill across every axis the staff carries (#294). */
export function computeEffectiveSkills(
  staff: Staff,
  skills: StaffSkillCatalog,
  masterSeed: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const skillId of Object.keys(staff.skills)) {
    out[skillId] = effectiveSkillValue(staff, skillId, skills[skillId], masterSeed);
  }
  return out;
}

function attachComposites(
  plain: Staff,
  skills: StaffSkillCatalog,
  masterSeed: number,
): StaffWithComposites {
  Object.defineProperty(plain, 'name', {
    get: () => rollPersonName(masterSeed, plain.id),
    enumerable: false,
    configurable: true,
  });
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
  for (const key of ['effectiveness', 'trustworthiness'] as const) {
    Object.defineProperty(plain, `${key}Ratio`, {
      get: () => compositeRatio(plain.skills, skills, key),
      enumerable: false,
      configurable: true,
    });
  }
  Object.defineProperty(plain, 'effectiveSkills', {
    get: () => computeEffectiveSkills(plain, skills, masterSeed),
    enumerable: false,
    configurable: true,
  });
  return plain as StaffWithComposites;
}

/**
 * Re-attach the non-enumerable derived getters (`name`, `effectiveness`,
 * `trustworthiness`) to a plain `Staff` record that lost them in transit —
 * e.g. a roster rehydrated from a JSON save (#190). Pure derivation from the
 * record's `skills` + the taxonomy, identical to the math `createStaff` runs,
 * so a rehydrated record is indistinguishable from a freshly-rolled one.
 */
export function rehydrateStaff(
  staff: Staff,
  taxonomy: StaffTaxonomy,
  masterSeed = 0,
): StaffWithComposites {
  return attachComposites(staff, taxonomy.skills, masterSeed);
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

  return attachComposites(plain, taxonomy.skills, masterSeed);
}

export function promoteStaff(
  staff: Staff,
  toRoleId: string,
  taxonomy: StaffTaxonomy,
  masterSeed = 0,
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

  return attachComposites(next, taxonomy.skills, masterSeed);
}

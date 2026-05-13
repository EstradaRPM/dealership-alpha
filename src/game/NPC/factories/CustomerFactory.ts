import { createRng, deriveSeed, type SeedContext } from '../Rng';
import { resolveEffects } from '../Trait';
import type { TraitSet, EffectKey, EffectVector } from '../schemas/trait';
import type { PersonArchetypeCatalog } from '../schemas/person-archetype';
import type { VisitArchetypeCatalog } from '../schemas/visit-archetype';
import type { Person, Visit, SPACEDVector, PSQTCVector } from '../schemas/customer';
import { PersonSchema, VisitSchema } from '../schemas/customer';

export const CUSTOMER_FACTORY_NAMESPACE = 'npc.customer.factory';

export interface CreateCustomerContext extends SeedContext {
  personArchetypeId: string;
  visitArchetypeId: string;
  day: number;
  slot: number;
}

export interface CreateCustomerDeps {
  masterSeed: number;
  personArchetypes: PersonArchetypeCatalog;
  visitArchetypes: VisitArchetypeCatalog;
  traits: TraitSet;
}

export interface CustomerBundle {
  person: Person;
  visit: Visit;
}

// EffectKey → SPACED preference field (sales visits only)
const SPACED_EFFECT_MAP: Partial<Record<EffectKey, keyof SPACEDVector>> = {
  'spaced_weight.economy': 'economy',
  'spaced_weight.luxury': 'appearance',
  'spaced_weight.truck': 'dependability',
};

// EffectKey → PSQTC preference field (service/body visits only)
const PSQTC_EFFECT_MAP: Partial<Record<EffectKey, keyof PSQTCVector>> = {
  price_sensitivity: 'price',
};

function gaussian(rng: () => number, mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
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

// Accumulate all trait deltas first (order-independent addition), then apply in one pass.
function applyEffectsToVisit(
  base: Visit,
  effects: EffectVector,
  agreeableness: number,
): Visit {
  const res = {
    // Agreeableness linearly modifies starting trust: higher agreeableness → higher trust.
    trust: base.resources.trust + (agreeableness / 100) * 0.1,
    patience: base.resources.patience + (effects['patience'] ?? 0),
  };
  res.trust += effects['trust_build_rate'] ?? 0;

  if (base.kind === 'sales') {
    const pref = { ...base.preferences } as SPACEDVector;
    for (const [ek, sk] of Object.entries(SPACED_EFFECT_MAP) as [EffectKey, keyof SPACEDVector][]) {
      const d = effects[ek] ?? 0;
      if (d !== 0) pref[sk] += d;
    }
    return { kind: 'sales', person_id: base.person_id, preferences: pref, resources: res };
  } else {
    const pref = { ...base.preferences } as PSQTCVector;
    for (const [ek, pk] of Object.entries(PSQTC_EFFECT_MAP) as [EffectKey, keyof PSQTCVector][]) {
      const d = effects[ek] ?? 0;
      if (d !== 0) pref[pk] += d;
    }
    return { kind: base.kind, person_id: base.person_id, preferences: pref, resources: res };
  }
}

export function createCustomer(ctx: CreateCustomerContext, deps: CreateCustomerDeps): CustomerBundle {
  const { masterSeed, personArchetypes, visitArchetypes, traits } = deps;

  const personArchetype = personArchetypes[ctx.personArchetypeId];
  if (!personArchetype) throw new Error(`Unknown person archetype "${ctx.personArchetypeId}"`);

  const visitArchetype = visitArchetypes[ctx.visitArchetypeId];
  if (!visitArchetype) throw new Error(`Unknown visit archetype "${ctx.visitArchetypeId}"`);

  const seedFor = (sub: string): number =>
    deriveSeed(masterSeed, `${CUSTOMER_FACTORY_NAMESPACE}.${sub}`, ctx);

  // -- Roll traits --
  const rngTraits = createRng(seedFor('traits'));
  const traitIds = pickTraits(
    rngTraits,
    personArchetype.trait_pool,
    personArchetype.trait_count.min,
    personArchetype.trait_count.max,
  );

  const resolvedTraits = traitIds.map((id) => {
    const t = traits[id];
    if (!t) throw new Error(`Unknown trait "${id}"`);
    return t;
  });

  // -- Roll person stats --
  const rollStat = (sub: string, mu: number, sigma: number): number =>
    gaussian(createRng(seedFor(sub)), mu, sigma);

  const agreeableness = rollStat('agreeableness', personArchetype.agreeableness.mu, personArchetype.agreeableness.sigma);

  const person = PersonSchema.parse({
    id: `customer:${ctx.personArchetypeId}:${ctx.day}:${ctx.slot}`,
    trait_ids: traitIds,
    wealth: rollStat('wealth', personArchetype.wealth.mu, personArchetype.wealth.sigma),
    credit: rollStat('credit', personArchetype.credit.mu, personArchetype.credit.sigma),
    int: rollStat('int', personArchetype.int.mu, personArchetype.int.sigma),
    agreeableness,
    brand_affinity: {},
    counters: { prior_visits: 0, prior_deals: 0, days_since_last_visit: 0 },
  });

  // -- Roll visit base values from archetype distributions --
  const rollField = (sub: string, mu: number, sigma: number): number =>
    gaussian(createRng(seedFor(sub)), mu, sigma);

  let baseVisit: Visit;

  if (visitArchetype.kind === 'sales') {
    const p = visitArchetype.preferences;
    const r = visitArchetype.resources;
    baseVisit = VisitSchema.parse({
      kind: 'sales',
      person_id: person.id,
      preferences: {
        safety: rollField('pref.safety', p.safety.mu, p.safety.sigma),
        performance: rollField('pref.performance', p.performance.mu, p.performance.sigma),
        appearance: rollField('pref.appearance', p.appearance.mu, p.appearance.sigma),
        comfort: rollField('pref.comfort', p.comfort.mu, p.comfort.sigma),
        economy: rollField('pref.economy', p.economy.mu, p.economy.sigma),
        dependability: rollField('pref.dependability', p.dependability.mu, p.dependability.sigma),
      },
      resources: {
        trust: rollField('res.trust', r.trust.mu, r.trust.sigma),
        patience: rollField('res.patience', r.patience.mu, r.patience.sigma),
      },
    });
  } else {
    const p = visitArchetype.preferences;
    const r = visitArchetype.resources;
    baseVisit = VisitSchema.parse({
      kind: visitArchetype.kind,
      person_id: person.id,
      preferences: {
        price: rollField('pref.price', p.price.mu, p.price.sigma),
        speed: rollField('pref.speed', p.speed.mu, p.speed.sigma),
        quality: rollField('pref.quality', p.quality.mu, p.quality.sigma),
        trust_in_shop: rollField('pref.trust_in_shop', p.trust_in_shop.mu, p.trust_in_shop.sigma),
        convenience: rollField('pref.convenience', p.convenience.mu, p.convenience.sigma),
      },
      resources: {
        trust: rollField('res.trust', r.trust.mu, r.trust.sigma),
        patience: rollField('res.patience', r.patience.mu, r.patience.sigma),
      },
    });
  }

  // -- Apply trait effects (accumulated before application → order-independent) --
  const effectVector = resolveEffects(resolvedTraits, {}, 'customer');
  const visit = VisitSchema.parse(applyEffectsToVisit(baseVisit, effectVector, agreeableness));

  return { person, visit };
}

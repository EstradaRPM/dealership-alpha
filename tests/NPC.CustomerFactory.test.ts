import {
  createCustomer,
  hotButtons,
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
  resolveEffects,
} from '../src/game/NPC';
import { PersonSchema, VisitSchema } from '../src/game/NPC/schemas/customer';
import { classifyCredit, loadCreditTiers } from '../src/game/DealEngine';

const creditTiers = loadCreditTiers();
const minDownPctForCredit = (credit: number): number =>
  creditTiers.tiers[classifyCredit(credit, creditTiers)].minDownPct;

const personArchetypes = loadPersonArchetypes();
const visitArchetypes = loadVisitArchetypes();
const traits = loadTraitTaxonomy();

const deps = { masterSeed: 99999, personArchetypes, visitArchetypes, traits };

const salesCtx = {
  personArchetypeId: 'young_family',
  visitArchetypeId: 'family_vehicle_search',
  day: 1,
  slot: 0,
};

// ── Schema validity ───────────────────────────────────────────────────────────

describe('CustomerFactory.createCustomer — schema validity', () => {
  it('rolled customer passes Person + Visit Zod schemas', () => {
    const { person, visit } = createCustomer(salesCtx, deps);
    expect(PersonSchema.safeParse(person).success).toBe(true);
    expect(VisitSchema.safeParse(visit).success).toBe(true);
  });

  it('visit.person_id matches person.id', () => {
    const { person, visit } = createCustomer(salesCtx, deps);
    expect(visit.person_id).toBe(person.id);
  });

  it('counters initialize at zero', () => {
    const { person } = createCustomer(salesCtx, deps);
    expect(person.counters).toEqual({ prior_visits: 0, prior_deals: 0, days_since_last_visit: 0 });
  });

  it('rolls annualIncome > 0 from archetype distribution', () => {
    const { person } = createCustomer(salesCtx, deps);
    expect(person.annualIncome).toBeGreaterThan(0);
  });

  it('same seed → same annualIncome (determinism)', () => {
    const a = createCustomer(salesCtx, deps);
    const b = createCustomer(salesCtx, deps);
    expect(a.person.annualIncome).toBe(b.person.annualIncome);
  });

  it('produces valid customers for service visit archetypes', () => {
    const ctx = { personArchetypeId: 'commuter', visitArchetypeId: 'routine_maintenance', day: 3, slot: 2 };
    const { person, visit } = createCustomer(ctx, deps);
    expect(visit.kind).toBe('service');
    expect(PersonSchema.safeParse(person).success).toBe(true);
    expect(VisitSchema.safeParse(visit).success).toBe(true);
  });

  it('produces valid customers for body visit archetypes', () => {
    const bodyId = Object.keys(visitArchetypes).find((k) => visitArchetypes[k]?.kind === 'body')!;
    const ctx = { personArchetypeId: 'young_family', visitArchetypeId: bodyId, day: 5, slot: 0 };
    const { person, visit } = createCustomer(ctx, deps);
    expect(visit.kind).toBe('body');
    expect(PersonSchema.safeParse(person).success).toBe(true);
    expect(VisitSchema.safeParse(visit).success).toBe(true);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('CustomerFactory.createCustomer — determinism', () => {
  it('same (saveSeed, day, slot) → byte-identical customer', () => {
    const a = createCustomer(salesCtx, deps);
    const b = createCustomer(salesCtx, deps);
    expect(a.person).toEqual(b.person);
    expect(a.visit).toEqual(b.visit);
  });

  it('different slot produces a distinct customer from the same archetype', () => {
    const a = createCustomer(salesCtx, deps);
    const b = createCustomer({ ...salesCtx, slot: 1 }, deps);
    expect(a.person.id).not.toBe(b.person.id);
    const identical =
      a.person.wealth === b.person.wealth &&
      a.person.credit === b.person.credit &&
      JSON.stringify(a.person.trait_ids) === JSON.stringify(b.person.trait_ids);
    expect(identical).toBe(false);
  });
});

// ── paymentMethod ─────────────────────────────────────────────────────────────

describe('CustomerFactory.createCustomer — paymentMethod', () => {
  const salesArchetypeIds = Object.keys(visitArchetypes).filter(
    (id) => visitArchetypes[id]?.kind === 'sales',
  );

  it('every sales visit carries a paymentMethod of cash or finance', () => {
    for (const visitArchetypeId of salesArchetypeIds) {
      const { visit } = createCustomer(
        { ...salesCtx, visitArchetypeId, slot: 0 },
        deps,
      );
      if (visit.kind !== 'sales') throw new Error('expected sales');
      expect(['cash', 'finance']).toContain(visit.paymentMethod);
    }
  });

  it('1000-customer cash-share roughly matches archetype cashProbability', () => {
    // No affordability gate (floor = 0) so the Bernoulli is unbiased.
    const N = 1000;
    for (const visitArchetypeId of salesArchetypeIds) {
      const arch = visitArchetypes[visitArchetypeId]!;
      if (arch.kind !== 'sales') throw new Error('unreachable');
      const expected = arch.payment.cashProbability;
      let cashCount = 0;
      for (let slot = 0; slot < N; slot++) {
        const { visit } = createCustomer(
          { personArchetypeId: 'young_family', visitArchetypeId, day: 7, slot },
          deps,
        );
        if (visit.kind === 'sales' && visit.paymentMethod === 'cash') cashCount++;
      }
      const observed = cashCount / N;
      // ±0.04 absolute tolerance — generous for N=1000 Bernoulli (3σ ≈ 0.03 at p=0.5).
      expect(Math.abs(observed - expected)).toBeLessThan(0.04);
    }
  });

  it('cash-affordability gate forces finance when floor exceeds wealth × cashSpendFraction', () => {
    // Floor of $10M is well above any rolled wealth × spend fraction → every
    // customer must be forced to finance.
    const gateDeps = { ...deps, cheapestLotPriceFloor: 10_000_000 };
    for (let slot = 0; slot < 200; slot++) {
      const { visit } = createCustomer(
        { personArchetypeId: 'young_family', visitArchetypeId: 'retirement_upgrade', day: 9, slot },
        gateDeps,
      );
      if (visit.kind !== 'sales') throw new Error('expected sales');
      expect(visit.paymentMethod).toBe('finance');
    }
  });

  it('same seed → same paymentMethod (determinism)', () => {
    for (const visitArchetypeId of salesArchetypeIds) {
      const ctx = { personArchetypeId: 'young_family', visitArchetypeId, day: 11, slot: 3 };
      const a = createCustomer(ctx, deps);
      const b = createCustomer(ctx, deps);
      if (a.visit.kind !== 'sales' || b.visit.kind !== 'sales') throw new Error('expected sales');
      expect(a.visit.paymentMethod).toBe(b.visit.paymentMethod);
    }
  });
});

// ── downPaymentBehavior ───────────────────────────────────────────────────────

describe('CustomerFactory.createCustomer — downPaymentBehavior', () => {
  const salesArchetypeIds = Object.keys(visitArchetypes).filter(
    (id) => visitArchetypes[id]?.kind === 'sales',
  );
  const dpDeps = { ...deps, minDownPctForCredit };

  it('finance sales customers carry downPaymentBehavior; cash customers do not', () => {
    let sawFinance = false;
    let sawCash = false;
    for (let slot = 0; slot < 200 && !(sawFinance && sawCash); slot++) {
      const { visit } = createCustomer(
        { personArchetypeId: 'young_family', visitArchetypeId: 'retirement_upgrade', day: 13, slot },
        dpDeps,
      );
      if (visit.kind !== 'sales') throw new Error('expected sales');
      if (visit.paymentMethod === 'finance') {
        sawFinance = true;
        expect(typeof visit.downPaymentBehavior).toBe('number');
      } else {
        sawCash = true;
        expect(visit.downPaymentBehavior).toBeUndefined();
      }
    }
    expect(sawFinance).toBe(true);
    expect(sawCash).toBe(true);
  });

  it('downPaymentBehavior respects the [tier.minDownPct, 0.5] clamp', () => {
    const N = 500;
    for (const visitArchetypeId of salesArchetypeIds) {
      for (let slot = 0; slot < N; slot++) {
        const { person, visit } = createCustomer(
          { personArchetypeId: 'young_family', visitArchetypeId, day: 17, slot },
          dpDeps,
        );
        if (visit.kind !== 'sales') throw new Error('expected sales');
        if (visit.paymentMethod !== 'finance') continue;
        const floor = minDownPctForCredit(person.credit);
        expect(visit.downPaymentBehavior).toBeDefined();
        expect(visit.downPaymentBehavior!).toBeGreaterThanOrEqual(floor);
        expect(visit.downPaymentBehavior!).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('per-archetype distribution mean ≈ archetype mu (ignoring clamp-affected samples)', () => {
    const N = 2000;
    for (const visitArchetypeId of salesArchetypeIds) {
      const arch = visitArchetypes[visitArchetypeId]!;
      if (arch.kind !== 'sales') throw new Error('unreachable');
      const mu = arch.payment.downPaymentBehavior.mu;
      const sigma = arch.payment.downPaymentBehavior.sigma;
      let sum = 0;
      let n = 0;
      for (let slot = 0; slot < N; slot++) {
        const { person, visit } = createCustomer(
          { personArchetypeId: 'young_family', visitArchetypeId, day: 19, slot },
          dpDeps,
        );
        if (visit.kind !== 'sales') throw new Error('expected sales');
        if (visit.paymentMethod !== 'finance') continue;
        const floor = minDownPctForCredit(person.credit);
        // Only include samples not pinned by either bound to avoid biasing the mean.
        if (visit.downPaymentBehavior! <= floor + 1e-9) continue;
        if (visit.downPaymentBehavior! >= 0.5 - 1e-9) continue;
        sum += visit.downPaymentBehavior!;
        n++;
      }
      if (n < 50) continue; // archetype mostly clamped — skip the mean check
      const observed = sum / n;
      expect(Math.abs(observed - mu)).toBeLessThan(Math.max(0.03, sigma));
    }
  });

  it('same seed → same downPaymentBehavior (determinism)', () => {
    for (const visitArchetypeId of salesArchetypeIds) {
      const ctx = { personArchetypeId: 'young_family', visitArchetypeId, day: 23, slot: 7 };
      const a = createCustomer(ctx, dpDeps);
      const b = createCustomer(ctx, dpDeps);
      if (a.visit.kind !== 'sales' || b.visit.kind !== 'sales') throw new Error('expected sales');
      expect(a.visit.downPaymentBehavior).toBe(b.visit.downPaymentBehavior);
    }
  });
});

// ── Trait application ─────────────────────────────────────────────────────────

describe('CustomerFactory.createCustomer — trait application', () => {
  it('never rolls a customer trait whose applies_to excludes "customer"', () => {
    for (const archetypeId of Object.keys(personArchetypes)) {
      const archetype = personArchetypes[archetypeId]!;
      for (const traitId of archetype.trait_pool) {
        const trait = traits[traitId];
        expect(trait).toBeDefined();
        expect(trait!.applies_to).toContain('customer');
      }
    }
  });

  it('visit composition is order-independent: resolveEffects([A, B]) === resolveEffects([B, A])', () => {
    const traitA = traits['price-sensitive']!;
    const traitB = traits['shops-around']!;
    const ab = resolveEffects([traitA, traitB], {}, 'customer');
    const ba = resolveEffects([traitB, traitA], {}, 'customer');
    expect(ab).toEqual(ba);
  });

  it('order-independence holds for three traits in all orderings', () => {
    const traitA = traits['price-sensitive']!;
    const traitB = traits['brand-loyal']!;
    const traitC = traits['impatient']!;
    const abc = resolveEffects([traitA, traitB, traitC], {}, 'customer');
    const bca = resolveEffects([traitB, traitC, traitA], {}, 'customer');
    const cab = resolveEffects([traitC, traitA, traitB], {}, 'customer');
    const allKeys = Array.from(new Set([...Object.keys(abc), ...Object.keys(bca), ...Object.keys(cab)]));
    for (const key of allKeys) {
      const v = (abc as Record<string, number>)[key] ?? 0;
      expect((bca as Record<string, number>)[key] ?? 0).toBeCloseTo(v, 10);
      expect((cab as Record<string, number>)[key] ?? 0).toBeCloseTo(v, 10);
    }
  });

  it('price-sensitive trait raises economy preference relative to no-trait baseline', () => {
    // Build a no-trait version by using a deps with empty trait pools
    const noTraitArchetypes = {
      blank: {
        ...personArchetypes['young_family']!,
        trait_pool: [] as string[],
        trait_count: { min: 0, max: 0 },
      },
    };
    const noTraitDeps = { ...deps, personArchetypes: noTraitArchetypes };

    const priceSensitiveTraitArchetypes = {
      blank: {
        ...personArchetypes['young_family']!,
        trait_pool: ['price-sensitive'],
        trait_count: { min: 1, max: 1 },
      },
    };
    const withTraitDeps = { ...deps, personArchetypes: priceSensitiveTraitArchetypes };

    const ctx = { personArchetypeId: 'blank', visitArchetypeId: 'family_vehicle_search', day: 10, slot: 0 };

    // Run many times to average out RNG variance
    let economyDelta = 0;
    const TRIALS = 20;
    for (let slot = 0; slot < TRIALS; slot++) {
      const c = { ...ctx, slot };
      const baseline = createCustomer(c, noTraitDeps);
      const withTrait = createCustomer(c, withTraitDeps);
      if (baseline.visit.kind === 'sales' && withTrait.visit.kind === 'sales') {
        economyDelta += withTrait.visit.preferences.economy - baseline.visit.preferences.economy;
      }
    }
    // price-sensitive has spaced_weight.economy: 0.3, so average delta should be ~0.3
    expect(economyDelta / TRIALS).toBeCloseTo(0.3, 1);
  });
});

// ── Emergent hot-buttons ──────────────────────────────────────────────────────

describe('CustomerFactory — emergent hot-buttons', () => {
  it('hotButtons top-N correctly identifies the highest-weighted preferences', () => {
    const { visit } = createCustomer(salesCtx, deps);
    expect(visit.kind).toBe('sales');
    if (visit.kind === 'sales') {
      const top2 = hotButtons(visit, 2);
      expect(top2).toHaveLength(2);
      const allValues = Object.values(visit.preferences).sort((a, b) => b - a);
      const topValues = top2.map((k) => (visit.preferences as Record<string, number>)[k]!);
      expect(topValues[0]).toBe(allValues[0]);
      expect(topValues[1]).toBe(allValues[1]);
    }
  });

  it('hotButtons top-1 is the single highest preference for a work_truck_purchase visit', () => {
    const ctx = { personArchetypeId: 'tradesperson', visitArchetypeId: 'work_truck_purchase', day: 2, slot: 0 };
    const { visit } = createCustomer(ctx, deps);
    expect(visit.kind).toBe('sales');
    if (visit.kind === 'sales') {
      const [top] = hotButtons(visit, 1);
      const max = Math.max(...Object.values(visit.preferences));
      expect((visit.preferences as Record<string, number>)[top!]).toBe(max);
    }
  });

  it('hotButtons on a service visit returns PSQTC keys', () => {
    const ctx = { personArchetypeId: 'retiree', visitArchetypeId: 'routine_maintenance', day: 4, slot: 1 };
    const { visit } = createCustomer(ctx, deps);
    expect(visit.kind).toBe('service');
    if (visit.kind === 'service') {
      const top2 = hotButtons(visit, 2);
      expect(top2).toHaveLength(2);
      const psqtcKeys = ['price', 'speed', 'quality', 'trust_in_shop', 'convenience'];
      for (const k of top2) {
        expect(psqtcKeys).toContain(k);
      }
    }
  });
});

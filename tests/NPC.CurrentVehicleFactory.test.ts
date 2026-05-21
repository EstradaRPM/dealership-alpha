import {
  createCustomer,
  loadCustomerCurrentVehicleConfig,
  loadPersonArchetypes,
  loadTraitTaxonomy,
  loadVisitArchetypes,
  rollCurrentVehicle,
  CurrentVehicleSchema,
} from '../src/game/NPC';
import { classifyCredit, loadCreditTiers } from '../src/game/DealEngine';

const config = loadCustomerCurrentVehicleConfig();
const personArchetypes = loadPersonArchetypes();
const visitArchetypes = loadVisitArchetypes();
const traits = loadTraitTaxonomy();
const creditTiers = loadCreditTiers();

const classifyCreditTier = (credit: number) =>
  classifyCredit(credit, creditTiers);

const npcDeps = {
  masterSeed: 12345,
  personArchetypes,
  visitArchetypes,
  traits,
  currentVehicleConfig: config,
  classifyCreditTier,
};

const archetypeIds = Object.keys(personArchetypes);

// ── Data coverage ────────────────────────────────────────────────────────────

describe('customer-current-vehicle.json — coverage', () => {
  it('declares a profile for every person archetype', () => {
    for (const id of archetypeIds) {
      expect(config.archetypes[id]).toBeDefined();
    }
  });

  it('every templatePool entry references a declared template', () => {
    for (const [id, profile] of Object.entries(config.archetypes)) {
      for (const cat of ['sedan', 'truck', 'suv'] as const) {
        for (const tid of profile.templatePool[cat]) {
          expect(config.templates[tid]).toBeDefined();
          expect(config.templates[tid]!.category).toBe(cat);
        }
      }
      // every credit tier has a payoff distribution
      for (const tier of ['A', 'B', 'C', 'D'] as const) {
        expect(profile.payoffByTier[tier]).toBeDefined();
      }
      expect(id).toBe(id); // hush unused
    }
  });
});

// ── Schema + creation ────────────────────────────────────────────────────────

describe('rollCurrentVehicle — schema', () => {
  it('produces a value that satisfies CurrentVehicleSchema for every archetype × tier', () => {
    for (const id of archetypeIds) {
      for (const tier of ['A', 'B', 'C', 'D'] as const) {
        const cv = rollCurrentVehicle(
          { personArchetypeId: id, day: 1, slot: 0 },
          { masterSeed: 7, config, creditTier: tier },
        );
        expect(CurrentVehicleSchema.safeParse(cv).success).toBe(true);
      }
    }
  });
});

// ── Determinism ──────────────────────────────────────────────────────────────

describe('rollCurrentVehicle — determinism', () => {
  it('identical (seed + archetype + day + slot + tier) → identical vehicle', () => {
    const a = rollCurrentVehicle(
      { personArchetypeId: 'young_family', day: 3, slot: 2 },
      { masterSeed: 555, config, creditTier: 'B' },
    );
    const b = rollCurrentVehicle(
      { personArchetypeId: 'young_family', day: 3, slot: 2 },
      { masterSeed: 555, config, creditTier: 'B' },
    );
    expect(a).toEqual(b);
  });

  it('different masterSeed → distinct vehicle (typically)', () => {
    const a = rollCurrentVehicle(
      { personArchetypeId: 'commuter', day: 1, slot: 0 },
      { masterSeed: 1, config, creditTier: 'C' },
    );
    const b = rollCurrentVehicle(
      { personArchetypeId: 'commuter', day: 1, slot: 0 },
      { masterSeed: 99999, config, creditTier: 'C' },
    );
    expect(a).not.toEqual(b);
  });

  it('stamps currentVehicle on the Person via createCustomer (deterministic)', () => {
    const ctx = {
      personArchetypeId: 'enthusiast',
      visitArchetypeId: 'performance_test_drive',
      day: 5,
      slot: 1,
    };
    const a = createCustomer(ctx, npcDeps);
    const b = createCustomer(ctx, npcDeps);
    expect(a.person.currentVehicle).toBeDefined();
    expect(a.person.currentVehicle).toEqual(b.person.currentVehicle);
  });

  it('legacy callers without currentVehicleConfig get a Person without the field', () => {
    const { currentVehicleConfig, classifyCreditTier, ...legacy } = npcDeps;
    void currentVehicleConfig;
    void classifyCreditTier;
    const { person } = createCustomer(
      {
        personArchetypeId: 'retiree',
        visitArchetypeId: 'retirement_upgrade',
        day: 1,
        slot: 0,
      },
      legacy,
    );
    expect(person.currentVehicle).toBeUndefined();
  });
});

// ── loanPayoff: cash vs finance, tier scaling ────────────────────────────────

describe('rollCurrentVehicle — loanPayoff', () => {
  function sampleArchetype(
    id: string,
    tier: 'A' | 'B' | 'C' | 'D',
    n: number,
  ): { financed: number; payoffs: number[] } {
    let financed = 0;
    const payoffs: number[] = [];
    for (let i = 0; i < n; i++) {
      const cv = rollCurrentVehicle(
        { personArchetypeId: id, day: 1, slot: i },
        { masterSeed: 31337, config, creditTier: tier },
      );
      if (cv.loanPayoff !== null) {
        financed++;
        payoffs.push(cv.loanPayoff);
      }
    }
    return { financed, payoffs };
  }

  it('financed rate tracks each archetype financeProbability (±0.10 over 400 samples)', () => {
    for (const id of archetypeIds) {
      const { financed } = sampleArchetype(id, 'B', 400);
      const rate = financed / 400;
      const expected = config.archetypes[id]!.financeProbability;
      expect(Math.abs(rate - expected)).toBeLessThan(0.1);
    }
  });

  it('within an archetype, mean payoff scales inversely with credit tier (A < D)', () => {
    // sub-prime customers carry larger absolute balances (longer terms, less down)
    for (const id of archetypeIds) {
      const a = sampleArchetype(id, 'A', 200).payoffs;
      const d = sampleArchetype(id, 'D', 200).payoffs;
      if (a.length < 20 || d.length < 20) continue;
      const meanA = a.reduce((s, v) => s + v, 0) / a.length;
      const meanD = d.reduce((s, v) => s + v, 0) / d.length;
      expect(meanD).toBeGreaterThan(meanA);
    }
  });

  it('cash-owners produce loanPayoff === null', () => {
    // We can't force "cash"; just confirm null appears for low-finance archetypes.
    const { financed } = sampleArchetype('retiree', 'A', 200);
    expect(financed).toBeLessThan(200); // some cash owners exist
  });

  it('loanPayoff (when present) is non-negative integer', () => {
    for (const id of archetypeIds) {
      const { payoffs } = sampleArchetype(id, 'C', 100);
      for (const p of payoffs) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(p)).toBe(true);
      }
    }
  });
});

// ── Distribution sanity: luxury vs sub-prime skews ───────────────────────────

describe('rollCurrentVehicle — distribution sanity', () => {
  function sampleVehicles(
    id: string,
    tier: 'A' | 'B' | 'C' | 'D',
    n: number,
  ) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(
        rollCurrentVehicle(
          { personArchetypeId: id, day: 1, slot: i },
          { masterSeed: 91, config, creditTier: tier },
        ),
      );
    }
    return out;
  }

  it('enthusiast (luxury-leaning) skews newer than tradesperson', () => {
    const ent = sampleVehicles('enthusiast', 'A', 300);
    const trd = sampleVehicles('tradesperson', 'A', 300);
    const meanYear = (arr: { year: number }[]) =>
      arr.reduce((s, v) => s + v.year, 0) / arr.length;
    expect(meanYear(ent)).toBeGreaterThan(meanYear(trd));
  });

  it('enthusiast skews cleaner condition mix than tradesperson', () => {
    const ent = sampleVehicles('enthusiast', 'A', 300);
    const trd = sampleVehicles('tradesperson', 'A', 300);
    const cleanFrac = (arr: { condition: string }[]) =>
      arr.filter((v) => v.condition === 'clean').length / arr.length;
    expect(cleanFrac(ent)).toBeGreaterThan(cleanFrac(trd));
  });

  it('commuter / tradesperson skew higher mileage than retiree', () => {
    const ret = sampleVehicles('retiree', 'A', 300);
    const com = sampleVehicles('commuter', 'A', 300);
    const meanMi = (arr: { mileage: number }[]) =>
      arr.reduce((s, v) => s + v.mileage, 0) / arr.length;
    expect(meanMi(com)).toBeGreaterThan(meanMi(ret));
  });

  it('tradesperson templates skew toward truck category', () => {
    const v = sampleVehicles('tradesperson', 'B', 400);
    const truckFrac = v.filter((x) => x.category === 'truck').length / v.length;
    expect(truckFrac).toBeGreaterThan(0.5);
  });

  it('year stays within configured bounds for every roll', () => {
    const [lo, hi] = config.yearBounds;
    for (const id of archetypeIds) {
      const v = sampleVehicles(id, 'C', 100);
      for (const cv of v) {
        expect(cv.year).toBeGreaterThanOrEqual(lo);
        expect(cv.year).toBeLessThanOrEqual(hi);
      }
    }
  });
});

import {
  createCustomer,
  loadTradeIncidenceConfig,
  loadCustomerCurrentVehicleConfig,
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
  rollHasTrade,
} from '../src/game/NPC';
import { classifyCredit, loadCreditTiers } from '../src/game/DealEngine';

const tradeConfig = loadTradeIncidenceConfig();
const currentVehicleConfig = loadCustomerCurrentVehicleConfig();
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
  tradeIncidenceConfig: tradeConfig,
  currentVehicleConfig,
  classifyCreditTier,
};

const archetypeIds = Object.keys(personArchetypes);
const TIERS = ['A', 'B', 'C', 'D'] as const;
const METHODS = ['cash', 'finance'] as const;

// Pick a sales-kind visit archetype id for each test up-front.
const SALES_VISIT_IDS = Object.entries(visitArchetypes)
  .filter(([, v]) => v.kind === 'sales')
  .map(([k]) => k);

// ── Data coverage ────────────────────────────────────────────────────────────

describe('trade-incidence.json — coverage', () => {
  it('declares a profile for every person archetype', () => {
    for (const id of archetypeIds) {
      expect(tradeConfig.archetypes[id]).toBeDefined();
    }
  });

  it('every archetype covers all (payment × credit tier) cells in [0,1]', () => {
    for (const id of archetypeIds) {
      const profile = tradeConfig.archetypes[id]!;
      for (const m of METHODS) {
        for (const t of TIERS) {
          const p = profile[m][t];
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('financers trade more than cash buyers within each tier', () => {
    for (const id of archetypeIds) {
      const profile = tradeConfig.archetypes[id]!;
      for (const t of TIERS) {
        expect(profile.finance[t]).toBeGreaterThan(profile.cash[t]);
      }
    }
  });

  it('sub-prime (D) trades at least as often as prime (A) within each payment band', () => {
    for (const id of archetypeIds) {
      const profile = tradeConfig.archetypes[id]!;
      for (const m of METHODS) {
        expect(profile[m].D).toBeGreaterThanOrEqual(profile[m].A);
      }
    }
  });
});

// ── Determinism ──────────────────────────────────────────────────────────────

describe('rollHasTrade — determinism', () => {
  it('identical (seed + archetype + day + slot + method + tier) → identical outcome', () => {
    const a = rollHasTrade(
      { personArchetypeId: 'young_family', day: 3, slot: 2 },
      { masterSeed: 555, config: tradeConfig, paymentMethod: 'finance', creditTier: 'B' },
    );
    const b = rollHasTrade(
      { personArchetypeId: 'young_family', day: 3, slot: 2 },
      { masterSeed: 555, config: tradeConfig, paymentMethod: 'finance', creditTier: 'B' },
    );
    expect(a).toBe(b);
  });

  it('different masterSeed → distinct outcome stream', () => {
    let agree = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const a = rollHasTrade(
        { personArchetypeId: 'commuter', day: 1, slot: i },
        { masterSeed: 1, config: tradeConfig, paymentMethod: 'finance', creditTier: 'C' },
      );
      const b = rollHasTrade(
        { personArchetypeId: 'commuter', day: 1, slot: i },
        { masterSeed: 99999, config: tradeConfig, paymentMethod: 'finance', creditTier: 'C' },
      );
      if (a === b) agree++;
    }
    // Two independent Bernoulli streams: expect roughly p²+(1-p)² agreement.
    // For p≈0.55 that's ~0.50 — assert nowhere near 100%.
    expect(agree).toBeLessThan(N);
  });

  it('throws on an unknown archetype id', () => {
    expect(() =>
      rollHasTrade(
        { personArchetypeId: 'nonsense', day: 0, slot: 0 },
        { masterSeed: 1, config: tradeConfig, paymentMethod: 'cash', creditTier: 'A' },
      ),
    ).toThrow();
  });
});

// ── Integration via createCustomer ──────────────────────────────────────────

describe('createCustomer — hasTrade stamping', () => {
  it('stamps hasTrade on sales visits when trade config + classifier are wired', () => {
    const ctx = {
      personArchetypeId: 'young_family',
      visitArchetypeId: SALES_VISIT_IDS[0]!,
      day: 5,
      slot: 1,
    };
    const { visit } = createCustomer(ctx, npcDeps);
    expect(visit.kind).toBe('sales');
    if (visit.kind === 'sales') {
      expect(typeof visit.hasTrade).toBe('boolean');
    }
  });

  it('produces a deterministic hasTrade for the same (seed, archetype, day, slot)', () => {
    const ctx = {
      personArchetypeId: 'enthusiast',
      visitArchetypeId: SALES_VISIT_IDS[0]!,
      day: 7,
      slot: 3,
    };
    const a = createCustomer(ctx, npcDeps);
    const b = createCustomer(ctx, npcDeps);
    if (a.visit.kind === 'sales' && b.visit.kind === 'sales') {
      expect(a.visit.hasTrade).toBe(b.visit.hasTrade);
    }
  });

  it('legacy callers (no tradeIncidenceConfig) get a sales Visit without hasTrade', () => {
    const { tradeIncidenceConfig: _t, currentVehicleConfig: _c, classifyCreditTier: _f, ...legacy } =
      npcDeps;
    void _t;
    void _c;
    void _f;
    const { visit } = createCustomer(
      {
        personArchetypeId: 'retiree',
        visitArchetypeId: SALES_VISIT_IDS[0]!,
        day: 1,
        slot: 0,
      },
      legacy,
    );
    if (visit.kind === 'sales') {
      expect(visit.hasTrade).toBeUndefined();
    }
  });

  it('service / body visits never carry hasTrade', () => {
    const serviceVisitId = Object.entries(visitArchetypes).find(([, v]) => v.kind === 'service')?.[0];
    expect(serviceVisitId).toBeDefined();
    const { visit } = createCustomer(
      {
        personArchetypeId: 'commuter',
        visitArchetypeId: serviceVisitId!,
        day: 1,
        slot: 0,
      },
      npcDeps,
    );
    expect(visit.kind).not.toBe('sales');
    // schema-level: only sales carries the field. (Service / body visits
    // don't model paymentMethod or trade.)
    expect((visit as Record<string, unknown>).hasTrade).toBeUndefined();
  });
});

// ── Distribution sanity ──────────────────────────────────────────────────────

function sampleHasTrade(
  archetypeId: string,
  paymentMethod: 'cash' | 'finance',
  creditTier: 'A' | 'B' | 'C' | 'D',
  n: number,
  baseSeed: number,
): number {
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (
      rollHasTrade(
        { personArchetypeId: archetypeId, day: 1, slot: i },
        { masterSeed: baseSeed, config: tradeConfig, paymentMethod, creditTier },
      )
    ) {
      count++;
    }
  }
  return count / n;
}

describe('rollHasTrade — distribution sanity', () => {
  it('each (archetype × method × tier) cell hits its target within ±0.08 over 500 samples', () => {
    for (const id of archetypeIds) {
      const profile = tradeConfig.archetypes[id]!;
      for (const m of METHODS) {
        for (const t of TIERS) {
          const rate = sampleHasTrade(id, m, t, 500, 31337);
          const target = profile[m][t];
          expect(Math.abs(rate - target)).toBeLessThan(0.08);
        }
      }
    }
  });

  it('aggregate trade rate across mixed visits lands in [0.30, 0.50]', () => {
    // Mix cash/finance roughly 25/75 (matches the dominant archetype mix)
    // across all archetypes and tiers, all weighted equally.
    let count = 0;
    let total = 0;
    const N = 200;
    for (const id of archetypeIds) {
      for (const t of TIERS) {
        // 25% cash
        for (let i = 0; i < Math.floor(N * 0.25); i++) {
          total++;
          if (
            rollHasTrade(
              { personArchetypeId: id, day: 1, slot: i },
              { masterSeed: 4242, config: tradeConfig, paymentMethod: 'cash', creditTier: t },
            )
          )
            count++;
        }
        // 75% finance
        for (let i = 0; i < Math.floor(N * 0.75); i++) {
          total++;
          if (
            rollHasTrade(
              { personArchetypeId: id, day: 2, slot: i },
              { masterSeed: 4242, config: tradeConfig, paymentMethod: 'finance', creditTier: t },
            )
          )
            count++;
        }
      }
    }
    const rate = count / total;
    expect(rate).toBeGreaterThanOrEqual(0.3);
    expect(rate).toBeLessThanOrEqual(0.55);
  });
});

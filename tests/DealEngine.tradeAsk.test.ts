import {
  generateTradeAsk,
  loadTradeAllowanceNoiseConfig,
  classifyCredit,
  loadCreditTiers,
  type TradeAllowanceNoiseConfig,
  type TradeBookValueFn,
} from '../src/game/DealEngine';
import {
  createCustomer,
  loadTradeIncidenceConfig,
  loadCustomerCurrentVehicleConfig,
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
  type CurrentVehicle,
} from '../src/game/NPC';
import { deriveSeed } from '../src/game/NPC/Rng';

const CFG = loadTradeAllowanceNoiseConfig();

// Constant book-value seam: the pure-function tests pin book so the formula and
// distribution are isolated from the live anchor engine.
const BOOK = 10_000;
const constBook: TradeBookValueFn = () => BOOK;

// Pins the multiplier to exactly meanMultiplier (stdev 0) so the formula can be
// asserted exactly, independent of the noise draw.
const PINNED: TradeAllowanceNoiseConfig = {
  schemaVersion: 1,
  meanMultiplier: 1.0,
  stdev: 0,
  floor: 0.6,
  ceiling: 1.5,
};

function vehicle(loanPayoff: number | null): CurrentVehicle {
  return {
    templateId: 'tmpl',
    make: 'Toyota',
    model: 'Camry',
    year: 2018,
    mileage: 60_000,
    condition: 'average',
    category: 'sedan',
    loanPayoff,
  };
}

const seedAt = (i: number): number =>
  deriveSeed(7, 'test.trade_ask', { i });

// ── Data file ─────────────────────────────────────────────────────────────────

describe('trade-allowance-noise.json — shape', () => {
  it('is a clipped normal centered ~book with a real spread and hard caps', () => {
    expect(CFG.meanMultiplier).toBeCloseTo(1.0, 1);
    expect(CFG.stdev).toBeGreaterThan(0);
    expect(CFG.floor).toBeLessThan(1); // ignorance bargains possible
    expect(CFG.ceiling).toBeGreaterThan(1); // entitled asks possible
  });
});

// ── Formula ───────────────────────────────────────────────────────────────────

describe('generateTradeAsk — formula', () => {
  it('cash owner (null payoff) at the mean multiplier asks honest book', () => {
    const ask = generateTradeAsk(vehicle(null), null, constBook, 1, PINNED);
    expect(ask).toBe(BOOK);
  });

  it('positive-equity owner (payoff < book) is unaffected by the equity term', () => {
    // payoff 4000 < book 10000 → max(0, payoff − book) = 0
    const ask = generateTradeAsk(vehicle(4_000), 4_000, constBook, 1, PINNED);
    expect(ask).toBe(BOOK);
  });

  it('underwater owner (payoff > book) asks the negative-equity-floored amount', () => {
    // ask = book×1 + (payoff − book) = payoff
    const ask = generateTradeAsk(vehicle(15_000), 15_000, constBook, 1, PINNED);
    expect(ask).toBe(15_000);
  });

  it('honors both terms: noisy value plus the equity gap', () => {
    const over: TradeAllowanceNoiseConfig = { ...PINNED, meanMultiplier: 1.2 };
    // book×1.2 = 12000, equity gap = 15000 − 10000 = 5000 → 17000
    const ask = generateTradeAsk(vehicle(15_000), 15_000, constBook, 1, over);
    expect(ask).toBe(17_000);
  });

  it('returns a whole-dollar (rounded) figure', () => {
    const odd: TradeBookValueFn = () => 10_000.7;
    const ask = generateTradeAsk(vehicle(null), null, odd, 1, PINNED);
    expect(Number.isInteger(ask)).toBe(true);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('generateTradeAsk — determinism', () => {
  it('identical seed → identical ask', () => {
    const a = generateTradeAsk(vehicle(null), null, constBook, 99, CFG);
    const b = generateTradeAsk(vehicle(null), null, constBook, 99, CFG);
    expect(a).toBe(b);
  });

  it('different seeds generally produce different asks', () => {
    const asks = new Set<number>();
    for (let i = 0; i < 50; i++) {
      asks.add(generateTradeAsk(vehicle(null), null, constBook, seedAt(i), CFG));
    }
    expect(asks.size).toBeGreaterThan(10);
  });
});

// ── Clip bounds ───────────────────────────────────────────────────────────────

describe('generateTradeAsk — clip caps', () => {
  it('cash-owner asks never escape [book×floor, book×ceiling]', () => {
    for (let i = 0; i < 2000; i++) {
      const ask = generateTradeAsk(vehicle(null), null, constBook, seedAt(i), CFG);
      expect(ask).toBeGreaterThanOrEqual(Math.round(BOOK * CFG.floor));
      expect(ask).toBeLessThanOrEqual(Math.round(BOOK * CFG.ceiling));
    }
  });
});

// ── Distribution sanity ───────────────────────────────────────────────────────

function manyAsks(n: number, loanPayoff: number | null): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      generateTradeAsk(vehicle(loanPayoff), loanPayoff, constBook, seedAt(i), CFG),
    );
  }
  return out;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('generateTradeAsk — distribution', () => {
  it('aggregate cash-owner ask mean ≈ honest book', () => {
    const m = mean(manyAsks(4000, null));
    expect(Math.abs(m - BOOK) / BOOK).toBeLessThan(0.02);
  });

  it('produces both ignorance bargains (< book) and entitled asks (> book)', () => {
    const asks = manyAsks(2000, null);
    expect(Math.min(...asks)).toBeLessThan(BOOK);
    expect(Math.max(...asks)).toBeGreaterThan(BOOK);
  });

  it('underwater financers cluster higher than cash owners', () => {
    // payoff 14000 vs book 10000 → every ask floored upward by the 4000 gap
    const underwater = mean(manyAsks(4000, 14_000));
    const cash = mean(manyAsks(4000, null));
    expect(underwater).toBeGreaterThan(cash);
    // and at least clears the bulk of the payoff
    expect(underwater).toBeGreaterThan(13_000);
  });

  it('zero payoff reads identically to a null (cash) payoff', () => {
    const a = generateTradeAsk(vehicle(0), 0, constBook, 123, CFG);
    const b = generateTradeAsk(vehicle(null), null, constBook, 123, CFG);
    expect(a).toBe(b);
  });
});

// ── Integration: persisted on the visit ───────────────────────────────────────

describe('createCustomer — allowanceAsk persisted on visit (#167)', () => {
  const creditTiers = loadCreditTiers();
  const npcDeps = {
    masterSeed: 12345,
    personArchetypes: loadPersonArchetypes(),
    visitArchetypes: loadVisitArchetypes(),
    traits: loadTraitTaxonomy(),
    currentVehicleConfig: loadCustomerCurrentVehicleConfig(),
    tradeIncidenceConfig: loadTradeIncidenceConfig(),
    classifyCreditTier: (credit: number) => classifyCredit(credit, creditTiers),
    tradeAskFn: (cv: CurrentVehicle, seed: number) =>
      generateTradeAsk(cv, cv.loanPayoff, constBook, seed, CFG),
  };

  const salesVisitId = Object.entries(npcDeps.visitArchetypes).find(
    ([, v]) => v.kind === 'sales',
  )![0];
  const archetypeIds = Object.keys(npcDeps.personArchetypes);

  it('trade visits carry allowanceAsk; no-trade visits do not', () => {
    let sawTrade = false;
    let sawNoTrade = false;
    for (let slot = 0; slot < 200 && !(sawTrade && sawNoTrade); slot++) {
      for (const id of archetypeIds) {
        const { visit } = createCustomer(
          { personArchetypeId: id, visitArchetypeId: salesVisitId, day: 1, slot },
          npcDeps,
        );
        if (visit.kind !== 'sales') continue;
        if (visit.hasTrade) {
          sawTrade = true;
          expect(typeof visit.allowanceAsk).toBe('number');
          expect(visit.allowanceAsk).toBeGreaterThan(0);
        } else {
          sawNoTrade = true;
          expect(visit.allowanceAsk).toBeUndefined();
        }
      }
    }
    expect(sawTrade).toBe(true);
    expect(sawNoTrade).toBe(true);
  });

  it('legacy callers (no tradeAskFn) get a visit without allowanceAsk', () => {
    const { tradeAskFn: _f, ...legacy } = npcDeps;
    void _f;
    for (let slot = 0; slot < 50; slot++) {
      const { visit } = createCustomer(
        { personArchetypeId: archetypeIds[0], visitArchetypeId: salesVisitId, day: 1, slot },
        legacy,
      );
      if (visit.kind === 'sales') {
        expect(visit.allowanceAsk).toBeUndefined();
      }
    }
  });

  it('persisted allowanceAsk is deterministic for a fixed seed', () => {
    const ctx = { personArchetypeId: archetypeIds[0], visitArchetypeId: salesVisitId, day: 3, slot: 7 };
    const a = createCustomer(ctx, npcDeps);
    const b = createCustomer(ctx, npcDeps);
    if (a.visit.kind === 'sales' && b.visit.kind === 'sales') {
      expect(a.visit.allowanceAsk).toBe(b.visit.allowanceAsk);
    }
  });
});

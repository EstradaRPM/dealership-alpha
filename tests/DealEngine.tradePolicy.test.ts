import {
  resolveTradeIn,
  resolveTradePolicyMultiplier,
  loadTradePolicyConfig,
  type NegotiationSkill,
  type TradeBookValueFn,
  type TradeConditionRead,
  type TradePolicyConfig,
} from '../src/game/DealEngine';
import type { CurrentVehicle } from '../src/game/NPC';
import { createRng } from '../src/game/NPC/Rng';

// ── resolveTradePolicyMultiplier (the multiplier-wiring seam, #172) ────────────

describe('resolveTradePolicyMultiplier', () => {
  const CFG: TradePolicyConfig = {
    defaultId: 'market',
    policies: [
      { id: 'aggressive', label: 'Aggressive', multiplier: 1.1, blurb: 'a' },
      { id: 'market', label: 'Market', multiplier: 1.0, blurb: 'm' },
      { id: 'conservative', label: 'Conservative', multiplier: 0.92, blurb: 'c' },
    ],
  };

  it('maps a known id to its multiplier', () => {
    expect(resolveTradePolicyMultiplier('aggressive', CFG)).toBe(1.1);
    expect(resolveTradePolicyMultiplier('market', CFG)).toBe(1.0);
    expect(resolveTradePolicyMultiplier('conservative', CFG)).toBe(0.92);
  });

  it('falls back to the catalog default for an unknown or undefined id', () => {
    expect(resolveTradePolicyMultiplier(undefined, CFG)).toBe(1.0);
    expect(resolveTradePolicyMultiplier('nonsense', CFG)).toBe(1.0);
  });

  it('falls back to the first policy when the default id is itself unknown', () => {
    const broken: TradePolicyConfig = { ...CFG, defaultId: 'gone' };
    expect(resolveTradePolicyMultiplier(undefined, broken)).toBe(1.1);
  });

  it('ships a market default of 1.0 in tunables (the #94 calibration baseline)', () => {
    const live = loadTradePolicyConfig();
    expect(live.defaultId).toBe('market');
    const market = live.policies.find((p) => p.id === 'market');
    expect(market?.multiplier).toBe(1.0);
  });
});

// ── Policy-rate spread over a synthetic 200-visit sample ──────────────────────

const constBook = (book: number): TradeBookValueFn => () => book;

const HONEST_READ: TradeConditionRead = { confidence: 1 }; // target == book × policy
// A strong negotiator: far-above asks counter (not decline) and counters hold
// near target, so the spread is driven by the policy multiplier, not by skill
// noise in the decline path.
const STRONG: NegotiationSkill = { effectiveness: 0.95, trustworthiness: 0.5 };

const CV: CurrentVehicle = {
  templateId: 'tmpl',
  make: 'Toyota',
  model: 'Camry',
  year: 2018,
  mileage: 60_000,
  condition: 'average',
  category: 'sedan',
  loanPayoff: null,
};

/** A deterministic synthetic visit: an honest book and the customer's ask. */
interface Visit {
  readonly book: number;
  readonly ask: number;
}

/** 200 seeded trade visits, asks spread from well-under to well-over book. */
function sampleVisits(seed: number, n = 200): readonly Visit[] {
  const rng = createRng(seed);
  const visits: Visit[] = [];
  for (let i = 0; i < n; i++) {
    const book = 8_000 + Math.round(rng() * 12_000); // 8k–20k
    const askMult = 0.75 + rng() * 0.55; // 0.75×–1.30× book
    visits.push({ book, ask: Math.round(book * askMult) });
  }
  return visits;
}

/** Acquisition rate + average kept-margin (book − agreed) over acquired trades. */
function runPolicy(visits: readonly Visit[], multiplier: number) {
  let acquired = 0;
  let marginSum = 0;
  for (const v of visits) {
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: null,
        allowanceAsk: v.ask,
        skill: STRONG,
        conditionRead: HONEST_READ,
      },
      { bookValueFn: constBook(v.book), policyMultiplier: multiplier },
    );
    if (r.status === 'resolved') {
      acquired++;
      marginSum += v.book - r.agreedAllowance;
    }
  }
  return {
    rate: acquired / visits.length,
    avgMargin: acquired === 0 ? 0 : marginSum / acquired,
  };
}

describe('trade-policy spread (#172 acceptance: distinguishable over 200 visits)', () => {
  const visits = sampleVisits(1234);
  const aggressive = runPolicy(visits, 1.1);
  const market = runPolicy(visits, 1.0);
  const conservative = runPolicy(visits, 0.92);

  it('acquisition rate is strictly aggressive > market > conservative', () => {
    expect(aggressive.rate).toBeGreaterThan(market.rate);
    expect(market.rate).toBeGreaterThan(conservative.rate);
  });

  it('average kept-margin is strictly conservative > market > aggressive', () => {
    expect(conservative.avgMargin).toBeGreaterThan(market.avgMargin);
    expect(market.avgMargin).toBeGreaterThan(aggressive.avgMargin);
  });

  it('the spread is materially large, not a rounding artifact', () => {
    // Acquisition rate and kept-margin both move by a wide, clearly
    // distinguishable margin across the policy band (not a one-trade wobble).
    expect(aggressive.rate - conservative.rate).toBeGreaterThan(0.1);
    expect(conservative.avgMargin - aggressive.avgMargin).toBeGreaterThan(200);
  });
});

// ── Determinism: same policy + inputs → identical resolution ──────────────────

describe('trade-policy determinism', () => {
  it('identical multiplier + inputs produce byte-identical resolutions', () => {
    const visits = sampleVisits(99, 50);
    const a = visits.map((v) =>
      resolveTradeIn(
        {
          currentVehicle: CV,
          loanPayoff: null,
          allowanceAsk: v.ask,
          skill: STRONG,
          conditionRead: HONEST_READ,
        },
        { bookValueFn: constBook(v.book), policyMultiplier: 0.92 },
      ),
    );
    const b = visits.map((v) =>
      resolveTradeIn(
        {
          currentVehicle: CV,
          loanPayoff: null,
          allowanceAsk: v.ask,
          skill: STRONG,
          conditionRead: HONEST_READ,
        },
        { bookValueFn: constBook(v.book), policyMultiplier: 0.92 },
      ),
    );
    expect(a).toEqual(b);
  });

  it('omitting the multiplier matches an explicit 1.0 (market = default)', () => {
    const visits = sampleVisits(7, 50);
    const omitted = visits.map((v) =>
      resolveTradeIn(
        {
          currentVehicle: CV,
          loanPayoff: null,
          allowanceAsk: v.ask,
          skill: STRONG,
          conditionRead: HONEST_READ,
        },
        { bookValueFn: constBook(v.book) },
      ),
    );
    const explicit = visits.map((v) =>
      resolveTradeIn(
        {
          currentVehicle: CV,
          loanPayoff: null,
          allowanceAsk: v.ask,
          skill: STRONG,
          conditionRead: HONEST_READ,
        },
        { bookValueFn: constBook(v.book), policyMultiplier: 1.0 },
      ),
    );
    expect(omitted).toEqual(explicit);
  });
});

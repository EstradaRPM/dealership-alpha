import {
  evaluateTrade,
  loadTradeEvalConfig,
  type NegotiationSkill,
  type TradeBookValueFn,
  type TradeConditionRead,
  type TradeEvalConfig,
} from '../src/game/DealEngine';
import type { CurrentVehicle } from '../src/game/NPC';

const CFG = loadTradeEvalConfig();

// Constant book seam so the decision is isolated from the live anchor engine.
const BOOK = 10_000;
const constBook: TradeBookValueFn = () => BOOK;

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

// Resolved NEGOTIATE composites at a few skill tiers.
const skillAt = (effectiveness: number): NegotiationSkill => ({
  effectiveness,
  trustworthiness: 0.5,
});
const WEAK = skillAt(0.1);
const MID = skillAt(0.5);
const STRONG = skillAt(0.95);

// Condition reads at a few confidence tiers (only confidence matters here).
const readAt = (confidence: number): TradeConditionRead => ({ confidence });
const HONEST_READ = readAt(1.0); // no defensive pull

function evalAsk(
  ask: number,
  skill: NegotiationSkill,
  conditionRead: TradeConditionRead | null,
  opts: { policyMultiplier?: number; config?: TradeEvalConfig } = {},
) {
  return evaluateTrade(
    { currentVehicle: CV, allowanceAsk: ask, skill, conditionRead },
    { bookValueFn: constBook, ...opts },
  );
}

// ── Data file ─────────────────────────────────────────────────────────────────

describe('trade-evaluation.json — shape', () => {
  it('has a real counter window, a partial defensive pull, and a mid skill gate', () => {
    expect(CFG.counterWindowFraction).toBeGreaterThan(0);
    expect(CFG.confidencePenaltyFraction).toBeGreaterThan(0);
    expect(CFG.confidencePenaltyFraction).toBeLessThan(1);
    expect(CFG.counterGiveWeight).toBeGreaterThan(0);
    expect(CFG.skillCounterThreshold).toBeGreaterThan(0);
    expect(CFG.skillCounterThreshold).toBeLessThan(1);
  });
});

// ── Action boundaries (honest read → target == book at market policy) ──────────

describe('evaluateTrade — action boundaries', () => {
  // With an honest read (confidence 1), defensiveFactor = 1 and target = book.
  it('accepts an ask at or below book', () => {
    expect(evalAsk(BOOK, MID, HONEST_READ).action).toBe('accept');
    expect(evalAsk(BOOK - 1, MID, HONEST_READ).action).toBe('accept');
    expect(evalAsk(8_000, STRONG, HONEST_READ).action).toBe('accept');
  });

  it('counters an ask just above book (within the counter window)', () => {
    const withinWindow = Math.round(BOOK * (1 + CFG.counterWindowFraction * 0.5));
    for (const skill of [WEAK, MID, STRONG]) {
      const r = evalAsk(withinWindow, skill, HONEST_READ);
      expect(r.action).toBe('counter');
      expect(typeof r.counterAmount).toBe('number');
    }
  });

  it('declines a far-above ask when the negotiator is weak', () => {
    const farAbove = Math.round(BOOK * (1 + CFG.counterWindowFraction) + 2_000);
    const r = evalAsk(farAbove, WEAK, HONEST_READ);
    expect(r.action).toBe('decline');
    expect(r.counterAmount).toBeUndefined();
  });

  it('counters a far-above ask when the negotiator is skilled', () => {
    const farAbove = Math.round(BOOK * (1 + CFG.counterWindowFraction) + 2_000);
    const r = evalAsk(farAbove, STRONG, HONEST_READ);
    expect(r.action).toBe('counter');
    expect(typeof r.counterAmount).toBe('number');
  });

  it('the skill gate is exactly skillCounterThreshold for a far-above ask', () => {
    const farAbove = Math.round(BOOK * (1 + CFG.counterWindowFraction) + 2_000);
    const atThreshold = evalAsk(farAbove, skillAt(CFG.skillCounterThreshold), HONEST_READ);
    const belowThreshold = evalAsk(
      farAbove,
      skillAt(CFG.skillCounterThreshold - 0.01),
      HONEST_READ,
    );
    expect(atThreshold.action).toBe('counter');
    expect(belowThreshold.action).toBe('decline');
  });
});

// ── Always-present result fields ───────────────────────────────────────────────

describe('evaluateTrade — result shape', () => {
  it('always carries an action and a rationale; counterAmount only on counter', () => {
    const accept = evalAsk(BOOK, MID, HONEST_READ);
    const counter = evalAsk(Math.round(BOOK * 1.1), MID, HONEST_READ);
    const decline = evalAsk(BOOK * 3, WEAK, HONEST_READ);

    for (const r of [accept, counter, decline]) {
      expect(r.rationale.length).toBeGreaterThan(0);
      expect(['accept', 'counter', 'decline']).toContain(r.action);
    }
    expect(accept.counterAmount).toBeUndefined();
    expect(decline.counterAmount).toBeUndefined();
    expect(counter.counterAmount).toBeGreaterThan(0);
  });
});

// ── Determinism ─────────────────────────────────────────────────────────────────

describe('evaluateTrade — determinism', () => {
  it('identical inputs → identical decision', () => {
    const a = evalAsk(11_500, MID, readAt(0.6));
    const b = evalAsk(11_500, MID, readAt(0.6));
    expect(a).toEqual(b);
  });
});

// ── Skill / confidence sanity (the "near book vs over/under-pay" property) ──────

describe('evaluateTrade — skilled near book, weak over- or under-pays', () => {
  const ask = Math.round(BOOK * (1 + CFG.counterWindowFraction * 0.8)); // inside window

  it('a skilled closer with an honest read counters at (≈) book', () => {
    const r = evalAsk(ask, STRONG, HONEST_READ);
    expect(r.action).toBe('counter');
    // effectiveness 0.95 → tiny give; counter sits right above book.
    expect(r.counterAmount).toBeGreaterThanOrEqual(BOOK);
    expect(r.counterAmount! - BOOK).toBeLessThan((ask - BOOK) * 0.2);
  });

  it('a weak negotiator over-pays: counters higher than a skilled one', () => {
    const weak = evalAsk(ask, WEAK, HONEST_READ);
    const strong = evalAsk(ask, STRONG, HONEST_READ);
    expect(weak.counterAmount!).toBeGreaterThan(strong.counterAmount!);
  });

  it('a poor/absent condition read under-pays: pulls the target below book', () => {
    // No UCM (null) → confidence 0 → maximal defensive pull → target < book.
    const noRead = evalAsk(BOOK, STRONG, null);
    // With the target below book, an ask AT book now exceeds it → no longer a
    // clean accept; the defensive staff would rather counter under book.
    expect(noRead.action).toBe('counter');
    expect(noRead.counterAmount!).toBeLessThan(BOOK);
  });

  it('higher read confidence raises the accept ceiling', () => {
    // An ask between the defensive target and book accepts with an honest read
    // but counters with a poor one.
    const honestTarget = BOOK; // confidence 1
    const poorTarget = BOOK * (1 - CFG.confidencePenaltyFraction); // confidence 0
    const between = Math.round((honestTarget + poorTarget) / 2);
    expect(evalAsk(between, MID, HONEST_READ).action).toBe('accept');
    expect(evalAsk(between, MID, null).action).toBe('counter');
  });
});

// ── Policy multiplier (slice #18 seam) ──────────────────────────────────────────

describe('evaluateTrade — trade policy multiplier', () => {
  it('defaults to market (1.0): target == book under an honest read', () => {
    // Ask exactly at book accepts (target == book); a hair above counters.
    expect(evalAsk(BOOK, MID, HONEST_READ).action).toBe('accept');
    expect(evalAsk(BOOK + 1, MID, HONEST_READ).action).toBe('counter');
  });

  it('aggressive policy (> 1) accepts asks above book to chase volume', () => {
    const r = evalAsk(Math.round(BOOK * 1.1), MID, HONEST_READ, {
      policyMultiplier: 1.2,
    });
    expect(r.action).toBe('accept');
  });

  it('conservative policy (< 1) counters/declines asks at book to protect gross', () => {
    const r = evalAsk(BOOK, MID, HONEST_READ, { policyMultiplier: 0.9 });
    expect(r.action).not.toBe('accept');
  });
});

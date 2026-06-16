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
  brand: 'toraya',
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
  it('has a real counter window, a positive generosity premium, and a mid skill gate', () => {
    expect(CFG.counterWindowFraction).toBeGreaterThan(0);
    expect(CFG.appraisalGenerosityPremium).toBeGreaterThan(0);
    expect(CFG.counterGiveWeight).toBeGreaterThan(0);
    expect(CFG.skillCounterThreshold).toBeGreaterThan(0);
    expect(CFG.skillCounterThreshold).toBeLessThan(1);
  });
});

// ── Action boundaries (honest read → target == book at market policy) ──────────

describe('evaluateTrade — action boundaries', () => {
  // With an honest read (confidence 1), generosity factor = 1 and target = book.
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

  it('a poor/absent condition read over-pays: pushes the target above book (#291/M4)', () => {
    // No UCM (null) → confidence 0 → max generosity premium → target > book, so
    // an ask AT book is comfortably accepted at the generous (thin-margin) floor.
    const noRead = evalAsk(BOOK, STRONG, null);
    expect(noRead.action).toBe('accept');
    // And an ask slightly above book — which a tight (honest-read) desk would
    // counter under — still accepts on the generous no-UCM target.
    const aboveBook = Math.round(BOOK * (1 + CFG.appraisalGenerosityPremium / 2));
    expect(evalAsk(aboveBook, STRONG, null).action).toBe('accept');
    expect(evalAsk(aboveBook, STRONG, HONEST_READ).action).toBe('counter');
  });

  it('trade target is monotonic in condition_reading, no-UCM = the generous floor (#291/M4)', () => {
    // Locked ordering (manager-roles-channel-desk.md §4): higher condition-read
    // confidence ⇒ tighter allowance target ⇒ better margin; the no-UCM
    // (confidence 0) target is the most generous = the margin floor. Read the
    // exposed `target` off a far-above ask so every tier yields a real figure.
    const ask = BOOK * 5;
    const targets = [0, 0.25, 0.5, 0.75, 1].map(
      (c) => evalAsk(ask, STRONG, readAt(c)).target,
    );
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i]).toBeLessThan(targets[i - 1]);
    }
    // No UCM reads as zero confidence ⇒ exactly the generous floor.
    expect(evalAsk(ask, STRONG, null).target).toBe(targets[0]);
    // Floor sits above book (thinnest margin); full confidence tightens to book.
    expect(targets[0]).toBeGreaterThan(BOOK);
    expect(targets[targets.length - 1]).toBe(BOOK);
  });

  it('higher read confidence tightens the target — lower margin floor at no UCM (#291/M4)', () => {
    // An ask between book and the generous no-UCM target accepts with a poor
    // (absent) read but counters with an honest one (tighter → better margin).
    const honestTarget = BOOK; // confidence 1
    const poorTarget = BOOK * (1 + CFG.appraisalGenerosityPremium); // confidence 0
    const between = Math.round((honestTarget + poorTarget) / 2);
    expect(evalAsk(between, MID, null).action).toBe('accept');
    expect(evalAsk(between, MID, HONEST_READ).action).toBe('counter');
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

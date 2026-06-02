import {
  resolveTradeIn,
  loadTradeEvalConfig,
  type NegotiationSkill,
  type TradeBookValueFn,
  type TradeConditionRead,
  type TradeResolutionInput,
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

const skillAt = (effectiveness: number): NegotiationSkill => ({
  effectiveness,
  trustworthiness: 0.5,
});
const WEAK = skillAt(0.1);
const MID = skillAt(0.5);
const STRONG = skillAt(0.95);

const readAt = (confidence: number): TradeConditionRead => ({ confidence });
const HONEST_READ = readAt(1.0); // confidence 1 ⇒ defensiveFactor 1 ⇒ target == book

function resolve(
  partial: Partial<TradeResolutionInput> & { allowanceAsk: number },
): ReturnType<typeof resolveTradeIn> {
  return resolveTradeIn(
    {
      currentVehicle: CV,
      loanPayoff: null,
      skill: MID,
      conditionRead: HONEST_READ,
      ...partial,
    },
    { bookValueFn: constBook },
  );
}

// ── Routine resolution ────────────────────────────────────────────────────────

describe('resolveTradeIn — routine auto-resolution', () => {
  it('accepts an ask at/below target: agreed = ask, no counter, equity = allowance', () => {
    const r = resolve({ allowanceAsk: BOOK });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.action).toBe('accept');
    expect(r.hadCounter).toBe(false);
    expect(r.agreedAllowance).toBe(BOOK);
    expect(r.tradeEquity).toBe(BOOK); // no payoff
  });

  it('routine counter (ask within the gap band) agrees at the staff counter', () => {
    // ask 11_000 = target + 1_000; gap 0.1 < routineGapFraction (0.25).
    const r = resolve({ allowanceAsk: 11_000, skill: MID });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.action).toBe('counter');
    expect(r.hadCounter).toBe(true);
    // counter = target + (ask−target)·(1−eff)·counterGiveWeight
    const expected = Math.round(
      BOOK + (11_000 - BOOK) * (1 - MID.effectiveness) * CFG.counterGiveWeight,
    );
    expect(r.agreedAllowance).toBe(expected);
    expect(r.agreedAllowance).toBeLessThan(11_000); // held below the ask
    expect(r.agreedAllowance).toBeGreaterThanOrEqual(BOOK); // never below target
  });

  it('nets the lien payoff out of trade equity on a positive-equity trade', () => {
    const r = resolve({ allowanceAsk: BOOK, loanPayoff: 4_000 });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.agreedAllowance).toBe(BOOK);
    expect(r.tradeEquity).toBe(BOOK - 4_000);
  });
});

// ── Unusual escalation ──────────────────────────────────────────────────────

describe('resolveTradeIn — unusual trades escalate', () => {
  it('escalates an ask far above target even when a skilled closer would counter', () => {
    // ask 13_000 = target × 1.3 > counter window edge (1.25) and > routine gap.
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: null,
        allowanceAsk: 13_000,
        skill: STRONG, // would 'counter' in evaluateTrade, but it's not routine
        conditionRead: HONEST_READ,
      },
      { bookValueFn: constBook },
    );
    expect(r.status).toBe('escalated');
  });

  it('escalates a declined ask (far above + weak negotiator)', () => {
    const r = resolve({ allowanceAsk: 13_000, skill: WEAK });
    expect(r.status).toBe('escalated');
  });

  it('escalates when confidence is below the routine floor', () => {
    // Floor 0.5; a null (zero-confidence) read fails it even on a near-target ask.
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: null,
        allowanceAsk: BOOK,
        skill: MID,
        conditionRead: null,
      },
      { bookValueFn: constBook, config: { ...CFG, routineConfidenceFloor: 0.5 } },
    );
    expect(r.status).toBe('escalated');
  });
});

// ── Negative equity ──────────────────────────────────────────────────────────

describe('resolveTradeIn — negative equity', () => {
  it('abandons a routine trade whose allowance cannot clear the lien', () => {
    const r = resolve({ allowanceAsk: BOOK, loanPayoff: 12_000 });
    expect(r.status).toBe('abandoned');
    if (r.status !== 'abandoned') return;
    expect(r.reason).toBe('negative_equity');
  });

  it('structures when allowance ≥ payoff (boundary)', () => {
    const r = resolve({ allowanceAsk: BOOK, loanPayoff: BOOK });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.tradeEquity).toBe(0);
  });
});

// ── Determinism ──────────────────────────────────────────────────────────────

describe('resolveTradeIn — determinism', () => {
  it('identical inputs produce identical outcomes', () => {
    const a = resolve({ allowanceAsk: 11_000, loanPayoff: 3_000 });
    const b = resolve({ allowanceAsk: 11_000, loanPayoff: 3_000 });
    expect(a).toEqual(b);
  });
});

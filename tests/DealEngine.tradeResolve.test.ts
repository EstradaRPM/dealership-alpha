import {
  resolveTradeIn,
  rollCustomerCounterResponse,
  loadTradeEvalConfig,
  type NegotiationSkill,
  type TradeApprover,
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

// ── Unusual escalation → player review (no manager on staff) ─────────────────

describe('resolveTradeIn — unusual trades escalate to player review', () => {
  it('routes an ask far above target to player review with the full overlay payload', () => {
    // ask 13_000 = target × 1.3 > counter window edge (1.25) and > routine gap.
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: 2_000,
        allowanceAsk: 13_000,
        skill: STRONG, // would 'counter' in evaluateTrade, but it's not routine
        conditionRead: HONEST_READ,
      },
      { bookValueFn: constBook },
    );
    expect(r.status).toBe('player_review');
    if (r.status !== 'player_review') return;
    expect(r.review.book).toBe(BOOK);
    expect(r.review.allowanceAsk).toBe(13_000);
    expect(r.review.payoff).toBe(2_000);
    expect(r.review.target).toBe(BOOK); // honest read ⇒ target == book
    expect(r.review.staffConfidence).toBe(1);
    // advisory counter sits between target and ask
    expect(r.review.recommendedCounter).toBeGreaterThanOrEqual(BOOK);
    expect(r.review.recommendedCounter).toBeLessThanOrEqual(13_000);
    expect(r.review.currentVehicle).toBe(CV);
  });

  it('routes a declined ask (far above + weak negotiator) to player review', () => {
    const r = resolve({ allowanceAsk: 13_000, skill: WEAK });
    expect(r.status).toBe('player_review');
  });

  it('routes a sub-floor-confidence trade to player review', () => {
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
    expect(r.status).toBe('player_review');
  });

  it('forces player review when the ask exceeds the per-slot override, even with a manager', () => {
    const gm: TradeApprover = { role: 'gm', skill: STRONG };
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: null,
        allowanceAsk: 13_000,
        skill: STRONG,
        conditionRead: HONEST_READ,
      },
      { bookValueFn: constBook, approver: gm, playerOverrideThreshold: 12_000 },
    );
    expect(r.status).toBe('player_review');
  });
});

// ── Staff approver path (GM / UCM resolve silently) ──────────────────────────

describe('resolveTradeIn — manager approver resolves an escalated trade', () => {
  it('a GM counters a far-above ask the salesperson would decline (resolved silently)', () => {
    const gm: TradeApprover = { role: 'gm', skill: MID };
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: null,
        allowanceAsk: 13_000, // beyond routine band, within manager window (×1.6)
        skill: WEAK, // salesperson would decline
        conditionRead: HONEST_READ,
      },
      { bookValueFn: constBook, approver: gm },
    );
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.approver).toBe('gm');
    expect(r.action).toBe('counter');
    expect(r.agreedAllowance).toBeGreaterThanOrEqual(BOOK);
    expect(r.agreedAllowance).toBeLessThan(13_000);
  });

  it('a UCM is used when no GM is present', () => {
    const ucm: TradeApprover = { role: 'ucm', skill: MID };
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: null,
        allowanceAsk: 13_000,
        skill: WEAK,
        conditionRead: HONEST_READ,
      },
      { bookValueFn: constBook, approver: ucm },
    );
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.approver).toBe('ucm');
  });

  it('a manager declines an ask beyond even the extended window', () => {
    const gm: TradeApprover = { role: 'gm', skill: WEAK };
    const r = resolveTradeIn(
      {
        currentVehicle: CV,
        loanPayoff: null,
        allowanceAsk: 20_000, // ×2.0, beyond manager window (×1.6) + weak closer
        skill: WEAK,
        conditionRead: HONEST_READ,
      },
      { bookValueFn: constBook, approver: gm },
    );
    expect(r.status).toBe('abandoned');
    if (r.status !== 'abandoned') return;
    expect(r.reason).toBe('manager_declined');
  });
});

// ── Negative equity ──────────────────────────────────────────────────────────

describe('resolveTradeIn — negative equity', () => {
  it('abandons a routine trade whose allowance cannot clear the lien (small overhang)', () => {
    // payoff 10_500 is within the escalation margin (target×1.1 = 11_000) so the
    // trade stays routine, but the accepted 10_000 allowance can't clear it.
    const r = resolve({ allowanceAsk: BOOK, loanPayoff: 10_500 });
    expect(r.status).toBe('abandoned');
    if (r.status !== 'abandoned') return;
    expect(r.reason).toBe('negative_equity');
  });

  it('escalates a large negative-equity overhang to player review', () => {
    // payoff 12_000 overhangs target 10_000 by 20% (> 10% margin) ⇒ unusual.
    const r = resolve({ allowanceAsk: BOOK, loanPayoff: 12_000 });
    expect(r.status).toBe('player_review');
  });

  it('structures when allowance ≥ payoff (boundary)', () => {
    const r = resolve({ allowanceAsk: BOOK, loanPayoff: BOOK });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.tradeEquity).toBe(0);
    expect(r.approver).toBe('auto');
  });
});

// ── Customer accept/reject on a player counter ───────────────────────────────

describe('rollCustomerCounterResponse', () => {
  const ask = 12_000;

  it('always accepts a counter at or above the ask', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(
        rollCustomerCounterResponse(
          { allowanceAsk: ask, counterAmount: ask, priceSensitivity: 1 },
          seed,
          CFG,
        ),
      ).toBe(true);
      expect(
        rollCustomerCounterResponse(
          { allowanceAsk: ask, counterAmount: ask + 500, priceSensitivity: 1 },
          seed,
          CFG,
        ),
      ).toBe(true);
    }
  });

  it('rejects a deep lowball outright (accept prob 0)', () => {
    // 50% haircut × aversion 2 × (1 + 1·1) = 2 ≥ 1 ⇒ prob 0.
    for (let seed = 0; seed < 50; seed++) {
      expect(
        rollCustomerCounterResponse(
          { allowanceAsk: ask, counterAmount: ask / 2, priceSensitivity: 1 },
          seed,
          CFG,
        ),
      ).toBe(false);
    }
  });

  it('is deterministic for the same seed and monotonic in the gap', () => {
    const small = (seed: number) =>
      rollCustomerCounterResponse(
        { allowanceAsk: ask, counterAmount: 11_500, priceSensitivity: 0.3 },
        seed,
        CFG,
      );
    expect(small(7)).toBe(small(7));
    // Acceptance rate falls as the haircut widens.
    const rate = (counter: number) => {
      let acc = 0;
      for (let s = 0; s < 200; s++) {
        if (
          rollCustomerCounterResponse(
            { allowanceAsk: ask, counterAmount: counter, priceSensitivity: 0.5 },
            s,
            CFG,
          )
        )
          acc++;
      }
      return acc / 200;
    };
    expect(rate(11_500)).toBeGreaterThan(rate(10_500));
    expect(rate(10_500)).toBeGreaterThan(rate(9_500));
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

import {
  isSourcingUnlocked,
  normalizeLean,
  scoreCandidate,
  selectAutoBuys,
  type SourcingCandidate,
  type SourcingConfig,
} from '../src/game/MarketEconomy';

// Explicit config so the tests assert behavior, not the calibration-deferred
// data-file numbers (#286). marginReference 0.2 ⇒ 20% book-relative gross = 1.0.
const CONFIG: SourcingConfig = {
  schemaVersion: 1,
  defaultLean: { margin: 1, condition: 1, demandFit: 1 },
  conditionScores: { clean: 1, average: 0.5, rough: 0 },
  marginReference: 0.2,
  demandFitGain: 1,
  buyThreshold: 0.5,
  cashReserve: 1000,
};

const DRIFT_CONFIG = { maxDriftFraction: 0.6, skillReference: 80 };

function candidate(over: Partial<SourcingCandidate> = {}): SourcingCandidate {
  return {
    listingId: 'l',
    cost: 8000,
    book: 10000,
    condition: 'clean',
    demandShare: 1 / 3,
    ...over,
  };
}

describe('#293 sourcing — act gate (channel-desk M6)', () => {
  it('is the earned-stripes cliff on condition_reading: null/below locked, at/above unlocked', () => {
    expect(isSourcingUnlocked(null, 60)).toBe(false);
    expect(isSourcingUnlocked(59, 60)).toBe(false);
    expect(isSourcingUnlocked(60, 60)).toBe(true);
    expect(isSourcingUnlocked(61, 60)).toBe(true);
  });
});

describe('#293 sourcing — lean normalization', () => {
  it('normalizes raw weights to sum 1 regardless of dial scale', () => {
    const n = normalizeLean({ margin: 2, condition: 1, demandFit: 1 });
    expect(n.margin + n.condition + n.demandFit).toBeCloseTo(1);
    expect(n.margin).toBeCloseTo(0.5);
  });

  it('degrades an all-zero lean to an even blend (no divide-by-zero)', () => {
    expect(normalizeLean({ margin: 0, condition: 0, demandFit: 0 })).toEqual({
      margin: 1 / 3,
      condition: 1 / 3,
      demandFit: 1 / 3,
    });
  });
});

describe('#293 sourcing — candidate scoring', () => {
  const segments = 3;

  it('margin axis rises with book-relative spread and floors at/above book', () => {
    const lean = { margin: 1, condition: 0, demandFit: 0 };
    const fat = scoreCandidate(candidate({ cost: 8000, book: 10000 }), lean, segments, { config: CONFIG });
    const thin = scoreCandidate(candidate({ cost: 9500, book: 10000 }), lean, segments, { config: CONFIG });
    const atBook = scoreCandidate(candidate({ cost: 10000, book: 10000 }), lean, segments, { config: CONFIG });
    expect(fat).toBeGreaterThan(thin);
    expect(atBook).toBe(0);
    // 20% book-relative gross is the reference → full 1.0 on the margin axis.
    expect(fat).toBeCloseTo(1);
  });

  it('condition axis ranks clean > average > rough', () => {
    const lean = { margin: 0, condition: 1, demandFit: 0 };
    const s = (c: string) => scoreCandidate(candidate({ condition: c }), lean, segments, { config: CONFIG });
    expect(s('clean')).toBeGreaterThan(s('average'));
    expect(s('average')).toBeGreaterThan(s('rough'));
  });

  it('demand-fit axis is 0.5 at the uniform share and rises with heat', () => {
    const lean = { margin: 0, condition: 0, demandFit: 1 };
    const neutral = scoreCandidate(candidate({ demandShare: 1 / 3 }), lean, segments, { config: CONFIG });
    const hot = scoreCandidate(candidate({ demandShare: 2 / 3 }), lean, segments, { config: CONFIG });
    const cold = scoreCandidate(candidate({ demandShare: 0 }), lean, segments, { config: CONFIG });
    expect(neutral).toBeCloseTo(0.5);
    expect(hot).toBeGreaterThan(neutral);
    expect(cold).toBeLessThan(neutral);
  });
});

describe('#293 sourcing — auto-buy selection', () => {
  const baseInput = {
    lean: { margin: 1, condition: 1, demandFit: 1 },
    segmentCount: 3,
    cashOnHand: 1_000_000,
  };

  it('buys the best-fit units first and skips below-threshold ones', () => {
    const candidates: SourcingCandidate[] = [
      candidate({ listingId: 'great', cost: 8000, book: 10000, condition: 'clean', demandShare: 2 / 3 }),
      candidate({ listingId: 'dog', cost: 10000, book: 10000, condition: 'rough', demandShare: 0 }),
    ];
    const bought = selectAutoBuys({ ...baseInput, candidates }, { config: CONFIG });
    expect(bought).toContain('great');
    expect(bought).not.toContain('dog');
  });

  it('respects the cash reserve floor — never spends into it', () => {
    const candidates: SourcingCandidate[] = [
      candidate({ listingId: 'a', cost: 8000, book: 10000 }),
      candidate({ listingId: 'b', cost: 8000, book: 10000 }),
    ];
    // Only enough above the 1000 reserve to afford ONE unit.
    const bought = selectAutoBuys(
      { ...baseInput, candidates, cashOnHand: 9000 },
      { config: CONFIG },
    );
    expect(bought).toHaveLength(1);
  });

  it('skips an unaffordable unit but still buys a cheaper affordable one', () => {
    const candidates: SourcingCandidate[] = [
      // Higher fit but unaffordable given the budget.
      candidate({ listingId: 'expensive', cost: 50000, book: 70000, condition: 'clean', demandShare: 2 / 3 }),
      // Lower fit but cheap enough to buy.
      candidate({ listingId: 'cheap', cost: 4000, book: 5000, condition: 'clean', demandShare: 1 / 3 }),
    ];
    const bought = selectAutoBuys(
      { ...baseInput, candidates, cashOnHand: 10000 },
      { config: CONFIG },
    );
    expect(bought).toEqual(['cheap']);
  });
});

describe('#293 sourcing — execution drift (M5)', () => {
  const candidates: SourcingCandidate[] = Array.from({ length: 8 }, (_, i) =>
    candidate({
      listingId: `u${i}`,
      cost: 8000 + i * 100,
      book: 10000,
      condition: i % 3 === 0 ? 'clean' : i % 3 === 1 ? 'average' : 'rough',
      demandShare: (i % 3) / 3,
    }),
  );
  const baseInput = {
    candidates,
    lean: { margin: 1, condition: 1, demandFit: 1 },
    segmentCount: 3,
    cashOnHand: 1_000_000,
  };

  it('is deterministic in (skill, seed)', () => {
    const drift = { conditionReadingSkill: 30, seed: 777, config: DRIFT_CONFIG };
    const a = selectAutoBuys({ ...baseInput, drift }, { config: CONFIG });
    const b = selectAutoBuys({ ...baseInput, drift }, { config: CONFIG });
    expect(a).toEqual(b);
  });

  it('a UCM at/above skillReference holds the lean exactly (zero drift = the no-drift pick)', () => {
    const noDrift = selectAutoBuys(baseInput, { config: CONFIG });
    const sharp = selectAutoBuys(
      { ...baseInput, drift: { conditionReadingSkill: 80, seed: 1, config: DRIFT_CONFIG } },
      { config: CONFIG },
    );
    expect(sharp).toEqual(noDrift);
  });

  it('a green UCM drifts off-lean (its picks diverge from the lean-optimal set)', () => {
    const noDrift = selectAutoBuys(baseInput, { config: CONFIG });
    const green = selectAutoBuys(
      { ...baseInput, drift: { conditionReadingSkill: 0, seed: 5, config: DRIFT_CONFIG } },
      { config: CONFIG },
    );
    // Same lean, but a green reader mis-judges fit → a different buy set.
    expect(green).not.toEqual(noDrift);
  });
});

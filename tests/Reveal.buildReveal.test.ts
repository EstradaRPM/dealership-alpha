import {
  buildReveal,
  betVerdictScoreline,
  rankTopCloses,
  winReactionText,
  rankTopWalkOffs,
  walkOffReactionText,
} from '../src/ui/Reveal';
import type { ClosedSale, WalkOff } from '../src/ui/Reveal';
import type { DayFunnel } from '../src/game/CapacityManager';
import type { PrepBet } from '../src/game/PrepBet';
import { loadTunables } from '../src/game/data';

const BUSY_THRESHOLD = loadTunables().reveal.busyWalkedInThreshold;
const STAR_BUDGET = loadTunables().reveal.starBudget;
const LOSS_STAR_BUDGET = loadTunables().reveal.lossStarBudget;

function sale(overrides: Partial<ClosedSale> = {}): ClosedSale {
  return {
    customerId: 'cust:1',
    archetypeLabel: 'Young Family',
    vehicleCategory: 'suv',
    matchQuality: 0.9,
    gross: 2_400,
    ...overrides,
  };
}

function walkOff(overrides: Partial<WalkOff> = {}): WalkOff {
  return {
    customerId: 'cust:2',
    archetypeLabel: 'Commuter',
    wantedCategory: 'sedan',
    reason: 'no_fit',
    ...overrides,
  };
}

function funnel(overrides: Partial<DayFunnel> = {}): DayFunnel {
  return {
    potentialTraffic: 10,
    walkedIn: 8,
    gated: 0,
    staffEngaged: 6,
    sold: 4,
    leakCause: 'none',
    ...overrides,
  };
}

describe('#319 buildReveal — pure Reveal read-model', () => {
  it('frames a zero-traffic day plainly, with no reactions to score', () => {
    const model = buildReveal(funnel({ potentialTraffic: 0, walkedIn: 0 }), 0, {
      strong: 0,
      matched: 0,
    });
    expect(model.scoreline).toBe('No traffic — nothing closed today.');
    expect(model.reactions).toHaveLength(1);
    expect(model.reactions[0]).toMatchObject({ id: 'match-summary', tone: 'neutral' });
    expect(model.reactions[0].text).toMatch(/No sales closed today/);
  });

  it('reads "Busy day" once walked-in clears the tunable threshold', () => {
    const model = buildReveal(
      funnel({ potentialTraffic: 20, walkedIn: BUSY_THRESHOLD }),
      14_200,
      { strong: 6, matched: 8 },
    );
    expect(model.scoreline).toBe(
      'Busy day — you had what the crowd wanted: 6 of 8 stuck.',
    );
    expect(model.reactions[0].tone).toBe('positive');
    expect(model.reactions[0].text).toMatch(/6 of 8 stuck/);
    expect(model.reactions[0].text).toMatch(/\$14,200/);
  });

  it('reads "Slow day" under the threshold and stars a losing verdict when the match rate is weak', () => {
    const model = buildReveal(
      funnel({ potentialTraffic: 10, walkedIn: BUSY_THRESHOLD - 1 }),
      1_500,
      { strong: 1, matched: 4 },
    );
    expect(model.scoreline).toBe(
      "Slow day — the lot didn't fit the crowd: 1 of 4 stuck.",
    );
    expect(model.reactions[0].tone).toBe('negative');
  });

  it('never uses temperature words', () => {
    const model = buildReveal(funnel(), 5_000, { strong: 2, matched: 4 });
    const copy = `${model.scoreline} ${model.reactions.map((r) => r.text).join(' ')}`;
    expect(copy.toLowerCase()).not.toMatch(/\b(warm|hot|cool|cold)\b/);
  });

  it('renders a negative gross day without throwing and formats the sign', () => {
    const model = buildReveal(funnel({ potentialTraffic: 0, walkedIn: 0, sold: 0 }), -1_200, {
      strong: 0,
      matched: 0,
    });
    expect(model.reactions[0].text).toMatch(/-\$1,200/);
  });

  it('exactly one reaction ships with no closes — the match summary', () => {
    const model = buildReveal(funnel(), 9_000, { strong: 3, matched: 5 });
    expect(model.reactions.map((r) => r.id)).toEqual(['match-summary']);
  });
});

describe('#320 winReactionText — the shared win narrative', () => {
  it('stars the customer archetype + vehicle category + gross, never a bare metric', () => {
    const text = winReactionText(sale({ archetypeLabel: 'Young Family', vehicleCategory: 'suv', gross: 2_400 }));
    expect(text).toBe('Young Family wanted an SUV — you had one. SOLD $2,400 front.');
  });

  it('phrases every vehicle category in plain language', () => {
    expect(winReactionText(sale({ vehicleCategory: 'sedan' }))).toMatch(/wanted a sedan/);
    expect(winReactionText(sale({ vehicleCategory: 'truck' }))).toMatch(/wanted a truck/);
    expect(winReactionText(sale({ vehicleCategory: 'suv' }))).toMatch(/wanted an SUV/);
  });
});

describe('#320 rankTopCloses — drama ranking (match strength, then gross)', () => {
  it('ranks by match quality descending', () => {
    const weak = sale({ customerId: 'weak', matchQuality: 0.3, gross: 5_000 });
    const strong = sale({ customerId: 'strong', matchQuality: 0.95, gross: 1_000 });
    const ranked = rankTopCloses([weak, strong], 2);
    expect(ranked.map((c) => c.customerId)).toEqual(['strong', 'weak']);
  });

  it('breaks a match-quality tie by gross descending', () => {
    const low = sale({ customerId: 'low', matchQuality: 0.8, gross: 1_000 });
    const high = sale({ customerId: 'high', matchQuality: 0.8, gross: 5_000 });
    const ranked = rankTopCloses([low, high], 2);
    expect(ranked.map((c) => c.customerId)).toEqual(['high', 'low']);
  });

  it('caps to the limit — the star budget stays small', () => {
    const closes = Array.from({ length: 10 }, (_, i) =>
      sale({ customerId: `c${i}`, matchQuality: i / 10 }),
    );
    expect(rankTopCloses(closes, 3)).toHaveLength(3);
  });

  it('does not mutate the input array', () => {
    const closes = [sale({ customerId: 'a', matchQuality: 0.1 }), sale({ customerId: 'b', matchQuality: 0.9 })];
    const copy = [...closes];
    rankTopCloses(closes, 2);
    expect(closes).toEqual(copy);
  });
});

describe('#320 buildReveal — individual starred win reactions', () => {
  it('appends ranked win reactions after the match summary', () => {
    const closes = [
      sale({ customerId: 'a', matchQuality: 0.95, gross: 3_000 }),
      sale({ customerId: 'b', matchQuality: 0.4, gross: 500 }),
    ];
    const model = buildReveal(funnel(), 3_500, { strong: 1, matched: 2 }, closes);
    expect(model.reactions.map((r) => r.id)).toEqual([
      'match-summary',
      'win-a',
      'win-b',
    ]);
    expect(model.reactions[1].tone).toBe('positive');
    expect(model.reactions[1].text).toBe(winReactionText(closes[0]));
  });

  it('caps starred wins to the tunable star budget', () => {
    const closes = Array.from({ length: STAR_BUDGET + 5 }, (_, i) =>
      sale({ customerId: `c${i}`, matchQuality: 1 - i / 100 }),
    );
    const model = buildReveal(funnel(), 10_000, { strong: 5, matched: closes.length }, closes);
    // One match-summary + at most starBudget win reactions.
    expect(model.reactions.length).toBeLessThanOrEqual(1 + STAR_BUDGET);
  });

  it('no closes ⇒ no win reactions, only the match summary', () => {
    const model = buildReveal(funnel(), 9_000, { strong: 3, matched: 5 });
    expect(model.reactions.map((r) => r.id)).toEqual(['match-summary']);
  });
});

describe('#321 walkOffReactionText — reason-code → plain-language copy (no magic strings)', () => {
  it('names the customer + what they wanted for a no_fit walk-off', () => {
    const text = walkOffReactionText(
      walkOff({ archetypeLabel: 'Commuter', wantedCategory: 'truck', reason: 'no_fit' }),
    );
    expect(text).toBe("Commuter wanted a truck — your lot didn't have one. Walked.");
  });

  it('falls back to generic phrasing when the wanted category is unavailable', () => {
    const text = walkOffReactionText(
      walkOff({ archetypeLabel: 'Commuter', wantedCategory: undefined, reason: 'no_fit' }),
    );
    expect(text).toBe('Commuter wanted something you didn\'t have. Walked.');
  });

  it('falls back to a generic "A customer" when no archetype label carried', () => {
    const text = walkOffReactionText(
      walkOff({ archetypeLabel: undefined, wantedCategory: undefined, reason: 'no_close' }),
    );
    expect(text).toMatch(/^A customer /);
  });

  it('phrases every documented reason code without throwing or falling back', () => {
    const reasons = [
      'no_fit',
      'no_close',
      'trade_negative_equity',
      'trade_manager_declined',
      'trade_player_declined',
      'discount_player_declined',
      'discount_below_cost',
      'discount_haggle_exhausted',
      'patience_drain',
      'trust_collapse',
      'demo_nonnegotiable_miss',
      'no_session',
      'not_sales',
    ];
    for (const reason of reasons) {
      const text = walkOffReactionText(walkOff({ reason }));
      expect(text).toMatch(/Walked\.$/);
      expect(text).not.toBe('Commuter walked.'); // the FALLBACK_WALK_OFF_COPY generic
    }
  });

  it('an unknown reason code falls back to the generic line rather than throwing', () => {
    const text = walkOffReactionText(walkOff({ reason: 'some_future_reason' }));
    expect(text).toBe('Commuter walked.');
  });

  it('never uses temperature words', () => {
    const text = walkOffReactionText(walkOff({ reason: 'no_fit' }));
    expect(text.toLowerCase()).not.toMatch(/\b(warm|hot|cool|cold)\b/);
  });
});

describe('#321 rankTopWalkOffs — only the painful/instructive losses star', () => {
  it('drops the boring-middle reasons (a routine no_close never stars)', () => {
    const ranked = rankTopWalkOffs([walkOff({ reason: 'no_close' })], 5);
    expect(ranked).toHaveLength(0);
  });

  it('keeps painful reasons like no_fit and trade_negative_equity', () => {
    const painful = [
      walkOff({ customerId: 'a', reason: 'no_fit' }),
      walkOff({ customerId: 'b', reason: 'trade_negative_equity' }),
    ];
    const ranked = rankTopWalkOffs(painful, 5);
    expect(ranked.map((w) => w.customerId)).toEqual(['a', 'b']);
  });

  it('caps to the limit — the star budget stays small', () => {
    const painful = Array.from({ length: 10 }, (_, i) =>
      walkOff({ customerId: `c${i}`, reason: 'no_fit' }),
    );
    expect(rankTopWalkOffs(painful, 3)).toHaveLength(3);
  });

  it('does not mutate the input array', () => {
    const walkOffs = [walkOff({ customerId: 'a' }), walkOff({ customerId: 'b', reason: 'no_close' })];
    const copy = [...walkOffs];
    rankTopWalkOffs(walkOffs, 2);
    expect(walkOffs).toEqual(copy);
  });
});

describe('#321 buildReveal — individual starred walk-off (loss) reactions', () => {
  it('appends ranked walk-off reactions after the win reactions', () => {
    const closes = [sale({ customerId: 'a' })];
    const walkOffs = [walkOff({ customerId: 'x', reason: 'no_fit' })];
    const model = buildReveal(funnel(), 2_400, { strong: 1, matched: 1 }, closes, walkOffs);
    expect(model.reactions.map((r) => r.id)).toEqual([
      'match-summary',
      'win-a',
      'walk-x',
    ]);
    expect(model.reactions[2].tone).toBe('negative');
    expect(model.reactions[2].text).toBe(walkOffReactionText(walkOffs[0]));
  });

  it('caps starred walk-offs to the tunable loss star budget', () => {
    const walkOffs = Array.from({ length: LOSS_STAR_BUDGET + 5 }, (_, i) =>
      walkOff({ customerId: `w${i}`, reason: 'no_fit' }),
    );
    const model = buildReveal(funnel(), 0, { strong: 0, matched: 0 }, [], walkOffs);
    expect(model.reactions.length).toBeLessThanOrEqual(1 + LOSS_STAR_BUDGET);
  });

  it('no walk-offs ⇒ no loss reactions', () => {
    const model = buildReveal(funnel(), 9_000, { strong: 3, matched: 5 });
    expect(model.reactions.map((r) => r.id)).toEqual(['match-summary']);
  });

  it('a routine no_close walk-off never stars, even when present', () => {
    const model = buildReveal(funnel(), 9_000, { strong: 3, matched: 5 }, [], [
      walkOff({ reason: 'no_close' }),
    ]);
    expect(model.reactions.map((r) => r.id)).toEqual(['match-summary']);
  });
});

function prepBet(overrides: Partial<PrepBet> = {}): PrepBet {
  return {
    day: 3,
    stockedCategory: 'truck',
    stockedShare: 0.7,
    readCategory: 'truck',
    ...overrides,
  };
}

describe('#322 betVerdictScoreline — the morning bet resolves in plain-match voice', () => {
  it('scores a right call when the stocked lot matches what the crowd wanted', () => {
    const text = betVerdictScoreline(
      prepBet({ stockedCategory: 'truck' }),
      { strong: 2, matched: 3 },
      'truck',
    );
    expect(text).toBe('Trucks filled your lot and your floor. Good match.');
  });

  it('scores a poor match when the crowd wanted a different category', () => {
    const text = betVerdictScoreline(
      prepBet({ stockedCategory: 'truck' }),
      { strong: 0, matched: 1 },
      'sedan',
    );
    expect(text).toBe('Your lot was trucks; the crowd wanted sedans. Poor match.');
  });

  it('scores the mixed case — right lot, but nothing stuck', () => {
    const text = betVerdictScoreline(
      prepBet({ stockedCategory: 'suv' }),
      { strong: 0, matched: 0 },
      'suv',
    );
    expect(text).toBe('Right lot, wrong result — SUVs wanted, none stuck.');
  });

  it('falls back to the morning read as the crowd stand-in on a dead day', () => {
    const text = betVerdictScoreline(
      prepBet({ stockedCategory: 'truck', readCategory: 'sedan' }),
      { strong: 0, matched: 0 },
      null, // the day expressed no want
    );
    expect(text).toBe('Your lot was trucks; the crowd wanted sedans. Poor match.');
  });

  it('returns null (⇒ S1 fallback) when there is no stocking lean', () => {
    expect(
      betVerdictScoreline(prepBet({ stockedCategory: null }), { strong: 0, matched: 0 }, 'truck'),
    ).toBeNull();
  });

  it('returns null when there is nothing to resolve against (no want, no read)', () => {
    expect(
      betVerdictScoreline(prepBet({ readCategory: null }), { strong: 0, matched: 0 }, null),
    ).toBeNull();
  });

  it('never uses temperature words', () => {
    for (const crowd of ['truck', 'sedan', 'suv', null] as const) {
      const text =
        betVerdictScoreline(prepBet(), { strong: 1, matched: 2 }, crowd) ?? '';
      expect(text.toLowerCase()).not.toMatch(/\b(warm|hot|cool|cold)\b/);
    }
  });
});

describe('#322 buildReveal — the scoreline leads with the resolved bet', () => {
  it('replaces the S1 scoreline with the bet→verdict when a bet is present', () => {
    const closes = [sale({ customerId: 'a', vehicleCategory: 'truck' })];
    const model = buildReveal(
      funnel({ walkedIn: BUSY_THRESHOLD }),
      2_400,
      { strong: 1, matched: 1 },
      closes,
      [],
      prepBet({ stockedCategory: 'truck' }),
    );
    expect(model.scoreline).toBe('Trucks filled your lot and your floor. Good match.');
    // The reactions feed is unchanged — the match summary still leads it.
    expect(model.reactions[0].id).toBe('match-summary');
    expect(model.reactions.some((r) => r.id === 'win-a')).toBe(true);
  });

  it('resolves a mismatch off the crowd\'s actual wants (closes + walk-offs)', () => {
    const walkOffs = [
      walkOff({ customerId: 'x', wantedCategory: 'sedan', reason: 'no_fit' }),
      walkOff({ customerId: 'y', wantedCategory: 'sedan', reason: 'no_fit' }),
    ];
    const model = buildReveal(
      funnel(),
      0,
      { strong: 0, matched: 0 },
      [],
      walkOffs,
      prepBet({ stockedCategory: 'truck' }),
    );
    expect(model.scoreline).toBe('Your lot was trucks; the crowd wanted sedans. Poor match.');
  });

  it('falls back to the S1 scoreline when no bet was captured (pre-S4 / empty lot)', () => {
    const model = buildReveal(
      funnel({ walkedIn: BUSY_THRESHOLD }),
      14_200,
      { strong: 6, matched: 8 },
      [],
      [],
      null,
    );
    expect(model.scoreline).toBe(
      'Busy day — you had what the crowd wanted: 6 of 8 stuck.',
    );
  });
});

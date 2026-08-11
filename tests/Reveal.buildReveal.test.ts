import {
  buildReveal,
  betVerdictScoreline,
  scoreDrama,
  rankDrama,
  isStarworthyWalkOff,
  isCrownworthyRecord,
  winReactionText,
  walkOffReactionText,
  crownReactionText,
} from '../src/ui/Reveal';
import type { ClosedSale, WalkOff, BrokenRecord, CrownedRecord } from '../src/ui/Reveal';
import type { DayFunnel } from '../src/game/CapacityManager';
import type { PrepBet } from '../src/game/PrepBet';
import { loadTunables } from '../src/game/data';
import { biteStarBudget } from '../src/game/ClockBite';

const BUSY_THRESHOLD = loadTunables().reveal.busyWalkedInThreshold;
// #382: the day's budget is the DAY bite's, off `data/clock-bites.json`.
const STAR_BUDGET = biteStarBudget('day');

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

function record(overrides: Partial<BrokenRecord> = {}): BrokenRecord {
  return {
    kind: 'bestDayGross',
    value: 4_200,
    previousValue: 3_800,
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

describe('#328 scoreDrama — one drama axis across wins and losses', () => {
  const ctx = { meanGross: 2_000 };

  it('scores a strong-fit close above a poor-fit one', () => {
    const strong = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 0.95, gross: 2_000 }) }, ctx);
    const weak = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 0.3, gross: 2_000 }) }, ctx);
    expect(strong).toBeGreaterThan(weak);
  });

  it('scores a fat front (well above the day norm) above a thin one', () => {
    const fat = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 0.8, gross: 6_000 }) }, ctx);
    const thin = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 0.8, gross: 500 }) }, ctx);
    expect(fat).toBeGreaterThan(thin);
  });

  it('a thin front (at or below the norm) adds no gross surprise — only the upside registers', () => {
    const atNorm = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 0.8, gross: 2_000 }) }, ctx);
    const belowNorm = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 0.8, gross: 100 }) }, ctx);
    expect(belowNorm).toBe(atNorm);
  });

  it('scores a more painful walk-off reason above a milder starworthy one', () => {
    const drama = loadTunables().reveal.drama;
    // no_fit is tuned more painful than trade_manager_declined.
    expect(drama.painByReason.no_fit).toBeGreaterThan(drama.painByReason.trade_manager_declined);
    const noFit = scoreDrama({ kind: 'loss', walkOff: walkOff({ reason: 'no_fit' }) }, ctx);
    const richTrade = scoreDrama({ kind: 'loss', walkOff: walkOff({ reason: 'trade_manager_declined' }) }, ctx);
    expect(noFit).toBeGreaterThan(richTrade);
  });

  it('reads its weights from tunables — zeroing a weight zeroes that term', () => {
    const drama = loadTunables().reveal.drama;
    expect(drama.weights.matchStrength).toBeGreaterThan(0);
    expect(drama.weights.grossSurprise).toBeGreaterThan(0);
    expect(drama.weights.walkOffPain).toBeGreaterThan(0);
    // A win at zero gross-surprise scores exactly matchStrength·matchQuality.
    const s = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 0.5, gross: 2_000 }) }, ctx);
    expect(s).toBeCloseTo(drama.weights.matchStrength * 0.5);
  });
});

describe('#328 rankDrama — wins and losses ranked in one pool', () => {
  it('a fat-gross win outranks a thin win', () => {
    const fat = sale({ customerId: 'fat', matchQuality: 0.8, gross: 6_000 });
    const thin = sale({ customerId: 'thin', matchQuality: 0.8, gross: 500 });
    const ranked = rankDrama([thin, fat], [], [], 5);
    expect(ranked.map((c) => (c.kind === 'win' ? c.sale.customerId : ''))).toEqual([
      'fat',
      'thin',
    ]);
  });

  it('a wanted-in-stock walk-off outranks a mild win', () => {
    const mild = sale({ customerId: 'mild', matchQuality: 0.2, gross: 2_400 });
    const painful = walkOff({ customerId: 'gone', reason: 'no_fit' });
    const ranked = rankDrama([mild], [painful], [], 5);
    const first = ranked[0];
    expect(first.kind).toBe('loss');
    expect(first.kind === 'loss' && first.walkOff.customerId).toBe('gone');
  });

  it('a strong win outranks a milder loss — drama runs both ways', () => {
    const strong = sale({ customerId: 'strong', matchQuality: 0.98, gross: 8_000 });
    const milder = walkOff({ customerId: 'gone', reason: 'trade_manager_declined' });
    const ranked = rankDrama([strong], [milder], [], 5);
    expect(ranked[0].kind).toBe('win');
  });

  it('drops non-starworthy walk-offs before scoring — they never crowd out drama', () => {
    const routine = walkOff({ customerId: 'meh', reason: 'no_close' });
    const ranked = rankDrama([], [routine], [], 5);
    expect(ranked).toHaveLength(0);
  });

  it('respects the unified budget cap', () => {
    const closes = Array.from({ length: 8 }, (_, i) => sale({ customerId: `c${i}`, matchQuality: i / 10 }));
    const walkOffs = Array.from({ length: 8 }, (_, i) => walkOff({ customerId: `w${i}`, reason: 'no_fit' }));
    expect(rankDrama(closes, walkOffs, [], 3)).toHaveLength(3);
  });

  it('breaks drama ties by arrival order (stable)', () => {
    // Three identical-drama wins keep their input order.
    const a = sale({ customerId: 'a', matchQuality: 0.5, gross: 2_000 });
    const b = sale({ customerId: 'b', matchQuality: 0.5, gross: 2_000 });
    const c = sale({ customerId: 'c', matchQuality: 0.5, gross: 2_000 });
    const ranked = rankDrama([a, b, c], [], [], 5);
    expect(ranked.map((r) => (r.kind === 'win' ? r.sale.customerId : ''))).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input arrays', () => {
    const closes = [sale({ customerId: 'a' })];
    const walkOffs = [walkOff({ customerId: 'x', reason: 'no_fit' })];
    const closesCopy = [...closes];
    const walkOffsCopy = [...walkOffs];
    rankDrama(closes, walkOffs, [], 5);
    expect(closes).toEqual(closesCopy);
    expect(walkOffs).toEqual(walkOffsCopy);
  });
});

describe('#328 isStarworthyWalkOff — the loss eligibility gate (shared with the floor toast)', () => {
  it('marks the painful/instructive reasons starworthy', () => {
    expect(isStarworthyWalkOff('no_fit')).toBe(true);
    expect(isStarworthyWalkOff('trade_negative_equity')).toBe(true);
  });

  it('leaves the boring middle unstarred', () => {
    expect(isStarworthyWalkOff('no_close')).toBe(false);
    expect(isStarworthyWalkOff('patience_drain')).toBe(false);
  });

  it('an unknown reason is not starworthy', () => {
    expect(isStarworthyWalkOff('some_future_reason')).toBe(false);
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

  it("caps starred wins to the day bite's star budget", () => {
    const closes = Array.from({ length: STAR_BUDGET + 5 }, (_, i) =>
      sale({ customerId: `c${i}`, matchQuality: 1 - i / 100 }),
    );
    const model = buildReveal(funnel(), 10_000, { strong: 5, matched: closes.length }, closes);
    // One match-summary + at most the day's star budget in win reactions.
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

describe('#328 buildReveal — wins and losses interleave on the unified feed', () => {
  it('a painful loss can outrank a mild win in the reaction order', () => {
    const closes = [sale({ customerId: 'a', matchQuality: 0.2, gross: 2_400 })];
    const walkOffs = [walkOff({ customerId: 'x', reason: 'no_fit' })];
    const model = buildReveal(funnel(), 2_400, { strong: 0, matched: 1 }, closes, walkOffs);
    // The match summary always leads; then the drama order — the painful loss
    // beats the mild win.
    expect(model.reactions.map((r) => r.id)).toEqual([
      'match-summary',
      'walk-x',
      'win-a',
    ]);
    const loss = model.reactions[1];
    expect(loss.tone).toBe('negative');
    expect(loss.text).toBe(walkOffReactionText(walkOffs[0]));
  });

  it('a strong win leads a milder loss on the feed — drama runs both ways', () => {
    const closes = [sale({ customerId: 'a', matchQuality: 0.98, gross: 8_000 })];
    // trade_manager_declined is a milder starworthy loss than no_fit; a strong
    // win outranks it.
    const walkOffs = [walkOff({ customerId: 'x', reason: 'trade_manager_declined' })];
    const model = buildReveal(funnel(), 8_000, { strong: 1, matched: 1 }, closes, walkOffs);
    expect(model.reactions.map((r) => r.id)).toEqual([
      'match-summary',
      'win-a',
      'walk-x',
    ]);
  });

  it('caps the pooled reactions to the single unified star budget', () => {
    const closes = Array.from({ length: STAR_BUDGET + 3 }, (_, i) =>
      sale({ customerId: `c${i}`, matchQuality: 1 - i / 100 }),
    );
    const walkOffs = Array.from({ length: STAR_BUDGET + 3 }, (_, i) =>
      walkOff({ customerId: `w${i}`, reason: 'no_fit' }),
    );
    const model = buildReveal(funnel(), 10_000, { strong: 5, matched: closes.length }, closes, walkOffs);
    // One match summary + at most the day's star budget in pooled reactions.
    expect(model.reactions.length).toBeLessThanOrEqual(1 + STAR_BUDGET);
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

describe('#330 isCrownworthyRecord — a crown means you beat yourself', () => {
  it('crowns a mark that displaced a standing one', () => {
    expect(isCrownworthyRecord(record({ previousValue: 3_800 }))).toBe(true);
  });

  it('does not crown a first-ever mark — the career start would crown everything at once', () => {
    expect(isCrownworthyRecord(record({ previousValue: null }))).toBe(false);
  });
});

describe('#330 crownReactionText — per-mark plain-language crown copy', () => {
  const kinds: CrownedRecord[] = [
    { kind: 'bestDayGross', value: 4_200, previousValue: 3_800 },
    { kind: 'bestMonthGross', value: 52_000, previousValue: 47_500, month: 3 },
    { kind: 'bestPvr', value: 2_100, previousValue: 1_850 },
    { kind: 'bestStreak', value: 6, previousValue: 5 },
    { kind: 'bestSingleDeal', value: 3_100, previousValue: 2_700 },
    { kind: 'mostUnitsInDay', value: 9, previousValue: 8 },
  ];

  it('names the mark, its new value and the number it displaced, with a crown', () => {
    expect(crownReactionText(kinds[0])).toBe('👑 Best day yet — $4,200 gross, beating $3,800.');
    expect(crownReactionText(kinds[4])).toBe('👑 Fattest deal ever — $3,100 front, beating $2,700.');
    expect(crownReactionText(kinds[5])).toBe('👑 9 cars out the door — most in a day, beating 8.');
  });

  it('has copy for every mark kind — crowned, and always speaking the new value', () => {
    for (const r of kinds) {
      const text = crownReactionText(r);
      expect(text.startsWith('👑 ')).toBe(true);
      expect(text).toContain(r.value.toLocaleString('en-US'));
    }
  });

  it('phrases the two count marks in plain units, not dollars', () => {
    expect(crownReactionText(kinds[3])).toBe('👑 Longest selling streak — 6 days running, beating 5.');
    expect(crownReactionText({ kind: 'bestStreak', value: 1, previousValue: 0 })).toContain('1 day running');
    expect(crownReactionText({ kind: 'mostUnitsInDay', value: 1, previousValue: 0 })).toContain('1 car out the door');
  });

  it('speaks the per-car average in plain language, never the trade term', () => {
    expect(crownReactionText(kinds[2])).toBe(
      '👑 Best per-car average yet — $2,100 a car, beating $1,850.',
    );
  });
});

describe('#330 scoreDrama — the record-broken axis', () => {
  const ctx = { meanGross: 2_000 };
  const drama = loadTunables().reveal.drama;

  it('scores a crown above the best ordinary win or loss', () => {
    const crown = scoreDrama({ kind: 'record', record: { kind: 'bestDayGross', value: 4_200, previousValue: 3_800 } }, ctx);
    const bestWin = scoreDrama({ kind: 'win', sale: sale({ matchQuality: 1, gross: 99_000 }) }, ctx);
    const worstLoss = scoreDrama({ kind: 'loss', walkOff: walkOff({ reason: 'no_fit' }) }, ctx);
    expect(crown).toBeGreaterThan(bestWin);
    expect(crown).toBeGreaterThan(worstLoss);
  });

  it('scores a smashed mark above a squeaked-past one', () => {
    const smashed = scoreDrama(
      { kind: 'record', record: { kind: 'bestDayGross', value: 8_000, previousValue: 4_000 } },
      ctx,
    );
    const squeaker = scoreDrama(
      { kind: 'record', record: { kind: 'bestDayGross', value: 4_100, previousValue: 4_000 } },
      ctx,
    );
    expect(smashed).toBeGreaterThan(squeaker);
  });

  it('reads both record weights from tunables — a flat term plus a margin term', () => {
    expect(drama.weights.recordBroken).toBeGreaterThan(0);
    expect(drama.weights.recordMargin).toBeGreaterThan(0);
    // Doubling the mark is a full-margin (clamped) beat.
    const doubled = scoreDrama(
      { kind: 'record', record: { kind: 'bestDayGross', value: 8_000, previousValue: 4_000 } },
      ctx,
    );
    expect(doubled).toBeCloseTo(drama.weights.recordBroken + drama.weights.recordMargin);
  });
});

describe('#330 rankDrama — crowns take star slots in the unified pool', () => {
  const CROWN_BUDGET = loadTunables().reveal.drama.crownBudget;

  it('ranks a crown above the day wins and losses', () => {
    const closes = [sale({ customerId: 'strong', matchQuality: 1, gross: 9_000 })];
    const walkOffs = [walkOff({ customerId: 'gone', reason: 'no_fit' })];
    const ranked = rankDrama(closes, walkOffs, [record()], STAR_BUDGET);
    expect(ranked[0].kind).toBe('record');
  });

  it('drops first-ever marks before scoring — they never take a star slot', () => {
    const ranked = rankDrama([], [], [record({ previousValue: null })], STAR_BUDGET);
    expect(ranked).toHaveLength(0);
  });

  it('caps crowns at the crown budget so a record day is not all crown', () => {
    const records = [
      record({ kind: 'bestDayGross', value: 9_000, previousValue: 3_000 }),
      record({ kind: 'mostUnitsInDay', value: 9, previousValue: 3 }),
      record({ kind: 'bestSingleDeal', value: 6_000, previousValue: 2_000 }),
      record({ kind: 'bestPvr', value: 3_000, previousValue: 1_000 }),
    ];
    const ranked = rankDrama([], [], records, STAR_BUDGET);
    expect(ranked).toHaveLength(CROWN_BUDGET);
    expect(ranked.every((c) => c.kind === 'record')).toBe(true);
  });

  it('leaves the remaining star slots to the day drama', () => {
    const records = [
      record({ kind: 'bestDayGross', value: 9_000, previousValue: 3_000 }),
      record({ kind: 'mostUnitsInDay', value: 9, previousValue: 3 }),
      record({ kind: 'bestSingleDeal', value: 6_000, previousValue: 2_000 }),
    ];
    const closes = Array.from({ length: 6 }, (_, i) =>
      sale({ customerId: `c${i}`, matchQuality: 0.9, gross: 3_000 }),
    );
    const ranked = rankDrama(closes, [], records, STAR_BUDGET);
    expect(ranked.filter((c) => c.kind === 'record')).toHaveLength(CROWN_BUDGET);
    expect(ranked.filter((c) => c.kind === 'win')).toHaveLength(STAR_BUDGET - CROWN_BUDGET);
  });

  it('gives the budgeted slots to the biggest beats', () => {
    const records = [
      record({ kind: 'bestDayGross', value: 3_100, previousValue: 3_000 }),
      record({ kind: 'mostUnitsInDay', value: 9, previousValue: 3 }),
      record({ kind: 'bestSingleDeal', value: 6_000, previousValue: 2_000 }),
    ];
    const kinds = rankDrama([], [], records, STAR_BUDGET).map((c) =>
      c.kind === 'record' ? c.record.kind : '',
    );
    expect(kinds).not.toContain('bestDayGross');
  });

  it('does not mutate the records array', () => {
    const records = [record()];
    const copy = [...records];
    rankDrama([], [], records, STAR_BUDGET);
    expect(records).toEqual(copy);
  });
});

describe('#330 buildReveal — crowned reactions on the same feed', () => {
  it('a day that breaks a record shows the crown alongside the day drama', () => {
    const closes = [sale({ customerId: 'won', gross: 4_200 })];
    const model = buildReveal(
      funnel(),
      4_200,
      { strong: 1, matched: 1 },
      closes,
      [],
      null,
      [record()],
    );
    const crown = model.reactions.find((r) => r.id === 'crown-bestDayGross');
    expect(crown).toBeTruthy();
    expect(crown?.tone).toBe('positive');
    expect(crown?.text).toBe('👑 Best day yet — $4,200 gross, beating $3,800.');
    // Still the same one feed — the match summary leads, the win still shows.
    expect(model.reactions[0].id).toBe('match-summary');
    expect(model.reactions.some((r) => r.id === 'win-won')).toBe(true);
  });

  it('the crown outranks the day drama for its star slot', () => {
    const closes = Array.from({ length: 8 }, (_, i) =>
      sale({ customerId: `c${i}`, matchQuality: 1, gross: 9_000 }),
    );
    const model = buildReveal(funnel(), 72_000, { strong: 8, matched: 8 }, closes, [], null, [
      record(),
    ]);
    // reactions[0] is the match summary; the crown leads the ranked feed.
    expect(model.reactions[1].id).toBe('crown-bestDayGross');
    expect(model.reactions).toHaveLength(1 + STAR_BUDGET);
  });

  it('a day that breaks none shows the normal feed unchanged', () => {
    const closes = [sale({ customerId: 'won' })];
    const walkOffs = [walkOff({ customerId: 'gone', reason: 'no_fit' })];
    const withNone = buildReveal(funnel(), 2_400, { strong: 1, matched: 1 }, closes, walkOffs, null, []);
    const withoutArg = buildReveal(funnel(), 2_400, { strong: 1, matched: 1 }, closes, walkOffs);
    expect(withNone).toEqual(withoutArg);
    expect(withNone.reactions.some((r) => r.id.startsWith('crown-'))).toBe(false);
  });

  it('a first-ever mark does not crown the feed', () => {
    const model = buildReveal(funnel(), 4_200, { strong: 0, matched: 0 }, [], [], null, [
      record({ previousValue: null }),
    ]);
    expect(model.reactions.some((r) => r.id.startsWith('crown-'))).toBe(false);
  });
});

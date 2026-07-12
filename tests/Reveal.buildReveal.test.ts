import { buildReveal, rankTopCloses, winReactionText } from '../src/ui/Reveal';
import type { ClosedSale } from '../src/ui/Reveal';
import type { DayFunnel } from '../src/game/CapacityManager';
import { loadTunables } from '../src/game/data';

const BUSY_THRESHOLD = loadTunables().reveal.busyWalkedInThreshold;
const STAR_BUDGET = loadTunables().reveal.starBudget;

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

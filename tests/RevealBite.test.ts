import { buildBiteReveal, poolBiteDays } from '../src/ui/Reveal';
import type {
  BiteDayBeats,
  ClosedSale,
  WalkOff,
  BrokenRecord,
} from '../src/ui/Reveal';
import type { DayFunnel } from '../src/game/CapacityManager';
import { loadTunables } from '../src/game/data';

const STAR_BUDGET = loadTunables().reveal.drama.starBudget;

function funnel(overrides: Partial<DayFunnel> = {}): DayFunnel {
  return {
    potentialTraffic: 10,
    walkedIn: 8,
    gated: 0,
    staffEngaged: 6,
    sold: 1,
    leakCause: 'engagement',
    ...overrides,
  };
}

function sale(id: string, gross = 2_400): ClosedSale {
  return {
    customerId: id,
    archetypeLabel: 'Young Family',
    vehicleCategory: 'suv',
    matchQuality: 0.9,
    gross,
  };
}

function walkOff(id: string): WalkOff {
  return {
    customerId: id,
    archetypeLabel: 'Commuter',
    wantedCategory: 'sedan',
    reason: 'price_gap',
  };
}

function record(kind: BrokenRecord['kind'] = 'bestDayGross'): BrokenRecord {
  return { kind, value: 4_200, previousValue: 3_800 };
}

function day(overrides: Partial<BiteDayBeats> = {}): BiteDayBeats {
  return {
    funnel: funnel(),
    gross: 2_400,
    matchTally: { strong: 1, matched: 1 },
    closes: [],
    walkOffs: [],
    prepBet: null,
    records: [],
    fniVerdict: null,
    ...overrides,
  };
}

// #381 — the Reveal at the BITE grain. One more producer, not a second mode:
// reactions pool across every day that ran and rank in the SAME single drama
// pool the day uses.
describe('buildBiteReveal (#381)', () => {
  it("a week's Reveal ranks reactions drawn from all seven days", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day({
        closes: [sale(`c${i}`, 1_000 + i * 500)],
        matchTally: { strong: 1, matched: 1 },
        gross: 1_000 + i * 500,
      }),
    );
    const model = buildBiteReveal(days, { daysRequested: 7, haltSentence: null });

    expect(model.scoreline).toContain('7 days run');
    // The pooled tally over the window it actually covers — a week's gross
    // printed as "gross today" is a number the player can check and find wrong.
    expect(model.reactions[0].text).toContain('7 of 7 stuck');
    expect(model.reactions[0].text).toContain('gross over 7 days');
    expect(model.reactions[0].text).not.toContain('today');
    // Every starred reaction is drawn from the pool of all seven days, and the
    // budget is the existing single one (#382 is what scales it).
    const starred = model.reactions.slice(1);
    expect(starred.length).toBeLessThanOrEqual(STAR_BUDGET);
    expect(starred.length).toBeGreaterThan(0);
    // The biggest deal of the week is day 7's, and it is the one crowned —
    // proof the ranking saw days the final one would have swallowed.
    expect(starred.some((r) => r.text.includes('4,000'))).toBe(true);
  });

  it('pools wins, walk-offs and crowns from every day into one feed', () => {
    const pooled = poolBiteDays([
      day({ closes: [sale('a')], walkOffs: [walkOff('w1')], records: [record()] }),
      day({ closes: [sale('b')], walkOffs: [], records: [] }),
      day({ closes: [], walkOffs: [walkOff('w2')], records: [] }),
    ]);
    expect(pooled.closes.map((c) => c.customerId)).toEqual(['a', 'b']);
    expect(pooled.walkOffs.map((w) => w.customerId)).toEqual(['w1', 'w2']);
    expect(pooled.records.length).toBe(1);
    expect(pooled.gross).toBe(7_200);
    expect(pooled.matchTally).toEqual({ strong: 3, matched: 3 });
    expect(pooled.funnel.potentialTraffic).toBe(30);
    expect(pooled.funnel.sold).toBe(3);
  });

  it('a halted week reveals the days it actually ran', () => {
    const model = buildBiteReveal(
      [day({ closes: [sale('a')] }), day({ closes: [sale('b')] })],
      {
        daysRequested: 7,
        haltSentence: 'A deal came to your desk, so the run stopped there.',
      },
    );
    // The span itself states the early stop; the halt reaction says why.
    expect(model.scoreline).toContain('2 of 7 days run');
    expect(model.reactions[0].id).toBe('bite-halt');
    expect(model.reactions[0].text).toBe(
      'A deal came to your desk, so the run stopped there.',
    );
    // Two days of closes, and the window says two — not seven, and not "today".
    expect(model.reactions[1].text).toContain('gross over 2 days');
  });

  it('a completed run states no halt', () => {
    const model = buildBiteReveal([day(), day()], {
      daysRequested: 2,
      haltSentence: null,
    });
    expect(model.scoreline).toContain('2 days run');
    expect(model.reactions.some((r) => r.id === 'bite-halt')).toBe(false);
  });

  it('a one-day bite is the day it has always been, morning bet included', () => {
    const bet = {
      day: 3,
      stockedCategory: 'suv' as const,
      stockedShare: 0.6,
      readCategory: 'suv' as const,
    };
    const model = buildBiteReveal([day({ prepBet: bet, closes: [sale('a')] })], {
      daysRequested: 1,
      haltSentence: null,
    });
    // The S4 bet→verdict scoreline, not the bite span clause.
    expect(model.scoreline).not.toContain('days run');
    expect(model.scoreline).toContain('Good match');
  });

  it('a bite that ran no days states so rather than inventing a day', () => {
    const model = buildBiteReveal([], {
      daysRequested: 7,
      haltSentence: 'The store ran out of money, so the run stopped there.',
    });
    expect(model.scoreline).toBe('0 of 7 days run.');
    expect(model.reactions).toHaveLength(1);
    expect(model.reactions[0].id).toBe('bite-halt');
  });
});

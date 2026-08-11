import { buildBiteReveal } from '../src/ui/Reveal';
import type { BiteDayBeats, ClosedSale, WalkOff } from '../src/ui/Reveal';
import type { PrepBet, PrepCategory } from '../src/game/PrepBet';
import type { DayFunnel } from '../src/game/CapacityManager';

// #383 — the bite is a bet, and the scoreline SETTLES it: the lean the run
// started with, scored against the days that actually ran.

function funnel(): DayFunnel {
  return {
    potentialTraffic: 10,
    walkedIn: 8,
    gated: 0,
    staffEngaged: 6,
    sold: 1,
    leakCause: 'engagement',
  };
}

function sale(id: string, category: PrepCategory): ClosedSale {
  return {
    customerId: id,
    archetypeLabel: 'Young Family',
    vehicleCategory: category,
    matchQuality: 0.9,
    gross: 2_400,
  };
}

function walkOff(id: string, wanted: PrepCategory): WalkOff {
  return {
    customerId: id,
    archetypeLabel: 'Commuter',
    wantedCategory: wanted,
    reason: 'price_gap',
  };
}

function bet(stocked: PrepCategory): PrepBet {
  return { day: 1, stockedCategory: stocked, stockedShare: 0.6, readCategory: stocked };
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

describe('the bite verdict (#383)', () => {
  it("the week's verdict scores the whole week's crowd", () => {
    // Stocked trucks. Five days ran: the crowd bought/asked SUVs on four of
    // them and trucks on one. Scored over every day, not over the last day's
    // beat and not over one busy day's unit count.
    const days = [
      day({ prepBet: bet('truck'), closes: [sale('a', 'suv')] }),
      day({ closes: [sale('b', 'suv'), sale('c', 'suv')] }),
      day({ closes: [], walkOffs: [walkOff('w1', 'suv')] }),
      day({ closes: [sale('d', 'truck')] }),
      day({ closes: [sale('e', 'suv')] }),
    ];
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 5,
      haltSentence: null,
    });
    expect(model.scoreline).toBe(
      '5 days run — You went in leaning on trucks; the crowd asked for SUVs on 4 of 5 days. Poor match.',
    );
  });

  it('a lot that matched the week states the good match, over the days it ran', () => {
    const days = [
      day({ prepBet: bet('suv'), closes: [sale('a', 'suv')] }),
      day({ closes: [sale('b', 'suv')] }),
      day({ closes: [], walkOffs: [walkOff('w1', 'sedan')] }),
    ];
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 3,
      haltSentence: null,
    });
    expect(model.scoreline).toBe(
      '3 days run — You went in leaning on SUVs; the crowd asked for them on 2 of 3 days. Good match.',
    );
  });

  it('a three-day week is judged as three days', () => {
    // The player did not get the run they wagered on. The bet is settled over
    // the three days that happened, and the span clause in front of it states
    // that the run stopped short of the seven they placed.
    const days = [
      day({ prepBet: bet('sedan'), closes: [sale('a', 'truck')] }),
      day({ closes: [sale('b', 'truck')] }),
      day({ closes: [sale('c', 'truck')] }),
    ];
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: 'A deal came to your desk, so the run stopped there.',
    });
    expect(model.scoreline).toBe(
      '3 of 7 days run — You went in leaning on sedans; the crowd asked for trucks on 3 of 3 days. Poor match.',
    );
    // Never scored over the seven that were never run.
    expect(model.scoreline).not.toContain('of 7 days.');
    expect(model.reactions[0].id).toBe('bite-halt');
  });

  it('a dead stretch states no verdict', () => {
    // Nothing closed and nobody walked off wanting anything — there is no crowd
    // to settle the bet against, so the tracer's span scoreline stands rather
    // than a verdict invented out of the morning read.
    const days = [
      day({ prepBet: bet('truck'), matchTally: { strong: 0, matched: 0 }, gross: 0 }),
      day({ matchTally: { strong: 0, matched: 0 }, gross: 0 }),
    ];
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    // ...and the fallback names the window it covers, never "today" (#381).
    expect(model.scoreline).toBe('2 days run — nothing closed over 2 days.');
    expect(model.scoreline).not.toContain('match.');
  });

  it('a bite the crowd asked evenly across states no verdict either', () => {
    // Two categories tied over the run: the crowd named no favorite, so there
    // is nothing to score the lean against. Same fallback, one rule.
    const days = [
      day({ prepBet: bet('truck'), closes: [sale('a', 'suv')] }),
      day({ closes: [sale('b', 'sedan')] }),
    ];
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    expect(model.scoreline).not.toContain('match.');
    expect(model.scoreline).toContain('2 days run');
  });

  it('a bite with no stocking lean falls back, exactly as the day grain does', () => {
    const days = [
      day({ prepBet: { day: 1, stockedCategory: null, stockedShare: 0, readCategory: 'suv' } }),
      day({ closes: [sale('a', 'suv')] }),
    ];
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    expect(model.scoreline).not.toContain('went in leaning');
  });
});

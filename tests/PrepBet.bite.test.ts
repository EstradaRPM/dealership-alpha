import { buildBiteReveal, biteBetVerdictScoreline } from '../src/ui/Reveal';
import type { BiteDayBeats, ClosedSale } from '../src/ui/Reveal';
import type { PrepBet, PrepCategory } from '../src/game/PrepBet';
import type { DayFunnel } from '../src/game/CapacityManager';

// #383 — the bite bet's CAPTURE POINT. The bet a bite is scored on is the lean
// the run started with, held for the whole run and independent of the per-day
// capture that keeps running inside it (`captureDayStartPrepBet` fires on every
// `nextDay()`, so day four recaptures against day four's lot).
//
// The frozen bet already rides `BiteDayBeats[0]`, captured as that day opened —
// so the bite bet is READ from there rather than copied into a second slot that
// could disagree with it.

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

function bet(day: number, stocked: PrepCategory): PrepBet {
  return {
    day,
    stockedCategory: stocked,
    stockedShare: 0.6,
    readCategory: stocked,
  };
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

describe('the bite bet (#383)', () => {
  it("a week's bet is the lean it started with, not day four's", () => {
    // Went in on trucks; restocked into SUVs mid-week (day 4 recaptured), and
    // the crowd wanted SUVs throughout. The verdict is scored on the TRUCK bet
    // the player actually placed — a bet re-read mid-run is a bet the player
    // never got to lose.
    const days = Array.from({ length: 7 }, (_, i) =>
      day({
        prepBet: bet(i + 1, i >= 3 ? 'suv' : 'truck'),
        closes: [sale(`c${i}`, 'suv')],
      }),
    );
    const verdict = biteBetVerdictScoreline(days);
    expect(verdict).toContain('leaning on trucks');
    expect(verdict).not.toContain('leaning on SUVs');
    expect(verdict).toContain('Poor match');
    // ...and the assembled Reveal reads the same bet.
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    expect(model.scoreline).toContain('leaning on trucks');
  });

  it('a run whose first day had no lean states no verdict, even if later days do', () => {
    // An empty (or evenly split) lot on the morning you tapped is no bet. The
    // first non-null bet down the run is a LATER day's posture, and adopting it
    // would invent a wager out of a restock the player made mid-week.
    const days = [
      day({ prepBet: null, closes: [sale('a', 'suv')] }),
      day({ prepBet: bet(2, 'suv'), closes: [sale('b', 'suv')] }),
    ];
    expect(biteBetVerdictScoreline(days)).toBeNull();
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    // Falls back to the tracer's span scoreline.
    expect(model.scoreline).toContain('2 days run');
    expect(model.scoreline).not.toContain('match.');
  });

  it('the per-day capture is untouched — a one-day bite still scores its own morning', () => {
    // Two grains, one module: the day bite delegates to `buildReveal`, which
    // resolves that day's own captured bet exactly as it did before this slice.
    const model = buildBiteReveal(
      [day({ prepBet: bet(3, 'suv'), closes: [sale('a', 'suv')] })],
      { biteId: 'day', daysRequested: 1, haltSentence: null },
    );
    expect(model.scoreline).toContain('Good match');
    expect(model.scoreline).not.toContain('days run');
    expect(model.scoreline).not.toContain('went in leaning');
  });
});

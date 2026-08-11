import fs from 'fs';
import path from 'path';
import { buildReveal, buildBiteReveal, rankDrama } from '../src/ui/Reveal';
import type { FniMonthVerdict } from '../src/game/DealEngine';
import type {
  BiteDayBeats,
  ClosedSale,
  WalkOff,
  BrokenRecord,
} from '../src/ui/Reveal';
import type { DayFunnel } from '../src/game/CapacityManager';
import { biteStarBudget, loadClockBites, BITE_IDS } from '../src/game/ClockBite';

// B4 S2 (#382) — the bigger the bite, the more the Reveal has to leave out.
//
// A day's Reveal shows a handful of starred reactions out of a day's
// candidates. A week runs seven days through the same pool, so a day's budget
// throws away roughly seven times as much — and throws it away SILENTLY, which
// is the failure this slice closes: a player who sold their best unit ever on
// day 4 of a quiet week can finish the week never told, and conclude the feed
// is noise.

const DAY_BUDGET = biteStarBudget('day');
const WEEK_BUDGET = biteStarBudget('week');
const MONTH_BUDGET = biteStarBudget('month');

function funnel(overrides: Partial<DayFunnel> = {}): DayFunnel {
  return {
    potentialTraffic: 12,
    walkedIn: 9,
    gated: 0,
    staffEngaged: 7,
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
    // A starworthy reason: a routine walk is dropped at the eligibility gate
    // and is not part of what the budget cut.
    reason: 'no_fit',
  };
}

function record(kind: BrokenRecord['kind'] = 'bestDayGross'): BrokenRecord {
  return { kind, value: 9_000, previousValue: 8_900 };
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

/** A week whose every day closes `perDay` deals — a deliberately over-full pool. */
function loudWeek(perDay: number, extra: Partial<BiteDayBeats> = {}): BiteDayBeats[] {
  return Array.from({ length: 7 }, (_, d) =>
    day({
      closes: Array.from({ length: perDay }, (_, i) =>
        sale(`d${d}c${i}`, 1_000 + i * 100),
      ),
      matchTally: { strong: perDay, matched: perDay },
      ...extra,
    }),
  );
}

const REMAINDER = 'bite-remainder';

describe('#382 the star budget rides the bite', () => {
  it('the budget rides the bite, not the renderer', () => {
    // Keyed by the bite in `data/clock-bites.json`, one entry per bite...
    const config = loadClockBites();
    for (const id of BITE_IDS) {
      const bite = config.bites.find((b) => b.id === id);
      expect(bite?.starBudget).toBeGreaterThan(0);
      expect(biteStarBudget(id)).toBe(bite?.starBudget);
    }
    // ...and it grows with the bite, sub-linearly: seven days of reactions at
    // seven times the stars is a scroll, not a beat.
    expect(WEEK_BUDGET).toBeGreaterThan(DAY_BUDGET);
    expect(MONTH_BUDGET).toBeGreaterThan(WEEK_BUDGET);
    expect(WEEK_BUDGET).toBeLessThan(DAY_BUDGET * 7);
    expect(MONTH_BUDGET).toBeLessThan(DAY_BUDGET * 30);

    // ...and NOT from a constant in the Reveal renderer. `drama.starBudget` was
    // deleted rather than left beside the per-bite entries — two budgets is two
    // places to disagree about the same day.
    const renderer = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'ui', 'Reveal', 'buildReveal.ts'),
      'utf8',
    );
    expect(renderer).not.toContain('drama.starBudget');
    expect(renderer).toContain('biteStarBudget');
    const tunables = fs.readFileSync(
      path.join(__dirname, '..', 'data', 'tunables.json'),
      'utf8',
    );
    expect(tunables).not.toContain('starBudget');
  });

  it("a day's feed is unchanged", () => {
    // The shipped day budget is the pre-#382 number: a day's Reveal after this
    // slice is identical to before it, or the tracer's live reading changed for
    // a reason nobody filed.
    expect(DAY_BUDGET).toBe(5);

    const closes = Array.from({ length: DAY_BUDGET + 6 }, (_, i) =>
      sale(`c${i}`, 3_000 - i * 10),
    );
    const model = buildReveal(
      funnel(),
      12_000,
      { strong: 4, matched: closes.length },
      closes,
    );
    // One match summary + exactly the day's budget in starred reactions, and no
    // leftover line: a day's handful through a day's budget is the feed doing
    // its job, and the statement of what was cut is the bite's affordance.
    expect(model.reactions).toHaveLength(1 + DAY_BUDGET);
    expect(model.reactions.some((r) => r.id === REMAINDER)).toBe(false);

    // The same day driven as a one-day bite delegates to the same builder.
    const asBite = buildBiteReveal(
      [
        day({
          closes,
          gross: 12_000,
          matchTally: { strong: 4, matched: closes.length },
        }),
      ],
      { biteId: 'day', daysRequested: 1, haltSentence: null },
    );
    expect(asBite).toEqual(model);
  });

  it('an over-full week says how much it left out', () => {
    const days = loudWeek(5);
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    const starred = model.reactions.filter(
      (r) => r.id !== 'match-summary' && r.id !== REMAINDER,
    );
    expect(starred).toHaveLength(WEEK_BUDGET);

    // The remainder is stated as ONE plain-language line, last, and it names
    // the window it counts over — not "today", which a week's figure is not.
    const leftover = model.reactions[model.reactions.length - 1];
    expect(leftover.id).toBe(REMAINDER);
    expect(leftover.text).toBe(
      `Plus ${35 - WEEK_BUDGET} smaller moments over 7 days, too small to make the cut.`,
    );
    // One line, not an expandable list: the feed's job is the top of the pile.
    expect(model.reactions.filter((r) => r.id === REMAINDER)).toHaveLength(1);
  });

  it('a quiet bite carries no leftover line', () => {
    // Two closes across a week — nothing was cut, so nothing is claimed to be.
    const days = [
      day({ closes: [sale('a')] }),
      day({ closes: [sale('b')] }),
      day(),
      day(),
      day(),
      day(),
      day(),
    ];
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    expect(model.reactions.some((r) => r.id === REMAINDER)).toBe(false);
  });

  it('a crowned record survives a loud week', () => {
    // A week loud enough to fill the budget several times over with wins, plus
    // a crown squeaking past its old mark — the weakest score a crown can take.
    //
    // Under the SHIPPED weights this cannot currently fail: `recordBroken` (2)
    // alone matches the ceiling of a win (`matchStrength` + `grossSurprise`, 1
    // each, both clamped to [0,1]) and crowns lead the arrival tiebreak. That is
    // exactly why the reservation exists rather than the weighting being trusted
    // — retuning the drama weights is C2-class calibration this slice does not
    // do, and a retune must not be able to silently drop a high-water mark. The
    // reservation itself is driven where it bites in the `rankDrama` test below.
    const days = loudWeek(6);
    days[3] = day({
      closes: days[3].closes,
      matchTally: days[3].matchTally,
      records: [record('bestDayGross')],
    });
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    const crowns = model.reactions.filter((r) => r.id.startsWith('crown-'));
    expect(crowns).toHaveLength(1);
    // And the budget is still the budget — reserving a slot does not widen it.
    const starred = model.reactions.filter(
      (r) => r.id !== 'match-summary' && r.id !== REMAINDER,
    );
    expect(starred).toHaveLength(WEEK_BUDGET);
  });

  it('a reserved crown does not reorder the feed', () => {
    // The admitted set is still emitted in the pool's own drama order: crowns
    // outscore wins, so the crown leads whether it was reserved or ranked in.
    const days = loudWeek(6);
    days[5] = day({
      closes: days[5].closes,
      matchTally: days[5].matchTally,
      records: [record('bestDayGross'), record('bestMonthGross')],
    });
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: null,
    });
    const starred = model.reactions.filter(
      (r) => r.id !== 'match-summary' && r.id !== REMAINDER,
    );
    // `drama.crownBudget` still caps how many crowns take slots (#330) — the
    // reservation guarantees the crowned marks that survive that cap, it does
    // not repeal it.
    expect(starred.slice(0, 2).every((r) => r.id.startsWith('crown-'))).toBe(true);
  });

  it('a halted week is budgeted as a week, not as the days it got', () => {
    // The budget is a property of the window the player bet on, not of how far
    // the run got before the store needed them.
    const days = loudWeek(6).slice(0, 2);
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: 7,
      haltSentence: 'A deal came to your desk, so the run stopped there.',
    });
    const starred = model.reactions.filter(
      (r) => !['match-summary', REMAINDER, 'bite-halt'].includes(r.id),
    );
    expect(starred).toHaveLength(WEEK_BUDGET);
    expect(model.reactions[model.reactions.length - 1].text).toContain('over 2 days');
  });

  it('the crown reservation outranks the budget itself', () => {
    // Driven at the one limit where the reservation can bite today: the month
    // verdict is the only candidate that outscores a crown (#373's `fniVerdict`
    // weight, 2.5). At a budget of 2 with a verdict and two crowns, a plain
    // top-N takes the verdict and one crown; the reservation takes both crowns.
    //
    // No shipped budget is that small — the smallest is the day's 5, and
    // `drama.crownBudget` (2) plus one verdict always fits inside it — so this
    // is a guard on the ranking, not a behaviour the player meets today.
    const verdict: FniMonthVerdict = {
      month: 3,
      postureId: 'balanced',
      postureLabel: 'Balanced',
      deskName: null,
      unitsRetailed: 8,
      financedUnits: 5,
      financedShare: 0.625,
      productGross: 7_000,
      reserveGross: 5_000,
      backGross: 12_000,
      perUnit: 1_500,
      mix: 'matched',
    };
    const records = [record('bestDayGross'), record('bestMonthGross')];
    const ranked = rankDrama([sale('a')], [], records, 2, verdict);
    expect(ranked.map((c) => c.kind)).toEqual(['record', 'record']);
    // Unreserved, the same pool at the same limit leads with the verdict.
    expect(rankDrama([sale('a')], [], [], 2, verdict)[0].kind).toBe('fni');
  });

  it('one leftover moment reads as one', () => {
    const perDay = 1;
    const closes = WEEK_BUDGET + 1;
    const days = Array.from({ length: closes }, (_, i) =>
      day({
        closes: Array.from({ length: perDay }, () => sale(`c${i}`, 1_000 + i)),
        matchTally: { strong: 1, matched: 1 },
      }),
    );
    const model = buildBiteReveal(days, {
      biteId: 'week',
      daysRequested: closes,
      haltSentence: null,
    });
    expect(model.reactions[model.reactions.length - 1].text).toContain(
      '1 smaller moment ',
    );
  });
});

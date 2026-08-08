import {
  buildReveal,
  rankDrama,
  fniVerdictReactionText,
  type ClosedSale,
  type WalkOff,
} from '../src/ui/Reveal';
import {
  buildFniMonthVerdict,
  loadFniPostureConfig,
  type FniMonthInput,
  type FniMonthVerdict,
} from '../src/game/DealEngine';
import type { DayFunnel } from '../src/game/CapacityManager';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * The monthly F&I verdict (#373) — B2's payoff beat and the test that the Reveal
 * grammar spans grains. The posture (#366) is a bet placed once and left
 * standing; this is the feed resolving it at the month grain, on the same
 * `reactions[]` shape a single day's win rides.
 */

const FUNNEL: DayFunnel = {
  potentialTraffic: 12,
  walkedIn: 8,
  gated: 0,
  staffEngaged: 6,
  sold: 2,
  leakCause: 'none',
};

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

let dealSeq = 0;

/** One closed retail unit on a live bus — the only input the verdict reads. */
function closeOne(
  bus: ReturnType<typeof createEventBus>,
  over: {
    paymentMethod: 'cash' | 'finance';
    productGross: number;
    reserveGross: number;
  },
): void {
  dealSeq += 1;
  bus.publish('deal:closed', {
    customerId: `c${dealSeq}`,
    vehicleId: `v${dealSeq}`,
    agreedPrice: 20_000,
    frontGross: 1_500,
    backGross: over.productGross + over.reserveGross,
    productGross: over.productGross,
    reserveGross: over.reserveGross,
    daysInInventory: 10,
    paymentMethod: over.paymentMethod,
    downPayment: over.paymentMethod === 'cash' ? 20_000 : 2_000,
    loanAmount: over.paymentMethod === 'cash' ? 0 : 18_000,
    term: over.paymentMethod === 'cash' ? 0 : 60,
    apr: over.paymentMethod === 'cash' ? 0 : 0.089,
  });
}

const BASE: FniMonthInput = {
  month: 3,
  postureId: 'balanced',
  deskName: 'Dana Reyes',
  unitsRetailed: 12,
  financedUnits: 9,
  productGross: 4_800,
  reserveGross: 3_600,
};

function verdict(over: Partial<FniMonthInput> = {}): FniMonthVerdict {
  const built = buildFniMonthVerdict({ ...BASE, ...over });
  if (!built) throw new Error('fixture retailed nothing');
  return built;
}

describe('the monthly F&I verdict (#373)', () => {
  it("the month's F&I verdict names the posture and both halves", () => {
    const text = fniVerdictReactionText(verdict());

    // The posture the month was written at, in the player's own words.
    expect(text).toContain('Balanced');
    // The two halves #365 split on `deal:closed`, named separately — a single
    // "back gross" number cannot tell the player WHICH lever moved.
    expect(text).toContain('$4,800 products');
    expect(text).toContain('$3,600 rate');
    // And the total on the units that carried it.
    expect(text).toContain('$8,400');
    expect(text).toContain('12 cars');
  });

  it('the verdict stars the finance manager, not a number', () => {
    // The spine's load-bearing rule: a reaction stars an ENTITY with a fate.
    expect(fniVerdictReactionText(verdict())).toContain(
      'Dana Reyes worked the desk',
    );

    // With nobody hired the entity is the office itself — "sat empty" is a fate.
    // The beat still fires, because a store that never opened a finance office
    // has just spent a month proving what that costs.
    const empty = fniVerdictReactionText(verdict({ deskName: null }));
    expect(empty).toContain('No finance office');
    expect(empty).not.toContain('worked the desk');
  });

  it('a cash-heavy month against a gross posture reads as the mismatch it was', () => {
    // Reaching for markup ("More per deal") in a month that paid cash: the bet
    // had almost nothing to bite on, and the reaction says so rather than
    // reporting a thin number and leaving the player to infer why.
    const mismatch = verdict({
      postureId: 'more-per-deal',
      financedUnits: 2,
      reserveGross: 400,
    });
    expect(mismatch.mix).toBe('too_few_financed');
    const text = fniVerdictReactionText(mismatch);
    expect(text).toContain('Only 2 of 12 financed');
    expect(text).toContain('cash-paying crowd');

    // The mirror: holding the rate down for a crowd that was going to borrow
    // anyway. Same one comparison, read from the other end.
    const gaveItAway = verdict({ postureId: 'more-deals', financedUnits: 12 });
    expect(gaveItAway.mix).toBe('too_many_financed');
    expect(fniVerdictReactionText(gaveItAway)).toContain(
      'going to borrow anyway',
    );

    // The month the posture was a bet on reads as the match it was.
    expect(verdict({ postureId: 'more-per-deal', financedUnits: 11 }).mix).toBe(
      'matched',
    );
  });

  it('Balanced is never a mismatch, at either end of the mix', () => {
    // It is the posture that makes no bet on the payment mix — it can be beaten
    // on money, never on the crowd. The band in `data/tunables.json` says so;
    // this pins the reading rather than the number.
    expect(verdict({ financedUnits: 0 }).mix).toBe('matched');
    expect(verdict({ financedUnits: 12 }).mix).toBe('matched');
  });

  it('a month that retailed nothing produces no verdict at all', () => {
    // No crowd, so no bet to resolve — blaming the dial for a floor problem is
    // exactly the wrong lesson. (`bestFniPvr` stays uncrowned for the same
    // reason; see tests/Records.test.ts.)
    expect(
      buildFniMonthVerdict({ ...BASE, unitsRetailed: 0, financedUnits: 0 }),
    ).toBeNull();
  });

  it('an unknown posture id falls back to the catalog default', () => {
    // A slot saved before the dial existed, or one naming a retired posture.
    // The verdict names a real posture or it names nothing — it never reports a
    // month written at "undefined".
    const config = loadFniPostureConfig();
    expect(verdict({ postureId: undefined }).postureId).toBe(config.defaultId);
    expect(verdict({ postureId: 'pack-the-payment' }).postureId).toBe(
      config.defaultId,
    );
  });

  describe('on the feed', () => {
    const SALE: ClosedSale = {
      customerId: 'c1',
      archetypeLabel: 'A commuter',
      vehicleCategory: 'sedan',
      matchQuality: 0.95,
      gross: 4_000,
    };
    const WALK: WalkOff = {
      customerId: 'c2',
      archetypeLabel: 'A tradesperson',
      wantedCategory: 'truck',
      reason: 'no_fit',
    };

    it('takes the headline slot on the bite it arrives on', () => {
      const ranked = rankDrama([SALE], [WALK], [], 5, verdict());
      expect(ranked[0]).toMatchObject({ kind: 'fni' });
    });

    it('rides the same reactions[] as every other beat, and only when it exists', () => {
      const tally = { strong: 1, matched: 1 };
      const withVerdict = buildReveal(
        FUNNEL,
        9_000,
        tally,
        [SALE],
        [WALK],
        null,
        [],
        verdict(),
      );
      // Reaction 0 is always the day's aggregate match summary; the verdict is
      // the top-ranked STARRED reaction after it — no month mode, no second
      // feed, no separate screen.
      expect(withVerdict.reactions[1].id).toBe('fni-month-3');
      expect(withVerdict.reactions[1].tone).toBe('positive');

      // Every other day of the month is untouched.
      const ordinary = buildReveal(FUNNEL, 9_000, tally, [SALE], [WALK]);
      expect(ordinary.reactions.some((r) => r.id.startsWith('fni-month'))).toBe(
        false,
      );
    });

    // Anti-orphan: the model is only worth anything if the assembled world can
    // answer with it. This exercises `World.getFniMonthVerdict` — the KPI window
    // arithmetic, the posture getter and the desk pick — off real closed deals
    // on a real bus, which is the half a pure-model test cannot see.
    it('the assembled world answers with the month the deals actually closed in', () => {
      const bus = createEventBus();
      const world = createWorld({
        bus,
        masterSeed: 373,
        characterProfile: PROFILE,
        getFniPostureId: () => 'more-per-deal',
      });
      bus.publish('clock:day_started', { day: 1 });
      closeOne(bus, { paymentMethod: 'cash', productGross: 400, reserveGross: 0 });
      closeOne(bus, { paymentMethod: 'cash', productGross: 200, reserveGross: 0 });
      closeOne(bus, {
        paymentMethod: 'finance',
        productGross: 900,
        reserveGross: 700,
      });

      const live = world.getFniMonthVerdict(30);
      expect(live).toMatchObject({
        month: 1,
        postureId: 'more-per-deal',
        postureLabel: 'More per deal',
        unitsRetailed: 3,
        financedUnits: 1,
        productGross: 1_500,
        reserveGross: 700,
        backGross: 2_200,
        // Two of three paid cash against a posture that needs financed volume.
        mix: 'too_few_financed',
      });
      // Nobody was hired, so the office has no name to star — and that IS the
      // month's fate, not a missing value.
      expect(live?.deskName).toBeNull();

      // The window is the month that closed, not the career: the same store one
      // month on reports only what it sold in that month.
      expect(world.getFniMonthVerdict(60)).toBeNull();
    });

    it('reads as a loss when the crowd was against the posture', () => {
      const mismatch = buildReveal(
        FUNNEL,
        9_000,
        { strong: 1, matched: 1 },
        [SALE],
        [WALK],
        null,
        [],
        verdict({ postureId: 'more-per-deal', financedUnits: 1 }),
      );
      // Tone follows the MIX, not the money: a month can earn well and still
      // have been the wrong standing bet.
      expect(mismatch.reactions[1].tone).toBe('negative');
    });
  });
});

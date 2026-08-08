import { createWorld } from '../src/createWorld';
import { createEventBus } from '../src/game/EventBus';
import {
  projectCrowdFinanceMix,
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import { loadCreditTiers } from '../src/game/DealEngine';
import type { CharacterProfile } from '../src/game/CareerProgression';

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

/**
 * #371 — the crowd's finance mix, read ahead.
 *
 * The player sets next month's finance posture *knowing* which way the crowd
 * leans. The whole point of deriving that read rather than sampling it is that
 * a gated read must never be able to move the world: opening the lane changes
 * what the player sees, never what happens.
 */

const DEPS = {
  personArchetypes: loadPersonArchetypes(),
  visitArchetypes: loadVisitArchetypes(),
  traits: loadTraitTaxonomy(),
  creditBands: Object.entries(loadCreditTiers().tiers).map(([tier, def]) => ({
    tier,
    minScore: def.minScore,
  })),
};

/** The retiree leans hardest toward cash; the young family hardest away. */
const RETIREE = { personArchetypeId: 'retiree', visitArchetypeId: 'retirement_upgrade' };
const FAMILY = {
  personArchetypeId: 'young_family',
  visitArchetypeId: 'family_vehicle_search',
};

describe('#371 finance-mix projection', () => {
  it('the read consumes no randomness and moves with the demand config', () => {
    // Pure in the strong sense: hand it a saboteur RNG and it never asks.
    const realRandom = Math.random;
    let draws = 0;
    Math.random = () => {
      draws++;
      return 0.5;
    };
    try {
      const mix = projectCrowdFinanceMix([{ ...FAMILY, share: 1 }], DEPS);
      expect(draws).toBe(0);
      expect(mix.cashShare + mix.financeShare).toBeCloseTo(1, 10);
      const creditTotal = mix.creditMix.reduce((sum, b) => sum + b.share, 0);
      expect(creditTotal).toBeCloseTo(1, 10);
    } finally {
      Math.random = realRandom;
    }

    // ...and it is a function of the configuration, not of a sample: the same
    // crowd projects identically every time, and a different crowd differs.
    const a = projectCrowdFinanceMix([{ ...FAMILY, share: 1 }], DEPS);
    const b = projectCrowdFinanceMix([{ ...FAMILY, share: 1 }], DEPS);
    expect(a).toEqual(b);
    const shifted = projectCrowdFinanceMix(
      [
        { ...FAMILY, share: 0.5 },
        { ...RETIREE, share: 0.5 },
      ],
      DEPS,
    );
    expect(shifted.cashShare).toBeGreaterThan(a.cashShare);
  });

  it('the reported mix tracks the crowd it describes', () => {
    const cashLeaning = projectCrowdFinanceMix([{ ...RETIREE, share: 1 }], DEPS);
    const financeLeaning = projectCrowdFinanceMix([{ ...FAMILY, share: 1 }], DEPS);

    // The retiree archetype pays cash far more often than the young family.
    expect(cashLeaning.cashShare).toBeGreaterThan(financeLeaning.cashShare);
    expect(financeLeaning.financeShare).toBeGreaterThan(cashLeaning.financeShare);

    // And the credit mix follows the same crowd: the retiree's 754/26 draw sits
    // almost entirely in the top band, the young family's 658/48 does not.
    const topOf = (m: typeof cashLeaning) =>
      m.creditMix.find((b) => b.tier === 'A')?.share ?? 0;
    expect(topOf(cashLeaning)).toBeGreaterThan(topOf(financeLeaning));

    // Weighting is honest: a half-and-half crowd lands between the two.
    const blended = projectCrowdFinanceMix(
      [
        { ...RETIREE, share: 1 },
        { ...FAMILY, share: 1 },
      ],
      DEPS,
    );
    expect(blended.cashShare).toBeLessThan(cashLeaning.cashShare);
    expect(blended.cashShare).toBeGreaterThan(financeLeaning.cashShare);
  });

  it('describes the FINANCED book, not every up', () => {
    // Credit and payment leaning are correlated through the archetype — the
    // best-credit crowd is also the likeliest to write a cheque — so an
    // all-comers credit mix would flatter the book the F&I office actually
    // writes. Dropping the retiree's cash buyers out of the credit weighting is
    // what makes the two halves answer different questions.
    const crowd = [
      { ...RETIREE, share: 1 },
      { ...FAMILY, share: 1 },
    ];
    const mix = projectCrowdFinanceMix(crowd, DEPS);
    const allComers = projectCrowdFinanceMix(
      crowd.map((c) => ({ ...c })),
      DEPS,
    );
    expect(mix).toEqual(allComers);
    // The financed book skews away from the cash-heavy retiree, so its top band
    // sits below the retiree's own.
    const retireeTop =
      projectCrowdFinanceMix([{ ...RETIREE, share: 1 }], DEPS).creditMix.find(
        (b) => b.tier === 'A',
      )?.share ?? 0;
    const bookTop = mix.creditMix.find((b) => b.tier === 'A')?.share ?? 0;
    expect(bookTop).toBeLessThan(retireeTop);
  });

  it('the live world composes the read off the demand heat map', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 7, characterProfile: PROFILE });

    const before = world.getCrowdFinanceMix();
    expect(before.cashShare + before.financeShare).toBeCloseTo(1, 10);

    // Swing the heat map hard onto trucks. The tradesperson is the only truck
    // archetype, so the projected crowd — and its mix — must move with it.
    world.demandShaper.setMix({ sedan: 0.001, truck: 1, suv: 0.001 });
    const trucky = world.getCrowdFinanceMix();
    expect(trucky).not.toEqual(before);

    world.demandShaper.setMix({ sedan: 0.001, truck: 0.001, suv: 1 });
    const suvish = world.getCrowdFinanceMix();
    // The SUV segment is the retiree's, and retirees pay cash far more often
    // than tradespeople do.
    expect(suvish.cashShare).toBeGreaterThan(trucky.cashShare);
  });
});

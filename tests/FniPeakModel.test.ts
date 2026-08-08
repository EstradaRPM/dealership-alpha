import {
  projectFniPostures,
  loadFniDealKillConfig,
  type FinancedDealSample,
  type FniDealKillConfig,
} from '../src/game/DealEngine';

/**
 * #370 — the posture peak model behind the meter.
 *
 * Everything here is a pure read over the store's own financed book. The model
 * composes the three rules that already exist (`computeReserve`,
 * `fallThroughProbability`, `markupSatisfactionHit`) rather than adding a
 * fourth, so these tests assert the SHAPE of the trade-off — which way each bar
 * moves, and where the total crests — never a calibration magnitude.
 */

/** A prime-through-subprime book, which is what a real store writes. */
const MIXED_BOOK: readonly FinancedDealSample[] = (
  ['A', 'B', 'C', 'D'] as const
).map((creditTier) => ({
  creditTier,
  amountFinanced: 20_000,
  termMonths: 72,
  dealGross: 2_000,
}));

/** A store whose crowd cannot be marked up: C and D cap below the frontier. */
const SUBPRIME_BOOK: readonly FinancedDealSample[] = [
  { creditTier: 'C', amountFinanced: 18_000, termMonths: 72, dealGross: 1_800 },
  { creditTier: 'D', amountFinanced: 15_000, termMonths: 66, dealGross: 1_500 },
];

const byId = (reading: ReturnType<typeof projectFniPostures>, id: string) => {
  const found = reading.postures.find((p) => p.id === id);
  if (!found) throw new Error(`no posture "${id}" in the catalog`);
  return found;
};

describe('the F&I posture peak model', () => {
  it('the model evaluates all three postures against live inputs', () => {
    const reading = projectFniPostures({
      book: MIXED_BOOK,
      financeStructuringSkill: null,
    });

    expect(reading.dealsRead).toBe(MIXED_BOOK.length);
    expect(reading.postures.map((p) => p.id)).toEqual([
      'more-per-deal',
      'balanced',
      'more-deals',
    ]);
    for (const posture of reading.postures) {
      expect(posture.reservePerDeal).toBeGreaterThan(0);
      expect(posture.stickRate).toBeGreaterThan(0);
      expect(posture.stickRate).toBeLessThanOrEqual(1);
      expect(posture.expectedGrossPerDeal).toBeGreaterThan(0);
    }

    // The lender's cap is a real ceiling, not a suggestion: the aggressive
    // posture asks for 2.5 points and a D-tier program allows 1.0, so a
    // subprime-only book earns the same reserve at every stop on the dial.
    const aggressiveOnSubprime = projectFniPostures({
      book: [SUBPRIME_BOOK[1]],
      financeStructuringSkill: null,
    });
    expect(byId(aggressiveOnSubprime, 'more-per-deal').reservePerDeal).toBeCloseTo(
      byId(aggressiveOnSubprime, 'more-deals').reservePerDeal,
      6,
    );

    // A store that has financed nothing has nothing to read, and says so rather
    // than projecting a made-up book.
    const empty = projectFniPostures({ book: [], financeStructuringSkill: null });
    expect(empty.dealsRead).toBe(0);
    expect(empty.peakId).toBeNull();
    expect(empty.postures).toHaveLength(3);
    expect(empty.postures.every((p) => p.expectedGrossPerDeal === 0)).toBe(true);
  });

  it('reserve per deal rises exactly as stick rate falls', () => {
    const reading = projectFniPostures({
      book: MIXED_BOOK,
      financeStructuringSkill: null,
    });
    const calmestFirst = [...reading.postures].sort(
      (a, b) => a.markupPts - b.markupPts,
    );

    // Bar one fills monotonically as the posture gets more aggressive...
    for (let i = 1; i < calmestFirst.length; i++) {
      expect(calmestFirst[i].reservePerDeal).toBeGreaterThan(
        calmestFirst[i - 1].reservePerDeal,
      );
      // ...and bar two never rises with it. It is flat below the lender's
      // frontier (that is #367's zero, and it is load-bearing) and strictly
      // drains past it, which is why "non-increasing" is the honest claim here
      // and "strictly falling" would be asserting a curve the engine does not
      // have.
      expect(calmestFirst[i].stickRate).toBeLessThanOrEqual(
        calmestFirst[i - 1].stickRate,
      );
    }

    // The two bars genuinely oppose: the top of the dial gives up contracts the
    // bottom of it keeps.
    const aggressive = byId(reading, 'more-per-deal');
    const calm = byId(reading, 'more-deals');
    expect(aggressive.reservePerDeal).toBeGreaterThan(calm.reservePerDeal);
    expect(aggressive.stickRate).toBeLessThan(calm.stickRate);

    // And the aggressive stop is the only one that costs satisfaction (#368):
    // Balanced sits ON the fair line, so it takes no drag at all.
    expect(aggressive.satisfactionCostPerDeal).toBeLessThan(0);
    expect(byId(reading, 'balanced').satisfactionCostPerDeal).toBe(0);
    expect(calm.satisfactionCostPerDeal).toBe(0);
  });

  it('the peak is named, and it is not always More per deal', () => {
    // A store with no finance office: the bank's frontier is the bare one, so
    // the aggressive posture loses more contracts than the extra spread is
    // worth and the curve crests in the middle. This is the whole point of the
    // meter — the optimum is not the maximum.
    const unstaffed = projectFniPostures({
      book: MIXED_BOOK,
      financeStructuringSkill: null,
    });
    expect(unstaffed.peakId).toBe('balanced');
    expect(byId(unstaffed, 'balanced').expectedGrossPerDeal).toBeGreaterThan(
      byId(unstaffed, 'more-per-deal').expectedGrossPerDeal,
    );

    // A crowd nobody can mark up: C and D both cap at or below the frontier, so
    // the aggressive posture buys literally nothing and the peak resolves to
    // the calmer stop that earns the same money for less markup.
    const subprime = projectFniPostures({
      book: SUBPRIME_BOOK,
      financeStructuringSkill: null,
    });
    expect(subprime.peakId).not.toBe('more-per-deal');
    expect(byId(subprime, 'more-per-deal').expectedGrossPerDeal).toBeCloseTo(
      byId(subprime, 'balanced').expectedGrossPerDeal,
      6,
    );
  });

  it('a better structurer slides the peak', () => {
    const at = (skill: number | null) =>
      projectFniPostures({ book: MIXED_BOOK, financeStructuringSkill: skill });

    // A green desk cannot package an over-marked contract, so the peak sits
    // where a store with no finance office would put it.
    expect(at(0).peakId).toBe('balanced');
    // A reference-grade structurer gets the bank to buy the same aggressive
    // rate, and the crest slides up the dial with them (grill Q5).
    expect(at(100).peakId).toBe('more-per-deal');

    // It slides because the frontier moved, not because the reserve did: the
    // spread on a contract is identical at both skills, and only how many of
    // them stick has changed.
    expect(byId(at(100), 'more-per-deal').reservePerDeal).toBeCloseTo(
      byId(at(0), 'more-per-deal').reservePerDeal,
      6,
    );
    expect(byId(at(100), 'more-per-deal').stickRate).toBeGreaterThan(
      byId(at(0), 'more-per-deal').stickRate,
    );

    // Monotonic, so the meter never reports a peak that jumps back down as the
    // desk improves.
    const grosses = [0, 25, 50, 75, 100].map(
      (s) => byId(at(s), 'more-per-deal').expectedGrossPerDeal,
    );
    for (let i = 1; i < grosses.length; i++) {
      expect(grosses[i]).toBeGreaterThanOrEqual(grosses[i - 1]);
    }

    // `null` is "no finance office", not "skill 0" (#369). They agree today and
    // are asked separately, so a future extension that is nonzero at zero skill
    // cannot silently grant itself to a store that never hired anyone.
    expect(at(null).peakId).toBe(at(0).peakId);
  });

  it('the curve is read off the live fall-through config, not a copy of it', () => {
    // The model owns no curve of its own: hand it a steeper kill and the peak
    // moves, which is what lets a #286-class calibration pass retune the teeth
    // in `data/` and have the meter follow without a code change.
    const steeper: FniDealKillConfig = {
      ...loadFniDealKillConfig(),
      maxFallThroughRate: 0.9,
      structuringFrontierMaxPts: 0,
    };
    const reading = projectFniPostures(
      { book: MIXED_BOOK, financeStructuringSkill: 100 },
      { dealKillConfig: steeper },
    );
    // `structuringFrontierMaxPts: 0` means even a reference-grade desk buys no
    // extra room, so the steeper curve bites at full strength.
    expect(reading.peakId).toBe('balanced');
    expect(byId(reading, 'more-per-deal').stickRate).toBeLessThan(
      byId(reading, 'balanced').stickRate,
    );
  });

  it('a fall-through costs the whole deal, not just the spread', () => {
    // The correction that makes the crest real. A contract the lender passes on
    // sends the customer home in their own car (#367) — the front and product
    // gross die with it — so a store with more gross on the metal has more to
    // lose by over-marking, and its peak is more conservative than a store with
    // none. A meter that weighed only the reserve would report the aggressive
    // posture as costing a few dollars of spread.
    const richBook = MIXED_BOOK.map((d) => ({ ...d, dealGross: 4_000 }));
    const thinBook = MIXED_BOOK.map((d) => ({ ...d, dealGross: 0 }));

    const rich = projectFniPostures({
      book: richBook,
      financeStructuringSkill: null,
    });
    const thin = projectFniPostures({
      book: thinBook,
      financeStructuringSkill: null,
    });

    expect(rich.peakId).toBe('balanced');
    // With nothing but the spread at stake the extra markup wins, which is
    // exactly the reading the whole-deal correction exists to prevent.
    expect(thin.peakId).toBe('more-per-deal');

    // The reserve bar itself is untouched by the metal — it is the spread, and
    // the spread does not know what the car cost.
    expect(byId(rich, 'balanced').reservePerDeal).toBeCloseTo(
      byId(thin, 'balanced').reservePerDeal,
      6,
    );
  });
});

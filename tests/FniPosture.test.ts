import {
  loadFniPostureConfig,
  resolveFniPostureMarkupPts,
} from '../src/game/DealEngine';
import type { FniPostureConfig } from '../src/game/DealEngine';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

// The F&I posture dial (#366) — the player's ONE finance-office input, and a
// standing one: three positions, persisted per save slot, executed by the F&I
// manager (grill Q5/Q6/Q9/I7). These drive the catalog, the resolver and the
// assembled world; the slot round-trip through the live app is
// tests/FniPosture.reachability.test.tsx.

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

/** A world at Tier 3 with the F&I desk actually staffed — the posture is inert
 *  until someone works it (grill Q2), so every markup assertion needs one. */
function deskedWorld(getFniPostureMarkupPts?: () => number) {
  const world = createWorld({
    bus: createEventBus(),
    masterSeed: 366,
    characterProfile: PROFILE,
    getFniPostureMarkupPts,
  });
  world.tierManager.restoreState({
    currentTier: 3,
    businessName: '',
    accentColor: '#38bdf8',
    fontId: 'prestige',
    customersServed: 0,
  });
  const candidate = world.staffOrg.getCandidates('f&i-manager')[0];
  expect(candidate).toBeDefined();
  world.staffOrg.hire(candidate.candidateId);
  return world;
}

describe('#366 the F&I posture catalog', () => {
  it('the catalog is three positions and defaults to Balanced', () => {
    const catalog = loadFniPostureConfig();
    expect(catalog.postures).toHaveLength(3);
    expect(catalog.postures.map((p) => p.label)).toEqual([
      'More per deal',
      'Balanced',
      'More deals',
    ]);
    expect(catalog.defaultId).toBe('balanced');
    // The default has to be a posture that exists, or every fresh slot silently
    // falls through to "the first one in the file".
    expect(catalog.postures.some((p) => p.id === catalog.defaultId)).toBe(true);
  });

  it('the three positions are monotonic in markup', () => {
    const by = (id: string) => resolveFniPostureMarkupPts(id);
    expect(by('more-per-deal')).toBeGreaterThan(by('balanced'));
    expect(by('balanced')).toBeGreaterThan(by('more-deals'));
    // Nobody works the rate for free, and nobody works it past what any lender
    // would allow — a posture outside the tier caps would be a dead position.
    expect(by('more-deals')).toBeGreaterThan(0);
  });

  it('an unknown posture id falls back to the default', () => {
    const balanced = resolveFniPostureMarkupPts('balanced');
    // A slot saved before the dial existed, and one naming a retired posture.
    expect(resolveFniPostureMarkupPts(undefined)).toBe(balanced);
    expect(resolveFniPostureMarkupPts('pack-the-payment')).toBe(balanced);
  });

  it('falls back to the first posture when the default itself is retired', () => {
    const orphaned: FniPostureConfig = {
      defaultId: 'gone',
      postures: [
        { id: 'only', label: 'Only', markupPts: 0.02, blurb: 'b' },
      ],
    };
    expect(resolveFniPostureMarkupPts('also-gone', orphaned)).toBe(0.02);
  });
});

// ── anti-orphan: the dial reaches the assembled world ────────────────────────
//
// A resolver test cannot tell "wired" from "wired to nothing" (#363's lesson):
// the posture only matters if the rate a real customer is quoted moves with it.

describe('#366 the posture is live on the assembled world', () => {
  it('the chosen posture moves the next deal’s markup', () => {
    const aggressive = deskedWorld(() => resolveFniPostureMarkupPts('more-per-deal'));
    const cheap = deskedWorld(() => resolveFniPostureMarkupPts('more-deals'));

    // Tier A's lender cap (2.5 points) is the widest in the book, so it is the
    // program where all three positions are actually reachable.
    const hard = aggressive.dealEngine.quoteFinance('A');
    const soft = cheap.dealEngine.quoteFinance('A');
    expect(hard.markupPts).toBeGreaterThan(soft.markupPts);
    expect(hard.customerRate).toBeGreaterThan(soft.customerRate);
    expect(hard.buyRate).toBeCloseTo(soft.buyRate, 6);
  });

  it('a mid-game change applies on the next deal without rebuilding the world', () => {
    let postureId = 'more-deals';
    const world = deskedWorld(() => resolveFniPostureMarkupPts(postureId));
    const before = world.dealEngine.quoteFinance('A').markupPts;

    postureId = 'more-per-deal';
    expect(world.dealEngine.quoteFinance('A').markupPts).toBeGreaterThan(before);
  });

  it('marking up harder raises the payment, so the affordability gate bites', () => {
    // The "More deals" trade is structural, not cosmetic (grill I3): the
    // payment IS built from the marked-up rate, so PTI — the gate that has
    // always been there — prices more buyers out at the aggressive posture.
    const aggressive = deskedWorld(() => resolveFniPostureMarkupPts('more-per-deal'));
    const cheap = deskedWorld(() => resolveFniPostureMarkupPts('more-deals'));
    const params = { price: 22_000, down: 2_000, termMonths: 60, tier: 'A' as const };

    expect(aggressive.dealEngine.structure(params).monthlyPayment).toBeGreaterThan(
      cheap.dealEngine.structure(params).monthlyPayment,
    );
  });

  it('an unstaffed desk earns the ambient markup whatever the posture says', () => {
    // Grill Q2: the dial is an instruction to a person. With nobody on the desk
    // the store's backend is ambient, and selecting "More per deal" changes
    // nothing — which is exactly what the surface tells the player.
    const green = (posture: string) =>
      createWorld({
        bus: createEventBus(),
        masterSeed: 366,
        characterProfile: PROFILE,
        getFniPostureMarkupPts: () => resolveFniPostureMarkupPts(posture),
      }).dealEngine.quoteFinance('A').markupPts;

    expect(green('more-per-deal')).toBeCloseTo(green('more-deals'), 6);
  });
});

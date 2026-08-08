import {
  fallThroughProbability,
  rollFinanceFallThrough,
  loadFniDealKillConfig,
  loadFniPostureConfig,
  resolveFniPostureMarkupPts,
} from '../src/game/DealEngine';
import type { FniDealKillConfig } from '../src/game/DealEngine';
import { walkOffReactionText, isStarworthyWalkOff } from '../src/ui/Reveal';
import {
  setup,
  admit,
  makeStaff,
  makeSession,
  makeFinanceVisit,
  makeCashVisit,
  makeLotVehicle,
  BASE_CONFIG,
} from './helpers/staffDispatchHarness';

/**
 * #367 — the contractual deal-kill. The teeth that make the F&I posture a
 * decision: without them "More per deal" is strictly better than the other two
 * positions (grill Q3 primary, I8).
 *
 * The *structural* kill — a marked-up payment breaching ptiCap/maxTerm/
 * ltvCeiling — is not tested here because it is not implemented here: it falls
 * out of the affordability gate that has always existed, because the payment is
 * built at the marked-up rate (#365, grill I3). See tests/FniPosture.test.ts.
 */

// Teeth dialed to certainty: any markup above zero kills. Lets the flow tests
// assert what a fallen-through deal does without depending on the shipped
// magnitudes, which are placeholders owed to calibration (grill I9).
const ALWAYS_KILLS: FniDealKillConfig = {
  safeFrontierPts: 0,
  fullKillRangePts: 0.001,
  maxFallThroughRate: 1,
};

// A coin flip on every financed contract — enough for the seeding test to see
// both answers in one population.
const COIN_FLIP: FniDealKillConfig = {
  safeFrontierPts: 0,
  fullKillRangePts: 0.001,
  maxFallThroughRate: 0.5,
};

const MARKUP = 0.02;

describe('#367 the deal-kill curve', () => {
  it('fall-through probability rises with markup past the frontier', () => {
    const config = loadFniDealKillConfig();
    const { safeFrontierPts: frontier, fullKillRangePts: range } = config;

    // Strictly increasing across the ramp.
    const quarter = fallThroughProbability(frontier + range * 0.25, config);
    const half = fallThroughProbability(frontier + range * 0.5, config);
    const threeQuarters = fallThroughProbability(frontier + range * 0.75, config);
    expect(quarter).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(quarter);
    expect(threeQuarters).toBeGreaterThan(half);

    // Linear: the midpoint of the ramp is half the maximum.
    expect(half).toBeCloseTo(config.maxFallThroughRate / 2, 10);

    // And it flattens at the maximum rather than running past it — a curve that
    // kept climbing would eventually refuse every deal, which is a wall, not a
    // trade-off.
    expect(fallThroughProbability(frontier + range, config)).toBeCloseTo(
      config.maxFallThroughRate,
      10,
    );
    expect(fallThroughProbability(frontier + range * 10, config)).toBe(
      config.maxFallThroughRate,
    );
  });

  it('a deal inside the frontier always sticks', () => {
    const config = loadFniDealKillConfig();
    const frontier = config.safeFrontierPts;

    expect(fallThroughProbability(frontier, config)).toBe(0);
    expect(fallThroughProbability(frontier * 0.5, config)).toBe(0);
    expect(fallThroughProbability(0, config)).toBe(0);

    // Zero probability means zero rolls kill, whatever the seed.
    for (let seed = 0; seed < 500; seed += 1) {
      expect(rollFinanceFallThrough(frontier, seed, config)).toBe(false);
    }

    // The two postures at or under the frontier are the reason every pre-#367
    // calibration harness is untouched: Balanced sits ON it, and a store with no
    // f&i-manager on the desk earns the ambient markup, which sits under it.
    const postures = loadFniPostureConfig();
    expect(
      fallThroughProbability(resolveFniPostureMarkupPts('balanced', postures), config),
    ).toBe(0);
    expect(
      fallThroughProbability(resolveFniPostureMarkupPts('more-deals', postures), config),
    ).toBe(0);
  });
});

describe('#367 a fallen-through deal on the floor', () => {
  it('a fallen-through deal leaves the car on the lot and the ledger untouched', () => {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [makeLotVehicle('veh:1')],
      getFniDeskStaffed: () => true,
      getFniPostureMarkupPts: () => MARKUP,
      fniDealKillConfig: ALWAYS_KILLS,
    });
    const cashBefore = w.economy.cash;

    w.sessions.set('cust:1', makeSession('p:1', makeFinanceVisit('p:1')));
    admit(w.bus, 'cust:1');

    // It resolves as a walk carrying its own reason — not folded into an
    // existing walk cause — and keeps the post-process bookkeeping every other
    // late walk gets (residual heat for FollowUpPool).
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:1',
      outcome: 'no_sale',
      reason: 'finance_fell_through',
      grossImpact: 0,
    });
    expect(w.events[0].heat).toBeGreaterThan(0);

    // Nothing settled off a contract nobody bought.
    expect(w.closedDeals).toHaveLength(0);
    expect(w.inventorySold).toHaveLength(0);
    expect(w.inventory.getLotVehicles().map((v) => v.id)).toEqual(['veh:1']);
    expect(w.economy.cash).toBe(cashBefore);
  });

  it('a cash buyer has no lender to refuse them', () => {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [makeLotVehicle('veh:1')],
      getFniDeskStaffed: () => true,
      getFniPostureMarkupPts: () => MARKUP,
      fniDealKillConfig: ALWAYS_KILLS,
    });

    w.sessions.set('cust:1', makeSession('p:1', makeCashVisit('p:1')));
    admit(w.bus, 'cust:1');

    expect(w.events[0].reason).not.toBe('finance_fell_through');
    expect(w.closedDeals).toHaveLength(1);
  });

  it('the fall-through roll is seeded per customer and day', () => {
    const run = () => {
      const w = setup([makeStaff(0.9)], BASE_CONFIG, {
        lot: Array.from({ length: 20 }, (_, i) => makeLotVehicle(`veh:${i}`)),
        getFniDeskStaffed: () => true,
        getFniPostureMarkupPts: () => MARKUP,
        fniDealKillConfig: COIN_FLIP,
      });
      for (let i = 0; i < 20; i += 1) {
        w.sessions.set(`cust:${i}`, makeSession(`p:${i}`, makeFinanceVisit(`p:${i}`)));
        admit(w.bus, `cust:${i}`, 1);
      }
      return w.events.map((e) => `${e.customerId}:${e.outcome}:${e.reason ?? '-'}`);
    };

    const first = run();
    const second = run();
    expect(second).toEqual(first);

    // Both answers actually occur, so the equality above isn't vacuous.
    const killed = first.filter((e) => e.endsWith('finance_fell_through'));
    expect(killed.length).toBeGreaterThan(0);
    expect(killed.length).toBeLessThan(first.length);
  });

  it('the aggressive posture buys reserve with stuck deals', () => {
    const postures = loadFniPostureConfig();
    const runAt = (postureId: string) => {
      const w = setup([makeStaff(0.9)], BASE_CONFIG, {
        lot: Array.from({ length: 40 }, (_, i) => makeLotVehicle(`veh:${i}`)),
        getFniDeskStaffed: () => true,
        getFniPostureMarkupPts: () => resolveFniPostureMarkupPts(postureId, postures),
      });
      for (let i = 0; i < 40; i += 1) {
        w.sessions.set(`cust:${i}`, makeSession(`p:${i}`, makeFinanceVisit(`p:${i}`)));
        admit(w.bus, `cust:${i}`, 1);
      }
      return {
        fellThrough: w.events.filter((e) => e.reason === 'finance_fell_through').length,
        closed: w.closedDeals.length,
      };
    };

    // Shipped curve, shipped postures — the trade the dial is supposed to make.
    const aggressive = runAt('more-per-deal');
    const volume = runAt('more-deals');

    expect(aggressive.fellThrough).toBeGreaterThan(0);
    expect(volume.fellThrough).toBe(0);
    expect(aggressive.closed).toBeLessThan(volume.closed);
  });
});

describe('#367 the walk-off reaches the player', () => {
  it('the fall-through has its own starred, plain-language walk-off line', () => {
    const walkOff = {
      customerId: 'cust:1',
      reason: 'finance_fell_through',
      archetypeLabel: 'Young Family',
      wantedCategory: 'sedan' as const,
      heat: 0.4,
    };
    const text = walkOffReactionText(walkOff);

    // Not the generic fallback ("<who> walked."): a walk the player caused with
    // a standing lever has to say which lever.
    expect(text).toContain('Young Family');
    expect(text).toMatch(/rate/i);
    expect(text.length).toBeGreaterThan('Young Family walked.'.length);
    expect(isStarworthyWalkOff(walkOff.reason)).toBe(true);
  });
});

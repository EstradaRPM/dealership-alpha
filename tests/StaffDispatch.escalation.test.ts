import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { SALES_ARCHETYPES } from '../src/game/CustomerPool';
import type { CharacterProfile } from '../src/game/CareerProgression';
import {
  BASE_CONFIG,
  DISCOUNT_EXCEPTION_CONFIG,
  admit,
  makeFinanceVisit,
  makeLotVehicle,
  makeSession,
  makeStaff,
  makeTradeVehicle,
  setup,
  withTrade,
} from './helpers/staffDispatchHarness';

/**
 * Two customers, one car (#364).
 *
 * A tier-1 lot holds six units and the seed lot parks three of them, so two
 * walk-ins picking the same car on the same day is ordinary. Both can land
 * below the price floor (or arrive with an unusual trade) and be held for the
 * player. Whichever review the player resolves first closes the deal and the
 * unit leaves the lot — and the second review used to reach `closeDeal` with
 * nothing left to sell, throwing `No lot vehicle` out of the resolution.
 *
 * The honest outcome is a no-sale with its own reason, carrying the same walk
 * bookkeeping every other no-sale carries.
 */

const discountDeps = {
  config: DISCOUNT_EXCEPTION_CONFIG,
  bookValueFn: () => 20_000,
};

/** A buyer whose reservation lands below the salesperson's margin floor. */
const belowFloorBuyer = (id: string) =>
  makeSession(id, makeFinanceVisit(id), {
    wealth: 15_000,
    agreeableness: 100,
  });

describe('StaffDispatch — a held review whose car sold to someone else (#364)', () => {
  function twoDiscountsOnOneCar() {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [makeLotVehicle('veh:contested')],
      salesProcessDeps: discountDeps,
    });
    w.sessions.set('cust:first', belowFloorBuyer('cust:first'));
    w.sessions.set('cust:second', belowFloorBuyer('cust:second'));
    admit(w.bus, 'cust:first');
    admit(w.bus, 'cust:second');
    return w;
  }

  it('resolves the second customer as a no-sale instead of throwing', () => {
    const w = twoDiscountsOnOneCar();
    // Both are held on the same unit — the lot still has it, nothing closed.
    expect(w.heldDiscountReviews).toHaveLength(2);
    expect(w.inventory.getLotVehicles()).toHaveLength(1);

    // The player takes the first deal; that car is now gone.
    expect(w.heldDiscountReviews[0].decide({ kind: 'accept_ask' }).status).toBe(
      'closed',
    );
    expect(w.inventory.getLotVehicles()).toHaveLength(0);

    // The second decision has nothing left to sell. It must not throw.
    const second = w.heldDiscountReviews[1].decide({ kind: 'accept_ask' });

    expect(second).toEqual({ status: 'vehicle_sold' });
    expect(w.closedDeals).toHaveLength(1);
    const walks = w.events.filter(e => e.customerId === 'cust:second');
    expect(walks).toHaveLength(1);
    expect(walks[0]).toMatchObject({
      outcome: 'no_sale',
      reason: 'vehicle_sold_to_other',
      grossImpact: 0,
    });
  });

  it('every decision walks them — the car being gone is not the player’s call', () => {
    for (const decision of [
      { kind: 'accept_ask' },
      { kind: 'accept_counter' },
      { kind: 'propose_counter' as const, amount: 12_000 },
      { kind: 'decline' },
    ] as const) {
      const w = twoDiscountsOnOneCar();
      w.heldDiscountReviews[0].decide({ kind: 'accept_ask' });

      const result = w.heldDiscountReviews[1].decide(decision);

      expect(result).toEqual({ status: 'vehicle_sold' });
      expect(
        w.events.filter(e => e.customerId === 'cust:second'),
      ).toHaveLength(1);
    }
  });

  it('the pending review still names the car after it leaves the lot', () => {
    const w = twoDiscountsOnOneCar();
    w.heldDiscountReviews[0].decide({ kind: 'accept_ask' });

    // The lot can no longer answer for this unit; the review can.
    expect(w.inventory.getLotVehicle('veh:contested')).toBeUndefined();
    expect(w.heldDiscountReviews[1].review.vehicle).toMatchObject({
      id: 'veh:contested',
      make: 'generic',
      model: 'Sedan',
      year: 2020,
    });
  });

  it('holds for the same walk on an escalated trade', () => {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [makeLotVehicle('veh:contested')],
    });
    // ask 9_000 is above the target and beyond the routine gap ⇒ unusual, and
    // with no manager on staff it routes to the player.
    for (const id of ['cust:first', 'cust:second']) {
      w.sessions.set(
        id,
        makeSession(id, withTrade(makeFinanceVisit(id), 9_000), {
          currentVehicle: makeTradeVehicle(null),
        }),
      );
      admit(w.bus, id);
    }
    expect(w.heldTradeReviews).toHaveLength(2);

    expect(w.heldTradeReviews[0].decide({ kind: 'accept_ask' }).status).toBe(
      'closed',
    );
    const second = w.heldTradeReviews[1].decide({ kind: 'accept_ask' });

    expect(second).toEqual({ status: 'vehicle_sold' });
    expect(w.closedDeals).toHaveLength(1);
    // No trade is booked on a deal that never happened.
    expect(w.trades).toHaveLength(1);
    const walks = w.events.filter(e => e.customerId === 'cust:second');
    expect(walks).toHaveLength(1);
    expect(walks[0]).toMatchObject({
      outcome: 'no_sale',
      reason: 'vehicle_sold_to_other',
    });
    // The trade review names the unit off the lot too, not just the trade-in.
    expect(w.heldTradeReviews[1].vehicle.id).toBe('veh:contested');
  });
});

/**
 * The walk this path produces has to be an ordinary walk. It carries the
 * residual warmth of a customer who went all the way through the process, so
 * the BDC pool, reputation and the rest act on it exactly as they would on any
 * other no-sale — asserted against the ASSEMBLED world, with the payload the
 * resolver actually emitted rather than a hand-written one.
 */
describe('#364 — the lost customer feeds the same walk bookkeeping', () => {
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

  /** The `staff:auto_resolved` the resolver emits for the second customer. */
  function capturedWalk() {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [makeLotVehicle('veh:contested')],
      salesProcessDeps: discountDeps,
    });
    w.sessions.set('cust:first', belowFloorBuyer('cust:first'));
    w.sessions.set('cust:second', belowFloorBuyer('cust:second'));
    admit(w.bus, 'cust:first');
    admit(w.bus, 'cust:second');
    w.heldDiscountReviews[0].decide({ kind: 'accept_ask' });
    w.heldDiscountReviews[1].decide({ kind: 'accept_ask' });
    return w.events.find(e => e.customerId === 'cust:second')!;
  }

  it('carries the warmth of a customer who went through the whole process', () => {
    const walk = capturedWalk();
    expect(walk.heat).toBeGreaterThan(0);
  });

  it('reaches the follow-up pool and moves reputation', () => {
    const walk = capturedWalk();
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 42, characterProfile: PROFILE });
    const [archetype] = SALES_ARCHETYPES;
    const customerId = world.customerPool.spawnCustomer(
      archetype.personId,
      archetype.visitId,
      archetype.label,
    );
    const satisfactionBefore = world.reputation.customerSatisfaction;

    bus.publish('staff:auto_resolved', {
      ...walk,
      outcome: 'no_sale',
      customerId,
      staffId: 'sp-1',
      day: 1,
    });

    expect(world.followUpPool.getFollowUp(customerId)?.heat).toBe(walk.heat);
    expect(world.reputation.customerSatisfaction).toBeLessThan(
      satisfactionBefore,
    );
  });
});

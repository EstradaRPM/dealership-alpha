import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { SALES_ARCHETYPES } from '../src/game/CustomerPool';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * Anti-orphan guard for the live-floor walk (#363).
 *
 * A walk on the live sales floor used to publish only `staff:auto_resolved`, so
 * `customer:resolved` never fired for one — and every consumer keyed off a
 * walked customer was dead in real play while looking perfectly healthy in
 * isolation tests. That is the shape this file exists to catch: each of the four
 * is pinned in the ASSEMBLED world, moving off one walk, because a unit test on
 * any single module cannot tell "wired" from "wired to nothing".
 *
 * The four, and what each one being dark cost:
 *   FollowUpPool     — the entire BDC callback pool never filled
 *   Reputation       — walks cost nothing
 *   RegulatoryMeter  — walk pressure never accrued
 *   TierManager      — `customersServed` counted closes only (~3% of the floor)
 */

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

function build(masterSeed = 42) {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
  return { bus, world };
}

/**
 * Put a real customer on the floor, then have the live floor walk them.
 *
 * The composed world runs `legacyDailyArrivals: false` (FloorSim owns arrivals
 * through the customer-source seam), so the session is spawned directly rather
 * than rolled off `clock:day_started`.
 */
function walkOneUp(
  bus: ReturnType<typeof createEventBus>,
  world: World,
  reason: string,
  heat?: number,
): string {
  const [archetype] = SALES_ARCHETYPES;
  const customerId = world.customerPool.spawnCustomer(
    archetype.personId,
    archetype.visitId,
    archetype.label,
  );
  bus.publish('staff:auto_resolved', {
    customerId,
    staffId: 'sp-1',
    day: 1,
    outcome: 'no_sale',
    grossImpact: 0,
    reason,
    heat,
  });
  return customerId;
}

describe('a live-floor walk reaches its consumers in the assembled world (#363)', () => {
  it('fills the follow-up pool', () => {
    const { bus, world } = build();
    expect(world.followUpPool.getFollowUps()).toHaveLength(0);

    const id = walkOneUp(bus, world, 'patience_drain', 0.7);

    expect(world.followUpPool.getFollowUp(id)?.heat).toBe(0.7);
  });

  it('costs reputation', () => {
    const { bus, world } = build();
    const before = world.reputation.customerSatisfaction;

    walkOneUp(bus, world, 'patience_drain', 0.7);

    expect(world.reputation.customerSatisfaction).toBeLessThan(before);
  });

  it('accrues regulatory pressure', () => {
    const { bus, world } = build();
    expect(world.regulatoryMeter.pressure).toBe(0);

    walkOneUp(bus, world, 'patience_drain', 0.7);

    expect(world.regulatoryMeter.pressure).toBeGreaterThan(0);
  });

  it('counts toward customers served', () => {
    const { bus, world } = build();
    const before = world.tierManager.customersServed;

    walkOneUp(bus, world, 'patience_drain', 0.7);

    expect(world.tierManager.customersServed).toBe(before + 1);
  });

  it('a walk that never reached the sales process still counts as served', () => {
    // `no_fit` carries no heat, so it is not worth a callback — but the up was
    // on the floor and left, and the store's numbers have to say so.
    const { bus, world } = build();
    const before = world.tierManager.customersServed;

    const id = walkOneUp(bus, world, 'no_fit');

    expect(world.tierManager.customersServed).toBe(before + 1);
    expect(world.followUpPool.getFollowUp(id)).toBeUndefined();
  });
});

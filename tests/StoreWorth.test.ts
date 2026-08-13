import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * #393 — what the store is worth nets what the store owes.
 *
 * #380 built the figure on one checkable rule: a purchase is a *move*, not a
 * loss, so cash falling by $12k while the lot rises by $12k leaves the total
 * still. A drawn credit line is the same rule from the other side — cash up
 * $50k, debt up $50k, worth unchanged — and without the debt term the panel
 * #393 ships would report the store $50k richer for having taken on a loan.
 *
 * Every assertion here is that one rule seen from a different door. The #380
 * rules themselves stay pinned in `tests/Economy.netWorth.test.ts`, which runs
 * against a founder with no line at all.
 */

const LINE = 50_000;

function profile(startingCreditLine: number): CharacterProfile {
  return {
    name: 'Ray Estrada',
    backstoryId: 'ex-banker',
    day1Modifier: {
      backstoryId: 'ex-banker',
      reconJudgmentBonus: 0,
      startingCreditLine,
      startingCapitalBonus: 0,
      grudgesFlag: false,
    },
  };
}

function makeWorld(startingCreditLine = LINE, masterSeed = 393) {
  const bus = createEventBus();
  return createWorld({
    bus,
    masterSeed,
    characterProfile: profile(startingCreditLine),
  });
}

describe('#393 the store is worth its cash and its stock, less its debt', () => {
  it('a draw leaves the store’s worth flat', () => {
    const world = makeWorld();
    const before = world.getStoreWorth();
    expect(before.debt).toBe(0);

    expect(world.creditFacility.draw(LINE).ok).toBe(true);
    const after = world.getStoreWorth();

    // The whole argument for the subtraction, in three lines: the money
    // arrived, the debt arrived with it, and what the store is worth did not
    // move. This is the identical shape of the #380 assertion for a bought car.
    expect(after.cash).toBe(before.cash + LINE);
    expect(after.debt).toBe(LINE);
    expect(after.total).toBe(before.total);
  });

  it('the total is the three terms and nothing else', () => {
    const world = makeWorld();
    world.creditFacility.draw(20_000);
    const worth = world.getStoreWorth();

    expect(worth.cash).toBe(world.economy.cash);
    expect(worth.stockValue).toBe(world.inventory.getStockValue());
    expect(worth.debt).toBe(world.creditFacility.getFacility().drawn);
    expect(worth.total).toBe(worth.cash + worth.stockValue - worth.debt);
  });

  it('paying the line back leaves it flat too', () => {
    const world = makeWorld();
    world.creditFacility.draw(LINE);
    const borrowed = world.getStoreWorth();

    expect(world.creditFacility.repay(LINE).ok).toBe(true);
    const repaid = world.getStoreWorth();

    expect(repaid.cash).toBe(borrowed.cash - LINE);
    expect(repaid.debt).toBe(0);
    expect(repaid.total).toBe(borrowed.total);
  });

  it('carrying the balance costs interest, and the balance itself does not grow', () => {
    const world = makeWorld();
    world.creditFacility.draw(LINE);
    const charge = world.creditFacility.getFacility().dailyInterest;
    expect(charge).toBeGreaterThan(0);

    world.clock.advanceDay();

    // The morning charge is a real cost — it leaves the store, and the store is
    // worth that much less for it. What it does NOT do is compound: the debt
    // term is the drawn balance, which only the player moves. One rule, so a
    // player can predict every charge the facility will ever make.
    const facility = world.creditFacility.getFacility();
    expect(facility.interestPaidToDate).toBe(charge);
    expect(world.getStoreWorth().debt).toBe(LINE);
  });

  it('a founder with no line is a store with no debt, on the same code path', () => {
    const world = makeWorld(0);
    const worth = world.getStoreWorth();

    // A limit of zero is a facility that cannot be drawn, not an absent one
    // (#392) — so the worth figure reads the same getter it always does and
    // simply subtracts nothing.
    expect(world.creditFacility.getFacility().limit).toBe(0);
    expect(worth.debt).toBe(0);
    expect(worth.total).toBe(worth.cash + worth.stockValue);
  });
});

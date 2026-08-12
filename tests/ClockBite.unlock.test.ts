import {
  availableBites,
  coverageAcrossStores,
  type CoverageFactId,
  type StoreCover,
} from '../src/game/ClockBite';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { resolveBiteCoverage, resolveStoreCovers } from '../src/app/config';
import type { CharacterProfile } from '../src/game/CareerProgression';

const bite = (coverage: readonly CoverageFactId[], id: string) => {
  const found = availableBites(coverage).find((o) => o.id === id);
  if (!found) throw new Error(`no bite "${id}"`);
  return found;
};

// #381 — "you can skip ahead exactly as far as your people can cover for you."
// One rule: the door and the capability are the same fact.
describe('ClockBite doors (#381)', () => {
  it('the day is always open', () => {
    expect(bite([], 'day').unlocked).toBe(true);
    expect(bite([], 'day').lockedReason).toBeNull();
  });

  it('a covered used desk opens the week', () => {
    const week = bite(['discount_desking', 'trade_approval'], 'week');
    expect(week.unlocked).toBe(true);
    expect(week.lockedReason).toBeNull();
    expect(week.days).toBe(7);
  });

  it('a half-covered desk states which cover is missing', () => {
    const noTrades = bite(['discount_desking'], 'week');
    expect(noTrades.unlocked).toBe(false);
    expect(noTrades.lockedReason).toBe('Nobody but you can approve a trade yet.');

    const noDesking = bite(['trade_approval'], 'week');
    expect(noDesking.unlocked).toBe(false);
    expect(noDesking.lockedReason).toBe(
      "Your used car manager can't desk a discount on their own yet.",
    );

    // Both missing ⇒ both stated, so the player is never told half the door.
    const neither = bite([], 'week');
    expect(neither.lockedReason).toContain('desk a discount');
    expect(neither.lockedReason).toContain('approve a trade');
  });

  it('the month needs a general manager', () => {
    expect(bite(['discount_desking', 'trade_approval'], 'month').unlocked).toBe(
      false,
    );
    expect(bite([], 'month').lockedReason).toBe(
      "You haven't hired a general manager to run the store.",
    );
    expect(bite(['general_manager'], 'month').unlocked).toBe(true);
  });

  it('never drops a locked bite from the list', () => {
    expect(availableBites([]).map((o) => o.id)).toEqual(['day', 'week', 'month']);
    expect(availableBites(['general_manager']).length).toBe(3);
  });
});

// ── The top rung, against a live roster (#385) ──────────────────────────────

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCapitalBonus: 0,
    startingCreditLine: 0,
    grudgesFlag: false,
  },
};

function freshWorld() {
  return createWorld({
    bus: createEventBus(),
    masterSeed: 385,
    characterProfile: PROFILE,
  });
}

describe('ClockBite month gate (#385)', () => {
  it('a staffed GM opens the month', () => {
    const world = freshWorld();
    expect(resolveBiteCoverage(world)).not.toContain('general_manager');
    expect(
      availableBites(resolveBiteCoverage(world)).find((o) => o.id === 'month')!
        .unlocked,
    ).toBe(false);

    // The GM's hireTier is 6; force the tier so the role is hireable at all.
    const tierState = world.tierManager.getSerializableState();
    world.tierManager.restoreState({ ...tierState, currentTier: 6 });
    const candidate = world.staffOrg.getCandidates('gm')[0];
    expect(candidate).toBeDefined();
    world.staffOrg.hire(candidate.candidateId);

    expect(resolveBiteCoverage(world)).toContain('general_manager');
    const month = availableBites(resolveBiteCoverage(world)).find(
      (o) => o.id === 'month',
    )!;
    expect(month.unlocked).toBe(true);
    expect(month.lockedReason).toBeNull();
    expect(month.days).toBe(30);
  });

  it('the month gate is written over stores, not one store', () => {
    // One store today, and the answer is the same as reading it directly —
    // which is exactly what makes this safe to leave in place when the T6
    // dealer-group layer starts returning more than one.
    const world = freshWorld();
    const covers = resolveStoreCovers(world);
    expect(covers).toHaveLength(1);
    expect(coverageAcrossStores(covers)).toEqual(resolveBiteCoverage(world));

    const covered: StoreCover = {
      dealershipId: 'store:covered',
      facts: ['discount_desking', 'trade_approval', 'general_manager'],
    };
    const green: StoreCover = { dealershipId: 'store:green', facts: [] };

    expect(coverageAcrossStores([covered])).toContain('general_manager');
    // One store short shuts the door for the whole group: the uncovered lot is
    // precisely where the owner would be needed.
    expect(coverageAcrossStores([covered, green])).toEqual([]);
    expect(
      availableBites(coverageAcrossStores([covered, green])).find(
        (o) => o.id === 'month',
      )!.unlocked,
    ).toBe(false);
  });

  it('no stores covers nothing — an empty group never opens the top rung', () => {
    // NOT the natural `every`-over-nothing answer, which would read "every
    // store is covered" and quietly unlock the month.
    expect(coverageAcrossStores([])).toEqual([]);
  });
});

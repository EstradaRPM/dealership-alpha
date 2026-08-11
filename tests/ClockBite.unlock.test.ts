import { availableBites, type CoverageFactId } from '../src/game/ClockBite';

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

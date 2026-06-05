import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createWorld } from '../src/createWorld';
import {
  snapshotWorld,
  restoreWorld,
  WORLD_SNAPSHOT_VERSION,
  type WorldSnapshot,
} from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #188 — the save/load tracer: the world-serialization seam proven end to end
// with the two smallest stateful values (GameClock.day + Economy.cash). Locks
// the WorldSnapshot contract shape every later #186 slice conforms to.

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

describe('GameClock snapshot/restore (#188)', () => {
  it('captures the current day and rehydrates it onto a fresh clock', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    clock.advanceDay();
    clock.advanceDay();
    expect(clock.currentDay).toBe(3);

    const snap = clock.snapshot();
    expect(snap).toEqual({ schemaVersion: 1, day: 3 });

    const fresh = createGameClock({ bus: createEventBus() });
    expect(fresh.currentDay).toBe(1);
    fresh.restore(snap);
    expect(fresh.currentDay).toBe(3);
    // Derived fields follow the restored day.
    expect(fresh.currentSeason).toBe(clock.currentSeason);
    expect(fresh.dayOfWeek).toBe(clock.dayOfWeek);
  });
});

describe('Economy snapshot/restore (#188)', () => {
  it('captures the cash balance and rehydrates it onto a fresh economy', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000 });
    economy.postRevenue(12_500, 'Sale');
    economy.postExpense(2_000, 'Recon');
    expect(economy.cash).toBe(60_500);

    const snap = economy.snapshot();
    expect(snap).toEqual({ schemaVersion: 1, cash: 60_500 });

    const fresh = createEconomy({ bus: createEventBus(), startingCash: 50_000 });
    expect(fresh.cash).toBe(50_000);
    fresh.restore(snap);
    expect(fresh.cash).toBe(60_500);
  });
});

describe('snapshotWorld / restoreWorld seam (#188)', () => {
  function build(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  it('emits the locked envelope shape', () => {
    const { world } = build(42);
    const snap = snapshotWorld(world);
    expect(snap.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(snap.modules.gameClock).toEqual({ schemaVersion: 1, day: 1 });
    expect(snap.modules.economy.schemaVersion).toBe(1);
    expect(typeof snap.modules.economy.cash).toBe('number');
  });

  it('is JSON-serializable round-trip (SaveStore persists plain data)', () => {
    const { world } = build(42);
    const snap = snapshotWorld(world);
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);
  });

  // The AC round-trip: advance N days + change cash → snapshot → a NEW World
  // built from the SAME seed (reset to night-before-Day-1) → restore → state
  // matches, rather than the seed-rebuilt cold start.
  it('restores day + cash onto a fresh same-seed World', () => {
    const seed = 1234;
    const { world: original } = build(seed);

    // Mutate both tracked values away from their cold-start defaults.
    original.clock.advanceDay();
    original.clock.advanceDay();
    original.clock.advanceDay();
    original.economy.postRevenue(8_750, 'Sale');
    const expectedDay = original.clock.currentDay; // 4
    const expectedCash = original.economy.cash;
    expect(expectedDay).toBe(4);

    const snap = snapshotWorld(original);

    // A brand-new World from the same seed boots at the cold start...
    const { world: rebuilt } = build(seed);
    expect(rebuilt.clock.currentDay).toBe(1);
    expect(rebuilt.economy.cash).not.toBe(expectedCash);

    // ...until we restore the snapshot onto it.
    restoreWorld(snap, rebuilt);
    expect(rebuilt.clock.currentDay).toBe(expectedDay);
    expect(rebuilt.economy.cash).toBe(expectedCash);
  });
});

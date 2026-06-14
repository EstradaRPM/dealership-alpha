/**
 * #248 — Tier-N dev fixtures load through the NORMAL snapshot/restore path.
 *
 * The committed fixtures (data/fixtures/tier-N.json) are real `SaveState`s
 * captured by the #247 competent policy. The acceptance criterion is that they
 * rehydrate exactly like any save — `createWorld` (same seed + character) then
 * `restoreWorld` — landing at the right tier and playing a day without a
 * parallel loader. If the worldSnapshot envelope version bumps, the version
 * assertion below fails until `npm run gen:fixtures` regenerates the fixtures.
 */
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import {
  restoreWorld,
  WORLD_SNAPSHOT_VERSION,
  type PersistedWorldSnapshot,
} from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';
import { TIER_FIXTURES } from '../src/app/devFixtures';

interface FixtureFile {
  readonly world: PersistedWorldSnapshot & {
    readonly modules: { readonly gameClock: { readonly day: number } };
  };
  readonly character: CharacterProfile;
  readonly masterSeed: number;
}

const tier2 = require('../data/fixtures/tier-2.json') as FixtureFile;

function restoreFixture(f: FixtureFile) {
  const bus = createEventBus();
  const world = createWorld({
    bus,
    masterSeed: f.masterSeed,
    characterProfile: f.character,
  });
  restoreWorld(f.world, world);
  return world;
}

describe('Tier-N dev fixtures (#248)', () => {
  it('the committed tier-2 fixture is at the current snapshot envelope version', () => {
    // Stale-fixture guard: a worldSnapshot envelope bump must be followed by
    // `npm run gen:fixtures`, or the dev menu would restore an outdated shape.
    expect(tier2.world.version).toBe(WORLD_SNAPSHOT_VERSION);
  });

  it('restores through the normal path to a tier-2 mid-game world', () => {
    const world = restoreFixture(tier2);
    expect(world.tierManager.currentTier).toBe(2);
    // Mid-game, not "night before Day 1": the captured day + a positive cushion.
    expect(world.clock.currentDay).toBe(tier2.world.modules.gameClock.day);
    expect(world.clock.currentDay).toBeGreaterThan(1);
    expect(world.economy.cash).toBeGreaterThan(0);
    expect(world.inventory.getLotVehicles().length).toBeGreaterThan(0);
  });

  it('plays a normal day from the restored fixture without throwing', () => {
    const world = restoreFixture(tier2);
    const dayBefore = world.clock.currentDay;
    expect(() => world.dayLoop.nextDay().runDay()).not.toThrow();
    // The day loop ran; the world stays coherent (still T2, clock not regressed).
    expect(world.clock.currentDay).toBeGreaterThanOrEqual(dayBefore);
    expect(world.tierManager.currentTier).toBe(2);
    expect(Number.isFinite(world.economy.cash)).toBe(true);
  });

  it('the __DEV__ fixture registry exposes the committed tier-2 fixture', () => {
    // jest-expo defines __DEV__ = true, so the registry is populated here.
    const entry = TIER_FIXTURES.find((f) => f.tier === 2);
    expect(entry).toBeDefined();
    expect(entry?.state).toEqual(tier2);
  });
});

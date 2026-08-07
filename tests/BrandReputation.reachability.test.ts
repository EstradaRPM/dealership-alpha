import { readFileSync } from 'fs';
import { join } from 'path';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * Anti-orphan guard for per-brand reputation (#151).
 *
 * This mechanic has no screen by design (B2 I6 — ambient depth, not a
 * dashboard), which is exactly the shape that goes dark unnoticed: a number
 * that moves in a module nobody reads is indistinguishable from a number that
 * never moves. Both halves of the loop are pinned here — the standing changes
 * in the ASSEMBLED world when a deal closes, and the matcher is wired to read
 * it back.
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

describe('per-brand reputation is reachable in the assembled world (#151)', () => {
  it('a closed deal moves that make’s standing in the real composition', () => {
    const { bus, world } = build();
    expect(world.reputation.repFor('vanda')).toBe(0);

    bus.publish('staff:auto_resolved', {
      customerId: 'c1',
      staffId: 'nobody',
      day: 1,
      outcome: 'closed',
      grossImpact: 2_000,
      matchQuality: 0.8,
      vehicleCategory: 'sedan',
      brand: 'vanda',
      archetypeLabel: 'Young Family',
      badReview: false,
    });

    expect(world.reputation.repFor('vanda')).toBeGreaterThan(0);
    // And only that make — the standing is per-brand, not a store-wide scalar
    // wearing a brand key.
    expect(world.reputation.repFor('toraya')).toBe(0);
  });

  it('the standing rides the save envelope', () => {
    const { bus, world } = build();
    bus.publish('staff:auto_resolved', {
      customerId: 'c1',
      staffId: 'nobody',
      day: 1,
      outcome: 'closed',
      grossImpact: 2_000,
      brand: 'vanda',
      badReview: true,
    });
    const stained = world.reputation.repFor('vanda');
    expect(stained).toBeLessThan(0);

    const restored = build().world;
    restored.reputation.restore(world.reputation.snapshot());
    expect(restored.reputation.repFor('vanda')).toBeCloseTo(stained, 10);
  });

  it('the live match seam reads the standing back', () => {
    // The consuming end is a closure handed to StaffDispatch's
    // `salesProcessDeps` at the composition root, so there is no runtime handle
    // to assert against — the honest guard is that the wiring is still there.
    // Behavior of the term itself is covered in SalesProcess.pickVehicle.
    const source = readFileSync(join(__dirname, '..', 'src', 'createWorld.ts'), 'utf8');
    expect(source).toMatch(/reputationBonusFn:\s*\(brand\)\s*=>/);
    expect(source).toMatch(/reputation\.repFor\(brand\)/);
  });
});

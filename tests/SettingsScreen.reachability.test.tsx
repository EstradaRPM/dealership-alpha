import * as fs from 'fs';
import * as path from 'path';
import { readAppCompositionSource } from './helpers/appComposition';
import {
  createInMemoryDriverFactory,
  createMultiSlotSaveStore,
  createSnapshotStore,
  type SaveState,
} from '../src/game/SaveStore';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { restoreWorld, snapshotWorld, type WorldSnapshot } from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';

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

function buildWorld(seed: number) {
  const bus = createEventBus();
  return createWorld({ bus, masterSeed: seed, characterProfile: PROFILE });
}

function saveStateFor(seed: number, world: ReturnType<typeof buildWorld>): SaveState {
  return {
    character: PROFILE,
    masterSeed: seed,
    world: snapshotWorld(world),
  };
}

function metadataFromWorldSnapshot(snapshot: WorldSnapshot) {
  return {
    day: snapshot.modules.gameClock.day,
    tier: snapshot.modules.tierManager.currentTier,
  };
}

describe('#200 Settings rollback reachability', () => {
  it('rolls back a saved snapshot and rehydrates it through restoreWorld', async () => {
    const seed = 200;
    const driverFactory = createInMemoryDriverFactory();
    const slotStore = createMultiSlotSaveStore(driverFactory);
    const slot = await slotStore.createSlot('Rollback test');
    await slotStore.selectSlot(slot.id);
    const snapshotStore = createSnapshotStore(driverFactory(`snapshot:${slot.id}`));

    const prior = buildWorld(seed);
    prior.clock.advanceDay();
    prior.economy.postRevenue(2_000, 'prior snapshot marker');
    const priorState = saveStateFor(seed, prior);
    const priorSnapshot = priorState.world as WorldSnapshot;
    await snapshotStore.saveSnapshot(priorState, metadataFromWorldSnapshot(priorSnapshot));

    const later = buildWorld(seed);
    later.clock.advanceDay();
    later.clock.advanceDay();
    later.economy.postRevenue(9_000, 'later state marker');
    const laterState = saveStateFor(seed, later);
    const laterSnapshot = laterState.world as WorldSnapshot;
    await slotStore.save(laterState, metadataFromWorldSnapshot(laterSnapshot));

    const rolledBackState = await snapshotStore.rollbackToSnapshot(0);
    expect(rolledBackState).not.toBeNull();
    const rolledBackSnapshot = rolledBackState!.world as WorldSnapshot;
    await slotStore.save(
      rolledBackState!,
      metadataFromWorldSnapshot(rolledBackSnapshot),
    );

    const loaded = await slotStore.load();
    const rebuilt = buildWorld(seed);
    restoreWorld(loaded!.world as WorldSnapshot, rebuilt);

    expect(rebuilt.clock.currentDay).toBe(prior.clock.currentDay);
    expect(rebuilt.economy.cash).toBe(prior.economy.cash);
    expect(rebuilt.clock.currentDay).not.toBe(later.clock.currentDay);
    expect(rebuilt.economy.cash).not.toBe(later.economy.cash);
  });

  it('keeps Settings mounted in the live App route graph', () => {
    const src = readAppCompositionSource();

    expect(src).toMatch(/import \{ SettingsScreen \} from '\.\.\/\.\.\/ui\/SettingsScreen'/);
    expect(src).toMatch(/nav\.navigate\('settings'\)/);
    expect(src).toMatch(/screen === 'settings'/);
    expect(src).toMatch(/onSettings=\{saveSlots\.openSettings\}/);
    expect(src).toMatch(/rollbackToSnapshot\(index\)/);
    expect(src).toMatch(/await saveStore\.save\(state\)/);
    expect(src).toMatch(/await loadActiveSlotIntoGame\(\)/);
    expect(src).toMatch(/saveSnapshot\(nextState/);
  });
});

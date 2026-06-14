import * as fs from 'fs';
import * as path from 'path';
import { readAppCompositionSource } from './helpers/appComposition';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import {
  restoreWorld,
  snapshotWorld,
  type WorldSnapshot,
} from '../src/worldSnapshot';
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

function buildWorld(seed: number, bus = createEventBus()) {
  return {
    bus,
    world: createWorld({ bus, masterSeed: seed, characterProfile: PROFILE }),
  };
}

describe('#208 HistoryLog persistence + reachability', () => {
  it('round-trips the history log through snapshotWorld/restoreWorld', () => {
    const seed = 208;
    const { bus, world } = buildWorld(seed);

    // Drive a notable event through the live bus so the log fills in-world.
    bus.publish('clock:day_started', { day: 2 } as never);
    bus.publish('market:shock_started', {
      day: 2,
      shockId: 'fuel-spike',
      instanceId: 'fuel-spike@2',
      label: 'Fuel price spike',
      segmentMagnitudes: {},
      expectedEndDay: 9,
    } as never);

    const before = world.historyLog.getEntries();
    expect(before.length).toBeGreaterThan(0);

    const snap = snapshotWorld(world);
    expect(snap.modules.historyLog).toBeDefined();

    // Rehydrate onto a freshly-built world (same seed) — the #188 contract.
    const { world: rebuilt } = buildWorld(seed);
    restoreWorld(snap as WorldSnapshot, rebuilt);

    expect(rebuilt.historyLog.getEntries()).toEqual(before);
  });

  it('migrates a pre-#208 (v3) snapshot to an empty log', () => {
    const seed = 209;
    const { world } = buildWorld(seed);
    const current = snapshotWorld(world);

    // Forge a v3 envelope (no historyLog key) from the current modules.
    const { historyLog: _omit, ...olderModules } = current.modules;
    const v3 = { version: 3, modules: olderModules };

    const { world: rebuilt } = buildWorld(seed);
    restoreWorld(v3, rebuilt);
    expect(rebuilt.historyLog.getEntries()).toEqual([]);
  });

  it('keeps the History screen mounted in the live App route graph', () => {
    const src = readAppCompositionSource();

    expect(src).toMatch(
      /import \{ HistoryScreen \} from '\.\.\/\.\.\/ui\/HistoryScreen'/,
    );
    expect(src).toMatch(/nav\.navigate\('history'\)/);
    expect(src).toMatch(/screen === 'history'/);
    expect(src).toMatch(/onHistory=\{saveSlots\.openHistory\}/);
    expect(src).toMatch(/world\.historyLog\.getEntries\(\)/);
  });
});

// ── Composition root (#114) ──────────────────────────────────────────────────
// Seed-free, must outlive world (re)construction. The store reads the
// persisted per-save masterSeed (#96) before the seed-dependent World is
// built; bus stays stable so the render-loop hook + bus subscriptions have a
// bus before the seed is known.
//
// Multi-slot store (#194): the active slot holds one game's full world
// trajectory; the per-slot checkpoint cell (#109/#122) lives beside it,
// isolated, so the in-progress FloorSim checkpoint can never collide with the
// main save blob and never bleeds between slots.
//
// Extracted verbatim from App.tsx (#242). Consumers receive the built
// AppServices and never reach into the store internals.
import {
  createLegacyStore,
  createMultiSlotSaveStore,
  createSnapshotStore,
} from '../game/SaveStore';
import { createEventBus } from '../game/EventBus';
import { createPlaytestLog } from '../game/PlaytestLog';
import type { PlaytestLog } from '../game/PlaytestLog';
import type {
  SaveStore,
  MultiSlotSaveStore,
  DriverFactory,
  LegacyStore,
  SnapshotStore,
} from '../game/SaveStore';
import type { WorldSnapshot } from '../worldSnapshot';

function snapshotKey(slotId: string): string {
  return `snapshot:${slotId}`;
}

export interface AppServices {
  bus: ReturnType<typeof createEventBus>;
  saveStore: SaveStore;
  slotStore: MultiSlotSaveStore;
  legacyStore: LegacyStore;
  /**
   * #74 playtest recorder (#332). Seed-free and slot-free on purpose: it holds
   * its own driver cell, so it survives `Reset Save` and spans the whole
   * multi-day playtest round rather than one career.
   */
  playtestLog: PlaytestLog;
  snapshotStoreForActiveSlot(): Promise<SnapshotStore | null>;
}

export function createAppServices(driverFactory: DriverFactory): AppServices {
  const slotStore: MultiSlotSaveStore = createMultiSlotSaveStore(driverFactory);
  const legacyStore: LegacyStore = createLegacyStore(driverFactory('legacy-wall'));
  // Active-slot-backed SaveStore adapter (#194). The character/admin/end-card
  // flows depend on the narrow single-blob SaveStore surface (save/load/clear);
  // this presents exactly that, always addressing whichever slot is active.
  // Slot creation/selection is owned entirely by the start menu (#195) — by the
  // time anything saves, the MainMenu has already created+selected the active
  // slot, so there is no lazy auto-create here. The slot-picker `day`/`tier`
  // metadata is read off the persisted world snapshot when present, else 0/1.
  const saveStore: SaveStore = {
    async save(state) {
      const snap = state.world as WorldSnapshot | undefined;
      const day = snap?.modules.gameClock.day ?? 0;
      const tier = snap?.modules.tierManager.currentTier ?? 1;
      await slotStore.save(state, { day, tier });
    },
    load: () => slotStore.load(),
    async clear() {
      const id = await slotStore.getActiveSlotId();
      if (id !== null) await slotStore.deleteSlot(id);
    },
  };

  const playtestLog = createPlaytestLog(driverFactory('playtest-log'));
  void playtestLog.hydrate();

  return {
    bus: createEventBus(),
    saveStore,
    slotStore,
    legacyStore,
    playtestLog,
    async snapshotStoreForActiveSlot() {
      const activeSlotId = await slotStore.getActiveSlotId();
      return activeSlotId === null
        ? null
        : createSnapshotStore(driverFactory(snapshotKey(activeSlotId)));
    },
  };
}

import { useState } from 'react';
import type { Navigator } from '../ui/Navigator';
import type { World } from '../createWorld';
import { snapshotWorld, type WorldSnapshot } from '../worldSnapshot';
import type { AppServices } from './services';
import type {
  SaveState,
  WeeklySnapshot,
  SlotMetadata,
  LegacyEntry,
} from '../game/SaveStore';

export interface SaveSlotsDeps {
  services: AppServices;
  worldRef: React.MutableRefObject<World | null>;
  nav: Navigator;
  /** Build + route into the active slot's game (owned by AppRoot). */
  loadActiveSlotIntoGame: () => Promise<void>;
  /** Tear down all session state back to a clean menu (owned by AppRoot). */
  resetSessionState: () => void;
}

export interface SaveSlots {
  settingsSnapshots: readonly WeeklySnapshot[];
  inGameSlots: readonly SlotMetadata[];
  activeSlotId: string | null;
  inGameMenuStatus: string;
  legacyWallLegacies: readonly LegacyEntry[];
  // Save helpers (shared with useDayLoop's day-close autosave).
  buildCurrentSaveState: (
    overrides?: SaveState,
    worldSnapshot?: WorldSnapshot,
  ) => Promise<SaveState>;
  persistCurrentSave: (overrides?: SaveState) => void;
  saveCurrentGame: () => Promise<void>;
  refreshInGameSlots: () => Promise<void>;
  refreshSettingsSnapshots: () => Promise<void>;
  // Menu / settings / sub-screen navigation.
  openInGameMenu: () => void;
  handleManualSave: () => Promise<void>;
  handleInGameLoadSlot: (slotId: string) => Promise<void>;
  handleReturnToMainMenu: () => Promise<void>;
  openSettings: () => void;
  openLegacyWall: () => void;
  openKPIDashboard: () => void;
  openHistory: () => void;
  handleRollback: (index: number) => Promise<void>;
}

// The save/slot-management cluster (#242). Owns the slot-picker metadata, the
// weekly-snapshot list, the in-game-menu status line, and every save helper /
// menu navigation handler. The world-mutating orchestrators (load a slot, reset
// the session) live in AppRoot and are injected so this hook never reaches into
// the world/day-loop clusters directly.
export function useSaveSlots({
  services,
  worldRef,
  nav,
  loadActiveSlotIntoGame,
  resetSessionState,
}: SaveSlotsDeps): SaveSlots {
  const { saveStore, slotStore, legacyStore, snapshotStoreForActiveSlot } =
    services;
  const [settingsSnapshots, setSettingsSnapshots] = useState<
    readonly WeeklySnapshot[]
  >([]);
  const [inGameSlots, setInGameSlots] = useState<readonly SlotMetadata[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [inGameMenuStatus, setInGameMenuStatus] = useState('');
  const [legacyWallLegacies, setLegacyWallLegacies] = useState<
    readonly LegacyEntry[]
  >([]);

  const refreshSettingsSnapshots = async () => {
    const snapshotStore = await snapshotStoreForActiveSlot();
    setSettingsSnapshots(
      snapshotStore ? await snapshotStore.listSnapshots() : [],
    );
  };

  const refreshInGameSlots = async () => {
    const [slots, active] = await Promise.all([
      slotStore.listSlots(),
      slotStore.getActiveSlotId(),
    ]);
    setInGameSlots(slots);
    setActiveSlotId(active);
  };

  const buildCurrentSaveState = async (
    overrides: SaveState = {},
    worldSnapshot?: WorldSnapshot,
  ): Promise<SaveState> => {
    const existing = await saveStore.load();
    const liveWorld =
      worldSnapshot ??
      (worldRef.current ? snapshotWorld(worldRef.current) : undefined);
    return {
      ...(existing ?? {}),
      ...(liveWorld ? { world: liveWorld } : {}),
      ...overrides,
    };
  };

  const persistCurrentSave = (overrides: SaveState = {}) => {
    void (async () => {
      await saveStore.save(await buildCurrentSaveState(overrides));
    })();
  };

  const saveCurrentGame = async () => {
    const w = worldRef.current;
    if (!w) return;
    const worldSnapshot = snapshotWorld(w);
    const nextState = await buildCurrentSaveState({}, worldSnapshot);
    await saveStore.save(nextState);
    const cp = w.dayLoop.checkpoint();
    if (cp) {
      await slotStore.writeCheckpoint(cp);
    } else {
      await slotStore.clearCheckpoint();
    }
    await refreshInGameSlots();
  };

  const openInGameMenu = () => {
    setInGameMenuStatus('');
    void refreshInGameSlots();
    nav.navigate('in-game-menu');
  };

  const handleManualSave = async () => {
    setInGameMenuStatus('Saving...');
    try {
      await saveCurrentGame();
      setInGameMenuStatus('Saved.');
    } catch (err) {
      console.error('Save current game failed', err);
      setInGameMenuStatus('Save failed. Check the Expo console.');
    }
  };

  const handleInGameLoadSlot = async (slotId: string) => {
    try {
      setInGameMenuStatus('Saving current game...');
      await saveCurrentGame();
      setInGameMenuStatus('Loading save...');
      await slotStore.selectSlot(slotId);
      await loadActiveSlotIntoGame();
      setInGameMenuStatus('');
    } catch (err) {
      console.error('Save and load failed', err);
      setInGameMenuStatus('Save/load failed. Check the Expo console.');
    }
  };

  const handleReturnToMainMenu = async () => {
    try {
      setInGameMenuStatus('Saving current game...');
      await saveCurrentGame();
      resetSessionState();
      setInGameMenuStatus('');
      nav.reset('main-menu');
    } catch (err) {
      console.error('Save and return to main menu failed', err);
      setInGameMenuStatus('Save failed. Check the Expo console.');
    }
  };

  const openSettings = () => {
    setSettingsSnapshots([]);
    void refreshSettingsSnapshots();
    nav.navigate('settings');
  };

  const openLegacyWall = () => {
    setLegacyWallLegacies([]);
    void (async () => {
      setLegacyWallLegacies(await legacyStore.listLegacies());
    })();
    nav.navigate('legacy-wall');
  };

  const openKPIDashboard = () => {
    nav.navigate('kpi-dashboard');
  };

  const openHistory = () => {
    nav.navigate('history');
  };

  const handleRollback = async (index: number) => {
    const snapshotStore = await snapshotStoreForActiveSlot();
    const state = await snapshotStore?.rollbackToSnapshot(index);
    if (!state) {
      await refreshSettingsSnapshots();
      return;
    }
    await saveStore.save(state);
    await slotStore.clearCheckpoint();
    await loadActiveSlotIntoGame();
  };

  return {
    settingsSnapshots,
    inGameSlots,
    activeSlotId,
    inGameMenuStatus,
    legacyWallLegacies,
    buildCurrentSaveState,
    persistCurrentSave,
    saveCurrentGame,
    refreshInGameSlots,
    refreshSettingsSnapshots,
    openInGameMenu,
    handleManualSave,
    handleInGameLoadSlot,
    handleReturnToMainMenu,
    openSettings,
    openLegacyWall,
    openKPIDashboard,
    openHistory,
    handleRollback,
  };
}

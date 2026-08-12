/**
 * Public types for the SaveStore module.
 *
 * SaveStore is the sole gateway to persistent game state. Consumers hand it
 * a plain serializable state object; the backing storage (SQLite today,
 * potentially a cloud-sync layer later) is hidden behind a StorageDriver.
 */

export type SaveState = Record<string, unknown>;

export interface SaveStore {
  save(state: SaveState): Promise<void>;
  load(): Promise<SaveState | null>;
  clear(): Promise<void>;
}

/**
 * Narrow seam between SaveStore and whatever persists bytes.
 * Current implementations: in-memory (tests), expo-sqlite (device).
 */
export interface StorageDriver {
  read(): Promise<string | null>;
  write(payload: string): Promise<void>;
  clear(): Promise<void>;
}

export interface WeeklySnapshot {
  day: number;
  tier: number;
  state: SaveState;
}

export interface SnapshotStore {
  saveSnapshot(state: SaveState, meta: { day: number; tier: number }): Promise<void>;
  listSnapshots(): Promise<readonly WeeklySnapshot[]>;
  rollbackToSnapshot(index: number): Promise<SaveState | null>;
  clear(): Promise<void>;
}

/**
 * What the player has been taught, for one slot (issue 386).
 *
 * Deliberately NOT world state: it records something about the *player's*
 * progress through the game's teaching, not about the store. It therefore
 * lives in its own per-slot cell rather than in the world snapshot, and
 * `WORLD_SNAPSHOT_VERSION` is untouched by anything that writes here.
 *
 * `resetAll()` re-arms this slot's hints (the "Show hints again" switch) and
 * keeps the cell; `clear()` wipes the cell itself, and is what `deleteSlot`
 * calls. Two careers learn independently — neither is a global reset.
 */
export interface TeachingStore {
  markTaught(id: string): Promise<void>;
  listTaught(): Promise<readonly string[]>;
  resetAll(): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Per-slot metadata surfaced to slot-picker UI. The game-state blob itself
 * lives behind the slot's own SaveStore; this is just the index entry.
 */
export interface SlotMetadata {
  id: string;
  name: string;
  day: number;
  /** Career tier reached (1-based); surfaced on the slot card. Starts at 1. */
  tier: number;
  lastPlayed: string; // ISO 8601 timestamp
}

/**
 * Produces an independent StorageDriver per logical key. Each key addresses
 * its own isolated cell so slots (and the slot index) never collide.
 * Current factories: keyed in-memory (tests), per-key sqlite db (device).
 */
export type DriverFactory = (key: string) => StorageDriver;

/**
 * One entry in the ordered player-action log. SaveStore round-trips these
 * verbatim and never inspects them; the deterministic-replay slice (#122)
 * defines and interprets the concrete shape.
 */
export type CheckpointAction = Record<string, unknown>;

/**
 * Lightweight mid-day checkpoint written on background and consumed by
 * deterministic cold-start replay (#122). Everything here is plain
 * serializable data the slot round-trips losslessly; SaveStore treats
 * `dayContext` and each `actionLog` entry as opaque.
 */
export interface MidDayCheckpoint {
  seed: number;
  day: number;
  /** Opaque #99 DayContext for the in-progress day. */
  dayContext: SaveState;
  currentTick: number;
  /** Player actions in dispatch order; replayed to `currentTick` by #122. */
  actionLog: readonly CheckpointAction[];
}

/**
 * Multi-slot save management sitting above the single-blob SaveStore.
 * Active-slot selection persists across cold start; deleting a slot is
 * isolated. The per-slot mid-day checkpoint and a future cloud-sync driver
 * drop in below this interface without consumer changes.
 */
export interface MultiSlotSaveStore {
  createSlot(name: string): Promise<SlotMetadata>;
  listSlots(): Promise<readonly SlotMetadata[]>;
  selectSlot(id: string): Promise<void>;
  getActiveSlotId(): Promise<string | null>;
  deleteSlot(id: string): Promise<void>;
  /** Persist game state into the active slot and refresh its metadata. */
  save(state: SaveState, meta: { day: number; tier: number }): Promise<void>;
  /** Load the active slot's game state, or null if none / not selected. */
  load(): Promise<SaveState | null>;
  /** Write the mid-day checkpoint for the active slot (overwrites prior). */
  writeCheckpoint(checkpoint: MidDayCheckpoint): Promise<void>;
  /** Read the active slot's mid-day checkpoint, or null if none. */
  readCheckpoint(): Promise<MidDayCheckpoint | null>;
  /** Clear the active slot's mid-day checkpoint (called on day-complete). */
  clearCheckpoint(): Promise<void>;
  /**
   * The active slot's weekly-snapshot store, or null if no slot is selected.
   *
   * It lives here rather than in the composition root because a slot's cells
   * are one key space and `deleteSlot` has to be able to wipe all of it — a
   * `snapshot:<id>` cell minted outside this module outlived the slot it
   * belonged to, and nothing could ever reach it again.
   */
  snapshotStore(): Promise<SnapshotStore | null>;
  /**
   * The active slot's teaching cell, or null if no slot is selected (386).
   *
   * Null is a real answer, not a failure: with no slot the game cannot know
   * what this player has been taught, and a hint the store cannot answer for
   * is *shown* rather than hidden.
   */
  teachingStore(): Promise<TeachingStore | null>;
}

export interface LegacyEntry {
  playerName: string;
  backstoryId: string;
  careerYear: number;
  tierReached: number;
  reason: string;
  flavorText: string;
  completedAt: string;
}

export interface LegacyStore {
  appendLegacy(entry: LegacyEntry): Promise<void>;
  listLegacies(): Promise<readonly LegacyEntry[]>;
  clear(): Promise<void>;
}

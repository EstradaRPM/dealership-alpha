/**
 * Public types for the SaveStore module.
 *
 * SaveStore is the sole gateway to persistent game state. Consumers hand it
 * a plain serializable state object; the backing storage (SQLite in v1,
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
 * v1 implementations: in-memory (tests), expo-sqlite (device).
 */
export interface StorageDriver {
  read(): Promise<string | null>;
  write(payload: string): Promise<void>;
  clear(): Promise<void>;
}

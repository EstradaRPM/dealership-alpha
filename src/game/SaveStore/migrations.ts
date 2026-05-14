import type { SaveState } from './types';

/**
 * Versioned save format. Every persisted blob is a SaveEnvelope so that
 * future save-shape changes can be migrated forward on load.
 *
 * Adding a new save version:
 *   1. Bump CURRENT_SAVE_VERSION.
 *   2. Register a Migration under MIGRATIONS keyed by the *old* version
 *      (the one being upgraded *from*).
 *   3. Migration runs in order until the envelope reaches the current version.
 */

export const CURRENT_SAVE_VERSION = 1;

export interface SaveEnvelope {
  v: number;
  state: SaveState;
}

export type Migration = (state: SaveState) => SaveState;

export const MIGRATIONS: Record<number, Migration> = {
  // v1 is the first shipped version — no upgrades needed yet.
};

export function wrap(state: SaveState): SaveEnvelope {
  return { v: CURRENT_SAVE_VERSION, state };
}

export function migrate(
  envelope: SaveEnvelope,
  migrations: Record<number, Migration> = MIGRATIONS,
  targetVersion: number = CURRENT_SAVE_VERSION,
): SaveState {
  if (envelope.v > targetVersion) {
    throw new Error(
      `Save was written by a newer game version (save v${envelope.v}, runtime v${targetVersion}). Refusing to load.`,
    );
  }
  let state = envelope.state;
  for (let from = envelope.v; from < targetVersion; from++) {
    const step = migrations[from];
    if (!step) {
      throw new Error(`No migration registered from save v${from} to v${from + 1}.`);
    }
    state = step(state);
  }
  return state;
}

// Platform choice of persistence backend (#338).
//
// SaveStore owns *how* each backend stores bytes; this file — a composition-root
// concern, not game logic — owns *which* one the running platform gets. Keeping
// it here is why no module under `src/game/` imports `react-native`.
//
// - native (iOS/Android, the shipping targets) → per-key `expo-sqlite` db files
// - web (the drivable target `npm run web` boots) → IndexedDB, no native module
//
// Both satisfy the same `DriverFactory` contract, so everything above the driver
// — slots, snapshots, checkpoints, the playtest log — is identical on either.
import { Platform } from 'react-native';
import {
  createSqliteDriverFactory,
  createWebDriverFactory,
  type DriverFactory,
} from '../game/SaveStore';

export function createPlatformDriverFactory(): DriverFactory {
  return Platform.OS === 'web' ? createWebDriverFactory() : createSqliteDriverFactory();
}

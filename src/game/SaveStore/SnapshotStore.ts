import type { SaveState, StorageDriver, SnapshotStore, WeeklySnapshot } from './types';

const SNAPSHOT_WINDOW = 6;

interface SnapshotBank {
  v: 1;
  snapshots: WeeklySnapshot[];
}

async function readBank(driver: StorageDriver): Promise<WeeklySnapshot[]> {
  const raw = await driver.read();
  if (raw === null) return [];
  const bank = JSON.parse(raw) as SnapshotBank;
  return bank.snapshots;
}

async function writeBank(driver: StorageDriver, snapshots: WeeklySnapshot[]): Promise<void> {
  const bank: SnapshotBank = { v: 1, snapshots };
  await driver.write(JSON.stringify(bank));
}

export function createSnapshotStore(driver: StorageDriver): SnapshotStore {
  return {
    async saveSnapshot(state: SaveState, meta: { day: number; tier: number }) {
      const existing = await readBank(driver);
      const next: WeeklySnapshot = { day: meta.day, tier: meta.tier, state };
      const updated = [next, ...existing].slice(0, SNAPSHOT_WINDOW);
      await writeBank(driver, updated);
    },

    async listSnapshots() {
      return readBank(driver);
    },

    async rollbackToSnapshot(index: number) {
      const snapshots = await readBank(driver);
      return snapshots[index]?.state ?? null;
    },

    async clear() {
      await driver.clear();
    },
  };
}

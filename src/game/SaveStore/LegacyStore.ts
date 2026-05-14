import type { StorageDriver, LegacyStore, LegacyEntry } from './types';

interface LegacyBank {
  v: 1;
  entries: LegacyEntry[];
}

async function readBank(driver: StorageDriver): Promise<LegacyEntry[]> {
  const raw = await driver.read();
  if (raw === null) return [];
  const bank = JSON.parse(raw) as LegacyBank;
  return bank.entries;
}

async function writeBank(driver: StorageDriver, entries: LegacyEntry[]): Promise<void> {
  const bank: LegacyBank = { v: 1, entries };
  await driver.write(JSON.stringify(bank));
}

export function createLegacyStore(driver: StorageDriver): LegacyStore {
  return {
    async appendLegacy(entry: LegacyEntry) {
      const existing = await readBank(driver);
      await writeBank(driver, [entry, ...existing]);
    },

    async listLegacies() {
      return readBank(driver);
    },

    async clear() {
      await driver.clear();
    },
  };
}

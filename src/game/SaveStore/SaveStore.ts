import type { SaveState, SaveStore, StorageDriver } from './types';

export function createSaveStore(driver: StorageDriver): SaveStore {
  return {
    async save(state) {
      await driver.write(JSON.stringify(state));
    },

    async load() {
      const raw = await driver.read();
      if (raw === null) return null;
      return JSON.parse(raw) as SaveState;
    },

    async clear() {
      await driver.clear();
    },
  };
}

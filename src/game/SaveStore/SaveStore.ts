import { migrate, wrap, type SaveEnvelope } from './migrations';
import type { SaveStore, StorageDriver } from './types';

export function createSaveStore(driver: StorageDriver): SaveStore {
  return {
    async save(state) {
      await driver.write(JSON.stringify(wrap(state)));
    },

    async load() {
      const raw = await driver.read();
      if (raw === null) return null;
      const envelope = JSON.parse(raw) as SaveEnvelope;
      return migrate(envelope);
    },

    async clear() {
      await driver.clear();
    },
  };
}

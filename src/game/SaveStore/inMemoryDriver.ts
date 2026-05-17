import type { DriverFactory, StorageDriver } from './types';

export function createInMemoryDriver(): StorageDriver {
  let cell: string | null = null;
  return {
    async read() {
      return cell;
    },
    async write(payload) {
      cell = payload;
    },
    async clear() {
      cell = null;
    },
  };
}

/**
 * Keyed in-memory DriverFactory for tests. Each key owns an independent
 * cell that survives across factory consumers, so cold-start persistence
 * and cross-slot isolation can be exercised without sqlite.
 */
export function createInMemoryDriverFactory(): DriverFactory {
  const cells = new Map<string, { value: string | null }>();
  return (key: string) => {
    let entry = cells.get(key);
    if (!entry) {
      entry = { value: null };
      cells.set(key, entry);
    }
    return {
      async read() {
        return entry.value;
      },
      async write(payload) {
        entry.value = payload;
      },
      async clear() {
        entry.value = null;
      },
    };
  };
}

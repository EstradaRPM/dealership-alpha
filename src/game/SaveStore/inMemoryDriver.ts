import type { StorageDriver } from './types';

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

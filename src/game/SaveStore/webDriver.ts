import type { DriverFactory, StorageDriver } from './types';

/**
 * Browser-backed StorageDriver — the web sibling of `sqliteDriver.ts`.
 *
 * It exists so the app boots on a target an agent can actually drive
 * (`npm run web`) without pulling in the native SQLite module. Everything
 * above the driver is unchanged: same three-method contract, same per-key
 * isolation, so slots/snapshots/checkpoints behave identically.
 *
 * Backends, resolved lazily on first use and never mixed within a session:
 *  1. **IndexedDB** — the real one. Async, and its quota comfortably holds
 *     several 80KB world snapshots per slot plus the six-deep snapshot ring.
 *  2. **localStorage** — used only when IndexedDB is missing. Correct but
 *     capped near 5MB, so a long career can outgrow it; that is why it is the
 *     fallback and not the default.
 *  3. **memory** — last resort (no DOM storage at all). The session still
 *     runs; it just does not survive a reload.
 *
 * This file is the ONE place in the codebase allowed to touch browser storage.
 */

const DEFAULT_DATABASE_NAME = 'dealership';
const OBJECT_STORE = 'cells';
const LOCAL_STORAGE_PREFIX = 'dealership:';

export type WebStorageBackendKind = 'indexeddb' | 'localstorage' | 'memory';

/**
 * The narrow async key/value surface every backend implements. Injectable so
 * tests can exercise the driver contract without a browser, and so a future
 * backend (OPFS, a sync layer) drops in without touching the driver.
 */
export interface WebKeyValueStore {
  readonly kind: WebStorageBackendKind;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface WebDriverOptions {
  /** IndexedDB database name / localStorage key namespace. */
  databaseName?: string;
  /** Inject a backend instead of auto-detecting one (tests, future drivers). */
  backend?: WebKeyValueStore;
}

function hasIndexedDb(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
}

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis !== 'undefined' && globalThis.localStorage != null;
  } catch {
    // Some browsers throw on `localStorage` access when storage is blocked.
    return false;
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export function createIndexedDbStore(databaseName: string): WebKeyValueStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function getDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const open = globalThis.indexedDB.open(databaseName, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(OBJECT_STORE)) {
          db.createObjectStore(OBJECT_STORE);
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
    });
    return dbPromise;
  }

  async function tx<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await getDb();
    const transaction = db.transaction(OBJECT_STORE, mode);
    const result = await request(run(transaction.objectStore(OBJECT_STORE)));
    // A readwrite transaction is only durable once it commits; awaiting the
    // request alone can resolve before the write lands.
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error('IndexedDB transaction failed'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      });
    }
    return result;
  }

  return {
    kind: 'indexeddb',
    async get(key) {
      const value = await tx<unknown>('readonly', (store) => store.get(key));
      return typeof value === 'string' ? value : null;
    },
    async set(key, value) {
      await tx('readwrite', (store) => store.put(value, key));
    },
    async remove(key) {
      await tx('readwrite', (store) => store.delete(key));
    },
  };
}

export function createLocalStorageStore(namespace: string): WebKeyValueStore {
  const prefix = `${LOCAL_STORAGE_PREFIX}${namespace}:`;
  return {
    kind: 'localstorage',
    async get(key) {
      return globalThis.localStorage.getItem(prefix + key);
    },
    async set(key, value) {
      globalThis.localStorage.setItem(prefix + key, value);
    },
    async remove(key) {
      globalThis.localStorage.removeItem(prefix + key);
    },
  };
}

export function createMemoryStore(): WebKeyValueStore {
  const cells = new Map<string, string>();
  return {
    kind: 'memory',
    async get(key) {
      return cells.get(key) ?? null;
    },
    async set(key, value) {
      cells.set(key, value);
    },
    async remove(key) {
      cells.delete(key);
    },
  };
}

/**
 * Pick the best backend this environment actually offers. Exported so a caller
 * (or a test) can assert which one a given environment resolves to.
 */
export function resolveWebStorageBackend(databaseName = DEFAULT_DATABASE_NAME): WebKeyValueStore {
  if (hasIndexedDb()) return createIndexedDbStore(databaseName);
  if (hasLocalStorage()) return createLocalStorageStore(databaseName);
  return createMemoryStore();
}

const SINGLE_CELL_KEY = 'save';

/** Single-cell web StorageDriver — the web analogue of `createSqliteDriver`. */
export function createWebDriver(options: WebDriverOptions = {}): StorageDriver {
  return createWebDriverFactory(options)(SINGLE_CELL_KEY);
}

/**
 * Per-key web DriverFactory. All keys share one IndexedDB database but own an
 * independent record inside it, so deleting a slot cannot touch another —
 * the same isolation the per-file sqlite factory gives on device.
 */
export function createWebDriverFactory(options: WebDriverOptions = {}): DriverFactory {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  // Resolved once per factory: every cell in a session shares one backend, so
  // a mid-session downgrade can never split a save across two stores.
  const backend = options.backend ?? resolveWebStorageBackend(databaseName);
  const drivers = new Map<string, StorageDriver>();
  return (key: string) => {
    let driver = drivers.get(key);
    if (!driver) {
      driver = {
        async read() {
          return backend.get(key);
        },
        async write(payload) {
          await backend.set(key, payload);
        },
        async clear() {
          await backend.remove(key);
        },
      };
      drivers.set(key, driver);
    }
    return driver;
  };
}

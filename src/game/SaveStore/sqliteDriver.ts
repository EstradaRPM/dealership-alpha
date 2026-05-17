import * as SQLite from 'expo-sqlite';

import type { DriverFactory, StorageDriver } from './types';

/**
 * expo-sqlite backed StorageDriver. The schema is a single-row table —
 * the entire serialized game state lives in one cell. That keeps this
 * driver narrow; structured query lives above SaveStore (or in future
 * driver versions), not here.
 *
 * This file is the ONE place in the codebase allowed to import expo-sqlite.
 */

const DEFAULT_DB_NAME = 'dealership.db';

export interface SqliteDriverOptions {
  databaseName?: string;
}

interface SaveRow {
  payload: string;
}

export function createSqliteDriver(options: SqliteDriverOptions = {}): StorageDriver {
  const name = options.databaseName ?? DEFAULT_DB_NAME;
  let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  function getDb(): Promise<SQLite.SQLiteDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(name);
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS save_slot (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);',
      );
      return db;
    })();
    return dbPromise;
  }

  return {
    async read() {
      const db = await getDb();
      const row = await db.getFirstAsync<SaveRow>('SELECT payload FROM save_slot WHERE id = 1;');
      return row ? row.payload : null;
    },

    async write(payload) {
      const db = await getDb();
      await db.runAsync(
        'INSERT INTO save_slot (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload;',
        payload,
      );
    },

    async clear() {
      const db = await getDb();
      await db.runAsync('DELETE FROM save_slot;');
    },
  };
}

/**
 * Per-key sqlite DriverFactory. Each logical key maps to its own database
 * file, so slots are isolated at the storage-file level and deleting one
 * cannot corrupt another.
 */
export function createSqliteDriverFactory(options: SqliteDriverOptions = {}): DriverFactory {
  const base = (options.databaseName ?? DEFAULT_DB_NAME).replace(/\.db$/, '');
  return (key: string) => {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return createSqliteDriver({ databaseName: `${base}.${safeKey}.db` });
  };
}

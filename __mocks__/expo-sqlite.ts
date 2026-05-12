/**
 * Jest mock for expo-sqlite. The real module requires a React Native
 * runtime that jest-expo can't resolve in the node test environment.
 *
 * The mock is *intentionally* dumb: it exists so importing the
 * SaveStore barrel (which re-exports the SQLite driver) doesn't crash
 * under jest. Tests of save/load behavior use the in-memory driver
 * directly and never touch this mock. The real SQLite driver is
 * verified on device.
 */

export async function openDatabaseAsync(): Promise<unknown> {
  throw new Error(
    'expo-sqlite is mocked under jest. Use createInMemoryDriver() in tests; verify the SQLite driver on device.',
  );
}

export type SQLiteDatabase = unknown;
export type SQLiteOpenOptions = unknown;

# SaveStore

Persistence layer. The **only** module that touches storage drivers (SQLite or in-memory). Designed so a cloud-sync driver drops in without consumer changes.

## Public API (`index.ts`)
- `createSaveStore({ driver })` → `SaveStore`.
- Drivers: `createInMemoryDriver` (tests), `createSqliteDriver` (production via `expo-sqlite`). Options: `SqliteDriverOptions`.
- Migration helpers: `CURRENT_SAVE_VERSION`, `migrate`, `wrap`. Types: `Migration`, `SaveEnvelope`.
- Types: `SaveStore`, `SaveState`, `StorageDriver`.

## Events
None — SaveStore is invoked imperatively by orchestration code, not via the bus.

## Migrations
Bump `CURRENT_SAVE_VERSION` and append a `Migration` whenever the persisted `SaveState` shape changes. Migrations run on load via `migrate()` → `wrap()`.

## No-no
- Never import `expo-sqlite` outside this module.
- Never read/write storage from other game-logic modules — they must round-trip through SaveStore.

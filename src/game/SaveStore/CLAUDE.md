# SaveStore

Persistence layer. The **only** module that touches storage drivers (SQLite or in-memory). Designed so a cloud-sync driver drops in without consumer changes.

## Public API (`index.ts`)
- `createSaveStore(driver)` → `SaveStore` — primary save slot (single state blob).
- `createSnapshotStore(driver)` → `SnapshotStore` — rolling window of up to 6 weekly snapshots. Pass a *separate* driver from the main save so the two slots never collide.
  - `saveSnapshot(state, { day, tier })` — prepend snapshot, drop oldest if window > 6.
  - `listSnapshots()` → `readonly WeeklySnapshot[]` — newest first.
  - `rollbackToSnapshot(index)` → `SaveState | null` — returns the state for that slot (caller restores it via `saveStore.save()`).
  - `clear()` — wipe all snapshots.
- `createMultiSlotSaveStore(driverFactory, options?)` → `MultiSlotSaveStore` — 2–3 independent save slots. Options: `{ maxSlots?: number (default 3); now?: () => string }`.
  - `createSlot(name)` → `SlotMetadata` (auto-activates the first slot; throws at the cap).
  - `listSlots()` → `readonly SlotMetadata[]` (id/name/day/tier/lastPlayed).
  - `selectSlot(id)` / `getActiveSlotId()` — active selection persists across cold start.
  - `deleteSlot(id)` — wipes only that slot's blob; clears active selection iff it was the deleted slot; recreated ids never reuse a deleted blob.
  - `save(state, { day, tier })` / `load()` — addresses the active slot and refreshes its metadata.
  - `writeCheckpoint(cp)` / `readCheckpoint()` / `clearCheckpoint()` — per-slot mid-day checkpoint (#109). Lives in its own cell (`checkpoint:<id>`), independent across slots, separate from the main save blob; `deleteSlot` wipes it too. Payload `MidDayCheckpoint = { seed, day, dayContext, currentTick, actionLog }` — `dayContext`/`actionLog` are opaque serializable data SaveStore round-trips but never inspects. Schema + accessors only; replay logic is #122. Caller clears it on day-complete.
- Drivers: `createInMemoryDriver` (single-cell, tests), `createSqliteDriver` (production via `expo-sqlite`). Options: `SqliteDriverOptions`.
- Driver factories (for multi-slot — one isolated cell per key): `createInMemoryDriverFactory` (tests), `createSqliteDriverFactory` (per-key db file).
- Migration helpers: `CURRENT_SAVE_VERSION`, `migrate`, `wrap`. Types: `Migration`, `SaveEnvelope`.
- Types: `SaveStore`, `SaveState`, `StorageDriver`, `DriverFactory`, `MultiSlotSaveStore`, `SlotMetadata`, `MidDayCheckpoint`, `CheckpointAction`, `SnapshotStore`, `WeeklySnapshot`.

## Events
None — SaveStore is invoked imperatively by orchestration code, not via the bus.

## Migrations
Bump `CURRENT_SAVE_VERSION` and append a `Migration` whenever the persisted `SaveState` shape changes. Migrations run on load via `migrate()` → `wrap()`.

## No-no
- Never import `expo-sqlite` outside this module.
- Never read/write storage from other game-logic modules — they must round-trip through SaveStore.

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
  - `deleteSlot(id)` — wipes **every cell the slot owns** (`slot:<id>`, `checkpoint:<id>`, `snapshot:<id>`, `teaching:<id>`) and nothing else; clears active selection iff it was the deleted slot; recreated ids never reuse a deleted blob.
  - `snapshotStore()` → `SnapshotStore | null` — the active slot's weekly-snapshot window.
  - `teachingStore()` → `TeachingStore | null` — the active slot's teaching progress (#386). `null` when no slot is selected, and that is a real answer: the caller shows every hint rather than hiding what the store cannot answer for.
- `createTeachingStore(driver)` → `TeachingStore` — the set of hint/teaching ids this player has retired, in the slot's own `teaching:<id>` cell.
  - `markTaught(id)` (idempotent) / `listTaught()` → `readonly string[]` / `resetAll()` (re-arm this slot's hints, keep the cell) / `clear()` (wipe the cell — what `deleteSlot` calls).
  - **One cell, three catalogs.** The ids in here come from `data/hints.json` (a control's consequence line, #386/#388), `data/teaching-beats.json` (a one-shot moment, #394) and `data/spine-steps.json` (a first-run coachmark, #213). It stays a bare id list precisely so a new kind of teaching needs a catalog and no change here — and so "Show hints again" re-arms all three with one `resetAll()`.
  - **Not world state.** It records the *player's* progress through the game's teaching, not the store's, so it lives in its own cell and `WORLD_SNAPSHOT_VERSION` is untouched by anything written here. `resetAll()` is per-slot: two careers learn independently.
  - A corrupt cell reads as "nothing taught yet" instead of throwing — the failure mode of a teaching surface is showing too much, never crashing the career.
  - `save(state, { day, tier })` / `load()` — addresses the active slot and refreshes its metadata.
  - `writeCheckpoint(cp)` / `readCheckpoint()` / `clearCheckpoint()` — per-slot mid-day checkpoint (#109). Lives in its own cell (`checkpoint:<id>`), independent across slots, separate from the main save blob; `deleteSlot` wipes it too. Payload `MidDayCheckpoint = { seed, day, dayContext, currentTick, actionLog }` — `dayContext`/`actionLog` are opaque serializable data SaveStore round-trips but never inspects. Schema + accessors only; replay logic is #122. Caller clears it on day-complete.
- Drivers: `createInMemoryDriver` (single-cell, tests), `createSqliteDriver` (device via `expo-sqlite`), `createWebDriver` (browser). Options: `SqliteDriverOptions`, `WebDriverOptions`.
- Driver factories (for multi-slot — one isolated cell per key): `createInMemoryDriverFactory` (tests), `createSqliteDriverFactory` (per-key db file), `createWebDriverFactory` (per-key record in one IndexedDB store).
- **Every per-slot cell key is minted inside `SlotStore.ts` and nowhere else.** `snapshot:<id>` used to be built in the composition root (`src/app/services.ts`), which meant `deleteSlot` could not see it: a deleted slot left its whole weekly-snapshot window behind in storage, unreachable and un-deletable. A new per-slot cell goes in that file, beside the delete that has to wipe it.
- Web backends (`webDriver.ts`, #338): resolved once per factory by `resolveWebStorageBackend` — IndexedDB, else localStorage, else memory. Each is a `WebKeyValueStore` and can be injected via `WebDriverOptions.backend`; `createIndexedDbStore` / `createLocalStorageStore` / `createMemoryStore` are exported for that. **Which platform gets which factory is not decided here** — that is `src/app/storage.ts` (`createPlatformDriverFactory`), so no module under `src/game/` imports `react-native`.
- Migration helpers: `CURRENT_SAVE_VERSION`, `migrate`, `wrap`. Types: `Migration`, `SaveEnvelope`.
- Types: `SaveStore`, `SaveState`, `StorageDriver`, `DriverFactory`, `MultiSlotSaveStore`, `SlotMetadata`, `MidDayCheckpoint`, `CheckpointAction`, `SnapshotStore`, `TeachingStore`, `WeeklySnapshot`.

## Events
None — SaveStore is invoked imperatively by orchestration code, not via the bus.

## Migrations
Bump `CURRENT_SAVE_VERSION` and append a `Migration` whenever the persisted `SaveState` shape changes. Migrations run on load via `migrate()` → `wrap()`.

## No-no
- Never import `expo-sqlite` outside this module.
- Never touch browser storage (`indexedDB`, `localStorage`) outside `webDriver.ts`.
- Never read/write storage from other game-logic modules — they must round-trip through SaveStore.

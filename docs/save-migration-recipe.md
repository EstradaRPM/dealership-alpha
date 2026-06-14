# Save-migration recipe — worldSnapshot versioning protocol

Context packet for changing persisted world state without bricking existing saves.
Source of truth: `src/worldSnapshot.ts`; migration funnel landed in #196.

**Failure mode this prevents:** adding a persisted field without bumping the
envelope version / writing a migration. Old saves then rehydrate onto a shape the
code no longer expects, and either crash on load or silently restore garbage.

## The envelope shape

`WorldSnapshot` is `{ version, modules }` (`src/worldSnapshot.ts:68`). Two
independent version axes:

- **Envelope version** (`WORLD_SNAPSHOT_VERSION`, `src/worldSnapshot.ts:63`) —
  versions *which module keys exist and how they nest*. Migrations live here.
- **Per-module `schemaVersion`** — each module's own blob self-versions. A module
  can evolve its internal shape (add/rename a field inside its own snapshot)
  **without** touching the envelope, by handling old shapes in its own
  `restore()`. The envelope stays out of it.

## When a change needs an envelope bump

Bump `WORLD_SNAPSHOT_VERSION` + write a migration **only** when you change the set
of `modules` keys — i.e. you add a new persisted module, or rename/restructure an
existing key. A change *inside* one module's blob is that module's `schemaVersion`
problem, not the envelope's (see the Inventory `#255` acquisition-field example,
`tests/worldSnapshot.test.ts:81`).

## How to add a persisted module (the worked example: historyLog, v3→v4)

1. Add the typed key to `WorldSnapshot.modules` (`src/worldSnapshot.ts:99`).
2. Add one line to `snapshotWorld` (`src/worldSnapshot.ts:258`) and one to
   `restoreWorld` (`src/worldSnapshot.ts:293`). **Nothing else changes** — that's
   the fan-out contract.
3. Bump `WORLD_SNAPSHOT_VERSION` (8 → 9).
4. Register a migration keyed by the *old* version it upgrades **from**, in
   `WORLD_SNAPSHOT_MIGRATIONS` (`src/worldSnapshot.ts:132`). It must materialize a
   **behavior-neutral default** for older saves — see the `3:` step that injects
   `createDefaultHistoryLogSnapshot()` (`src/worldSnapshot.ts:154`). Prefer a
   `createDefault*Snapshot()` factory exported from the module over an inline
   literal, so the default has one home.

Each step bumps exactly one version. Restore funnels every load through
`migrateWorldSnapshot` (`src/worldSnapshot.ts:271`), which:
- runs steps in order from the persisted version to current;
- **throws** on a snapshot from a newer runtime (`src/worldSnapshot.ts:215`);
- **throws** on a missing step rather than restoring a mismatched shape
  (`src/worldSnapshot.ts:224`). Fail-safe by design (#196 AC) — never "fix" this
  by making it silently skip.

## What is intentionally NOT persisted (do not "fix" this)

- **CustomerPool in-flight visitors** and **per-day funnels/KPI accruals** are not
  in the envelope. They are reconstructed by the **day-boundary autosave** (the
  save is taken at the day boundary, when no visit is mid-flight) and **FloorSim
  checkpoint replay**. Persisting them would double-count on reload and couple the
  save format to transient real-time state. Leave them out.

## The test that must accompany any migration

Every envelope bump needs a migration test in
`tests/worldSnapshot.test.ts` (`describe('world-snapshot versioning + migrations
(#196)')`, line 847). Mirror the existing pattern:

- assert the default blob is materialized for an old-version snapshot
  (`tests/worldSnapshot.test.ts:859`);
- assert pre-existing module blobs survive the bump untouched and the new key
  lands at its default (the injected-migration round-trip,
  `tests/worldSnapshot.test.ts:894`);
- the fail-safe guards (newer-runtime throw `:934`, missing-step throw `:947`) are
  already covered — don't weaken them.

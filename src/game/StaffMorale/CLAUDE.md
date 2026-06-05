# StaffMorale

Tracks morale for each active staff member. Drifts daily based on outcomes; triggers quits below threshold.

## Public API (`index.ts`)
- `createStaffMorale()` → `StaffMorale`.
- `loadStaffMoraleConfig` — reads morale tunables.
- Types: `StaffMorale`, `StaffMoraleDeps`, `StaffMoraleConfig`.

## Events
- **Emits:** `staff:quit` (when morale crosses the quit threshold).
- **Consumes:** `staff:auto_resolved` (success bump / failure ding), `staff:hired` (init morale), `staff:fired` (cleanup), `clock:day_ended` (daily drift).

## Data
- `data/tunables.json` — morale section (initial value, drift, quit threshold, outcome impacts).

## Persistence (#190)
- `snapshot()/restore()` (barrel-exported `StaffMoraleSnapshot`) flatten the
  per-staff morale map to `[staffId, morale]` pairs for save/load. Wired into
  `snapshotWorld`/`restoreWorld` under the `staffMorale` key; restored after
  `StaffOrg`'s roster so morale lands on the same ids.

## Notes
- Morale is per-staff state; `StaffOrg` is the roster source of truth, this module owns the morale dimension.

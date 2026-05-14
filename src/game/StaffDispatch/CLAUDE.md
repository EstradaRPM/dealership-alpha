# StaffDispatch

Auto-resolves Sales queue items using on-duty salespeople. Reads the queue, picks a staff member, runs the resolution, posts outcome.

## Public API (`index.ts`)
- `createStaffDispatch()` → `StaffDispatch`.
- `loadStaffDispatchConfig` — reads dispatch tunables.
- Types: `StaffDispatch`, `StaffDispatchDeps`, `StaffDispatchConfig`, `ExceptionFlag`.

## Events
- **Emits:** `staff:auto_resolved` (outcome `closed` or `no_sale`, with `grossImpact`).
- **Consumes:** Sales queue items via `DepartmentQueue` (called on a tick driven by `GameClock` or player action).

## Data
- `data/tunables.json` — staff-dispatch section (skill weighting, exception thresholds).

## ExceptionFlag
Used to flag deals that auto-resolution refused to handle (e.g. high-value, low-trust scenarios). Those bubble to the player UI.

# StaffDispatch

Auto-resolves Sales queue items using on-duty salespeople. Reads the queue, picks a staff member, runs the resolution, posts outcome.

## Public API (`index.ts`)
- `createStaffDispatch()` → `StaffDispatch`. Legacy once-per-admit path:
  subscribes to `capacity:customer_admitted` and resolves immediately.
- `createStaffFloorDrain()` → `DeptDrain` (the locked #99 per-tick `drain`
  seam FloorSim drives, #101). Per-day instance; each tick pulls up to a
  skill-scaled number of unattempted sales workspace items off the routine
  queue and resolves them via the **same resolver** as the legacy path, so
  the queue drains across ticks with identical outcomes — only the cadence
  differs. Composition wires one path or the other per FloorSim day, never
  both. `escalated` is surfaced per the locked seam shape; the forced-
  exception channel (`floor:exception_raised`) is wired in #103.
- `loadStaffDispatchConfig` — reads dispatch tunables.
- Types: `StaffDispatch`, `StaffDispatchDeps`, `StaffDispatchConfig`, `ExceptionFlag`.

## Events
- **Emits:** `staff:auto_resolved` (outcome `closed` or `no_sale`, with `grossImpact`).
- **Consumes:** Sales queue items via `DepartmentQueue` (legacy path on
  `capacity:customer_admitted`; floor-drain path per FloorSim tick).

## Data
- `data/tunables.json` — staff-dispatch section (skill weighting, exception thresholds).

## ExceptionFlag
Used to flag deals that auto-resolution refused to handle (e.g. high-value, low-trust scenarios). Those bubble to the player UI.

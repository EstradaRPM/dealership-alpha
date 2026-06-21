# ServiceDispatch

Auto-resolves service queue items using on-duty service advisors. Service-side analog of `StaffDispatch`.

## Public API (`index.ts`)
- `createServiceDispatch()` → `ServiceDispatch`. Legacy once-per-intake path:
  subscribes to `service:intake_ready` and resolves immediately.
- `createServiceFloorDrain()` → `DeptDrain` (the locked #99 per-tick `drain`
  seam FloorSim drives, #101). Per-day instance; captures intake payloads
  (and sweeps already-queued items, which carry `baseRevenue` since #303) and
  resolves up to a skill-scaled number per tick via the **same resolver** as the
  legacy path — identical
  outcomes, only the cadence differs. Composition wires one path or the other
  per FloorSim day, never both. Service has no exception channel, so
  `escalated` is always 0.
- `loadServiceDispatchConfig` — reads dispatch tunables.
- Types: `ServiceDispatch`, `ServiceDispatchDeps`, `ServiceDispatchConfig`.

## Events
- **Emits:** `service:ticket_closed` (with `revenue` and `advisorId`).
- **Consumes:** Service queue items from `DepartmentQueue` (Service lane).

## Data
- `data/tunables.json` — service-dispatch section.

## Notes
- Mirrors `StaffDispatch` in shape but operates on Service items rather than Sales. Look at that module first when extending — keep the two parallel.

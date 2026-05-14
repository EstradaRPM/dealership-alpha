# ServiceDispatch

Auto-resolves service queue items using on-duty service advisors. Service-side analog of `StaffDispatch`.

## Public API (`index.ts`)
- `createServiceDispatch()` → `ServiceDispatch`.
- `loadServiceDispatchConfig` — reads dispatch tunables.
- Types: `ServiceDispatch`, `ServiceDispatchDeps`, `ServiceDispatchConfig`.

## Events
- **Emits:** `service:ticket_closed` (with `revenue` and `advisorId`).
- **Consumes:** Service queue items from `DepartmentQueue` (Service lane).

## Data
- `data/tunables.json` — service-dispatch section.

## Notes
- Mirrors `StaffDispatch` in shape but operates on Service items rather than Sales. Look at that module first when extending — keep the two parallel.

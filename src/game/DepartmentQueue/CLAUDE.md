# DepartmentQueue

In-memory work queue per department (Sales, Service, BDC, etc.). Items wait here until either the player or a staff member resolves them.

## Public API (`index.ts`)
- `createDepartmentQueue()` → `DepartmentQueue` (push/pop/peek per `DeptKey`).
- Types: `DepartmentQueue`, `DeptKey`, `ItemType`, `QueueItem`.

## Events
- **Consumes:** `customer:arrived` (push Sales item), `followup:bdc_tasks_ready` (push BDC items), `service:intake_ready` (push Service items).
- **Does not emit** EventBus events — dequeuing is driven by callers (player action or `StaffDispatch` / `ServiceDispatch`).

## Data
None. Pure in-memory; persisted only via `SaveStore` snapshot.

## Notes
- Queue is FIFO within a department. If you need priority ordering, do it at insertion time — don't add a priority field without discussing with the user first.

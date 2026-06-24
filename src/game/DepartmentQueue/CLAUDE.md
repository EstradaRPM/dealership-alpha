# DepartmentQueue

In-memory work queue per department (Sales, Service, BDC, etc.). Items wait here until either the player or a staff member resolves them.

## Public API (`index.ts`)
- `createDepartmentQueue()` → `DepartmentQueue` (push/pop/peek per `DeptKey`).
- Types: `DepartmentQueue`, `DeptKey`, `ItemType`, `QueueItem`.

## Events
- **Consumes:** `customer:arrived` (push Sales item), `followup:bdc_tasks_ready` (push BDC items), `service:intake_ready` (push Service items), `bodyshop:intake_ready` (push Body-Shop items, #314).
- **Does not emit** EventBus events — dequeuing is driven by callers (player action or `StaffDispatch` / `ServiceDispatch`).

## Lanes (`DeptKey`)
`sales` | `service` | `bdc` | `office` | `lot` | `bodyshop`. The `bodyshop` lane
(#314) is the Tier-3 mirror of `service`: it carries the channel `source`
(insurance/retail) and the collision parts category on each item so the Body-Shop
drain prices + parts-gates a restored/pre-drain item correctly. Adding a lane is
NOT adding a nav tab — the nav is a fixed 5 tabs (the Body Shop is a sub-surface).

## Data
None. Pure in-memory; persisted only via `SaveStore` snapshot.

## Persistence (#193)
- `snapshot()/restore()` (barrel-exported `DepartmentQueueSnapshot`) capture every
  department's pending items verbatim. Wired into `snapshotWorld`/`restoreWorld`
  under the `departmentQueue` key. `restore` advances the shared `q-<n>` id
  counter past the highest restored id so freshly-enqueued items never collide
  with the loaded ones.

## Notes
- Queue is FIFO within a department. If you need priority ordering, do it at insertion time — don't add a priority field without discussing with the user first.

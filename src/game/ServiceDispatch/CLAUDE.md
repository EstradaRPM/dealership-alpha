# ServiceDispatch

Auto-resolves service queue items using on-duty service advisors. Service-side analog of `StaffDispatch`.

## Public API (`index.ts`)
- `createServiceDispatch()` → `ServiceDispatch`. Legacy once-per-intake path:
  subscribes to `service:intake_ready` and resolves immediately.
- `createServiceFloorDrain()` → `DeptDrain` (the locked #99 per-tick `drain`
  seam FloorSim drives, #101). Per-day instance; captures intake payloads
  (and sweeps already-queued items, which carry `baseRevenue` + the job/parts
  category since #303/#304) and resolves up to a skill-scaled number per tick via
  the **same resolver** as the legacy path — identical
  outcomes, only the cadence differs. Composition wires one path or the other
  per FloorSim day, never both. Service has no exception channel, so
  `escalated` is always 0.
- `loadServiceDispatchConfig` — reads dispatch tunables.
- Types: `ServiceDispatch`, `ServiceDispatchDeps`, `ServiceDispatchConfig`.

## Parts gate (#304)
Two optional deps add the parts gate; when neither is wired the resolver behaves
exactly as pre-#304 (job closes, no part consumed):
- `partsInventory?: Pick<PartsInventory, 'consume' | 'rushOrder'>` — a completed
  job `consume`s one unit of its `jobCategory`. A miss (no unit on hand) routes
  to the under-stock path.
- `isRushUnlocked?: () => boolean` — the operation-maturity gate (read per-call).
  On a miss: **unlocked** ⇒ `rushOrder(jobCategory, 1)` at the premium rush tier
  and the job completes at full revenue; **locked** ⇒ the job is turned away (no
  revenue + a CSI hit).

The gate runs only after the advisor's auto-resolve roll passes, so a job the
advisor doesn't get to never consumes a part. Both the legacy and drain paths
consume in the **same FIFO order**, so the same jobs get a part and the same
jobs miss — cadence-invariance holds across the parts gate.

## Events
- **Emits:** `service:ticket_closed` (with `revenue` and `advisorId`); plus the
  #304 parts-gate events: `service:parts_consumed` (fires right before
  `ticket_closed` on a stocked job), `service:job_rushed` (right before
  `ticket_closed` on a rush), and `service:job_missed` (terminal — **no**
  `ticket_closed` for a missed job).
- **Consumes:** Service queue items from `DepartmentQueue` (Service lane); calls
  `PartsInventory.consume`/`rushOrder` (#304).

## Data
- `data/tunables.json` — service-dispatch section: adds `rushUnlockTier` (the
  tier the live wiring's `isRushUnlocked` predicate compares against) and
  `missCsiHit` (the CSI-hit magnitude a missed job reports). Both are
  placeholders pending calibration (#286).

## Notes
- Mirrors `StaffDispatch` in shape but operates on Service items rather than Sales. Look at that module first when extending — keep the two parallel.

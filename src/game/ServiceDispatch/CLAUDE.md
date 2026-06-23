# ServiceDispatch

Auto-resolves service queue items using on-duty service advisors. Service-side analog of `StaffDispatch`.

## Public API (`index.ts`)
- `createServiceDispatch()` → `ServiceDispatch`. Legacy once-per-intake path:
  subscribes to `service:intake_ready` and resolves immediately. No capacity
  model (the #305 slot/wait/read-model logic is drain-only).
- `createServiceFloorDrain()` → `DeptDrain` (the locked #99 per-tick `drain`
  seam FloorSim drives, #101). Per-day instance; captures intake payloads
  (and sweeps already-queued items, which carry `baseRevenue` + the job/parts
  category since #303/#304) and resolves up to a **capacity-bounded** number per
  tick via the **same resolver** as the legacy path — identical per-job
  outcomes, only the cadence + capacity gate differ. Composition wires one path
  or the other per FloorSim day, never both. Service has no exception channel, so
  `escalated` is always 0.
- `createServiceReadModel()` → `ServiceReadModelWriter` (#305). Long-lived holder
  for the live capacity read-model. Created once in the composition root; each
  per-day drain is handed the same instance and writes the live snapshot each
  tick. Consumers read `.read()` → `ServiceLoad`
  (`slots`/`inProgress`/`waiting`/`avgWaitTicks`/`utilization`); the `_apply`/
  `_resetDay` writer methods are drain-internal. Mirrors how CapacityManager owns
  `getDayFunnel()` while its per-day floor gate mutates it.
- `loadServiceDispatchConfig` — reads dispatch tunables.
- Types: `ServiceDispatch`, `ServiceDispatchDeps`, `ServiceDispatchConfig`,
  `ServiceLoad`, `ServiceReadModel`, `ServiceReadModelWriter`.

## Pricing posture (#305)
Per-ticket revenue scales by a single competitive↔premium dial (labor rate +
parts markup, modeled together), NOT the retired flat upsell multiplier:
`revenue = round(baseRevenue × lerp(competitivePriceMultiplier,
premiumPriceMultiplier, posture))`. `getPricingPosture?: () => number` ([0,1],
read per-resolve so a live dial change applies next ticket; omitted ⇒ neutral
0.5). The composition root backs it with a stored player setting exposed on the
World seam (`get/setServicePricingPosture`), now persisted via the world snapshot
(`servicePricingPosture` key, envelope v12→v13) and driven by the Service-page
posture dial (#309). Advisor skill now governs **throughput**, not per-ticket
price.

## Capacity model (#305, drain only)
Concurrent work is bounded by `slots = min(bays, advisors on duty)`:
- **Bays** are a structural facility-tier ceiling — `config.baysByTier[tier]`,
  selected by the `facilityTier?` dep (snapshotted per-day; omitted ⇒ 1).
- Per-tick throughput is the sum over the `slots` **busiest** advisors of each
  one's effectiveness-scaled per-slot rate
  (`lerp(minPerSlotThroughput, maxPerSlotThroughput, eff)`), so only `slots`
  advisors contribute (the min bound) and sharper advisors clear more. Fractional;
  accumulated across ticks.
- **Overflow:** jobs that back up in the queue past `config.maxWaitTicks` leave
  UNSERVED (capacity starvation) — evicted before service each tick, emitting
  `service:job_unserved` (lost revenue + `unservedCsiHit`, terminal — no
  `ticket_closed`). Distinct from the #304 parts miss (a stockout).
- The read-model (`slots`/`inProgress`/`waiting`/`avgWaitTicks`/`utilization`)
  is written every tick when a `readModel` dep is wired.

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
- **Emits:** `service:ticket_closed` (with `revenue` and `advisorId`); the #304
  parts-gate events `service:parts_consumed` (fires right before `ticket_closed`
  on a stocked job), `service:job_rushed` (right before `ticket_closed` on a
  rush), and `service:job_missed` (terminal — **no** `ticket_closed` for a missed
  job); plus the #305 capacity event `service:job_unserved` (terminal — a job
  that timed out waiting past `maxWaitTicks`, carrying `lostRevenue`/`csiHit`/
  `waitTicks`; drain path only).
- **Consumes:** Service queue items from `DepartmentQueue` (Service lane); calls
  `PartsInventory.consume`/`rushOrder` (#304).

## Data
- `data/tunables.json` — service-dispatch section:
  - #305: `competitivePriceMultiplier`/`premiumPriceMultiplier` (the posture
    revenue dial ends, replacing the retired `min/maxRevenueMultiplier`),
    `minPerSlotThroughput`/`maxPerSlotThroughput` (per-slot tick throughput,
    replacing the shop-wide `min/maxDrainPerTick`), `baysByTier` (facility-tier
    bay ceiling), `maxWaitTicks` (unserved timeout), `unservedCsiHit`.
  - #304: `rushUnlockTier` (the tier the live wiring's `isRushUnlocked` predicate
    compares against) and `missCsiHit` (the CSI-hit magnitude a missed job
    reports).
  - All magnitudes are placeholders pending calibration (#286).

## Notes
- Mirrors `StaffDispatch` in shape but operates on Service items rather than Sales. Look at that module first when extending — keep the two parallel.

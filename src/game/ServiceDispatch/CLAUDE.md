# ServiceDispatch

Auto-resolves service queue items using on-duty service advisors. Service-side analog of `StaffDispatch`.

## Now the shared department-dispatch engine (#314)
As of #314 this module hosts the **department-agnostic** auto-resolution +
capacity + read-model engine that BOTH Service and Body Shop run (the shared
assembly line — `docs/planning/shared-department-structure.md`). The engine owns
the advisor pick, the skill-scaled auto-resolve roll, the #304 parts gate, the
`min(bays, advisors)` capacity model, eviction, and the live read-model. Each
department supplies a **`DeptDispatchProfile`** for everything that differs:
advisor role, queue lane, RNG namespace, per-ticket pricing (Service's
competitive↔premium dial vs Body Shop's insurance rate-capped / retail
player-priced split), revenue label, **which profit center its revenue posts to**
(#375 — `profitCenter`, so the one engine names neither department), the intake
feed, and the event family it emits. Per the locked event-name decision (#312) the two emit PARALLEL families
(`service:*` / `bodyshop:*`) bound to this one engine — NOT a collapsed `dept:*`.

- Generic exports: `createDeptFloorDrain`, `createDeptDispatch`,
  `createDeptReadModel`; types `DeptDispatchProfile`, `DeptDispatchDeps`,
  `DeptDispatchEmit`, `DeptIntakeItem`, `DeptCapacityConfig`,
  `DeptLoad`/`DeptReadModel`/`DeptReadModelWriter`.
- Service is the **reference profile**, built inside the `createService*`
  wrappers below from `ServiceDispatchDeps` so the Service surface + every Service
  test + a fixed-seed replay stay byte-identical. Body Shop supplies its profile
  in `src/bodyShopDepartment.ts`.
- (Naming is legacy: the engine lives in the `ServiceDispatch` module because the
  locked doc designates it the shared resolver; a future slice may relocate it.)

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
- **Bays** are what the store has BUILT (#358) — the `bays?` dep, fed by the
  `Facility` module through the department package and snapshotted per-day, so
  construction finished today applies tomorrow (omitted ⇒ 1 bay). Both
  departments read that one bay truth; `config.baysByTier` is **deleted** from
  both schemas and from `data/tunables.json`. The tier's number became the
  ceiling on building, not the bay count itself.
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
    replacing the shop-wide `min/maxDrainPerTick`), `maxWaitTicks` (unserved
    timeout), `unservedCsiHit`. (`baysByTier` left in #358 — see above.)
  - #304: `rushUnlockTier` (the tier the live wiring's `isRushUnlocked` predicate
    compares against) and `missCsiHit` (the CSI-hit magnitude a missed job
    reports).
  - All magnitudes are placeholders pending calibration (#286).

## Service-manager automation (#310, parent #297)
The Service-side mirror of the channel-desk manager model (UCM/NCM/GM). Pure +
deterministic engine in `serviceManager.ts`; the gate THRESHOLDS live in
`tunables.json#managerGates.serviceManager.actThresholds`, the function TUNING in
`data/service-manager.json` (`loadServiceManagerConfig`) — same split as
`data/sourcing.json`. As the on-staff service manager's `shop_throughput` clears
each function's threshold (a LADDER — par 50 < pricing 55 < marketing 60 < rush
65 < capacity 75, so automation engages one function at a time as the SM grows)
the SM takes over the standing decision the player otherwise ran by hand. Below a
gate (or no SM) the player keeps manual control — no behavior change.
- `isServiceFunctionAutomated(shopThroughputSkill, threshold)` → boolean — the
  act gate, mirroring `isAutoPricingUnlocked` (`null` skill = no SM = closed).
- `autoServicePar(rows, deps?)` → `ServiceParSetpoint[]` — demand-driven
  PartsInventory par (cover-days × trailing intake demand, floored, monotonic,
  reorderPoint ≤ target).
- `autoServicePosture(reputation01, deps?)` → posture `[0,1]` — reputation-driven
  competitive↔premium, monotonic non-decreasing, clamped to `[min,max]Posture`.
- `autoServiceMarketing({health, coverage, retentionCampaignId}, deps?)` →
  `ServiceMarketingDecision` — runs retention on high churn pressure, aims
  conquest at the most over-stocked category to clear dead capital.
- `shouldRush({utilization, capacityAware}, deps?)` → boolean — the rush-vs-walk
  call. Rush-function-only ⇒ always rush (keep the customer, the SM is the
  operational maturity the tier gate stood in for); capacity-function-also ⇒
  rush only while the shop has slack (utilization below the ceiling), else walk.

The orchestration lives in the **Service department package**
(`src/serviceDepartment.ts`, #311), not inline in `createWorld`: it resolves the
top SM `shop_throughput` from the live roster, applies the par/posture/marketing
setpoints on `clock:day_started` through the shared
`DepartmentLine.createDepartmentManagerAutomation` ladder (constant within the day
+ replay-deterministic readouts ⇒ #122-safe; the PartsInventory reorder sweep
subscribes earlier so a re-tuned par lands on the next morning's sweep — a
one-day lag), and folds `shouldRush` into the `isRushUnlocked` parts-gate seam of
the drain the package builds. The skill-gated ladder *pattern* is now shared
(`DepartmentLine`); the *specific functions* automated stay Service-owned in the
package. `warranty_handling` (the SM's other granted skill) is reserved for a
future advise-side surface, NOT gated here.

## Notes
- Mirrors `StaffDispatch` in shape but operates on Service items rather than Sales. Look at that module first when extending — keep the two parallel.

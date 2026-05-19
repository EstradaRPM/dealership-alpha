# CapacityManager

Daily admittance gate. Computes how many customers the dealership can handle today (driven by tier + staff contribution) and admits/turns-away arrivals accordingly.

## Public API (`index.ts`)
- `createCapacityManager()` → `CapacityManager`.
- `CapacityManager.createFloorGate()` → `CapacityFloorGate`: the locked #99
  per-tick `capacity` seam FloorSim drives. One gate per simulated day
  (composition root creates it after that day's capacity is recomputed); it
  snapshots the day's budget, admits per-tick against the remaining budget,
  and turns away the overflow as a felt in-day walk — emitting
  `capacity:missed_opportunity` + `reputation:satisfaction_hit` per walked
  customer (daily-gate semantics preserved). `customerId` is synthetic
  (`floor-walk:<day>:<tick>:<i>`) until the spawn seam (#101) individuates
  arrivals.
- `CapacityManager.getDayFunnel()` → `DayFunnel`: read-only end-of-day
  funnel (drove-by → walked-in → staff-engaged → sold, plus a parallel
  `gated` bucket off drove-by) plus a single `leakCause` signal for a
  plain-language biggest-leak callout. Pure read-model derived from observed
  events (`customer:arrived` / `capacity:customer_admitted` path, the floor
  gate, and `staff:auto_resolved`); no side effects, no FloorSim/#99
  coupling. The composition root assembles the recap from this (#110/#107).
  Resets daily — a closed lot ticks no gate ⇒ every counter stays zero.

### Disposition taxonomy (LOCKED — #107 reconciliation 2026-05-19, #128b)
- `walk` = admitted-then-left ONLY.
- A customer the lot never admitted (capacity overflow OR deliberate player
  gating) is the distinct `gated` bucket: **pure opportunity cost, never a
  walk, never a lost-sellable**. It still emits `capacity:missed_opportunity`
  (the KPI "hire more / upgrade tier" signal) but carries **no**
  `reputation:satisfaction_hit` — a customer who never got on the lot leaves
  no bad review. FloorSim still emits its locked #99 `floor:customer_walked`
  heartbeat off the gate's return count (observability only); the domain
  disposition is owned here, behind the seam.
- `loadCapacityConfig` — reads capacity tunables.
- `getStaffContribution(staff)` — pure helper computing capacity boost from a staff member.
- Types: `CapacityManager`, `CapacityManagerDeps`, `CapacityConfig`, `CapacityFloorGate`, `DayFunnel`, `FunnelLeakCause`.

## Events
- **Emits:** `capacity:customer_admitted`, `capacity:missed_opportunity` (turn-away).
- **Consumes:** customer-arrival flow (called by `CustomerPool` before admit).

## Two admittance paths
- **Legacy daily gate** — `customer:arrived` subscription, once-per-day
  budget (CustomerPool path). Gated by `deps.legacyAdmitGate` (default
  `true`). The #114 composition root passes `false` so only the floor gate
  is live — composition wires one path, never both.
- **Per-tick floor gate** (#100) — `createFloorGate()`, driven by FloorSim's
  per-tick loop. Overflow walks in-day rather than as a daily aggregate. The
  sole admittance path in the #114 composition; updates the funnel
  read-model counters independently of the legacy gate.

## Data
- `data/tunables.json` — capacity section (tier base + per-role contribution).

## Notes
- Missed opportunities are surfaced in the KPI dashboard — they are a signal the player should hire more staff or upgrade tier.

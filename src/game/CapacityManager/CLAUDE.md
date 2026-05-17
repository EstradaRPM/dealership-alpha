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
  funnel (drove-by → walked-in → staff-engaged → sold) plus a single
  `leakCause` signal for a plain-language biggest-leak callout. Pure
  read-model derived from observed events (`customer:arrived` /
  `capacity:customer_admitted` path, the floor gate, and
  `staff:auto_resolved`); no side effects, no FloorSim/#99 coupling. The
  composition root assembles the recap from this (#110/#107). Resets daily.
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

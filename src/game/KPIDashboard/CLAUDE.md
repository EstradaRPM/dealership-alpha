# KPIDashboard

Read-model over the deal log. Accumulates every closed deal off the bus and
computes the industry KPI snapshot (PVR, F&I PPRU, DII, cash/finance split,
heavy-down units, avg APR/term/down) on demand. No logic mutates game state.

## Public API (`index.ts`)
- `createKPIDashboard(deps)` → `KPIDashboard`. `deps`: `bus` (EventBus).
- `KPIDashboard`:
  - `getSnapshot()` → `KPISnapshot` — the computed read-model (derived fresh
    each call from the raw log; the log is the source of truth).
  - `snapshot()` / `restore()` — save/load blob.
- Types: `DealRecord`, `KPISnapshot`, `KPIDashboardSnapshot`.

## Behavior
- Appends a `DealRecord` per `deal:closed`; KPIs are **derived on read**, never
  stored pre-aggregated.
- Finance deals with `downPayment / agreedPrice ≥ HEAVY_DOWN_THRESHOLD` (0.25,
  code-local tunable) are bucketed as `heavyDownUnits`. Cash deals never count
  toward APR/term/down averages.
- `dailyCarryingCost` is the most-recent day's lot-wide floorplan + carrying
  burn (#173), tracked off the bus so the snapshot surfaces it without reaching
  into `Inventory`. Full month-to-date aggregation is deferred to slice #25.

## Events
- **Consumes:** `deal:closed` (append to log), `economy:carrying_cost_posted`
  (latch `dailyCarryingCost = payload.totalCost`).
- **Emits:** none — pure read-model.

## Data
- No JSON tunable file. `HEAVY_DOWN_THRESHOLD` lives in `KPIDashboard.ts`.

## Persistence (#193)
- `KPIDashboardSnapshot` (`schemaVersion: 1`, self-versioned per the #188
  contract) persists the raw `DealRecord[]` plus `dailyCarryingCost`. KPIs are
  re-derived on restore, so only the log is saved. Distinct from `KPISnapshot`,
  which is the computed read-model, never persisted.

## Collaborators
- `DealEngine` emits `deal:closed`; `Economy`/`Inventory` emit
  `economy:carrying_cost_posted`. Consumed by the UI KPI surface.

# KPIDashboard

Read-model over the deal log. Accumulates every closed deal off the bus and
computes the industry KPI snapshot (PVR, F&I PPRU, DII, cash/finance split,
heavy-down units, avg APR/term/down) on demand. No logic mutates game state.

## Public API (`index.ts`)
- `createKPIDashboard(deps)` → `KPIDashboard`. `deps`: `bus` (EventBus).
- `KPIDashboard`:
  - `getSnapshot(range?)` → `KPISnapshot` — the computed read-model (derived
    fresh each call from the raw log; the log is the source of truth). With no
    argument it is career-to-date; with a `DayRange` it is the same math over
    the deals that closed inside that **inclusive** day window (#351 — Finance's
    time-range chips). `dailyCarryingCost` is a live burn rate, not an accrual,
    so it rides every snapshot unchanged regardless of the window.
  - `getDailyTotals(range)` → `readonly KPIDayTotals[]` (#351) — per-day retail
    flow across the window, oldest→newest, **one row for every day including
    days with no deals**. A series that skips the quiet days draws a shape the
    business never had. Backs the dashboard's sparklines + hero trend chart.
  - `snapshot()` / `restore()` — save/load blob.
- Types: `DealRecord`, `DayRange`, `KPIDayTotals`, `KPISnapshot`,
  `KPIDashboardSnapshot`.

## Behavior
- Appends a `DealRecord` per `deal:closed`; KPIs are **derived on read**, never
  stored pre-aggregated.
- **Back gross is carried in two halves (#365).** `productGross` (margin on the
  F&I products that attached) and `reserveGross` (the store's share of the rate
  spread, 0 on cash) ride every `deal:closed`, accrue per day on `KPIDayTotals`,
  and total on `KPISnapshot` as **window totals, not averages** — the Finance
  tab's gross breakdown adds them beside the gross it sits next to. `backGross`
  stays the sum, so every pre-existing read is unchanged.
- **The module stamps its own day.** `deal:closed` carries no day, so a
  `clock:day_started` cursor supplies one (the same pattern `HistoryLog` and
  `Records` use) — a range query can window the log without every publisher
  growing a field. Deals close during the open day, so the day last *started*
  is the day they belong to.
- Finance deals with `downPayment / agreedPrice ≥ HEAVY_DOWN_THRESHOLD` (0.25,
  code-local tunable) are bucketed as `heavyDownUnits`. Cash deals never count
  toward APR/term/down averages.
- `dailyCarryingCost` is the most-recent day's lot-wide floorplan + carrying
  burn (#173), tracked off the bus so the snapshot surfaces it without reaching
  into `Inventory`. Full month-to-date aggregation is deferred to slice #25.

## Events
- **Consumes:** `deal:closed` (append to log), `economy:carrying_cost_posted`
  (latch `dailyCarryingCost = payload.totalCost`), `clock:day_started` (advance
  the day cursor that stamps each `DealRecord`).
- **Emits:** none — pure read-model.

## Data
- No JSON tunable file. `HEAVY_DOWN_THRESHOLD` lives in `KPIDashboard.ts`.

## Persistence (#193)
- `KPIDashboardSnapshot` (`schemaVersion: 1`, self-versioned per the #188
  contract) persists the raw `DealRecord[]` plus `dailyCarryingCost` and the day
  cursor. KPIs are re-derived on restore, so only the log is saved. Distinct
  from `KPISnapshot`, which is the computed read-model, never persisted.
- **Pre-#365 records carry no back-end split and restore as zeroed halves.**
  Their `backGross` is real and stays whole in every total, but nothing in the
  record says how much of it was reserve, so it claims none. This is inside the
  module's blob, not the `modules` key set, so per `docs/save-migration-recipe.md`
  the envelope version does not move and there is no migration to look for.
- **Pre-#351 records carry no day and restore as `day: 0`** — real enough to
  count in a lifetime read, outside every day-1-and-later window, and never
  attributed to a day they did not close on.

## Collaborators
- `DealEngine` emits `deal:closed`; `Economy`/`Inventory` emit
  `economy:carrying_cost_posted`. Consumed by the UI KPI surface.

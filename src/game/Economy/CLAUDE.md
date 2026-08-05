# Economy

Money ledger. Posts revenue and expense entries, computes P&L summaries.

## Public API (`index.ts`)
- `createEconomy()` → `Economy`.
- `loadEconomyConfig` — reads economy tunables from `data/tunables.json` (Economy section).
- Types: `Economy`, `EconomyDeps`, `EconomyConfig`, `ExpenseCategory`, `LedgerEntry`, `PnLSummary`.
- `postExpense`/`forceDebit` take an optional `ExpenseCategory`
  (`'inventoryAcquisition'` = cash converted into stock, i.e. auction purchase
  price; inspection/recon/carrying stay uncategorized = operating). The lifetime
  `inventoryAcquisitionSpend` accumulator backs the Home cash-delta ops/stock
  split (#255) — cumulative, never reset; consumers diff it across day closes
  like they diff `cash`. Persisted in the snapshot (pre-#255 snapshots restore
  to 0).

## Events
- **Emits:** `economy:revenue_posted`, `economy:expense_posted` (every post produces one of these).
- **Consumes:** `deal:closed` (post sale revenue), `staff:hired` (hiring cost), `clock:overnight_payroll` (**weekly rent only** — the "Payroll" line on that same phase is posted by StaffOrg since #353), `inventory:vehicle_purchased` (auction cost), `service:ticket_closed` (service revenue), `clock:day_ended` + `clock:day_started` (the day cursor every ledger entry is stamped with).

## Data
- `data/tunables.json` — economy section (interest, fees, recurring expenses).
  `economy.tier1` is **`weeklyRent` only**. `weeklyPayrollStub` was deleted in #353 (JSON *and*
  `EconomyConfigSchema`, same commit) — it was a flat $800/week that made your fifth hire free.
  Do not add a payroll number back here: `StaffOrg` owns the salary book because it owns the
  roster, and two numbers that can disagree about what staff cost is the bug that deletion
  prevents.

## Notes
- Single source of truth for cash. Never mutate balances elsewhere — always emit/post through Economy.
- Ledger entries carry a human-readable `label` so the KPI dashboard can group them.
- **The ledger is persisted whole (#351)** and never pruned: it IS the P&L, and
  a window that silently loses its early days reports a profit the business did
  not make. Pre-#351 snapshots lack the field and restore to an empty ledger.
- **Day stamping rides both clock edges.** `advanceDay()` fires `day_ended` →
  the overnight phases → `day_started`, so latching on `day_ended` keeps
  overnight posts (payroll, rent, carrying) on the day that just concluded, and
  latching again on `day_started` rolls the cursor forward for the new trading
  day. Before #351 only the first half existed, which stamped every deal closed
  on day N with day N-1 — invisible while the only consumer was a lifetime
  total, and exactly one day wrong once Finance windows the ledger.

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
- **Consumes:** `deal:closed` (post sale revenue), `staff:hired` (hiring cost), `clock:overnight_payroll` (recurring payroll), `inventory:vehicle_purchased` (auction cost), `service:ticket_closed` (service revenue).

## Data
- `data/tunables.json` — economy section (interest, fees, recurring expenses).

## Notes
- Single source of truth for cash. Never mutate balances elsewhere — always emit/post through Economy.
- Ledger entries carry a human-readable `label` so the KPI dashboard can group them.

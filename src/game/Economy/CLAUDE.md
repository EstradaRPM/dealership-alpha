# Economy

Money ledger. Posts revenue and expense entries, computes P&L summaries.

## Public API (`index.ts`)
- `createEconomy()` → `Economy`.
- `loadEconomyConfig` — reads economy tunables from `data/tunables.json` (Economy section).
- Types: `Economy`, `EconomyDeps`, `EconomyConfig`, `LedgerEntry`, `PnLSummary`.

## Events
- **Emits:** `economy:revenue_posted`, `economy:expense_posted` (every post produces one of these).
- **Consumes:** `deal:closed` (post sale revenue), `staff:hired` (hiring cost), `clock:overnight_payroll` (recurring payroll), `inventory:vehicle_purchased` (auction cost), `service:ticket_closed` (service revenue).

## Data
- `data/tunables.json` — economy section (interest, fees, recurring expenses).

## Notes
- Single source of truth for cash. Never mutate balances elsewhere — always emit/post through Economy.
- Ledger entries carry a human-readable `label` so the KPI dashboard can group them.

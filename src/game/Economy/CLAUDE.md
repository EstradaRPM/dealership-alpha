# Economy

Money ledger. Posts revenue and expense entries, computes P&L summaries.

## The P&L is ACCRUAL (#374)

Cash movement and P&L effect are orthogonal, and the ledger now carries both axes:

| Entry | Moves cash | Hits the P&L |
|---|---|---|
| Auction purchase (`category: 'inventoryAcquisition'`) | yes | **no** |
| Cost of a vehicle sold (`postCostOfSale`, `nonCash: true`) | **no** | yes |
| Everything else (rent, payroll, recon, carrying, service revenue, …) | yes | yes |

- **`postCostOfSale(amount, label)`** writes a `nonCash` expense entry and does not touch
  cash. Posting the relief through `postExpense` would debit the store twice for one car.
  It **publishes nothing** — `economy:expense_posted` means cash moved, and Telemetry's
  `cashCurve` (its only consumer) is a cash curve. A P&L reader wants `getPnL`.
- **`getPnL` drops `inventoryAcquisition` entries whole** — from the totals *and* from
  `entries`. Buying a car converts cash into stock; the cost comes back as the relief on the
  day that car sells. Leaving them in `entries` would put "Auction purchase" on the Finance
  expense breakdown under a Net Income that does not count it — two numbers on one screen
  that cannot be added up. `snapshot().ledger` is still the complete record; `getPnL` is a
  read of it.
- **Why it exists:** cash-basis charged an auction buy on the day of the buy while that
  unit's revenue arrived weeks later. At Tier 1 a six-space lot is bought out in two or three
  days, so a month spent stocking reported a loss the store did not make.
- **Only `Inventory` relieves**, at the two doors a unit leaves by (retail sale and
  wholesale-out), and it relieves `purchasePrice` **only** — recon/inspection/carrying are
  already operating spend on the days they were incurred.
- **A pre-#374 save needs no migration** (`schemaVersion` stays 1 — `nonCash` is optional
  inside the module's own blob) and is **never back-filled**. Its historical months read more
  profitable than they did on the day they closed, because their acquisitions have no matching
  relief. The ledger records what was posted; the rule governs how it is read. Inventing
  synthetic relief entries would be inventing history the store never had.

## Public API (`index.ts`)
- `createEconomy()` → `Economy`. `postCostOfSale(amount, label)` is the accrual half (above).
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

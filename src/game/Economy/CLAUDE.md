# Economy

Money ledger. Posts revenue and expense entries, computes P&L summaries.

## The P&L is ACCRUAL (#374)

Cash movement and P&L effect are orthogonal, and the ledger now carries both axes:

| Entry | Moves cash | Hits the P&L |
|---|---|---|
| Auction purchase (`category: 'inventoryAcquisition'`) | yes | **no** |
| Trade allowance (`category: 'inventoryAcquisition'`, #379) | yes | **no** |
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
- **A trade allowance is stock spend, not a deal expense (#379).** `closeDeal` debits it
  through `forceDebit` with the acquisition category, so it moves cash and leaves net income
  alone — the store paid for a car and now owns one. It is `forceDebit` rather than
  `postExpense` because the close has already banked the selling price and taken the
  customer's car: the lienholder gets paid whether or not the store can afford it, and a
  throw there would abort a deal that already sold a unit off the lot.
- **Only `Inventory` relieves**, at the two doors a unit leaves by (retail sale and
  wholesale-out), and it relieves `purchasePrice` **only** — recon/inspection/carrying are
  already operating spend on the days they were incurred.
- **A pre-#374 save needs no migration** (`schemaVersion` stays 1 — `nonCash` is optional
  inside the module's own blob) and is **never back-filled**. Its historical months read more
  profitable than they did on the day they closed, because their acquisitions have no matching
  relief. The ledger records what was posted; the rule governs how it is read. Inventing
  synthetic relief entries would be inventing history the store never had.

## The P&L also has a DEPARTMENTAL axis (#375)

Every post may carry an optional `profitCenter` — `sales | fni | service | bodyshop | store`
— beside its human `label`, exactly as `ExpenseCategory` does. **Omitted ⇒ `store`
(overhead)**, which is the rule and not a fallback: it keeps every untagged post (pre-#375
saves, every harness) below the gross line instead of flattering a department it did not
come from.

- **`getDepartmentPnL(fromDay, toDay)`** → `{ departments, overhead, netIncome }`. All four
  earning centers are always reported, in `DEPARTMENT_CENTERS` order, each with
  `revenue`/`costOfSale`/`gross`/`active`. `active` is what a surface reads to omit a bar
  rather than draw a zero — a consumer never has to guess whether a missing line means
  "nothing" or "not built yet".
- **`sum(departments.gross) − overhead === netIncome`, for any window, always.** That
  identity is the whole reason the panel is trustworthy, and it is only available because
  #374 made the statement accrual. Both reads go through the ONE private `pnlEntries` filter;
  a department cut with a different filter would stop adding up to the Net Income printed
  beside it.
- **`overhead` is store expenses NET of store revenue.** A store-center receipt (PE sellout,
  admin injection) is not a department's gross and has nowhere else honest to go, and stating
  it net keeps the reconciliation one subtraction.
- **Gross is revenue less cost of sale, and payroll is NOT cost of sale here.** Techs and
  advisors draw one aggregate daily wage in this sim, not flat-rate, and it is posted as a
  single line by StaffOrg. Splitting it across departments would need a second wage model
  nobody asked for, so payroll sits in overhead with rent: departmental gross → less store
  overhead → net income, the classic statement.
- **The tag arrives as a named object** (`PostTag` / `ExpenseTag`), not as trailing
  positional arguments — a site that wants only a profit center should not write `undefined`
  in the category slot, and the next axis added there changes no existing call site.
- Who tags what: `sales` = the vehicle sale, its cost-of-sale relief, wholesale proceeds,
  recon / inspection / carrying, the auction buy. `fni` = product and reserve. `service` /
  `bodyshop` = the ticket posting (via `DeptDispatchProfile.profitCenter`, so the one shared
  engine names neither department) and parts, keyed off the part's category. `store` =
  everything left, by omission.

## Public API (`index.ts`)
- `createEconomy()` → `Economy`. `postCostOfSale(amount, label)` is the accrual half (above).
- `loadEconomyConfig` — reads economy tunables from `data/tunables.json` (Economy section).
- `getDepartmentPnL(fromDay, toDay)` — the departmental axis (above).
- `DEPARTMENT_CENTERS` (the four earning centers, in reporting order) and
  `PROFIT_CENTER_LABELS` (how each reads on a surface).
- Types: `Economy`, `EconomyDeps`, `EconomyConfig`, `ExpenseCategory`, `LedgerEntry`,
  `PnLSummary`, `ProfitCenter`, `PostTag`, `ExpenseTag`, `DepartmentPnL`,
  `DepartmentPnLSummary`.
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

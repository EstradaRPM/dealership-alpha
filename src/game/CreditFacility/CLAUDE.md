# CreditFacility

Money the store can reach for, at a price. A limit set once at career start, a
drawn balance only the player moves, and interest on whatever is standing.

## The rule this module exists to hold (#392, F2-R1)

**Every morning, the balance the day opens with costs a day's interest.** That
is the whole cost model. Money drawn today first costs tomorrow morning; money
repaid today stops costing tomorrow morning. No intra-day proration, no
compounding schedule, no minimum payment, no second rule — the player reads one
sentence and can predict every charge the facility will ever make.

**The facility never calls the balance and never forces a repayment.** What it
does is make the next borrowed dollar quietly dearer than the last, until the
store either sells its way out or runs the cash down. A store that cannot pay a
morning's interest goes negative on cash, which the bankruptcy machinery already
reads — the same call #379 made about a trade the store cannot cover. That is
why the charge goes through `forceDebit` and not `postExpense`: a throw there
would abort the day over a bill the lender is owed regardless.

**A limit of zero is a facility that cannot be drawn, not an absent facility.**
One code path, so no surface and no test branches on which founder the player
picked. `available` reads 0, every draw is refused `over-limit`, and the module
is composed, snapshotted and restored exactly as it is for a banker.

## What it is, in the career

The third genuinely different opening a founder's pick can buy — a sharper eye
(#390), more money now (#390), or **money you can reach for later at a cost**.
The composition root resolves the founder's line of credit into a plain `limit`
number; this module never learns that a backstory exists (the #390 rule, pinned
by `tests/BackstoryModifiers.test.ts`).

## A draw is not income; a repayment is not an expense

Both are balance-sheet movements — cash changing form against a debt — so both
post with `category: 'financing'` and are dropped whole from the P&L, exactly as
an auction purchase is. **Only the interest is a real cost**, and it lands
uncategorized on the `store` profit center, which is plain operating overhead.

Booking a draw as revenue would flatter Net Income by the size of the loan, and
the statement's whole claim since #374 is that it reports what the store
*earned*. #392 is also what widened the ledger's category axis from "cash
converted into stock" to "a balance-sheet movement" — see `Economy/CLAUDE.md`.

## Public API (`index.ts`)

- `createCreditFacility({ bus, economy, limit, getCurrentDay, data? })`.
- `getFacility()` → the ONE read: `limit`, `drawn`, `available`,
  `maxRepayment`, `interestPaidToDate`, `dailyInterest`, `apr`, `drawSteps`. A
  surface re-derives none of these — `maxRepayment` (`min(cash, drawn)`),
  `dailyInterest` and `drawSteps` are stated here precisely so a screen never
  computes a rule the engine also computes.
- **`drawSteps` is what the line is offered in** (#393): `data/credit-facility.json`'s
  `drawFractions` resolved against this store's own limit, ascending, the largest
  being the whole line. Fractions rather than dollars so every founder's line is
  offered at the same rungs whatever it is worth; a zero rung is dropped, because
  an amount `draw` would refuse is not an offer. Empty for a zero limit.
- `draw(amount)` / `repay(amount)` → `{ ok: true, amount } | { ok: false, reason }`,
  the `Facility.build` idiom. **A refusal changes nothing at all** — every check
  runs before anything moves.
- **A draw past the limit is refused WHOLE, never clamped to the headroom.** A
  control that quietly hands you less than you asked for is a second rule, and
  `available` already tells the surface what will be taken.
- `CREDIT_DRAW_LABEL` / `CREDIT_REPAYMENT_LABEL` / `CREDIT_INTEREST_LABEL` — the
  three ledger lines, stated once.
- `dailyInterestOn(drawn, data)` — the pure cost rule, exported so the posted
  charge and any previewed one cannot be computed two ways.
- `loadCreditFacilityData`, `CreditFacilityDataSchema`,
  `createDefaultCreditFacilitySnapshot`.

## Events

- **Emits:** `credit:drawn`, `credit:repaid`. Both carry the balance *after* the
  move and the limit it was measured against, so a consumer never has to add or
  ask the module back.
- **The morning interest charge publishes nothing of its own.** It is an
  ordinary operating expense and `economy:expense_posted` already announces it;
  a second event for money the player did not move would be a beat about nothing
  happening.
- **Consumes:** `clock:day_started` — the morning charge.

## Data

- `data/credit-facility.json` — `apr` and `daysPerYear`. The rate is unsecured
  personal credit and is deliberately dearer than the secured floorplan rate in
  `tunables.json#inventory.carrying` (0.09 baseline): borrowing against the
  store's inventory is cheap, borrowing against your name is not, which is what
  stops the line reading as free money. `daysPerYear` is the lender's day-count
  convention, declared rather than taken from the clock's 364-day calendar — a
  retune moves the price of money without touching the seasons. Magnitudes are
  placeholders owed to a #286-class calibration pass.

## Persistence

`snapshot()`/`restore()` carry `limit`, `drawn` and `interestPaidToDate`.
Envelope **v21 → v22** (`docs/save-migration-recipe.md`).

**The migration's default deliberately omits `limit`.** A career saved before
this module existed never borrowed, and its limit is whatever its founder's
credit is worth — which the freshly built world has *already* resolved from the
persisted character profile before `restoreWorld` runs. Materializing a
synthetic `0` over it would silently strip the facility from every banker's
career that predates the module. `restore` therefore reads `snap.limit ?? limit`;
`snapshot()` always writes the field, so only the migration path takes that
branch.

## Collaborators

- `Economy`, through the narrow `CreditFacilityBank` (`cash` + the three post
  methods) — this module moves cash and never reads the ledger back.
- `GameClock`, through the injected `getCurrentDay` closure and the
  `clock:day_started` subscription. Never a module reference.
- The Finance statement (#393) is the surface half, and it is built: the room's
  `finance-region-credit` panel (`src/ui/FinanceTab/CreditFacilityPanel.tsx`)
  states the five figures and carries the draw/repay controls, and
  `World.getStoreWorth()` subtracts `drawn` so a $50k draw leaves what the store
  is worth **flat** — the identical rule a bought car obeys (#380). The worth
  caption says "less what you owe on your credit line" for every store, drawn or
  not: one sentence that is always true beats two the surface picks between.
- **A limit of zero renders NOTHING**, not a block of zeros (locked IA rule 3).
  `buildCreditFacilityPanel` returns `null` on the limit and the room omits the
  region — the only place in the app that branches on whether the store has a
  line, and it branches on how the facility *reads*, never on how it works.
- **The morning interest is pinned in the Finance expenses breakdown** (#393).
  `groupExpenses` folds its long tail into "Other" by size, and a day's interest
  on a $50,000 line is a few dollars against a payroll of hundreds — so it would
  be hidden in every window that mattered. It is the one cost the player can end
  with a button on that same screen, and a cost you are asked to act on cannot
  be a cost the chart buries.

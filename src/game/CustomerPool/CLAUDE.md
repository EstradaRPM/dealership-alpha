# CustomerPool

Per-day customer roster + SalesProcess-driven resolution. Rolls today's customers, advances them through Sales stages, and runs `SalesProcess.resolveSalesProcess` + `closeAndPrice` at resolution time.

Competitors are the ambient market force (price drift + demand heat), not a per-customer snatch: a customer you don't win **walks** (SalesProcess outcome), and rival pull is expressed through demand/reputation, so there is no separate poach path. (Customer-poaching was cut — redundant with walk + competitive pressure + future BDC follow-up; see `docs/planning/poaching-cut.md`.)

## Public API (`index.ts`)
- `createCustomerPool(deps)` → `CustomerPool`. Optional `deps.skill?: SalespersonSkill` (defaults to `GREEN_SALESPERSON`; StaffOrg wiring is a follow-on). Optional `deps.legacyDailyArrivals?: boolean` (default `true`) — the old `clock:day_started` once-per-day arrival generator; the #114 composition root passes `false` so FloorSim's customer-source seam is the sole arrival source (`currentDay` still tracked). Optional `deps.dealEngine` + `deps.inventory` + `deps.creditTiers` (all three together) — when supplied, `dispatch(CLOSE)` real-close path routes through `DealEngine.closeDeal` (#146) so the canonical `deal:closed` with the five deal-structuring fields fires; absent any of the three, falls back to legacy SalesProcess-direct emit (test harnesses without inventory wiring).
- Session type: `CustomerSession`.
- `transition(...)`, `IllegalTransitionError` — FSM validates dispatch legality (intermediate stages).
- Types: `CustomerStage`, `CustomerAction`.

## Resolution semantics (#91, extended #146)
- **`dispatch(CLOSE)`** — SalesProcess-driven outcome determination (`resolveSalesProcess` + `closeAndPrice`):
  - Outcome `walk` → emits `customer:resolved` directly.
  - Outcome `closed` AND DealEngine wiring present AND lot non-empty → routes through `DealEngine.closeDeal` with the five deal-structuring fields (paymentMethod / downPayment / loanAmount / term / apr) computed from the customer's Visit + classified credit tier; the `deal:closed` listener below handles the resulting `CLOSED` transition + `customer:resolved` emit. Cash: `downPayment=agreedPrice, loanAmount=term=apr=0`. Finance: `apr/term` from `creditTiers.tiers[tier]`, `downPayment = agreedPrice × visit.downPaymentBehavior`.
  - Outcome `closed` AND no DealEngine wiring (or empty lot) → legacy fallback: emits `customer:resolved` directly with SalesProcess `agreedPrice`/`frontGross` (no inventory decrement).
- **`dispatch(WALK_CUSTOMER)`** — forced walk: uses visit patience as heat proxy (no SalesProcess evaluation).
- **`deal:closed` listener** — DealEngine-driven close (own dispatch *or* external caller, e.g. future StaffDispatch tracer #147): forces outcome='closed', runs SalesProcess for quality scalars only; uses `agreedPrice`/`frontGross` from the DealEngine payload.
- Intermediate actions (GREET, QUALIFY, DEMO, NEGOTIATE) still use FSM.

## Events
- **Emits:** `customer:arrived`, `customer:state_changed`, `customer:gate_evaluated` (observability only, #92 — one per gate in gate order on a SalesProcess-driven resolution), `customer:resolved` (extended — see EventBus events.ts). Per-customer ordering: `arrived → state_changed (0..n) → gate_evaluated (0..n) → resolved`.
- **Consumes:** `clock:day_started` (roll today's customers — legacy path only, gated by `legacyDailyArrivals`), `deal:closed` (DealEngine-driven close), `bdc:callback_succeeded` (return to sales).

## Data
- Customer archetypes/visit archetypes come from `NPC` module (see its CLAUDE.md).

## Collaborators
- `CapacityManager` gates admittance before a customer is added to the pool.
- `NPC.createCustomer` produces the underlying `Person + Visit` bundle.

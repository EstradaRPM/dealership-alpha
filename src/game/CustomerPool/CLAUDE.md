# CustomerPool

Per-day customer roster + SalesProcess-driven resolution. Rolls today's customers, advances them through Sales stages, and runs `SalesProcess.resolveSalesProcess` + `closeAndPrice` at resolution time.

Competitors are the ambient market force (price drift + demand heat), not a per-customer snatch: a customer you don't win **walks** (SalesProcess outcome), and rival pull is expressed through demand/reputation, so there is no separate poach path. (Customer-poaching was cut — redundant with walk + competitive pressure + future BDC follow-up; see `docs/planning/poaching-cut.md`.)

## Public API (`index.ts`)
- `createCustomerPool(deps)` → `CustomerPool`. Optional `deps.skill?: SalespersonSkill` (defaults to `GREEN_SALESPERSON`; StaffOrg wiring is a follow-on). Optional `deps.legacyDailyArrivals?: boolean` (default `true`) — the old `clock:day_started` once-per-day arrival generator; the #114 composition root passes `false` so FloorSim's customer-source seam is the sole arrival source (`currentDay` still tracked). Optional `deps.dealEngine` + `deps.inventory` + `deps.creditTiers` (all three together) — when supplied, `dispatch(CLOSE)` real-close path routes through `DealEngine.closeDeal` (#146) so the canonical `deal:closed` with the five deal-structuring fields fires; absent any of the three, falls back to legacy SalesProcess-direct emit (test harnesses without inventory wiring).
- Session type: `CustomerSession`.
- `SALES_ARCHETYPES` (type `SalesArchetype`) — the person/visit pairings the sales floor spawns.
- **`resolveSegmentArchetypes(table)` (#371)** → `ReadonlyMap<segment, SegmentArchetypeWeight[]>`. Resolves `demandShaper.segmentArchetypes` (segment → personId → weight) against those pairings, dropping any personId the catalog doesn't spawn. **The ONE reading of that table**: `createWorld`'s spawn draw uses it, and the finance-mix projection (#371) integrates over it. A second copy of the filter or the normalization is how a forward read starts describing a crowd that never walks in.
- **`skewSegmentArchetypes(candidates, skew)` (#372)** → the same weights bent by an additive person-archetype skew (advertising's crowd lane, `DemandShaper.getPersonSkew()`), each clamped at zero. **The ONE place the skew is applied** — the spawn draw and the #371 finance-mix projection both go through it, so the crowd the wire promises is the crowd that walks in. A skew that zeroes every candidate returns the segment **unskewed**: advertising bends who walks in, it cannot close a segment the heat map still spawns, and an empty list would fall through to a persona that does not belong to the segment at all.
- `transition(...)`, `IllegalTransitionError` — FSM validates dispatch legality (intermediate stages).
- Types: `CustomerStage`, `CustomerAction`.

## Resolution semantics (#91, extended #146)
- **`dispatch(CLOSE)`** — SalesProcess-driven outcome determination (`resolveSalesProcess` + `closeAndPrice`):
  - Outcome `walk` → emits `customer:resolved` directly.
  - Outcome `closed` AND DealEngine wiring present AND lot non-empty → routes through `DealEngine.closeDeal` with the five deal-structuring fields (paymentMethod / downPayment / loanAmount / term / apr) computed from the customer's Visit + classified credit tier; the `deal:closed` listener below handles the resulting `CLOSED` transition + `customer:resolved` emit. Cash: `downPayment=agreedPrice, loanAmount=term=apr=0`. Finance: `term` from `creditTiers.tiers[tier]`; `apr`/`buyRate` from `DealEngine.quoteFinance(tier)` so the close earns its reserve half (#365); `downPayment = agreedPrice × visit.downPaymentBehavior`.
  - Outcome `closed` AND no DealEngine wiring (or empty lot) → legacy fallback: emits `customer:resolved` directly with SalesProcess `agreedPrice`/`frontGross` (no inventory decrement).
- **`dispatch(WALK_CUSTOMER)`** — forced walk: uses visit patience as heat proxy (no SalesProcess evaluation).
- **`deal:closed` listener** — DealEngine-driven close (own dispatch *or* external caller, e.g. StaffDispatch): forces outcome='closed', uses `agreedPrice`/`frontGross` from the DealEngine payload. Quality scalars come from the payload's **`salesQuality`** when present (#363 — the closing flow's own `SalesProcess.resolutionQuality` over the resolution and close that actually ran); absent, it falls back to a local `resolveViaProcess` evaluation. The fallback is what keeps legacy harnesses and direct `closeDeal` callers publishing exactly as before, and the preference is what stops a live close being scored against `STUB_VEHICLE_SPACED` — a car nobody was shown — and emitting a phantom `customer:gate_evaluated` stream for gates that never ran.
- **`staff:auto_resolved` listener** (`outcome: 'no_sale'`) — **the live sales floor's walk (#363).** StaffDispatch owns the outcome truth for a customer a salesperson worked, and a `no_sale` there is a resolution just as much as a close is. Transitions the session to `WALK` (when one exists) and publishes `customer:resolved` with `outcome: 'walk'`, carrying the event's `heat` straight through — it is `SalesProcess.residualHeat` over the resolution that ran, already computed for exactly the population FollowUpPool wants. The three pre-process reasons (`no_session`, `not_sales`, `no_fit`) carry no heat and resolve at `0` rather than not resolving at all: the up was on the floor and left, even if the lot never gave them a reason to warm up. An already-terminal session (`WALK`/`CLOSED`) is skipped so one customer is never charged twice; a customer BDC brought back sits at `UNGREETED` again and may legitimately re-resolve. **Before this bridge a walk on the live floor published nothing**, so `FollowUpPool`, `Reputation`'s walk penalty, `RegulatoryMeter`'s walk pressure and `TierManager.customersServed` were all dead in real play.
- Intermediate actions (GREET, QUALIFY, DEMO, NEGOTIATE) still use FSM.

## Events
- **Emits:** `customer:arrived`, `customer:state_changed`, `customer:gate_evaluated` (observability only, #92 — one per gate in gate order on a SalesProcess-driven resolution), `customer:resolved` (extended — see EventBus events.ts). Per-customer ordering: `arrived → state_changed (0..n) → gate_evaluated (0..n) → resolved`.
- **Consumes:** `clock:day_started` (roll today's customers — legacy path only, gated by `legacyDailyArrivals`), `deal:closed` (DealEngine-driven close), `staff:auto_resolved` with `outcome=no_sale` (#363 — the live-floor walk), `bdc:callback_succeeded` (return to sales).

**CustomerPool is the sole publisher of `customer:resolved`, and there are now three drivers** — `deal:closed`, `staff:auto_resolved`/`no_sale`, and `dispatch` (the forced admin walk + the legacy no-DealEngine direct emit). Do not add a fourth publisher in another module: the session lifecycle and the terminal-stage guard that keeps one customer from resolving twice both live here.

## Data
- Customer archetypes/visit archetypes come from `NPC` module (see its CLAUDE.md).

## Collaborators
- `CapacityManager` gates admittance before a customer is added to the pool.
- `NPC.createCustomer` produces the underlying `Person + Visit` bundle.

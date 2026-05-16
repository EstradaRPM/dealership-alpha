# CustomerPool

Per-day customer roster + SalesProcess-driven resolution. Rolls today's customers, advances them through Sales stages, runs `SalesProcess.resolveSalesProcess` + `closeAndPrice` at resolution time, and handles poach attempts by competitors.

## Public API (`index.ts`)
- `createCustomerPool(deps)` → `CustomerPool`. Optional `deps.skill?: SalespersonSkill` (defaults to `GREEN_SALESPERSON`; StaffOrg wiring is a follow-on).
- Session type: `CustomerSession`.
- `transition(...)`, `IllegalTransitionError` — FSM validates dispatch legality (intermediate stages).
- `checkPoach(...)` — competitor poach decision. `PoachParams`, `PoachResult`, `PoachOutcome`.
- `loadPoachConfig` — reads `data/poach-config.json`.
- Types: `CustomerStage`, `CustomerAction`, `PoachConfig`.

## Resolution semantics (#91)
- **`dispatch(CLOSE)`** — SalesProcess-driven: runs `resolveSalesProcess` + `closeAndPrice`; outcome may be 'closed' or 'walk' depending on meters + price formation.
- **`dispatch(WALK_CUSTOMER)`** — forced walk: uses visit patience as heat proxy (no SalesProcess evaluation).
- **`deal:closed` listener** — DealEngine-driven close: forces outcome='closed', runs SalesProcess for quality scalars only; uses `agreedPrice`/`frontGross` from DealEngine payload.
- Intermediate actions (GREET, QUALIFY, DEMO, NEGOTIATE) still use FSM.

## Events
- **Emits:** `customer:arrived`, `customer:state_changed`, `customer:gate_evaluated` (observability only, #92 — one per gate in gate order on a SalesProcess-driven resolution), `customer:resolved` (extended — see EventBus events.ts), `customer:poached`. Per-customer ordering: `arrived → state_changed (0..n) → gate_evaluated (0..n) → (resolved | poached)`.
- **Consumes:** `clock:day_started` (roll today's customers), `market:competitive_pressure` (poach checks), `deal:closed` (DealEngine-driven close), `bdc:callback_succeeded` (return to sales).

## Data
- `data/poach-config.json` — poach probabilities + thresholds.
- Customer archetypes/visit archetypes come from `NPC` module (see its CLAUDE.md).

## Collaborators
- `CapacityManager` gates admittance before a customer is added to the pool.
- `NPC.createCustomer` produces the underlying `Person + Visit` bundle.

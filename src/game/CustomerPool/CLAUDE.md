# CustomerPool

Per-day customer roster + state machine. Rolls today's customers, advances them through Sales stages, and handles poach attempts by competitors.

## Public API (`index.ts`)
- `createCustomerPool()` → `CustomerPool`. Session type: `CustomerSession`.
- `transition(...)`, `IllegalTransitionError` — explicit FSM for stage changes.
- `checkPoach(...)` — competitor poach decision. `PoachParams`, `PoachResult`, `PoachOutcome`.
- `loadPoachConfig` — reads `data/poach-config.json`.
- Types: `CustomerStage`, `CustomerAction`, `PoachConfig`.

## Events
- **Emits:** `customer:arrived`, `customer:state_changed`, `customer:resolved`, `customer:poached`. Per-customer ordering: `arrived → state_changed (0..n) → (resolved | poached)`.
- **Consumes:** `clock:day_started` (roll today's customers), `market:competitive_pressure` (input to poach checks).

## Data
- `data/poach-config.json` — poach probabilities + thresholds.
- Customer archetypes/visit archetypes come from `NPC` module (see its CLAUDE.md).

## Collaborators
- `CapacityManager` gates admittance before a customer is added to the pool.
- `NPC.createCustomer` produces the underlying `Person + Visit` bundle.

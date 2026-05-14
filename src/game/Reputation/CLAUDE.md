# Reputation

Dealership reputation score + marketing → demand feedback loop. Drifts overnight, takes hits from bad customer outcomes, feeds back into customer arrival rates.

## Public API (`index.ts`)
- `createReputation()` → `Reputation`.
- `loadReputationConfig` — reads reputation tunables.
- Types: `Reputation`, `ReputationDeps`, `ReputationConfig`.

## Events
- **Emits:** none directly (state read by `CustomerPool` / `CapacityManager` for arrival rates).
- **Consumes:** `clock:overnight_reputation_drift` (mean-reversion drift), `reputation:satisfaction_hit` (negative outcomes), `deal:closed` (positive bump), `customer:resolved` with outcome=walk (small hit).

## Data
- `data/tunables.json` — reputation section (drift rate, hit magnitudes, marketing curve).

## v1 simplification
The marketing → demand curve is a static lookup in v1. The interface allows a v2 replacement (dynamic marketing campaigns) without changing consumers.

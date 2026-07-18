# Reputation

Dealership reputation score + marketing → demand feedback loop. Drifts overnight, takes hits from bad customer outcomes, feeds back into customer arrival rates.

## Public API (`index.ts`)
- `createReputation()` → `Reputation`.
- `loadReputationConfig` — reads reputation tunables.
- Types: `Reputation`, `ReputationDeps`, `ReputationConfig`, `ReputationSnapshot`.

## Persistence (#192, parent #186)
- `snapshot()/restore()` — module-owned `schemaVersion`, captures the three live
  scalars (`customerSatisfaction`, `reviewScore`, `marketingBudget`). The demand
  curve + config are data-derived and not persisted. Wired into the world seam
  under the `reputation` key.

## Events
- **Emits:** Reputation itself emits none directly (state read by `CustomerPool` / `CapacityManager` for arrival rates). `RegulatoryMeter` (same module barrel) emits the AG-complaint family + `regulatory:suspension_lifted`, and (#327) `regulatory:audit_failure` when pressure sits in the audit band `[auditThreshold, pressureThreshold)` at an overnight tick — a latched IndictmentMonitor producer (one crossing = one failure; the escalating warning below the AG complaint). `auditThreshold` lives in `data/failure-tunables.json` `regulatory` section.
- **Consumes:** `clock:overnight_reputation_drift` (mean-reversion drift), `reputation:satisfaction_hit` (negative outcomes), `deal:closed` (positive bump), `customer:resolved` with outcome=walk (small hit).

## Data
- `data/tunables.json` — reputation section (drift rate, hit magnitudes, marketing curve).

## Current simplification
The marketing → demand curve is a static lookup for now. The interface allows a richer replacement (dynamic marketing campaigns) later without changing consumers.

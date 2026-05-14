# ServiceQueue

Daily service-department intake generator. Active at Tier 2+. Produces a batch of service items each morning that flow into `DepartmentQueue` (Service lane).

## Public API (`index.ts`)
- `createServiceQueue()` → `ServiceQueue`.
- `loadServiceQueueConfig` — reads service-intake tunables.
- Types: `ServiceQueue`, `ServiceQueueDeps`, `ServiceQueueConfig`, `ServiceIntakeItemDef`.

## Events
- **Emits:** `service:intake_ready` (list of items with `serviceItemId`, `type`, `label`, `baseRevenue`).
- **Consumes:** `clock:day_started` (at Tier 2+), `career:tier_up` (start producing intake once Tier 2 is reached).

## Data
- `data/service-intake.json` — intake item types, base revenue, generation rates.

## Tier gate
Do nothing at Tier 1 — service is unlocked at Tier 2. Check tier from `CareerProgression` before generating.

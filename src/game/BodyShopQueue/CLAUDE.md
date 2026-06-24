# BodyShopQueue

The **Tier-3 gate** on the Body Shop department's daily intake, and the Body-Shop
instantiation of the shared department assembly line
(`docs/planning/shared-department-structure.md`, LOCKED). The direct **Tier-3
mirror of `ServiceQueue`** (Service unlocks at Tier 2): it subscribes to
CollisionStream's enriched, NPC-bound stream (`bodyshop:demand_ready`, #313),
applies the tier gate, and re-publishes it as `bodyshop:intake_ready` for the
Body-Shop lane + drain (#314).

## Public API (`index.ts`)
- `createBodyShopQueue({ bus, initialTier?, config? })` → `BodyShopQueue`.
- `loadBodyShopQueueConfig` — reads the tier gate + collision-job labels.
- Types: `BodyShopQueue`, `BodyShopQueueDeps`, `BodyShopQueueConfig`,
  `BodyShopQueueSnapshot`.

## Events
- **Emits:** `bodyshop:intake_ready` — each item carries the customer + vehicle
  identity (`customerId`, `vehicleId`, `category`, `powertrain`), the due
  collision `jobCategory` (windows_glass / doors_panels / interior_trim / paint),
  the demand `source` (`insurance` DRP work | `retail` customer-pay), the
  `baseRevenue`, and a display `label` (derived from the job category via config).
- **Consumes:** `bodyshop:demand_ready` (the upstream CollisionStream mix, #313),
  `career:tier_up` (start re-publishing once Tier 3 is reached).

## Event-name decision (#312)
Per the shared-structure doc's "Event-name generalization" note, the Body Shop
**mirrors** the `service:*` set with a parallel `bodyshop:*` set bound to the same
resolver — it does NOT collapse both into a `dept:*` family. This keeps the
`service:*` payloads byte-stable (Service tests + persistence envelopes don't
churn); the shared part-category union simply widens to the four Body-Shop
collision categories.

## Data
- `data/bodyshop-intake.json` — `minTierRequired` (3) + `jobLabels` (per
  collision job category).

## Tier gate
Do nothing below `minTierRequired` (3) — the Body Shop is dark until the showroom
tier. Tier is followed off the bus (`career:tier_up`) and seeded by `initialTier`.

## Status (#312 skeleton)
This slice stands up the gate, roles, parts categories, and events. Intake is
fed by CollisionStream (#313) and resolved by the Body-Shop drain (#314); the
queue is not yet wired into `createWorld`/`snapshotWorld` — that lands with the
demand + drain slices, when the queue has a live feed to gate. `snapshot()/
restore()` carry only the tier gate (`currentTier`), ready for that wiring.

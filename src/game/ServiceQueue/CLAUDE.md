# ServiceQueue

The **Tier-2 gate** on the Service department's daily intake. Active at Tier 2+.
It no longer synthesizes intake from a flat `seed × day` table — instead it
subscribes to ServiceDemand's enriched, NPC-bound stream
(`serviceDemand:intake_ready`, #302), applies the tier gate, and re-publishes it
as `service:intake_ready` for `DepartmentQueue` (Service lane) + `ServiceDispatch`
(#303).

## Public API (`index.ts`)
- `createServiceQueue({ bus, initialTier?, config? })` → `ServiceQueue`.
- `loadServiceQueueConfig` — reads the tier gate + job-category labels.
- Types: `ServiceQueue`, `ServiceQueueDeps`, `ServiceQueueConfig`,
  `ServiceQueueSnapshot`.

## Events
- **Emits:** `service:intake_ready` — each item carries the customer + vehicle
  identity (`customerId`, `vehicleId`, `category`, `powertrain`), the due
  `jobCategory`, the `source` (`return` | `conquest`), the `baseRevenue`, and a
  display `label` (derived from the job category via config).
- **Consumes:** `serviceDemand:intake_ready` (the upstream mix), `career:tier_up`
  (start re-publishing once Tier 2 is reached).

## Data
- `data/service-intake.json` — `minTierRequired` + `jobLabels` (per
  `JobCategory`). The old `intakeItems`/`dailyIntakeMin`/`dailyIntakeMax` flat
  table is retired (#303).

## Tier gate
Do nothing below `minTierRequired` (2) — service is unlocked at Tier 2. Tier is
followed off the bus (`career:tier_up`) and seeded by `initialTier`.

## Persistence (#193)
- `snapshot()/restore()` (barrel-exported `ServiceQueueSnapshot`) carry only the
  tier gate (`currentTier`) — daily intake is never stored; it regenerates
  deterministically from `masterSeed + day` inside ServiceDemand. Wired into
  `snapshotWorld`/`restoreWorld` under the `serviceQueue` key so the Tier 2+
  unlock survives a load without waiting for the next `career:tier_up`.

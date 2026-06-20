# InstalledBase

The living per-owner registry — the foundation of the Service annuity (#298/#300,
parent PRD #297). Every car the player sells enters here as one owner record.
**Built so far: registry + persistence (#298) and the return cadence +
job-category drift that emits the day's returning-owner stream (#300). No service
resolution, parts, or defection yet (later #297 slices).**

## Public API (`index.ts`)
- `createInstalledBase({ bus, config, masterSeed?, reputation? })` →
  `InstalledBase`. `masterSeed` (default 0) seeds the per-owner return roll;
  `reputation` (default `() => 1`) is a live [0,1] read the root binds to the
  Reputation module.
- `getOwners()` / `getOwner(ownerId)` / `size` — read the registry.
- `snapshot()` / `restore()` — barrel-exported `InstalledBaseSnapshot`.
- `loadInstalledBaseConfig()` — reads `data/tunables.json#installedBase`.
- Return-cadence pure fns (#300, isolation-testable): `isServiceDue`,
  `cadenceForPowertrain`, `returnProbability`, `selectJobCategory`. Plus
  `JOB_CATEGORIES`.
- Types: `InstalledBase`, `InstalledBaseSnapshot`, `OwnerRecord`,
  `OwnerPowertrain`, `JobCategory`, `ReturningOwner`, `InstalledBaseConfig`.

## Accrual — the three-signal join
One sale fans out three signals, all synchronous within one
`DealEngine.closeDeal`:
1. `inventory:vehicle_sold` — the sold-vehicle snapshot (category, **powertrain**
   (#298 added the field), sale `day` → age), keyed by `vehicleId`.
2. `deal:closed` — `customerId` ↔ `vehicleId` (the join key).
3. `customer:resolved` (`outcome:'closed'`) — `retentionSeed`, the
   satisfaction-at-sale loyalty seed, keyed by `customerId`.

Vehicle attributes are taken **straight from the sold-vehicle snapshot, never
re-derived**. `loyalty = clamp01(retentionSeed × loyaltySeedScale)`.

### Order-independence
`customer:resolved` is published from *inside* CustomerPool's `deal:closed`
handler, so the relative firing order of this module's own handlers vs.
CustomerPool's is not guaranteed. We stash each signal in a transient pending
buffer and attempt to finalize from **both** the `deal:closed` and
`customer:resolved` handlers — whichever completes the trio last creates the
record. A walk (`outcome !== 'closed'`) never enters the base. `ownerId` is
`${customerId}::${vehicleId}`, so a repeat buyer gets one record per vehicle.

## Return cadence + job-category drift (#300)
On each `clock:day_started` the module rolls every **service-due** owner and
publishes the day's `installedBase:returns_ready` stream for the future
ServiceDemand. It fires **every day** (possibly with an empty `returns`) so
downstream gets a reliable daily signal. Tier-gating is *not* done here — the
module is pure life-cycle math; ServiceDemand/ServiceQueue gate consumption at
Tier 2+.

- **Due** when `ageDays = day − saleDay` is a positive multiple of the
  powertrain cadence (`config.returnCadence[powertrain]`; EVs longest ⇒ least
  often). `isServiceDue` / `cadenceForPowertrain`.
- **Return roll** `P = clamp01(loyalty × reputation × convenience −
  priceSensitivity)` — monotone ↑ in loyalty/reputation/convenience, ↓ in
  price-sensitivity. `reputation` is the live injected read; convenience &
  price-sensitivity are tunables (the future marketing/pricing levers drive
  them). Returns iff `rng() < P`. `returnProbability`.
- **Job category** is age-selected by `selectJobCategory`: walks
  `config.jobCategoryDrift` (early→late: `oil_filters` → `tires_brakes` →
  `drivetrain` → `electronics`); each band applies while `ageDays <
  untilAgeDays`, the last band is the catch-all.
- Each `ReturningOwner` entry carries `ownerId`/`customerId`/`vehicleId`/
  `category`/`powertrain`/`jobCategory`/`ageDays`.

## Events
- **Consumes:** `inventory:vehicle_sold`, `deal:closed`, `customer:resolved`,
  `clock:day_started` (#300).
- **Emits:** `installedBase:returns_ready` (#300).

## Data
- `data/tunables.json#installedBase` — `loyaltySeedScale` (1.0 = identity),
  plus (#300) `returnCadence` (per-powertrain interval days),
  `jobCategoryDrift` (ordered age→category ladder), and `returnRoll`
  (`convenience` / `priceSensitivity`). All placeholders tuned in the S14
  balance pass (#286).

## Persistence (#298)
- `snapshot()/restore()` round-trips owner records + loyalty under the
  `installedBase` world-snapshot key (envelope v9; the v8→v9 migration
  materializes an empty base for pre-existing saves). The pending join buffers
  are transient (always empty at rest between closes) and are **not** persisted —
  a restore starts them empty.

## Determinism
Loyalty is a pure function of the upstream `retentionSeed` (itself deterministic
from `masterSeed`), so accrual replays identically. The #300 return roll draws
its own RNG but seeds it off `masterSeed + 'installed_base.return' + {day,
ownerId}` (via `NPC/Rng`), so each owner's roll is keyed, order-independent, and
replays byte-identically (#122). The stream is derived state — nothing new is
persisted.

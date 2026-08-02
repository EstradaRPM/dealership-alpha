# InstalledBase

The living per-owner registry — the foundation of the Service annuity (#298/#300/
#306, parent PRD #297). Every car the player sells enters here as one owner
record. **Built so far: registry + persistence (#298), the return cadence +
job-category drift that emits the day's returning-owner stream (#300), and the
closed feedback loop (#306) — service outcomes move loyalty + CSI, sustained
neglect defects an owner, and aged-out loyal owners emit warm repeat-buyer
leads.**

## Public API (`index.ts`)
- `createInstalledBase({ bus, config, masterSeed?, reputation?, getPricingPosture? })`
  → `InstalledBase`. `masterSeed` (default 0) seeds the per-owner return roll;
  `reputation` (default `() => 1`) is a live [0,1] read the root binds to the
  Reputation module; `getPricingPosture` (default `() => 0.5`) is the live [0,1]
  service pricing-posture read for the #306 gouging gate.
- `getOwners()` / `getOwner(ownerId)` / `size` — read the registry. `OwnerRecord`
  carries `loyalty` + `csi` + the defection counters + `repeatLeadEmitted`.
- `snapshot()` / `restore()` — barrel-exported `InstalledBaseSnapshot` (versioned
  `1 | 2`; `restore` migrates a v1 blob forward, #306).
- `loadInstalledBaseConfig()` — reads `data/tunables.json#installedBase`.
- Return-cadence pure fns (#300, isolation-testable): `isServiceDue`,
  `cadenceForPowertrain`, `returnProbability`, `selectJobCategory`. Plus
  `JOB_CATEGORIES`.
- Feedback pure fns (#306, isolation-testable): `resolveServiceOutcome`,
  `isGouging`, `shouldDefect`, `isRepeatBuyerDue`.
- Types: `InstalledBase`, `InstalledBaseSnapshot`, `OwnerRecord`,
  `OwnerPowertrain`, `JobCategory`, `ReturningOwner`, `RepeatBuyerLead`,
  `ServiceOutcomeKind`, `ServiceOutcomeEffect`, `InstalledBaseConfig`.

## Feedback loop (#306)
Consumes the enriched service outcome events and closes the annuity loop:
- **`service:ticket_closed`** — a served job. `service:intake_ready` is consumed
  first to build a transient per-day `serviceItemId → ownerId` map (ticket_closed
  carries only the serviceItemId), so the close is attributed to its owner.
  At a **fair** posture (`≤ feedback.fairPostureThreshold`) it raises loyalty +
  CSI and resets the bad-visit streak; at a **premium** ("gouging") posture it
  drops both, counts as a bad visit, and dings Reputation. Rushed jobs also emit
  `ticket_closed`, so they count as served — we deliberately do NOT subscribe to
  `service:job_rushed` (avoids double-counting).
- **`service:job_missed`** (under-stock) / **`service:job_unserved`** (capacity /
  long wait) — both carry `customerId`+`vehicleId`, so the owner is keyed
  directly. Drop loyalty + CSI, count as a bad visit, ding Reputation.
- **Defection** — `shouldDefect` removes an owner permanently (emits
  `installedBase:owner_defected`) on sustained bad visits
  (`defection.badVisitsToDefect`) OR sustained non-returns
  (`defection.noReturnsToDefect`, counted in the morning return sweep).
- **Repeat-buyer leads** — in the morning sweep, an aged-out
  (`repeatBuyer.ageOutDays`), still-loyal (`≥ repeatBuyer.minLoyalty`) owner emits
  one warm lead on `installedBase:repeat_buyer_ready` (deduped by the persisted
  `repeatLeadEmitted`). The composition root maps the lead's `category` onto a
  matching sales archetype and spawns it into CustomerPool.

Reputation stays decoupled — the module publishes the generic
`reputation:satisfaction_hit` channel (reasons `service_missed` /
`service_unserved` / `service_gouged`), never calling Reputation directly.

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
  `clock:day_started` (#300); `service:intake_ready`, `service:ticket_closed`,
  `service:job_missed`, `service:job_unserved` (#306).
- **Emits:** `installedBase:returns_ready` (#300); `installedBase:repeat_buyer_ready`,
  `installedBase:owner_defected`, `reputation:satisfaction_hit` (#306).

## Data
- `data/tunables.json#installedBase` — `loyaltySeedScale` (1.0 = identity),
  plus (#300) `returnCadence` (per-powertrain interval days),
  `jobCategoryDrift` (ordered age→category ladder), and `returnRoll`
  (`convenience` / `priceSensitivity`); plus (#306) `feedback` (loyalty/CSI
  deltas per outcome, `fairPostureThreshold`, the three `reputation*` hit
  amounts), `defection` (`badVisitsToDefect` / `noReturnsToDefect`), and
  `repeatBuyer` (`ageOutDays` / `minLoyalty`). All placeholders tuned in the S14
  balance pass (#286).

## Persistence (#298, #306)
- `snapshot()/restore()` round-trips owner records (loyalty + CSI + defection
  counters + `repeatLeadEmitted`) under the `installedBase` world-snapshot key.
  The module-internal `schemaVersion` is **2** (#306); `restore` migrates a v1
  blob forward by defaulting `csi = loyalty` and zeroing the new fields. The
  world envelope v8→v9 migration still materializes an empty v1 base for
  pre-#298 saves (its restore then migrates that to v2 in memory). The pending
  join buffers + the per-day `serviceItemId → ownerId` map are transient (empty
  at rest) and are **not** persisted — a restore starts them empty.

## Determinism
Loyalty is a pure function of the upstream `retentionSeed` (itself deterministic
from `masterSeed`), so accrual replays identically. The #300 return roll draws
its own RNG but seeds it off `masterSeed + 'installed_base.return' + {day,
ownerId}` (via `Rng`), so each owner's roll is keyed, order-independent, and
replays byte-identically (#122). The stream is derived state — nothing new is
persisted. The #306 feedback path draws no RNG (deltas/defection/age-out are pure
functions of persisted owner state + the live posture/reputation reads), so it
replays identically; the repeat-buyer spawn the root performs is seeded on
`masterSeed + 'installed_base.repeat_buyer' + {day, ownerId}`.

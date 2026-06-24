# CollisionStream

The Body Shop's demand **spine** (#313, parent PRD #297) — the Tier-3 mirror of
`ServiceDemand`, but a fundamentally different shape. Where Service is an
installed-base annuity (steady returns + a small conquest floor), Body Shop is a
**stochastic collision shock**: a weather/season-spiked random draw,
conquest-dominant via reputation, with only a small installed-base tie. Each
collision job is split across two channels — `insurance` (DRP claim work: steady,
high, rate-capped, price-insensitive) and `retail` (customer-pay: lumpy,
fatter-margin) — governed by the player's channel posture.

It emits the **same enriched intake shape** Service uses, so the shared
resolution/capacity/parts machinery (#311) applies unchanged. `BodyShopQueue`
(#312) gates this stream by Tier 3 and re-publishes it as `bodyshop:intake_ready`
for the Body-Shop lane + drain (#314).

## Public API (`index.ts`)
- `createCollisionStream({ bus, masterSeed, config?, weather, reputation?,
  posture?, baseSize? })` → `CollisionStream`. Event-driven: subscribes
  `clock:day_started`, composes, publishes `bodyshop:demand_ready`.
  - `weather(day)` — the day's `{ conditionId, season }`, read from
    `Weather.weatherForDay` (a minimal local read type keeps CollisionStream
    decoupled from Weather's `DayWeather`).
  - `reputation?` — live [0,1] read; default neutral 1. Scales the **retail**
    (conquest-dominant) stream only.
  - `posture?` — channel posture [0,1]: 0 = full insurance-DRP, 1 = full retail;
    default neutral 0.5. The Body-Shop package supplies the live dial.
  - `baseSize?` — installed-base size for the small additive tie; default 0.
- `getLatestIntake()` — the most recently composed stream (empty before the first
  day). Holds no persisted state.
- Pure fns (isolation-testable): `composeCollisionIntake`, `composeCollisionMix`,
  `collisionRates`, `samplePoisson`.
- `loadCollisionStreamConfig()`, `BODY_SHOP_JOB_CATEGORIES`,
  `COLLISION_POWERTRAINS`.
- Types: `CollisionStream`, `CollisionStreamDeps`, `CollisionWeatherRead`,
  `CollisionStreamConfig`, `CollisionStreamInput`, `CollisionIntakeEntry`,
  `CollisionChannel`, `CollisionPowertrain`, `BodyShopJobCategory`.

## The model
Two **seeded Poisson** streams feed the day's draw (`collisionRates` →
`samplePoisson`). Poisson with a low mean is naturally feast-or-famine — most days
quiet, occasional spikes — so a storm genuinely floods the shop rather than
nudging a fixed cadence:
- **Retail / conquest** (lumpy): `conquestBase × fullWeatherSpike ×
  (1 + repGain·rep) + baseTieAdd`, grown by leaning retail
  (`× (1 + retailLeanBonus·posture)`). The **full** weather spike
  (`byCondition × bySeason`) makes it spike hard; reputation is the
  conquest-dominant growth lever; `baseTieAdd = min(baseTieCap, baseTie·baseSize)`
  is the small installed-base tie.
- **Insurance-DRP** (steady): `referralBase × dampedWeatherSpike × (1 − posture)`.
  The spike is **damped** (`1 + (full−1)·insuranceDamping`) so insurance is a
  steady contract feed, **rep-independent**, scaled by how much the player leans
  insurance.

Each drawn ticket gets a job category from the composed mix (`jobSplit` + the
day's `seasonalLean` + `conditionLean` (snow/storm tilt toward glass/panels/paint)
+ per-category RNG jitter, normalized), a vehicle category + powertrain from the
conquest distributions, and synthetic `bs:<channel>:*` ids. `baseRevenue` already
carries the **channel margin profile**: insurance jobs are rate-capped below book
(`insuranceRateCap < 1`), retail jobs carry the fatter structural margin
(`retailMarginMultiplier`). The player-priced retail markup (posture-driven) is
the later Body-Shop pricing satellite's concern (the `pricingRead` seam); the
channel-intrinsic margin difference lives here in the demand baseRevenue so it is
observable + testable within #313.

## Events
- **Consumes:** `clock:day_started`.
- **Emits:** `bodyshop:demand_ready` (`{ day, intake: CollisionIntakeEntry[] }`,
  shape locked in #312's `events.ts`).

## Data
- `data/bodyshop-demand.json` (`schemaVersion: 1`) — `jobRevenue`, `volume`
  (`conquestBase` / `referralBase` / `repGain` / `retailLeanBonus` / `baseTie` /
  `baseTieCap` / `maxLambda`), `weatherSpike` (`byCondition` / `bySeason` /
  `insuranceDamping`), `channel` (`insuranceRateCap` / `retailMarginMultiplier`),
  and `mix` (`jobSplit` / `seasonalLean` / `conditionLean` / `rngVariance` /
  `vehicleCategories` / `powertrainMix`). All magnitudes are placeholders tuned in
  the S14 balance pass (#286).

## Determinism & persistence
Holds **no persisted state** — the intake regenerates deterministically from
`masterSeed + day` + the live weather/reputation/posture reads, exactly like
Weather and ServiceDemand. Both Poisson draws + every per-event/per-category draw
are seeded via `NPC/Rng` (`deriveSeed(masterSeed, 'collision_stream.*',
{ day, … })`), so the stream is order-independent and replays byte-identically
(#122). No `worldSnapshot` key, no migration.

## Decoupling
CollisionStream never imports Weather, Reputation, StaffOrg, or InstalledBase —
the weather read + reputation + posture + base-size are injected as functions by
the composition root (the Body-Shop package, #314). The collision job-category
union + powertrain union are declared locally (type-compatible with the
`bodyshop:demand_ready` event), since CollisionStream — unlike ServiceDemand —
does not consume an InstalledBase stream.

## Status (#313)
This slice builds the demand spine as a standalone, isolation-tested module. It is
**not yet wired into `createWorld`/`snapshotWorld`** — like `BodyShopQueue` (#312),
that wiring lands with the Body-Shop drain slice (#314), when the Body-Shop package
exists to compose CollisionStream → BodyShopQueue → the drain and bind the live
weather/reputation/posture/base reads.

# ServiceDemand

The pure **mix composer** for the Service profit center (#302, parent PRD #297).
Each day it assembles the enriched service intake: the installed-base returns
(#300) folded in as the **primary stream**, plus a **conquest floor** of fresh
walk-ins scaled by reputation × service marketing. Every ticket carries customer
+ vehicle identity, the due job/parts category, and the base ticket revenue.

**This is the stream that replaces ServiceQueue's synthetic `seed × day` roll —
the consumer rewire (ServiceQueue/DepartmentQueue reading this instead) is a
later #297 slice. Nothing consumes `serviceDemand:intake_ready` yet** (mirrors
how #300 emitted `installedBase:returns_ready` for a not-yet-built consumer).

## Public API (`index.ts`)
- `createServiceDemand({ bus, masterSeed, config?, reputation?, serviceMarketing?, season, baseOwners })`
  → `ServiceDemand`. Event-driven: subscribes `installedBase:returns_ready`,
  composes, publishes `serviceDemand:intake_ready`.
  - `reputation?` — live [0,1] read; default neutral 1.
  - `serviceMarketing?` — [0,1] influence input; default 0 (⇒ floor-only
    conquest until a service-marketing lever lands).
  - `season(day)` — the day's season, read from `Weather.weatherForDay`.
  - `baseOwners()` — a live sample of the installed base (the composer reads
    only `{ saleDay, powertrain }` per owner).
- `getLatestIntake()` — the most recently composed stream (empty before the
  first day). Holds no persisted state.
- Pure fns (isolation-testable): `composeServiceIntake(input, config)`,
  `composeConquestMix(input, config)`, `conquestVolume(rep, mktg, cfg)`.
- `loadServiceDemandConfig()`, `JOB_CATEGORIES`, `POWERTRAINS`.
- Types: `ServiceDemand`, `ServiceDemandDeps`, `ServiceDemandConfig`,
  `ServiceIntakeEntry`, `ServiceTicketSource`, `ServiceDemandInput`,
  `BaseOwnerSample`, `JobCategory`, `OwnerPowertrain`.

## The mix
Returns keep the age-selected `jobCategory` InstalledBase already resolved. The
**conquest** category mix (`composeConquestMix`) is composed from five inputs,
then normalized to a probability distribution each ticket draws from:
1. **`usualSplit`** — the consumable-heavy base (oil/filters dominate).
2. **Seasonal lean** — `seasonalLean[season]`, a per-category additive delta
   (the *season* is read from Weather; the lean magnitudes are ServiceDemand's
   own concern). Winter favors tires/brakes + electronics, etc.
3. **Base-age drift** — mean installed-fleet age (saturating at
   `baseAgeDrift.referenceAgeDays`) shifts weight off `oil_filters` toward
   `drivetrain`/`electronics` via `categoryShift`.
4. **Powertrain skew** — the installed base's powertrain distribution blends the
   per-powertrain `powertrainSkew` multipliers (EVs trade oil work for
   electronics). An empty base falls back to `conquestPowertrainMix`.
5. **RNG variance** — a per-category multiplicative jitter (`rngVariance`),
   seeded off `masterSeed + day + category`.

Conquest **volume** = `conquest.floor + round(conquest.scale × rep × marketing)`
— the floor is always present (even with an empty base / zero marketing); the
product term is the influenceable growth. Conquest tickets draw a vehicle
category from `conquestVehicleCategories` and a powertrain from
`conquestPowertrainMix`, with synthetic `svc-conquest:*` customer/vehicle ids.

## Events
- **Consumes:** `installedBase:returns_ready` (#300).
- **Emits:** `serviceDemand:intake_ready` (`{ day, intake: ServiceIntakeEntry[] }`).

## Data
- `data/service-demand.json` (`schemaVersion: 1`) — `usualSplit`, `jobRevenue`,
  `conquest` (floor/scale), `baseAgeDrift`, `powertrainSkew`,
  `conquestPowertrainMix`, `conquestVehicleCategories`, `seasonalLean.bySeason`,
  `rngVariance`. All magnitudes are placeholders tuned in the S14 balance pass
  (#286).

## Determinism & persistence
Holds **no persisted state** — the intake regenerates deterministically from
`masterSeed + day` + the live installed base, exactly like Weather and
InstalledBase's return roll. All randomness is seeded via `NPC/Rng`
(`deriveSeed(masterSeed, 'service_demand.*', { day, … })`), so the stream is
order-independent and replays byte-identically (#122). No `worldSnapshot` key,
no migration.

## Decoupling
ServiceDemand is a downstream consumer of InstalledBase's returning-owner
contract, so it imports `JobCategory`/`OwnerPowertrain`/`ReturningOwner` types +
the `JOB_CATEGORIES` value from that module rather than declaring a parallel
union. It never imports Weather or Reputation — the season + reputation +
installed-base reads are injected as functions by the composition root.

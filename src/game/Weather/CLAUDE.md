# Weather

Season + per-day weather substrate (#231). The weather-demand mechanic:
S1 a read-only daily weather state surfaced on the Home calendar card; S2 a
season → demand lean over the customer want-vector. Later slices ride daily
weather onto traffic volume (S3) and add new attribute axes (S4) — they wire
onto this same pure core, they do not replace it.

## Public API (`index.ts`)
- `createWeather({ masterSeed, config? })` → `Weather`.
  - `config?` — test seam; defaults to the bundled `loadTunables().weather`.
- `Weather`:
  - `weatherForDay(day) → DayWeather` — `{ day, season, conditionId,
    conditionLabel, temperatureF }`. The **forecast** is just
    `weatherForDay(currentDay + 1)` — honest one-day lookahead, not a demand
    oracle.
  - `wantLeanForDay(day) → Record<axisId, number>` (**S2**) — the day's season
    demand lean: additive per-axis deltas over the SPACED want axes. Pure, from
    `attributeLeans.bySeason[season]`.
  - `leanWantVector(spaced, day) → spaced` (**S2**) — apply the day's lean to a
    customer want-vector, clamped to [0,1]. Axes absent from the lean (and lean
    axes the vector doesn't carry) pass through. This is the seam StaffDispatch's
    auto-resolve path biases `customerSpaced` through before the match, so the
    seasonal effect stays **emergent through `persona→preference→pickVehicleFor`**
    (#197) — never a per-make/model rule. Returns a new object; never mutates.
  - `volumeMultiplierForDay(day) → number` (**S3**) — the daily-weather →
    traffic-VOLUME multiplier (nice day ↑, bad day ↓). A pure projection of the
    day's already-drawn condition via `conditionVolume` (no new RNG ⇒
    replay-safe); unmapped conditions ⇒ 1.
  - `trafficOutlookForDay(day) → 'busy' | 'steady' | 'slow'` (**S3**) — the
    multiplier banded by `volumeOutlook` for the Home weather card, so reading
    tomorrow's forecast is a learnable planning signal.
  - `attributeLeanForDay(day) → Record<axisId, number>` (**S4**) — the day's
    *vehicle-attribute* demand lean: signed deltas over the attribute axes
    (`winterCapability` / `openAir` / `fuelEfficiency`), the across-the-board
    complement to `wantLeanForDay`. Sums the season climate regime
    (`attributeAxisLeans.bySeason`) and the acute daily-condition signal
    (`byCondition`, keyed off the day's drawn condition ⇒ no new RNG). Only
    non-zero axes present; empty ⇒ no lean.
- Types: `Weather`, `WeatherConfig`, `WeatherDeps`, `DayWeather`, `SpacedLike`,
  `TrafficOutlook`.

## Traffic volume (S3)
Daily weather rides foot-traffic volume. `createWorld` composes
`volumeMultiplierForDay(day)` onto the locked #125 `pricing.trafficMultiplier`
(alongside the inventory-depth `demandFactor`), which `DayLoopController`
projects into FloorSim's `demandFactor` arrival input. It is the **per-day
variance**, orthogonal to FloorSim's `seasonArrivalMultiplier` — the coarse
SEASON baseline — so the two never double-count (season-constant × daily
variance). The Home card surfaces today's + tomorrow's outlook so the forecast
is actionable, not decorative.

## Attribute lean (S4)
Weather also nudges demand over *vehicle attributes* — drivetrain/ground
clearance (`winterCapability`), convertible body (`openAir`), fuel economy
(`fuelEfficiency`) — distinct from the persona-SPACED axes S2 leans. These are
across-the-board: SalesProcess derives every template's attribute vector from
`vehicle-spaced.json` (`attributeBase` + `attributeOverrides`), so a lean
written over attributes gives every model a coherent response with no
per-make/model rule. Wiring: `createWorld` passes
`attributeLeanForDay: (day) => weather.attributeLeanForDay(day)` into the
`StaffFloorDrain`; StaffDispatch hands it to the matcher's `attributeLean`, and
`pickVehicleForMatch` adds `weatherAttributeBonus = Σ lean·(attr − 0.5)` to the
argmax score — a positive lean tilts toward weather-aligned units (AWD in snow,
open-tops in summer) while leaving `matchQuality` (want-axis fit, the #199
payoff) untouched. Zero lean ⇒ zero effect (calm-day / lean-less back-compat).
The lean is surfaced on the Home card as "Weather favors: AWD / 4WD". Note: v1
inventory has no convertibles, so `openAir` is dormant (schema in place for a
future template). Config: `weather.attributeAxisLeans { bySeason, byCondition }`.

## Demand lean (S2)
Season nudges *what buyers want* along the existing 6 SPACED axes; which models
that favors falls out of the existing match. Wiring: `createWorld` passes
`wantVectorBias: (spaced, day) => weather.leanWantVector(spaced, day)` into the
`StaffFloorDrain`; the resolver biases the want-vector before `pickVehicleForMatch`
+ `resolveSalesProcess`. The lean is also surfaced verbatim on the Home calendar
card ("Season favors: Reliability, Safety") so the effect is learnable, not just
felt. `SpacedLike` (`Record<string, number>`) keeps Weather decoupled from
SalesProcess — it never imports `SpacedVector`. Condition-specific leans over
*new* axes (snow→AWD) arrive with the attribute-schema extension (S4).

## Determinism & persistence
Weather for a day is a **pure function of `(masterSeed, day)`**: a temperature
drawn uniformly in the season band + a condition drawn from the season's
weighted catalog, on `deriveSeed(masterSeed, 'weather', { day })`. The per-day
key is independent of tick order, so it cannot desync mid-day (#122 replay).

Because all state derives from the already-persisted `masterSeed` +
`GameClock.day`, **the module holds no state and needs no snapshot** — a
restored World (same seed) recomputes identical weather. No `worldSnapshot`
key, no migration.

Season comes from `GameClock.seasonForDay(day)` (the single source of truth for
season boundaries), so Weather never duplicates the 4×91 cutoffs.

## Events
None — a pure library/factory module (mirrors SalesProcess / DemandShaper). The
composition root reads `weatherForDay` to assemble the Home readout.

## Data
- `data/tunables.json` → `weather`: `{ conditions, seasons, attributeLeans }`.
  `conditions` is the condition-id → display-label catalog; each season carries
  `{ tempMinF, tempMaxF, conditionWeights }` (a relative distribution over the
  condition ids — snow ~0 outside winter, etc.). `attributeLeans.bySeason` (S2)
  is a per-season partial record over the SPACED axis ids → additive want-vector
  delta. Magnitudes are first-pass calibration, tuned last.

## Scope notes
- S1 was **behavior-neutral on demand** (weather displayed only). S2 makes the
  season lean the customer want-vector in the live auto-resolve path. S3 rides
  daily weather onto traffic VOLUME (above). S4 adds the new vehicle-attribute
  axes (drivetrain/convertible/fuel) and the per-condition attribute lean over
  them (above). #231 is complete.

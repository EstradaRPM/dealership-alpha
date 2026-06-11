# Weather

Season + per-day weather substrate (#231). Slice 1 of the weather-demand
mechanic: a read-only daily weather state surfaced on the Home calendar card.
Later slices ride season/weather onto demand (attribute-axis lean) and traffic
volume — they wire onto this same pure core, they do not replace it.

## Public API (`index.ts`)
- `createWeather({ masterSeed, config? })` → `Weather`.
  - `config?` — test seam; defaults to the bundled `loadTunables().weather`.
- `Weather`:
  - `weatherForDay(day) → DayWeather` — `{ day, season, conditionId,
    conditionLabel, temperatureF }`. The **forecast** is just
    `weatherForDay(currentDay + 1)` — honest one-day lookahead, not a demand
    oracle.
- Types: `Weather`, `WeatherConfig`, `WeatherDeps`, `DayWeather`.

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
- `data/tunables.json` → `weather`: `{ conditions, seasons }`. `conditions` is
  the condition-id → display-label catalog; each season carries `{ tempMinF,
  tempMaxF, conditionWeights }` (a relative distribution over the condition
  ids — snow ~0 outside winter, etc.). Magnitudes are first-pass calibration,
  tuned last.

## Scope notes
- Slice 1 is **behavior-neutral on demand** — weather is displayed, nothing
  consumes it for spawning yet. The demand lean (over vehicle attribute axes,
  via the customer want-vector) and the daily-weather → traffic-volume rider are
  later slices of #231.

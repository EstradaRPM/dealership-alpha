# FloorSim

Owns the intra-day **logical-tick** loop (PRD #95). 1 day = N logical ticks;
customers arrive across ticks via seeded RNG scaled by reputation / market
share / season. Day ends exactly at N ticks → control returns to `GameClock`.

This slice (#98) is the **skeleton**: arrivals + day-exhaustion only. Staff
per-tick draining (#101), tick-cost hand-play (#102), forced-exception channel
(#103), and CapacityManager per-tick admittance (#100) layer on later.

## Public API (`index.ts`)
- `createFloorSim({ bus, seed, ctx })` → `FloorSim`.
- Types: `FloorSim`, `DayContext`.

`DayContext` is an injected snapshot (`day`, `reputation` [0,1], `marketShare`
[0,1], `season`). FloorSim never reaches into Reputation/CompetitorMarket/
GameClock — the composition root supplies it, keeping `step()` pure w.r.t.
injected state.

## Determinism
All randomness is seeded: one stable RNG stream per `(seed, day)` via
`deriveSeed(seed, 'floor_sim.arrivals', { day })`. `step()` and `runDay()`
produce an identical arrival sequence for the same seed + `DayContext`,
regardless of call shape. Wall-clock and speed controls are render-only
multipliers over `step()` in the UI loop — game logic never depends on UI
cadence (preserves headless testability + UI/logic separability).

## Events emitted (per simulated day, in order)
1. `floor:tick` — ×`ticksPerDay`, ascending `tick = 1..ticksPerDay`.
2. `floor:day_complete` — exactly once, immediately after the final
   `floor:tick`; control then returns to `GameClock`.

Runs strictly between `clock:day_started` and the composition root calling
`GameClock.advanceDay()` — independent of, never interleaved with, the
`clock:*` overnight sequence.

## Data
`data/tunables.json` → `floorSim` section (loaded via `loadTunables()`):
`ticksPerDay`, `baseDailyArrivals`, `reputationArrivalCoeff`,
`marketShareArrivalCoeff`, `seasonArrivalMultiplier`. No magic numbers in code.

Arrival model: `expected = base · (1 + repCoeff·rep) · (1 + shareCoeff·share)
· seasonMult[season]`; per-tick arrival probability = `expected / ticksPerDay`
(skeleton: ≤1 arrival/tick). Curve calibration is deferred to the HITL task
(#105) — these are reasonable defaults, not final balance.

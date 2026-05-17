# DayLoopController

Headless orchestrator that owns the per-day lifecycle. **First responsibility
only (#111):** a narrow provider seam for the per-day `DemandContext` slip and
the construction side that creates + owns one `FloorSim` per day via the
locked #99 contract. **No state machine yet, no UI.** FloorSim/#99 untouched.

## Provider seam (#111 + locked #125 contract)

- `DemandSource.slipFor({day,department}) → DemandContext` — the "morning
  slip". The real economy (deliberately post-#74, co-calibrated with #105)
  drops in here; v1 uses `createStubDemandSource()` (dumb neutral fill, sales
  the only `pipelineActive` department — service/bodyshop dormant per #125
  decision 10).
- `DecisionSink.record(DayDecision)` — the day hands back a `DayOutcome`
  object (NOT a bare scalar, on purpose: same shape-reservation discipline
  #125 applied to the slip, since the sink's producer is this module's
  `endDay` — additive `DayOutcome` fields keep `endDay()` stable so the
  economy drops in without reopening this seam). Success-coupling +
  marketing-lag math lives **entirely behind the seam** (#125 decisions
  6/8). v1 default `createNullDecisionSink()`.
- Both seams follow FloorSim's omitted-default pattern (omit ⇒ stub/no-op).

`DemandContext` shape is **LOCKED by design record #125** — reserved fields
are present even though the stub fills them flat, so #114 and the future
economy drop in without reopening this HITL seam. Carries: composite
pluggable demand streams (`townPool` / `privateBaseline` / `outOfMarketReach`
/ `installedBaseReturn` / `freshDriveIn`), each resolving to a buyer-segment
distribution (credit tier / seriousness / brand-fit), aggregate `segmentMix`,
dual-path `pricing`, READ-only `reputation`, `marketGrowth`
(calendar/era index + your-draw feedback + cap), per-day `season` traffic
filter, length-1 `brands`/`stores` collections, reserved `dealershipId`.

## FloorSim create/own

`beginDay({day,department})` pulls the slip, **projects it down** to
FloorSim's untouched #99 4-scalar `DayContext` (`day`, `reputation`,
`marketShare` = town-pool draw / market cap, `season`), and creates + owns one
`FloorSim` via `createFloorSim({bus,seed,ctx})`. The richer slip never enters
FloorSim — the projection is the hard invariant from #125. `currentSlip()` /
`currentFloor()` expose the owned pair; `endDay(realizedDraw)` feeds the sink.

Capacity/drain/customer-source wiring is **#114's job** (composition root),
not here.

## Public API (`index.ts`)
- `createDayLoopController({ bus, seed, demandSource?, decisionSink? })`.
- `createStubDemandSource()` / `createNullDecisionSink()` — v1 stubs.
- Types: `DayLoopController`, `DemandSource`, `DecisionSink`, `DayDecision`,
  `DayOutcome`, `DemandContext` (+ its component types).

## Events
None yet — construction/seam slice only. EventBus is threaded through to the
owned FloorSim; the state-machine slice adds orchestration events.

## Locked / do-not-re-grill
`DemandContext` = #125 (locked 2026-05-17). FloorSim surface = #99 (locked).
This module must not change either; it only projects #125 → #99.

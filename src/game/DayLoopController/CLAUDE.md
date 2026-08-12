# DayLoopController

Headless orchestrator that owns the per-day lifecycle. **#111:** a narrow
provider seam for the per-day `DemandContext` slip + construction side that
creates/owns one `FloorSim` per day via the locked #99 contract. **#112:** the
two-state MANAGERIAL↔FLOOR_OPEN lifecycle on top. Still **no UI**;
FloorSim/#99 untouched.

## Lifecycle state machine (#112, design = #107 d11/d15)

Two states: `MANAGERIAL` (lot closed — recap/leak review, ownership levers
unlocked for next-day prep, primary action "Next Day") ↔ `FLOOR_OPEN` (live
ticking floor; ownership greyed). The game **boots MANAGERIAL = "night before
Day 1"** (no day played ⇒ no recap).

- `state() → DayLoopState` `{ phase, day (= clock day), ownershipUnlocked
  (⇔ MANAGERIAL), hasRecap (false only at the cold-start night-before-Day-1) }`.
  Everything derives from `phase` + clock — no separate ownership/career state.
- `nextDay({department?}) → FloorSim` — player-gated MANAGERIAL→FLOOR_OPEN.
  Calls `GameClock.advanceDay()` **then** `beginDay(clock.currentDay)`. The
  advance is **skipped on the cold-start first call only** (clock already sits
  on Day 1 = night before Day 1; advancing would skip Day 1 — the
  deterministic cold-start rule, #107 d15). Throws if not MANAGERIAL.
- `floor:day_complete` (exhaustion or early close, #99) for the owned floor's
  day → FLOOR_OPEN→MANAGERIAL, `hasRecap` latches true. The subscription is
  idempotent + floor-scoped: a foreign/stale `floor:day_complete` (e.g. a bare
  `beginDay()` primitive used in isolation, or a wrong `day`) never drives the
  machine. `beginDay()` itself is the unguarded low-level primitive (used by
  the #111 seam tests); `nextDay()` is the only guarded transition.

Needs a `GameClock` injected (`deps.clock`) — the controller is the
composition-root actor that owns the player-gated clock advance; per the #99
invariant FloorSim never advances the clock itself.

## Provider seam (#111 + locked #125 contract)

- `DemandSource.slipFor({day,department}) → DemandContext` — the "morning
  slip". The real economy (deliberately post-#74, co-calibrated with #105)
  drops in here; the current default is `createStubDemandSource()` (dumb neutral fill, sales
  the only `pipelineActive` department — service/bodyshop dormant per #125
  decision 10).
- `DecisionSink.record(DayDecision)` — the day hands back a `DayOutcome`
  object (NOT a bare scalar, on purpose: same shape-reservation discipline
  #125 applied to the slip, since the sink's producer is this module's
  `endDay` — additive `DayOutcome` fields keep `endDay()` stable so the
  economy drops in without reopening this seam). Success-coupling +
  marketing-lag math lives **entirely behind the seam** (#125 decisions
  6/8). Current default `createNullDecisionSink()`.
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

### Floor-seam injection (#114)
`beginDay` accepts an optional `deps.floorSeams: FloorSeamProvider` —
`(slip) → { capacity?, drains?, customerSource? }`, invoked once per day with
that day's slip so each day gets fresh per-day seam instances (the capacity
gate snapshots the day's budget; the staff floor drain is a per-day
instance). Whatever it returns is spread straight into `createFloorSim`.
Omitted ⇒ bare FloorSim (the #111/#112 default — same omitted-default
discipline as the provider seams). The controller only **forwards** the
seams; it never builds them and never touches FloorSim/#99. The composition
root (#114) supplies the provider that wires CapacityManager /
StaffDispatch / CustomerPool behind the locked #99 seams.

## Deterministic cold-start replay (#122)

The controller transparently records the two player verbs by wrapping the
FloorSim it owns (`grab`, and `advance` via the wrapped `HandPlaySession`) —
the UI keeps calling them unchanged; FloorSim/#99 is wrapped, never modified.
Each entry logs the floor's `currentTick` at dispatch (`advance` burns its
tick-cost burst *after* this).

- `checkpoint() → MidDayCheckpoint | null` — the live mid-day state in the
  #109 schema (`{ seed, day, dayContext, currentTick, actionLog }`).
  `dayContext` is the exact projected #99 ctx, checkpointed verbatim. `null`
  unless FLOOR_OPEN with a live (not-yet-complete) floor.
- `resume(cp) → FloorSim` — recreate the day's FloorSim from
  `(seed, day, dayContext)` via the normal seam path (ctx used verbatim, never
  re-derived), replay the ordered log (step to each action's `atTick`, re-issue
  the verb), then step out to `currentTick` — byte-exact, headless, instant.
  Requires the injected clock to already sit on `cp.day` (the composition root
  positions it from the main save first; throws otherwise). Leaves the
  controller FLOOR_OPEN with recording live, so a later checkpoint captures the
  full history. Idempotent.

Composition root wires it: `AppState` background/inactive → persist
`checkpoint()` to a separate sqlite cell; cold start → if a checkpoint exists
for the clock's current day, `resume()` it (a stale one the clock can't honor
is discarded, never misapplied — broader mid-game clock/economy persistence is
a later slice); `floor:day_complete` clears the cell.

## Public API (`index.ts`)
- `createDayLoopController({ bus, seed, clock, demandSource?, decisionSink? })`.
- `checkpoint()` / `resume(cp)` (#122); type `ReplayAction`.
- `createStubDemandSource()` / `createNullDecisionSink()` — current stubs.
- `DEALERSHIP_ID` — the single dealership the career runs today, i.e. the ONE
  definition of the reserved `dealershipId` key (#125 d9). The clock-bite gate
  reads it too (#385, multi-store): a store the ladder identifies by a different
  string than the demand slip stamps is a group whose stores silently stop
  lining up.
- Types: `DayLoopController`, `DayLoopState`, `LifecyclePhase`,
  `FloorSeamProvider`, `DemandSource`, `DecisionSink`, `DayDecision`,
  `DayOutcome`, `DemandContext` (+ its component types).

## Events
Emits none of its own. **Consumes** `floor:day_complete` (FLOOR_OPEN→
MANAGERIAL). `nextDay()` drives `GameClock.advanceDay()`, which fans out the
normal `clock:*` overnight sequence. EventBus is otherwise threaded through to
the owned FloorSim (observability only).

## Locked / do-not-re-grill
`DemandContext` = #125 (locked 2026-05-17). FloorSim surface = #99 (locked).
This module must not change either; it only projects #125 → #99.

**Boundary reopened (#277, Pricing/Demand spine S5):** the #125 *shape* is
untouched, but the semantics of `pricing.trafficMultiplier` are reopened — it is
now a real price-elastic demand input, not a flat stub. The composition root
rides the price → arrivals rider (`computePricingTrafficMultiplier`) onto that
field alongside the inventory-depth `demandFactor` and the weather rider;
`project()` still forwards the single composite to FloorSim's `demandFactor`
unchanged. **Armed in #279 (S7):** `pricingTrafficWeight = 1` and the rider's
per-vehicle response is MarketEconomy's shared `demandMultiplier`
(`demandMultiplierFor`), so price posture now actually moves arrivals and the
floor matches the pricing screen's days-to-sell. See
`docs/planning/pricing-demand-spine.md` §7.

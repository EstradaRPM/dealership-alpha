# FloorSim

Owns the intra-day **logical-tick** loop (PRD #95). 1 day = N logical ticks;
customers arrive across ticks via seeded RNG scaled by reputation / market
share / season. Day ends exactly at N ticks → control returns to `GameClock`.

Skeleton (#98): arrivals + day-exhaustion. CapacityManager per-tick
admittance + felt walk (#100): **landed**. Staff per-tick draining (#101):
**landed**. Tick-cost hand-play (#102): **landed**. Cross-department
cherry-pick (#104): **landed**.

The forced-exception channel (#103 — FloorSim minting grabbable exception
refs + `floor:exception_raised` per held case) was **removed in #275** along
with the dead HandPlay event it fed. A drain's `escalated` count is now only
tallied into `totalEscalated`; the held case (a trade/discount review) is
surfaced + paused by the composition root's interrupt modals via its own
`trade:escalated` / `discount:escalated` event, not by a floor channel.

## Capacity seam (#100)
Optional injected `capacity?: CapacityGate` (`admit(arrivals, {day,tick}) →
walkedCount`). Per tick, after spawn: arrivals are handed to the gate; the
overflow it turns away is emitted as `floor:customer_walked` (once per walked
customer) **before** `floor:tick`, per the canonical sequence. FloorSim only
emits the walk heartbeat — the domain consequence (missed-opportunity +
reputation hit) lives behind the seam (`CapacityManager.createFloorGate()`).
Seam omitted ⇒ admit-all, zero walks (skeleton behavior). `totalWalked`
exposes the cumulative felt-walk count.

## Drain seam (#101)
Optional injected `drains?: DeptDrain[]`. Each tick, after admit/walk and
before `floor:tick`, every drain's `drain({day,tick}) → {resolved,escalated}`
is invoked so a department auto-resolves its routine queue at a skill-scaled
throughput, draining across ticks (not once-per-day). FloorSim only paces the
invocation — the department owns its own throughput/threshold. `resolved` accumulates into `totalResolved`; `escalated` is tallied into
`totalEscalated` (was the #103 forced-exception channel, removed in #275 —
see below). Seam omitted ⇒ no auto-resolution
(skeleton behavior). Structurally satisfied by `createStaffFloorDrain` /
`createServiceFloorDrain`.

## Drain `escalated` tally (was the forced-exception channel #103)
A drain reports a per-tick `escalated` count for dramatic cases it held for
the player (a trade/discount review pending the player's decision). FloorSim
only accumulates it into `totalEscalated` — it no longer mints exception
refs or emits a floor event (the #103 channel + the dead HandPlay event it
fed were removed in #275). The held case surfaces + pauses the floor through
the composition root's `trade:escalated` / `discount:escalated` interrupt
modals + the render-loop `hold`, not a floor channel.

## Cross-department cherry-pick (#104)
The grab verb is department-agnostic: `grabbableCustomers()` is one roster of
ambient + exception refs spanning every unlocked department (the ref's
`department` is opaque routing context), and `grab()` opens the same #102
hand-play session for any of them. #104 adds the tick-budget gate so a
cherry-pick is never a free extra action: `spareTickBudget` (= ticks left in
the day, 0 once complete) is now a `canGrab()` precondition and a hard
`grab()` guard — both require `spareTickBudget ≥ handPlay.tickCostPerGate`
(enough to play at least one gate). No interface rework: `spareTickBudget` is
an additive read-only observable, `canGrab()`/`grab()` keep their locked #99
signatures.

## Hand-play seam (#102)
Optional injected `customerSource?: CustomerSource`
(`spawn({day,tick,count}) → CustomerRef[]`) mints identities for the
*admitted* count each tick — FloorSim's arrival RNG is untouched (#100/#101
determinism preserved); the source only names who got in. Omitted ⇒
deterministic default refs `floor:{day}:{tick}:{i}` (ambient, mustHandle
false, dept `sales`), same omitted-default pattern as capacity/drains.
Admitted refs accrue to an in-floor roster (`grabbableCustomers()`).
`canGrab()` ⇔ day live ∧ no active session ∧ roster non-empty. `grab(id)`
removes the ref and opens a single-use `HandPlaySession`. `advance(choiceId)`
burns exactly `handPlay.tickCostPerGate` ticks of the **same** per-tick loop
(player marked busy — concurrent grab blocked), then resolves the pending
gate via the unchanged #85 `evaluateGate` seam fed the picked approach
(`fitModifier`/`difficultyModifier` from tunables) + the injected
`skill?: SalespersonSkill` (default `GREEN_SALESPERSON`). Returns the locked
discriminated union: `continue{currentGate,choices}` |
`closed{meters,evaluations}` | `walk{gate,cause,meters,evaluations}`.
Terminal close = surviving every configured gate; walk causes: `low_quality`
(a gate `q < handPlay.walkQualityFloor`) or `day_exhausted` (burst exhausted
the day with gates remaining — committed gate still resolves, locked #99
derived invariant). The richer #89 named-walk/patience model stays on the
auto path; #102's terminal rule is deliberately minimal — its job is the
tick-cost verb + evaluator wiring, zero evaluator change. **Deferred:**
`source:'exception'` refs + `mustHandle` policy (#103); unified grab over
ambient+exception (#104). `handPlay` tunables are calibration starting
points (see #105 HITL), not final balance.

## Locked public contract (#99 HITL gate)

The full FloorSim public surface is **locked** — see the issue #99 sign-off
comment for the authoritative spec. #100–#104 build against it with zero
interface rework. Load-bearing invariants for anyone touching this module:

- **FloorSim owns the per-tick loop** via injected narrow seams
  (`customerSource.spawn`, `capacity.admit`, per-dept `drain`, the unchanged
  #85 evaluator). EventBus is observability only.
- **Canonical per-tick order:** spawn → admit/walk (`floor:customer_walked`)
  → drain (`{resolved,escalated}`; escalated only tallied) →
  `floor:tick` (settled, emitted last) → day-end check (`floor:day_complete`).
- **Determinism:** auto path `runDay()` deterministic from `(seed,day,ctx)`
  alone; interactive path from seed + ordered player-action log. Player actions
  never draw the arrival/drain RNG.
- **One verb:** unified `grabbableCustomers()` (ambient + exceptions, self-
  describing refs `source`/`mustHandle`/`department`); single `grab() →
  HandPlaySession`; `advance()` resolves a gate via the #85 seam, burns
  tick-cost ticks, returns a discriminated union (continue | closed | walk).
  `canGrab()` precondition owned here. FloorSim is department/tier-agnostic.
- **Macro boundary (reopened #277):** marketing/pricing/strategy never enter
  FloorSim *directly* — they enter as a **demand input** through the single
  projected `demandFactor` only, never as new FloorSim terms. The original
  "pricing never touches arrivals" stance is superseded by the Pricing/Demand
  spine (`docs/planning/pricing-demand-spine.md` §7): price posture rides the
  locked #125 `pricing.trafficMultiplier` composite (alongside inventory depth
  and weather) via `computePricingTrafficMultiplier`, so FloorSim's contract is
  unchanged — it still consumes one scalar. Ships at identity
  (`demandModel.pricingTrafficWeight = 0` ⇒ ×1). `dealershipId` reserved as a
  seed-derivation context key for v2 dealer-group.
- **3-phase day:** floor-open → floor-closes (`floor:day_complete` ≠ advance
  clock) → after-hours (managerial, OUT of FloorSim). Clock advance is always
  a separate player-gated composition-root action. FloorSim never calls
  GameClock. `CloseEarly` is removed (#106); early-close folds into
  `floor:day_complete{earlyClose,walkCount}` via `closeFloor()`.

## Public API (`index.ts`)
- `createFloorSim({ bus, seed, ctx })` → `FloorSim`.
- Types: `FloorSim`, `DayContext`.

`DayContext` is an injected snapshot (`day`, `reputation` [0,1], `marketShare`
[0,1], `season`, optional `demandFactor`). FloorSim never reaches into
Reputation/CompetitorMarket/GameClock — the composition root supplies it,
keeping `step()` pure w.r.t. injected state.

**`demandFactor` (#128a, additive #99 amendment — design-record note on
#99/#107).** One optional scalar so the full controllable-lever economics
(inventory depth × quality + weather + **pricing posture (#277, identity
default)**; marketing later) stay behind the locked #125 `DemandSource` seam
and never widen this contract again. It is
the only arrival input that can floor traffic at ~0 (empty lot ⇒ no draw)
or exceed 1 (busy high-volume store) — rep/share/season can't. Arrival model
becomes `expected = base · (1+repC·rep) · (1+shareC·share) · season ·
demandFactor`. **Omitted ⇒ 1 ⇒ pre-#128a behavior**, so every existing
caller/test and `(seed,day,ctx)` replay stays byte-identical (back-compat is
the load-bearing invariant of this amendment). The composition root rides
the composite on the existing #125 `pricing.trafficMultiplier` (stub = 1);
`DayLoopController.project()` maps it additively. `DemandContext` (#125) and
the projection's other outputs are untouched.

## Determinism
All randomness is seeded: one stable RNG stream per `(seed, day)` via
`deriveSeed(seed, 'floor_sim.arrivals', { day })`. `step()` and `runDay()`
produce an identical arrival sequence for the same seed + `DayContext`,
regardless of call shape. Wall-clock and speed controls are render-only
multipliers over `step()` in the UI loop — game logic never depends on UI
cadence (preserves headless testability + UI/logic separability).

## Events emitted (per simulated day, in order)
1. `floor:customer_walked` — 0..n per tick, one per overflow customer,
   emitted before that tick's `floor:tick`.
2. `floor:tick` — ×`ticksPerDay`, ascending `tick = 1..ticksPerDay`.
3. `floor:day_complete` — exactly once, immediately after the final
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

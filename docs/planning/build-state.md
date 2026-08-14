# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phase 12 — F1 onboarding (#213) + F2 + F3 + D3 — is the ACTIVE phase as of 2026-08-12. Its
ADJUDICATE gate is CLOSED and it is now SLICED AND FILED (2026-08-12).** Five rulings, recorded in
`path-to-finished-product.md` §6 D3, §8 F2 and §8 F3 (and summarized in `gates.md` Settled) — see
the 2026-08-12 gate log entry for the reasoning and the rejected options. **Eleven slices: ten new
issues #386–#395 plus #213, whose scope had grown since filing and was rewritten in place rather
than duplicated** (the #151–#153 precedent). **F3 produced no issue — it was ruled NONE and is
closed.** The next `/next` is BUILD #213 (deps-met once #386 lands) — in practice **#386, the
tracer, is the lowest deps-met issue and is built first.**

**#386, the tracer, is BUILT as of 2026-08-12.** It also filed **#396 out of phase** — the
sourcing-lean dial that #385 declared as a standing desk order and that has no rendered control
anywhere in `src/ui/**`.

**#387 is BUILT as of 2026-08-12.**

**#388 is BUILT as of 2026-08-12.**

**#389 is BUILT as of 2026-08-13.**

**#390 is BUILT as of 2026-08-13.**

**#391 is BUILT as of 2026-08-13.**

**#392 is BUILT as of 2026-08-13.** **`WORLD_SNAPSHOT_VERSION` is now 22.**

**#393 is BUILT as of 2026-08-13 — F2-R1 is COMPLETE.**

**#394 is BUILT as of 2026-08-13 — F2 is COMPLETE.** It also filed **#397 out of phase** — four
`data/` loaders still load as raw casts, the defect #394 fixed in `failureData.ts`.

**#213 is BUILT as of 2026-08-13.** `WORLD_SNAPSHOT_VERSION` stays 22: the spine writes into the
per-slot `teaching:<id>` cell and nothing else.

**#395 is BUILT as of 2026-08-13 — PHASE 12 IS COMPLETE.** Nothing under it is outstanding. The
next `/next` advances the pointer to phase 13. `WORLD_SNAPSHOT_VERSION` stays 22.

The one thing a future session must not re-derive: **the backstory picks WERE mechanically
identical, and #390/#391/#392/#393 ended all of it.** All four `day1Modifier` levers are read in
`createWorld`, every one is wired to a mechanic, and every one now has a surface the player can
see it on. **The character card is now true** — `data/backstories.json`'s `effect` sentences all
describe something the engine does. F2-R1 is closed; nothing under it is outstanding.

### Phase 12 — F1 + F2 + D3 (sliced + filed 2026-08-12)

| # | Slice | Deps |
|---|---|---|
| ~~#386~~ | ~~**tracer** — the teaching cell (`teaching:<id>`, minted in `SlotStore.ts`) + `data/hints.json` registry + retire-on-use + "Show hints again"; three real hints ship with it~~ **BUILT 2026-08-12** | — |
| ~~#387~~ | ~~D3-R1 — `money`/`compactMoney` onto the kit barrel + the compact-when-ambient / exact-when-acting rule + the no-leak scan~~ **BUILT 2026-08-12** | — |
| ~~#388~~ | ~~D3-R2 — the consequence-hint copy pass over every live control, completeness asserted by a mount scan~~ **BUILT 2026-08-12** | #386, #387 |
| ~~#389~~ | ~~D3 — plain-language labels + every empty state written + `tests/PlainLanguage.test.tsx`~~ **BUILT 2026-08-13** | #387 |
| ~~#390~~ | ~~F2-R1 — `startingCapitalBonus` + `reconJudgmentBonus` wired in `createWorld`, each pick stated on the card~~ **BUILT 2026-08-13** | — |
| ~~#391~~ | ~~F2-R1 — `grudgesFlag` becomes a starting reputation deficit~~ **BUILT 2026-08-13** | #390 |
| ~~#392~~ | ~~F2-R1 — `startingCreditLine` becomes a real borrowing facility, `src/game/CreditFacility/` (**bumps `WORLD_SNAPSHOT_VERSION` 21 → 22**)~~ **BUILT 2026-08-13** | #390 |
| ~~#393~~ | ~~F2-R1 — the facility on the Finance statement; `getStoreWorth()` nets the drawn balance~~ **BUILT 2026-08-13 — F2-R1 COMPLETE** | #392, #387 |
| ~~#394~~ | ~~F2-R2 — the failure stakes, stated once the first time cash goes low~~ **BUILT 2026-08-13 — F2 COMPLETE** | #386, #392 |
| ~~#213~~ | ~~F1 — the first-run spine coachmarks + the "What should I do?" InGameMenu entry **[rewritten in place]**~~ **BUILT 2026-08-13** | #386 |
| ~~#395~~ | ~~F1 — progressive disclosure: a teaching beat fires when its mechanic first matters~~ **BUILT 2026-08-13 — phase 12 COMPLETE** | #213 |

**Phase 11 — B4 drive-the-clock — is COMPLETE as of 2026-08-12: #381–#385 all built** (table
below), and its bite-unlock gate was RULED 2026-08-11 (`engagement-spine.md` + `gates.md`
Settled). **#381, the tracer** — the ladder, the runner, the halt, the picker and the bite-grain
Reveal. **#382** — the star budget rides the bite and what it cuts is stated. **#383** — the bite
is a placed bet: the picker states the stake and the Reveal settles it. **#384** — the overnight
interrupt channel: a moment that asks the owner a question stops the run and the Reveal names who.
**#385** — the month rung, which closed **#124** with it. Nothing under phase 11 is outstanding.

### Phase 11 — B4 drive-the-clock (sliced + filed 2026-08-11)

| # | Slice | Deps |
|---|---|---|
| ~~#381~~ | ~~**tracer** — `data/clock-bites.json` + `src/game/ClockBite/` headless multi-day runner + halt + the Home bite picker + the bite-grain Reveal~~ **BUILT 2026-08-11** | — |
| ~~#382~~ | ~~the star budget scales with the bite; what the feed leaves out is stated, not dropped~~ **BUILT 2026-08-11** | #381 |
| ~~#383~~ | ~~the bite is a bet — `PrepBet` captured at the bite's start, scored over the days that ran~~ **BUILT 2026-08-11** | #381 |
| ~~#384~~ | ~~the overnight interrupt channel — a moment that asks the owner a question stops the run~~ **BUILT 2026-08-11** | #381 |
| ~~#385~~ | ~~the month rung — GM-gated, the desks earn the silence, multi-store safe **[HITL]**, closes #124~~ **BUILT 2026-08-12 — phase 11 COMPLETE** | #381, #384 |

**Phase 5 — #74 round-1 playtest (HITL). The script is prepared, verified and HANDED OVER
as of 2026-08-06.** It now sits with the director; nothing in the repo blocks it.

**Phases 6 and 7 are COMPLETE as of 2026-08-06** — the whole #352–#362 slice landed. Both
gates were closed before a line was written (C1 2026-08-02 `staff-teeth-design.md`, A2
2026-08-03 `path-to-finished-product.md` §3 A2) and nothing in the slice reopened them.

**The next `/next` does NOT wait on the playtest.** If the director's round-1 notes have
landed (as a comment on #74 or a pasted export), the unit is triaging them per §7's Class
A/B protocol. If they have not, the unit continues the phase pointer below. A human gate is
never a reason for a session to end with nothing built.

**Phase 8 is COMPLETE as of 2026-08-07** — #180, #181 and **#286** have all landed. The live
engine now closes **28.5%** of worked ups against the 2.2% #180 measured, the early-game floor
held its shape (0.5% positive for a green operator, so the progression still has a bottom), and
the balance harness went from "bankrupts before Tier 2" to **90 of 100 seeds reaching T2** with
a median survival of the full 360 days.

**#286's bands were re-measured on 2026-08-11 and MOVED, by #379.** The store had been paid
twice for every trade-in, so those bands were partly funded by money it was never handed. The
current reading is **69 of 100 seeds reaching T2, median survival 203 days** — see the #379 log
entry for the full before/after and for why the `FAILED:` percentage *falling* is not an
improvement. **A retune against the honest cash is C2's, and is not yet done.**

**Phase 9 is COMPLETE as of 2026-08-08** — all twelve B2 slices have landed (#151, #153, #365,
#152, #366, #367, #368, #369, #370, #371, #372, #373). `docs/planning/fni-mechanics-grill-state.md`
stays a locked design; do not re-grill it.

**Phase 10 — D1 — is RE-SCOPED AND FILED as of 2026-08-08.** Its row's *"largely absorbed by 5c;
re-scope when reached"* was mostly right: the subtraction against the shipped app killed Growth's
D1 scope entirely and left People with two items and Finance with three. Five issues filed,
**#374–#378** (table below). **All five have landed as of 2026-08-11** — #378's sweep closed the
phase's own scope. The out-of-phase **#379 landed 2026-08-11** too. **#380 landed 2026-08-11 as
well — phase 10 is COMPLETE.** Nothing under it is outstanding; the pointer advanced to phase 11
on 2026-08-11.

### Phase 10 — D1 the three dashboards (re-scoped + filed 2026-08-08)

| # | Slice | Deps |
|---|---|---|
| ~~#374~~ | ~~the P&L relieves inventory at the sale — Net Income becomes what the store *earned*~~ **BUILT 2026-08-09** | — |
| ~~#375~~ | ~~**tracer** — `ProfitCenter` axis on the ledger + `getDepartmentPnL` + the Finance "Where the Gross Came From" panel~~ **BUILT 2026-08-09** | #374 |
| ~~#376~~ | ~~the P&L proper — revenue/expenses/net over time + the gross→overhead→net ladder~~ **BUILT 2026-08-11** | #375 |
| ~~#377~~ | ~~People — skill growth made visible, and what morale is costing~~ **BUILT 2026-08-11** | — |
| ~~#378~~ | ~~closing sweep — delete the dead placeholder tab surface + the stale comments~~ **BUILT 2026-08-11** | — |
| ~~#380~~ | ~~Cash on Hand + "What the Store Is Worth" — automated spending stops reading as decay~~ **BUILT 2026-08-11 — phase 10 COMPLETE** | #376 for the Finance half only |

**Filed out of phase, from #374's tracing: ~~#379~~ — BUILT 2026-08-11.** A trade-in credited
the store the full selling price in cash *and* landed the trade car free. `closeDeal` now takes
`tradeAllowance` and debits it once, as `inventoryAcquisition` so the accrual P&L does not move.
It **did** move the #286 bands, as filed — the numbers are in the log entry, and re-tuning them
back is C2's call, not this slice's.

**What the subtraction actually found** (do not re-derive it; this is the record):

- **Growth is DONE — nothing survives.** All six D1-implied panels ship (`GrowthTab.tsx:79-157`):
  demand console, market report, industry wire + subscription lanes, the #371 finance-mix panel,
  the #359 build surface, and the gate board with live verdict pills. D1's remaining Growth line
  is *"courtship/brand portfolio once T4 lands"*, which is **E1**, not this phase.
- **People had 6 of 8 shipped.** Roster + slot boards, morale meter, salary book (grade + daily
  wage + total payroll), hiring, promotion, and raise/poach prompts are all live. Missing: skill
  **growth** is invisible (the card draws `effectiveSkills` alone, never against the hire-time base
  or the per-hire cap, so a climbing rookie and a topped-out veteran look identical), and
  `getMoraleMultiplier` — which the engine reads at `createWorld.ts:977` and
  `StaffDispatch.ts:508/522` — is read by **no UI**, so the morale bar states a level and never a
  consequence. → #377.
- **Finance had the charts and the F&I detail, and was missing the statement.** Shipped: the gross
  hero, cash-vs-financed donut, the #365 product/reserve split, back-end-by-structure, expenses by
  label, PVR + PPRU + carrying cost as KPI rows, Deal History and Month-Close sub-screens. Missing:
  **per-department gross does not exist anywhere in the game and no getter can build it** (zero
  engine hits for `departmentGross|grossByDepartment|deptGross`) → #375; and the "P&L trend" is a
  trend of *gross* — Net Income alone among the four headline cards has no series
  (`financeModel.ts:322`), and `PnLSummary.totalRevenue`/`.totalExpenses` are computed on every
  read and rendered nowhere → #376.
- **#374 is the prerequisite nobody had filed.** `getPnL` is pure cash-basis
  (`Economy.ts:124`): an auction purchase is charged as an operating expense on the day of the
  buy while the unit's revenue arrives weeks later, so at T1 — where a six-space lot is bought out
  in three days — a stocking month reports a loss the store did not make. The fix is already
  half-built: `category: 'inventoryAcquisition'` (#255) exists precisely to say "cash converted
  into stock, NOT operating spend" and the P&L never acts on it. Without #374, #375's department
  panel cannot reconcile with its own Net Income — the exact defect the #365 reserve-posting note
  was written about.
- **#374 can move no calibration number, and that was checked, not assumed.** `getPnL` has four
  consumers and all four are Finance UI (`FinanceTabContainer.tsx:47-48`, `TabStackContent.tsx:136`,
  `financeModel.ts:322`, `monthResultsModel.ts:115`). `scripts/` has **zero** hits for `getPnL` or
  `netIncome`; every monitor and gate face branches on `economy.cash`, which #374 does not touch.

### Phase 9 — B2 F&I plug-in #2 (filed 2026-08-07)

| # | Slice | Deps |
|---|---|---|
| ~~#151~~ | ~~per-brand `Reputation.repFor(make)` replaces the `pickVehicle` stub — ambient, no screen (I6)~~ **BUILT 2026-08-07** | — |
| ~~#152~~ | ~~attach scales with amount financed — one per-product `loanSensitivity` (I4)~~ **BUILT 2026-08-08** | — |
| ~~#153~~ | ~~cash-buyer / must-finance traits through `resolveEffects` (I5)~~ **BUILT 2026-08-07** | — |
| ~~#365~~ | ~~**tracer** — `apr`→`buyRate` + `markupCapPts`, `computeReserve`, back gross splits into `productGross`/`reserveGross` (Q1/Q2, I1–I3)~~ **BUILT 2026-08-08** | — |
| ~~#366~~ | ~~the posture dial — three positions, slot-persisted like `tradePolicy`, **no snapshot bump** (Q5/Q6/Q9, I7)~~ **BUILT 2026-08-08** | #365 |
| ~~#367~~ | ~~deal-kill — one curve in `data/`, an over-marked deal falls through (Q3 primary, I8)~~ **BUILT 2026-08-08** | #366 |
| ~~#368~~ | ~~CSI drag — an over-marked customer publishes `reputation:satisfaction_hit` (Q3 secondary)~~ **BUILT 2026-08-08** | #365 |
| ~~#369~~ | ~~the F&I manager works the deal — `finance_structuring` frontier, `product_presentation` attach (Q2/Q5/Q10)~~ **BUILT 2026-08-08** | #367 |
| ~~#370~~ | ~~the peak meter — twin opposed bars, the crest is not the max (Q4)~~ **BUILT 2026-08-08** | #366, #367, #369 |
| ~~#371~~ | ~~the crowd's finance mix read ahead on the wire — MarketIntel lane, F&I manager is a third opener (Q7)~~ **BUILT 2026-08-08** | — |
| ~~#372~~ | ~~advertising buys a different crowd — person-archetype weights on campaigns (Q8)~~ **BUILT 2026-08-08** | — |
| ~~#373~~ | ~~the monthly F&I verdict — Reveal reactions + the PVR record (engagement spine plug-in #2)~~ **BUILT 2026-08-08 — phase 9 COMPLETE** | #365, #366, #371 |

(#151–#153 were **absorbed as filed** rather than re-filed — their bodies now carry the locked
B2 scope, EARS criteria and corrected deps. Do not file duplicates of them.)

| # | Slice | Phase |
|---|---|---|
| ~~#352~~ | ~~per-role slot table = the hiring cap; `headcountCapByTier` deleted~~ **BUILT 2026-08-05** | 7 → unblocks 6 |
| ~~#353~~ | ~~`data/staff-pay.json`, derived grade, `paidGrade`, daily payroll drain; `weeklyPayrollStub` deleted~~ **BUILT 2026-08-05** | 6 |
| ~~#354~~ | ~~People surface: grade + wage per card, total daily payroll~~ **BUILT 2026-08-05** (the skill-bar `flexDirection` defect was already dead — #347 deleted `PersonnelScreen`) | 6 |
| ~~#355~~ | ~~hire fee = multiple × daily wage; `hiringCostByTier` retired~~ **BUILT 2026-08-06** | 6 |
| ~~#356~~ | ~~raise demands (ask/answer) + `payVsMarketBonus` made real~~ **BUILT 2026-08-06** | 6 |
| ~~#357~~ | ~~rival offers on the same event family (retention + poaching, one moment)~~ **BUILT 2026-08-06 — phase 6 COMPLETE** | 6 |
| ~~#358~~ | ~~`src/game/Facility/` owns built spaces + bays, one bay truth; `baysByTier` retired~~ **BUILT 2026-08-06** | 7 |
| ~~#359~~ | ~~construction: buy capacity with cash + days, ceiling enforced, Growth build surface~~ **BUILT 2026-08-06** | 7 |
| ~~#360~~ | ~~facility score lights the dormant tier-gate `facility` face~~ **BUILT 2026-08-06** | 7 |
| ~~#361~~ | ~~lot cap governs buying ("31 of 35"), trade always lands~~ **BUILT 2026-08-06** | 7 |
| ~~#362~~ | ~~wholesale this unit — the aged-inventory release valve~~ **BUILT 2026-08-06 — phases 6 + 7 COMPLETE** | 7 |

(Phase 4 B3 closed 2026-07-22 — #176, #177, #178; #179 landed earlier in A4.)

## Blockers

- **A condition is asked on EVERY tick of its events until it is taught, so it must be cheap**
  (#395). `bite_ladder` rides `clock:day_started` and stays untaught for a whole Tier 1 career, so
  its predicate runs once per game-day forever. The first version called `availableBites(coverage)`
  — whose **default argument** is `loadClockBites()`, a `require` plus a full Zod parse of
  `data/clock-bites.json` — and that parse-per-day pushed four live-app drive suites
  (`FniPosture.reachability`, `Hints.coverage`, `App.saveFlow`, `InTabNavigation.reachability`)
  from ~13s to 29–37s and over their 30s timeout. The catalog is now parsed **once** in
  `createTeachingBeatContext` and passed in. A future condition that loads a data file, walks the
  roster deeply, or derives the lot must do the same: the context is built once, so anything
  expensive belongs in the factory rather than in the predicate.
- **A beat's TRIGGER is data and its CONDITION is code, and the split is the whole design**
  (#395). `data/teaching-beats.json` declares `events` (when to re-ask) and `when` (a condition
  id); `BEAT_CONDITIONS` in `src/app/teachingBeats.ts` holds the predicates, total over the
  `BEAT_CONDITION_IDS` union so a condition the catalog names but nobody answers does not compile.
  "When does this matter" is a design fact somebody should read in one file; "is it true of this
  store right now" is a live World read and only the composition root may make one. A beat for an
  existing condition therefore needs **no code at all**. A future session moving the event names
  into the registry is collapsing that back into one place and losing the readable half.
- **`EVENT_NAMES` is a runtime catalog with a compile-time proof, and adding an event now means
  TWO lines** (#395). `EventMap` is an interface, so `EventName` is erased and a JSON file naming
  an event had nothing to check itself against — a typo'd or renamed event was a subscription that
  silently never fired, the one failure mode of a registration table you cannot find by playing.
  `EVENT_NAMES_ARE_EXHAUSTIVE` at the foot of `events.ts` resolves to `never` (and so fails `tsc`)
  the moment the list and the map disagree in **either** direction, so the two cannot drift. It
  found five events on its first run — the ones whose names my `domain:verb` grep missed.
- **`failure_stakes` was FOLDED INTO the channel, and #394's ordering rule is now structural**
  (#395). Its raise left `useDayLoop`'s `onDayComplete` and became a declaration
  (`floor:day_complete` + `cash_first_low`). #394's rule was "raised BEFORE the bite early-return",
  pinned by comparing source positions; the beat now rides its own bus subscription, so there is no
  early return above it to step over and the source-position test was replaced by one asserting the
  handler contains **no** raise at all. Two mechanisms for one kind of moment would have been the
  alternative, and the one-at-a-time rule needs a single queue anyway.
- **`events` is an ARRAY, deliberately wider than the issue's `event`** (#395). One mechanic can
  start mattering by more than one route: a service advisor arrives by hire **or** by promotion,
  and a part can be missing on either department's line. A single name would have taught the
  annuity to the player who hired and not to the player who promoted.
- **The condition reads the ROSTER, never the payload's `roleId`** (#395), which is what makes that
  array work — one predicate answers for both routes without knowing either payload shape.
  `deal_financed` is the **one** condition that reads its payload, because whether a closed deal
  was financed is a fact about that deal and not about the store afterwards; it goes through
  `payloadField`, a structural read, rather than a cast.
- **`job_turned_away` returns `{}` unconditionally, and that is an answer rather than a gap**
  (#395). A job the shop could have done and did not IS the whole condition — there is nothing
  further to ask of the store. Inventing an always-true World read to make it look like the others
  would be ceremony. `{}` (a yes with nothing to fill) is deliberately distinct from `null` (not
  yet), and the runner branches on that difference.
- **A beat is marked taught at RAISE, not at dismissal** (#395). `isCashLow` is true every day
  once it is true at all; a mark deferred to the "Got it" press would re-raise the beat on every
  tick until the player got round to it. The cost is that a beat raised and then abandoned (app
  closed with the card up) is spent — the right trade for a teaching surface, whose failure mode is
  showing the player too much.
- **The queue is FIFO and beats never stack** (#395). Two mechanics can come due on the same day;
  they are reported in **declaration order** (the `TEACHING_BEAT_IDS` union order, which the loader
  refines the JSON against) and drained one card at a time from `beatQueue`. Order is stated once,
  in the union — not once in the union and again in the file.
- **The runner names no beat, no mechanic and no event, and a test proves it** (#395).
  `createTeachingBeatChannel` is generic over the id type, so the shipped catalog and a test's
  synthetic beats run identical code; `tests/TeachingBeats.test.tsx` scans the runner's source for
  every `TEACHING_BEAT_ID` and every `EVENT_NAME` and requires none of them. That is what "adding a
  beat needs no runner edit" means as a check rather than as a claim.
- **One card, three generic section headers, chip and accent from data** (#395). "What's
  happening / Why it matters / What you can do" are the same three questions of every beat, so a
  new beat needs four sentences and no layout. `badge` + `tone` carry the difference between a
  warning (`danger`) and a mechanic coming into reach (`info`); `tone` is bound to the kit's
  `BadgeTone` with `satisfies` at the catalog boundary, so the card never casts. Per-beat headers
  would be three more strings to review for a distinction the player never makes.
- **Nothing about #395 is persisted** (#395). The taught marks are the per-slot `teaching:<id>`
  cell #386 minted — the player's progress, not the store's — so "Show hints again" re-arms the
  beats with the hints and the spine, and `WORLD_SNAPSHOT_VERSION` stays 22. The channel is not
  built at all when `hasTaught`/`markTaught` are omitted: a beat that could never be retired would
  fire on every tick of its condition forever, which is the wrong default for a harness and the
  right one for the app.
- **A coachmark is anchored by COMPOSITION and there is no measurement code — do not add any**
  (#213). The surface that owns a region renders `spine.coachmarkFor(anchor)`'s model, so a step
  whose region is not mounted draws nothing. That is not a shortcut standing in for a "real"
  spotlight overlay: an overlay would need `measure()`, absolute positioning and a rule for what to
  do when the target is off-screen, scrolled, inside a modal or inside a `stackScreen` — four
  states this app has all four of. `tests/Onboarding.test.tsx` pins the skip **and** that the step
  was skipped rather than consumed (walk to the anchor and it is still there).
- **The spine introduces NO state, and the two completion routes are one fact each** (#213). A step
  is done because its own id is in the `teaching:<id>` cell, or because the hint named in its
  `completedBy` has retired into that same cell. `useSpine` has no `useState`/`useRef` — the test
  scans the hook's source for them — because a cursor beside the cell would be a second copy of
  "has this player stocked to match yet?". `WORLD_SNAPSHOT_VERSION` stays 22.
- **`TaughtId` is ONE id space with three catalogs feeding it** (#213). `hints.json` (a control's
  consequence line), `teaching-beats.json` (a one-shot moment), `spine-steps.json` (a first-run
  coachmark). The #394 ruling — one in-memory taught set, in `useHints` — is why `hasTaught`/
  `markTaught` were *widened* rather than a `useSpineProgress` hook added beside them. A fourth kind
  of teaching needs a catalog and a union member, and nothing else.
- **Completion is per-step; the ORDER only decides which unfinished step draws** (#213). A player
  who runs a day before stocking has run a day, and the spine does not go back and teach it. A
  future session "fixing" the out-of-order case by gating later steps on earlier ones would be
  re-teaching something the player has already done.
- **Every door to the demand console finishes step 1 — the glance, the gate strip AND the tab bar**
  (#213, found on the web drive). `changeTab` routes a Growth tab press through `openGrowth`. With
  only the glance wired, a player who used the tab bar stood on the console with an instruction on
  Home telling them to go to the console. The step is "go and read the market", never "use this
  particular control", and `tests/Onboarding.test.tsx` pins the tab-bar door explicitly.
- **The advice ladder's last rung is unconditionally true, and that is what keeps the menu entry
  alive** (#213). `nextAdviceId` reads three live World facts (`bankruptcyMonitor.isCashLow`, a live
  `buildCoverageGap`, `getLotOccupancy().spacesOpen`) and falls through to `run_the_day`. A rung
  added later goes **above** the fallback, never below it. `buildDemandEntries` exists in
  `config.ts` so the coverage question has one answer for both the console and the menu.
- **`coachmark` and `menu-advice` are `viewOnly` in `data/hints.json`, and that is a real
  classification rather than an exemption** (#213). Teaching commits the store to nothing. The #388
  coverage scan would have failed by name otherwise — which is the guard working, not a nuisance.
- **The stakes beat is TIER 1 ONLY, and that gate is honesty rather than narrowing** (#394).
  Running out at T1 ends the career; at T2 it contracts you back a tier and at T3+ it buys a
  compliance bill — and the #326 recovery beat already states both when they land. The beat's
  copy is the T1 rule, so firing it at T2 would tell an owner their career is about to end while
  the engine does something else. A future session "widening" it to every tier is shipping a false
  sentence; widening it properly means writing the other tiers' consequences, which is a different
  beat nobody has ruled on.
- **`data/hints.json` could not carry this and that is structural, not a preference** (#394).
  `HINT_IDS` is a closed union and `tests/HintCopy.test.ts` requires every declared hint's
  `control` to be a testID some surface actually renders. A stakes warning has nothing to press,
  so a `failure_stakes` hint would have needed a `places[].control` that does not exist. The beat
  catalog (`data/teaching-beats.json` + `src/ui/copy/teachingBeats.ts`, the `emptyStates` shape) is
  the second half of the same teaching cell — **not a second progress store**. #395's progressive
  disclosure adds entries here.
- **ONE in-memory taught set, in `useHints`, for both hints and beats** (#394). `hasTaught` /
  `markTaught` sit beside `hintFor` / `markUsed` and share the private `retire()`. Two sets over
  one `teaching:<id>` cell would be two copies of one fact, and "Show hints again" (`resetAll()`)
  would clear only whichever half remembered to listen. A future session adding a `useTeachingBeats`
  hook beside this one is building that disagreement.
- **This is the one copy catalog allowed to quote money, and it follows #387 rather than
  excepting it** (#394). A hint is written once against every store, so a dollar figure in one is a
  claim the player can check and find wrong — that is why `tests/PlainLanguage.test.tsx` bans `$`
  from `hints.json` and `empty-states.json`. A beat fires against ONE store's position at one
  moment and the player is about to act on it, so `{cash}` and `{reach}` are **exact**, through the
  kit's `money`. Do not "consistency-fix" this by compacting them or by banning the figure.
- **The reach clause is omitted WHOLE for a store with no headroom** (#394), never rendered about
  $0, and it reads `getFacility().available` — never a backstory id. `tests/FailureStakes.test.tsx`
  pins both halves (the composition scan asserts no `backstoryId === 'ex-banker'` branch exists).
- **The beat is raised BEFORE the bite early-return and does NOT halt the run** (#394). A warning a
  multi-day bite could skip is a warning the player who most needs it never gets — so it fires on
  the day cash first reads low even inside a week. It does not stop the clock because #384's rule
  is that a moment halts a run when it puts a *decision* in front of the owner; this one reports,
  and the card is waiting when the run ends MANAGERIAL. `tests/FailureStakes.test.tsx` pins the
  ordering by source position, because a later session moving the block below the return would
  break nothing else.
- **`warningCashFloor` is 12,500 because 10,000 crosses the same careers and buys five fewer days**
  (#394). Measured over a 100-seed naive-policy cohort, 360 days: 62/100 careers cross either
  level, median first crossing day 198 at 12,500, median **35 days of runway** to the bad end vs.
  30 at 10,000, and 8 of the 62 recovered and finished the full run. That reading — not the
  roundness of the number — is what a C2 retune should re-derive.
- **`isCashLow` / `daysBelowFloorToFail` are LIVE reads and nothing about #394 is persisted**
  (#394). No latch, no snapshot field, `WORLD_SNAPSHOT_VERSION` stays 22. Whether the store's cash
  is low is the failure model's question; whether the player has been *told* is teaching state and
  lives in the per-slot cell, nowhere near `src/game/**`.
- **The credit-line panel is a MOMENT read, and that is why it states lifetime interest rather
  than the window's** (#393). #393's scope bullet asked for "the interest paid in the selected
  window" and its own Notes asked for a reading of this moment that takes its own prop; those
  contradict, and the Notes wins — it is the #380 worth-line rule, and `interestPaidToDate` is
  what the engine exposes. What the debt cost over a *period* is the expenses-breakdown line. A
  future session "finishing" this by feeding the panel a windowed figure makes the range chips
  appear to move a limit and a balance, which is the exact confusion the moment/window split
  exists to prevent.
- **`CREDIT_INTEREST_LABEL` is the ONE pinned expense label, and the pin is not decoration**
  (#393). `groupExpenses` folds its tail into "Other" by size; a day's interest on a $50,000 line
  is ~$19 against a payroll of hundreds, so the label would be folded away in every window that
  mattered. It earns the exemption because it is the only cost on that chart the player can end
  with a button on the same screen — a cost you are asked to act on cannot be a cost the chart
  hides. Pinning a *second* label needs that same argument; "it feels important" is not it, and
  the fold is byte-identical for every other cost (`tests/CreditFacilityPanel.test.tsx` pins both
  halves).
- **The worth caption states the debt clause ALWAYS, for every store** (#393). One sentence that
  is true of a store with no line and a store with $50k standing beats two the surface picks
  between: a caption that appeared the first time the player borrowed would read as the rule
  changing, when what changed is only that a term stopped being zero. `StoreWorthInputs`
  deliberately does **not** restate `debt` — `total` already nets it and nothing formats it, so
  the field would be dead weight on the eight call sites that build one.
- **`drawSteps` lives on `getFacility()` and the fractions live in `data/`** (#393). A surface
  multiplying a limit by 0.25 would be a second place deciding how coarse borrowing is, and the
  two would drift the first time the catalog moved — the same doctrine `available` and
  `maxRepayment` already follow. Fractions rather than dollar rungs so every founder's line is
  offered at the same four steps whatever it is worth; the schema refuses a non-ascending list
  or a last rung that is not the whole line. A zero rung is dropped, because an amount `draw`
  would refuse as `invalid-amount` is not an offer.
- **A refusal is REPORTED, never observed** (#393). `onDraw`/`onRepay` return the notice string
  or `null` rather than being void handlers, because #392's refusals change nothing at all —
  there is no state change for the panel to re-read, so the sentence is the only thing that
  happened. The notice is built from the same `getFacility()` the refusal was decided from, so
  the headroom the player is told is the one the next press is judged against. A future session
  lifting this into container state is adding a second copy of a fact that lives for one tap.
- **The panel is `null` for a zero limit, and that is the app's only branch on "does this store
  have a line"** (#393). It branches on how the facility *reads*, never on how it works — the
  engine still composes, snapshots and restores identically (#392's rule). Do not "fix" the
  absent panel with an empty state: a mechanic the store does not have renders NOTHING (locked
  IA rule 3).
- **The credit facility has ONE cost rule, and the issue's Notes line describes a second one
  that was deliberately not built** (#392). The rule: every morning, the balance the day opens
  with is charged a day's interest. #392's Notes said *"a same-day draw-and-repay costs a day's
  interest and no more"* — under the shipped rule it costs **nothing**, because the balance never
  stood at a morning. Making it cost one day needs a charge levied at draw time *on top of* the
  morning charge, i.e. two rules the player must hold to predict one number, which the one-rule
  ruling forbids. Nothing is exploitable by the free intraday float: an auction unit takes two
  days to land, so there is no same-day use for borrowed cash. A future session "fixing" this is
  adding the second rule, not completing the first.
- **The ledger's category axis IS the balance-sheet axis, and `getPnL` now reads the axis rather
  than naming a member** (#392). `pnlEntries` filters `e.category === undefined`; a *categorized*
  entry moves cash and has no P&L effect. That was always what `inventoryAcquisition` meant (cash
  → stock), and `financing` is the same fact in the other direction (cash ↔ debt), so the change
  is **behaviour-identical for every entry written before #392**. A third category added next year
  needs no edit to the filter and no second exclusion list to keep in step. Adding a category for
  something that IS operating spend would silently drop it off the statement — that is the one way
  to misuse this axis.
- **`ExpenseTag` is deleted; `PostTag` carries `category` for both directions** (#392). The split
  existed only while a category could mean nothing but "cash converted into stock", and stock is
  only ever bought. A credit draw is a *receipt* that is a balance-sheet movement, so re-splitting
  the type would be two places to state one axis. `ExpenseCategory` was renamed `LedgerCategory`
  for the same reason.
- **A draw goes through `postRevenue` and a repayment through `postExpense`, and neither reaches
  the P&L** (#392). `LedgerEntry.type` is the *direction* of the cash; the category is what kind
  of movement it is. Interest is the only part that is a real cost, and it posts uncategorized on
  the `store` profit center through **`forceDebit`** — the lender is owed it whether or not the
  store can pay, so a `postExpense` throw would abort the day over the bill. A store that cannot
  cover it goes negative, which the bankruptcy machinery already reads (the #379 call).
- **The v21→v22 migration deliberately omits `limit`, and that is what makes it different from
  the #358 step** (#392). A facility's ceiling is not derivable from anything in `modules` — it
  comes off the character profile in SaveStore — but `restoreWorld` rehydrates onto a freshly
  built World that has *already* resolved it. `createDefaultCreditFacilitySnapshot()` therefore
  returns `{ schemaVersion: 1, drawn: 0, interestPaidToDate: 0 }` with **no** limit, and
  `CreditFacility.restore` reads `snap.limit ?? limit`. Materializing a synthetic `0` there would
  silently strip the facility from every banker's career saved before the module existed.
  `snapshot()` always writes the field, so only the migration path takes that branch.
- **A limit of zero is a facility that cannot be drawn, not an absent facility** (#392). One code
  path: `available` reads 0, every draw is refused `over-limit` by the same rule that governs a
  banker's, and the module is composed / snapshotted / restored identically. #393's surface must
  not add a "does this store have a facility" branch — there is no such state.
- **A draw past the limit is refused WHOLE, never clamped to the headroom** (#392). A control that
  quietly hands you less than you asked for is a second rule; `getFacility().available` and
  `.maxRepayment` are stated on the read precisely so a surface never re-derives either bound.
  `dailyInterest` is on the same read for the same reason — the previewed charge and the posted
  one come out of the one `dailyInterestOn` function.
- **#392 cannot move a pacing band until someone draws on it, and that was checked** (#392). The
  `#180` live calibration is byte-identical after the slice: 35.8% / 54.3%, closes=274,
  `costOverAsk` 1.026. The harness founder declares `startingCreditLine: 0` (the #390 rule that
  the harness measures the store, not the founder), so no automated run ever borrows.
- **The grudge moves BOTH standing scalars, and the review-only version would have been a
  fortnight's inconvenience** (#391). `reviewDriftRate` is 0.1, so the review score chases
  satisfaction at 10% a night: a deficit applied to the review alone is handed back inside two
  weeks with no play involved. Lowering satisfaction with it is what makes the climb-out real —
  the satisfaction gap decays at `satisfactionDriftRate` 0.02 and the review gap chases *it*.
  Measured: the review gap runs 10.0 → 9.7 (day 7) → 6.7 (day 30) → 2.0 (day 90), i.e. **13%
  fewer walk-ins on day 1, still 8.8% down at the end of month 1, ~2.7% by month 3.**
- **`startingStandingPenalty` is 10 because that opens the grudged store at exactly the
  demand-neutral review score** (#391). `getDailyDemand`'s `repMult` is `1 + (review - 50) ×
  0.015`, so a default 60 is a **1.15** on arrivals and the grudged 50 is a flat **1.00**: the
  town gives you no benefit of the doubt where it gives a stranger some. That reading is what the
  magnitude was picked against, and it is the one thing a C2 retune should re-derive rather than
  nudging the number blind.
- **The penalty applies at construction ONLY, which is what "starting position, not a permanent
  drag" means mechanically** (#391). `withOpeningPenalty` returns a config with two opening
  numbers moved; every rule above it — close bonus, walk penalty, overnight drift — is the one
  every founder gets. `tests/BackstoryModifiers.test.ts` drives a real month (8 closes, 2 walks a
  day, 30 nights of drift) through both stores and asserts the day's movement is identical and the
  gap only ever closes. A future session adding a multiplier keyed on the flag is building a
  second mechanic nobody ruled on.
- **That test deliberately does NOT close thirty deals in thirty days** (#391). `closedDealReviewBonus`
  is +1 and the ceiling is 100, so a straight month of closes puts the clean store on the clamp
  while the grudged one is still climbing — the assertion would then be watching `Math.min`, not
  the mechanic. Eight units and the ups that walked is both the honest T1 month and the version
  that keeps both stores off the ceiling.
- **Reputation is handed a standing, never a reason** (#391). The tunable is
  `reputation.startingStandingPenalty` — no backstory word anywhere in `src/game/Reputation/**` —
  and `createWorld` is the only place that decides it applies. That is why the #390 leak scan
  still passes with `grudgesFlag` in its `THE_MODIFIER` pattern: the flag is read at the
  composition root and nothing below it learns there was a pick.
- **The T3 CSI gate reads the same scalar and is NOT tightened by this** (#391).
  `data/tier-gate.json` asks `csi: 75` at tier 3 only, off `reputation.reviewScore`; by the time a
  career is gating on T3 the opening gap has decayed to a couple of points. A C2 pass that raises
  the penalty materially should re-check that gate rather than assume it stayed clear.
- **The founder's eye is a BANDED effect, and that is #162's model, not a weak lever** (#390).
  `data/recon-variance.json` keys `sourceReliabilityFactors` low/mid/high with boundaries at 0.50
  and 0.70, so `applyReconJudgment` (`min(1, reliability + bonus)`) changes nothing inside a band
  and a great deal across one — a repo lane at 0.40 goes low→mid, halving its minor factor and
  cutting catastrophic 2.5 → 1.0. That is why the lever is 0.15 and not 0.02, and why it is a
  **lift with a ceiling** rather than a `Math.max` floor: every configured source already sits
  above 0.15, so a floor at the bonus would have been inert. A future session "fixing" the
  banding is redesigning the recon model.
- **The eye rides `rollRecon`'s INPUT and three call sites, not one** (#390).
  `buildAcquiredVehicle` (both acquisition lanes), `rollListingRealizedRecon` (the paid
  inspection, which shares `deriveReconSeed` with the buy) and `createWorld`'s `realizedReconFor`
  (#163's UCM condition read). The UCM seam exists to target *the truth the player will realize
  on purchase* — leaving the founder's edge out of it would have the desk reading a different car
  than the one that lands on the lot. Never applied to the seed: same seed + same founder ⇒ the
  same board and the same rolls.
- **The harness founder now declares every lever at ZERO, on purpose** (#390).
  `scripts/balance-harness/runner.ts` PROFILE, `MarketEconomy.calibration` and
  `MarketEconomy.earlyGameFloor` all called themselves "balance-neutral founder" while carrying
  the ex-mechanic's real `reconJudgmentBonus: 0.15` — neutral only by accident, because nothing
  read it. Wiring the lever would have handed the bot a permanent edge and moved every pacing
  band with it. **The harness measures the store, not the founder**; measuring a specific
  founder's career is a different run that declares its own profile. Nothing calibrated moved:
  the live `#180` read is byte-identical at 35.8% / 54.3%, closes=274, `costOverAsk` 1.026.
- **`day1Modifier: {} as CharacterProfile` was a lying fixture and is now a NaN** (#390). Two
  reachability tests (Growth, Finance) declared an empty modifier behind an `as` cast; it was
  harmless while nothing read it and became `50_000 + undefined` the moment the bonus reached
  `createEconomy`. Both now declare the modifier in full. A new world fixture that omits it does
  not fail loudly at construction — it produces a NaN balance, so declare it.
- **Two modules read the backstory ID and are DECLARED, and neither reads the modifier** (#390).
  `EndCard` picks the sentence a career ends on; `SaveStore`'s persisted profile carries the id
  because a reloaded career is the same person. `tests/BackstoryModifiers.test.ts` scans all of
  `src/game/**` and names the offending file — a *fourth* module appearing there is a mechanic
  being written against the pick, which is the thing the ruling forbids. The modifier scan is
  narrower on purpose: `reconJudgmentBonus` is deliberately absent from it, because it is the one
  lever with a meaning of its own (a number added to an appraisal's reliability) and `Inventory`
  declares it as exactly that.
- **The card states all four levers, and two of them are not true until #391/#392** (#390).
  `data/backstories.json` is schemaVersion **2** — each entry now carries `effect`, the sentence
  the card reads verbatim, living in the same declaration as the lever so a retune cannot leave
  the copy behind. The Ex-Banker's `$50,000` line of credit and the Inheritor's town-with-an-
  opinion are the copy for mechanics #392 and #391 build; the flavor text already promised both
  before this slice. `tests/CharacterCreation.test.tsx` derives the dollar strings from the
  modifier, so a retune that leaves the sentence behind fails there.
- **Empty-state copy is DATA and `tests/EmptyStates.test.tsx` scans all of `src/` for it** (#389).
  `data/empty-states.json` + `src/ui/copy/` behind `parseData`, the `data/hints.json` shape exactly:
  closed id union, completeness `.refine`, plus a refine of its own that every string end in
  `.`/`!`/`?`. The leak scan matches on a 40-char fragment (cut at the first `{slot}`), so a
  component that inlines one fails **by name**. Do not quote empty-state copy in a comment.
- **The catalog is a plain read, NOT a hook — that is the difference from `useHints`** (#389). A
  hint's answer is a read of the slot's teaching cell, so it has to be injected; an empty-state
  sentence is the same for every slot, tier and day, so `emptyState(id)` is a module-level memo the
  surface calls directly. Prop-drilling fifty static strings through the composition root would be
  the ceremony of injection with none of its reason. The **kit** `EmptyState` still takes `text`
  and never reaches the catalog — presentation stays presentation.
- **Five ids are drawn from TWO places on purpose** (#389). `demand_readout` (Home's market band +
  Growth's console), `lot_no_spaces` (the Lot's sourcing block + the auction's bidding notice),
  `parts_coverage` (Service + Body Shop), `gate_trend` (Home's gate strip + Growth's gate board),
  `no_saved_games` (main menu + in-game load list). Splitting one back into two gives the player two
  wordings of one fact and two entries that can drift — the rule `data/hints.json`'s `places` array
  is built on.
- **The temperature scan judges what is RENDERED, and that is why it can be broad** (#389).
  `tests/PlainLanguage.test.tsx` strips comments, then matches copy-carrying keys/props
  (`label`/`title`/`caption`/`emptyLabel`/…) and JSX text nodes. `'hot' | 'warm' | 'cold'` as an
  internal band-id union, an object key or a palette name is untouched — the rule was never "the
  word must not appear in the file". Widening it to every string literal would flag the three
  `DEMAND_BAND` maps, whose whole job is to turn a band id into "High demand". It was proved
  against an injected probe, not trusted.
- **The `data/` half of that scan names its files, and `recon-surprise-events.json` is deliberately
  not one of them** (#389). "Engine smokes on cold start" is a mechanical event description, not a
  position on a scale. `COPY_CATALOGS` is the set whose strings are labels the player reads off a
  control or a region.
- **`PENDING-WARM` was the one temperature word actually on screen, and the field was renamed with
  it** (#389). It is `walkedIn - staffEngaged` — people who came in and have nobody working them —
  so `FloorDashboardModel.pendingWarm` is now `waiting` and the live-floor stat reads `WAITING`.
  Renaming only the label would have left the next reader of the model believing there is a
  lead-heat model behind it. There is a second `WAITING` in the SERVICE strip (cars, not people);
  the section headers are the disambiguator, the same way `AVG WAIT` already sits under SERVICE.
- **The auction's condition read stated a magnitude of nothing** (#389). "UCM Recon Read:
  $400–$1,200 (Medium)" — medium *what*. It is now "Manager's Repair Estimate … (fairly sure)": the
  confidence words name how far the manager will stand behind the number. `BARE_MAGNITUDE` in the
  plain-language test is what stops a scale end being a naked "High"/"Low" again.
- **Every chart call site outside the kit must pass `emptyLabel`, and a scan enforces it** (#389).
  `ChartEmpty` returns `null` on an absent label, so a chart without one renders a blank box on an
  empty window — which is exactly what `FinanceTab`'s headline sparkline was doing. The scan counts
  what it saw first, so it cannot pass by matching nothing.
- **Finance keeps its DMS idiom and that is a boundary, not an omission** (#389). PVR / PPRU /
  carrying cost stay as they are: the tab's charter (locked IA §1/§4) is "the backward-looking
  judgment numbers, in honest DMS idiom", and re-wording them is a charter question rather than a
  copy pass. The jargon audit fixed the labels a first-time player cannot decode with **no
  expansion anywhere on the surface** — the auction read was the one that qualified.
- **Two empty states are unreachable in the shipped composition, and that is correct** (#389). A
  People department panel renders no roster note when the store has neither desks nor people in that
  department (locked IA rule 3 — a mechanic that does not exist renders NOTHING), and
  `people_hiring_no_role` only draws in a department that is not the one being shopped, because
  `shoppingDept` falls back to the first hiring panel. `tests/EmptyStates.test.tsx` drives the
  second through the header press a player would make. Do not "fix" either by forcing a panel to
  render.

- **`data/hints.json` classifies EVERY control, and `viewOnly` is the half that carries no copy**
  (#388). A coverage scan cannot see the difference between a control that changes the store and
  one that only moves the view, so the author states it. A pressable that matches neither array
  fails `tests/Hints.coverage.test.tsx` **by name**. Do not "fix" a failure by widening a
  `viewOnly` entry into a prefix that swallows a real control — the loader's own refine already
  refuses one declared control being a prefix of another, and that refine is the reason the two
  arrays cannot quietly overlap.
- **A hint is owned by a control GROUP, and every pressable inside it belongs to that lesson**
  (#388). `controlOwns(control, testID)` — exact match, or the declared id followed by `-` — is
  the one ownership rule, shared by the runtime scan and `HintCopy`'s source scan. The consequence
  a future session must not miss: **adding a control inside an already-hinted block is deemed
  taught by that block's line.** That is the right default (it is the same teaching block) but it
  is a default, so a genuinely new decision belongs in its own group with its own line.
- **The hint draws where the decision is made, NOT on every button that reaches it** (#388). The
  wholesale line lives on the confirmation sheet, not on twelve stock rows; the auction's two live
  inside the listing modal; People's promote/fire share one region line while the raise answer
  draws on the prompt itself. A hint repeated per row is the noise retire-on-use exists to
  prevent, and "completeness" is never a reason to repeat one.
- **`places` is an ARRAY because one lesson can be reachable from two rooms** (#388). Asking price
  = the Lot's stock list + the pricing screen; `parts_policy` = Service + Body Shop. Both places
  draw the same string and using either retires both. Splitting one of these back into two ids
  gives the player the same lesson twice and gives the catalog two entries that can drift.
- **Containers take `hints: Hints` as a REQUIRED dep** (#388), so a surface cannot be composed
  without someone deciding what it teaches. Tests about the mechanic under the control pass
  `stubHints()` (`tests/helpers/hints.ts`); a test about the hints drives the real `useHints`.
  Making the dep optional would restore exactly the silence the coverage scan was built to end.
- **`HintLine` mints its own testID and there is no `testID` prop** (#388). `hint-<id>`,
  underscores as dashes, so the catalog id, the control it teaches and the rendered line all join
  on one string across twenty-odd surfaces.
- **A hint quotes NO figure, and `tests/PlainLanguage.test.tsx` enforces it** (#388). The money
  rule (#387) is "exact when the player is about to act" — and a hint cannot be exact about
  anything, because it is written once and read against every store, tier and day. A dollar
  amount in one is a claim the player can check against their own screen and find wrong; a compact
  one would be an inexact claim about money they are about to commit. That file is also the seam
  #389 extends to labels and empty states — it is the one copy-review surface, which is why
  #388's two copy criteria live there rather than beside the mount scan.
- **The three DEV instruments are declared `viewOnly` and the DEV console's contents are not**
  (#388). `playtest-flag-fab`, `playtest-guide-fab` and `admin-console-fab` are addressed to the
  director, not the player; only the console's *opener* is named, because what is behind it is not
  a player-facing control at all. A future session finding the console's buttons undeclared should
  not declare them — the scan simply never opens it.
- **The money rule has a SECOND clause, and the Finance room is what it is for** (#387).
  "Compact when ambient, exact when the player is about to act" would, read alone, compact the
  Finance headline cards — and #376's rule is that the headline Net Income and the statement's Net
  Income line **must match everywhere**. So a figure the player can check against another figure on
  the same surface counts as acting on it, and the whole Finance room stays exact except its chart
  axis ticks. A future session compacting those cards "for consistency with the HUD" is breaking
  the reconciliation the statement exists to be. The issue's *"month gross"* compact case is the
  Home gate strip and the Growth gate board, which is where the HUD actually states one.
- **The Reveal splits: compact scoreline, exact reactions** (#387). A beat names one deal or one
  standing mark, and *"beating $4.9k"* is a claim the player cannot check against the record it
  just broke. Only the match-summary scoreline — the ambient tally at the top of the feed — is
  compact. Do not "finish" this by making the feed uniform.
- **`toLocaleString` is banned outright under `src/ui/**` and `src/app/**`, not just for currency**
  (#387). Hermes ships without full `Intl`: it renders an ungrouped run of digits on iOS/Android
  while reading correctly on the web target an agent drives, so the defect is a property of the
  **grouping**, not of the dollar sign. That is why `grouped()` is on the barrel beside the two
  money formatters — the six odometers had the same bug, and an allowlist for "the non-currency
  ones" would have left them broken and made the guard permanently conditional.
  `tests/MoneyFormat.noleak.test.ts` is absolute and names the file and line; it was proved against
  an injected probe rather than trusted. **`src/game/**` is deliberately unscanned** — game logic
  may not import from `src/ui/**`, so the engine cannot reach this barrel, and consolidating the
  strings it formats itself (HistoryLog, the trade rationale, the playtest export) is a question
  about where engine-owned display copy lives, not about this rule.
- **`sourcingLean` is a standing desk order with NO control, and #396 is the fix** (found by
  #386). `data/desk-orders.json` declares it as one of three orders a named desk carries out, and
  #385 halts a multi-day bite when nobody can hold it — but `handleSetSourcingLean`
  (`useLevers.ts:167`) has zero call sites outside its own hook and nothing under `src/ui/**`
  mentions the lean. A player can be stopped mid-run by an instruction they were never able to
  give, and every store sources at `DEFAULT_SOURCING_LEAN` forever. `sourcing_lean` is therefore
  **absent from `data/hints.json`** rather than declared blind, and `tests/HintCopy.test.ts` pins
  that: every declared hint's `control` must be a testID some surface actually renders.
- **The retire fires from `useLevers`, never from the surface** (#386). "Used" means the lever
  actually changed — the hook's fact, the surface's report. One `onControlUsed` seam injected at
  the composition root, so a coachmark or a beat that calls a handler teaches exactly what a tap
  does. Moving the mark into the components would be three copies of one rule, and the fourth
  caller would forget.
- **`teaching:<id>` is NOT world state and `WORLD_SNAPSHOT_VERSION` stays 21** (#386). It records
  the *player's* progress, not the store's. `resetAll()` (re-arm, keep the cell) and `clear()`
  (wipe it, what `deleteSlot` calls) are deliberately separate methods, and the reset is per-slot —
  two careers learn independently. A corrupt cell reads as "nothing taught" rather than throwing:
  the failure mode of a teaching surface is showing the player too much, never crashing the career
  it is attached to.
- **`teachingStore()` returning `null` means every hint DRAWS** (#386). No slot selected is a real
  answer, not a failure — a hint the store cannot answer for is shown, not hidden. Using a control
  with no cell to write to is also not an error; the line simply goes for that session.
- **`HintLine` is presentation only and must not become pressable** (#386). Whether a hint is owed
  is `useHints`'s read; the surface omits the element when the answer is no. A pressable hint would
  also break the exact-pressable-count assertions the lever smoke tests carry.
- **Hint copy is DATA and `tests/HintCopy.test.ts` scans all of `src/` for it** (#386). The scan
  matches on a 40-char fragment of each catalog string, so a component that inlines one fails by
  name. Do not quote hint copy in a comment.
- **The month is the SAME runner — there is no batch mode and there must not be one** (#385).
  Thirty days through `runBite`, halting on the same seams a week does.
  `tests/ClockBite.month.test.ts` pins thirty runner-driven days against thirty hand-driven
  ones surface for surface (the #122 controller-scoped idiom, never a `snapshotWorld` re-run).
  A second "bulk" implementation is how the month grain starts behaving differently from the
  week for a reason nobody can find later — and it is why nothing calibrated moved: the live
  `#180` read is byte-identical at 35.8% / 54.3%, closes=274, `costOverAsk` 1.026.
- **The GM is the DOOR; the at-threshold desks earn the silence** (#385, #124's attribution
  claim). `resolveStoreCover` reads the GM as a presence test because a staffed GM *implies*
  the covered desks beneath it — but what makes the floor drain return `escalated: 0` is the
  UCM's `t_o_closing` / `condition_reading` clearing their act thresholds. A GM standing beside
  a green desk suppresses **nothing**: `tests/ClockBite.month.test.ts` runs the same below-floor
  up with and without a GM on the roster and the escalation count follows the desk both times.
  A future session reading the GM as the suppressor has the causation backwards.
- **The bite gate is written over a SET of stores, and trips if ANY store lacks the cover**
  (#385). `resolveStoreCovers` → `coverageAcrossStores`; one store today ⇒ the same answer as
  reading it directly, and phase 16's dealer-group layer adds members to that list rather than
  rewriting the rule. An **empty** set covers nothing — deliberately not the natural
  `every`-over-nothing answer, which reads "every store is covered" and quietly opens the month.
  `DEALERSHIP_ID` moved onto the DayLoopController barrel so the ladder and the demand slip
  cannot identify the same store by two different strings.
- **A standing desk order counts only once the dial is OFF its default** (#385). The default
  *is* "no instruction": market pricing is the honest suggestion an intake already gets, a flat
  lean expresses no preference, and Balanced makes no bet on the payment mix. So a player who
  never touched a dial is never halted, and the halt is a consequence of a choice rather than a
  tax on the ladder. Making it fire on the defaults would halt every run on day 1 forever.
- **Only levers a NAMED DESK performs are declared, and the two omissions are the rule working**
  (#385). Hours-of-op is the owner's own. The **trade policy** is a multiplier inside the
  appraisal math — in force whoever is standing at the desk — so there is no state in which it
  goes uncarried-out. Declaring either would be dead weight, the same call #384 made about a
  moment that only reports. The three that qualify: `pricingStrategy` (UCM `pricing` gate),
  `sourcingLean` (UCM `condition_reading` gate), `fniPosture` (an `f&i-manager` **presence**
  test, not a threshold).
- **The desk-order check is a READ, and the floor latch is asked FIRST** (#385).
  `checkHalt: () => biteHaltRef.current ?? deskOrderHalt?.() ?? null`. A thing that happened
  today outranks a standing condition that was already true when the run began. Being a read
  rather than a latch is also what stops a run on the day a poached manager's orders went dead,
  not only on the day they left — and it is why nothing about #385 is persisted and
  `WORLD_SNAPSHOT_VERSION` stays 21.
- **ONE dead order is stated, in declaration order** (#385). A run stops at one thing and states
  one sentence, the same rule the floor halts and the overnight channel follow. Listing the rest
  would be a report, not the moment the run stopped; fix that one, run again, the next surfaces.
- **`desk_order` is ONE halt id riding the `{subject}` slot** (#385), the #384 shape exactly.
  Cadence written once in `data/clock-bites.json`, who-could-not-do-what once in
  `data/desk-orders.json`. A fourth standing lever added next year needs a declaration and a
  line of copy — no new halt id, no runner edit, no new sentence shape.
- **The #385 web drive proved the halt and its counterfactual; the 30-day month itself was NOT
  drivable.** On the T2 dev fixture: setting the F&I posture to "More per deal" with no finance
  manager halted the week bite on day 1 with *"You have no finance manager to hold the F&I
  posture you set, so the run stopped there."*, span clause in front and the pooled feed intact;
  putting the dial back to Balanced ran the identical week the full **7 days / $24,471 gross**.
  The month rung showed locked with its stated door. A **staffed GM is `hireTier` 6 and the only
  dev fixture is Tier 2**, so an actual 30-day run is covered by `tests/ClockBite.month.test.ts`
  + `tests/ClockBite.unlock.test.ts` (real world, tier forced to 6, GM hired) rather than by the
  drive. A future session wanting to drive the top rung needs a higher-tier fixture first.
- **An overnight interrupt ends the bite AFTER the day it was raised on, not before that day
  runs** (#384). `staff:raise_requested` is published on `clock:day_started`, which fires inside
  `nextDay()` — so the store plays that day and then stops, exactly the way a floor escalation
  stops it. Halting between `nextDay()` and `floor.runDay()` would leave the run sitting on an
  open, un-played day: **not MANAGERIAL, so #381's single closing write has no state to write**,
  and the next tap would advance the clock past a day nobody played. Nothing is lost by playing
  it — a rival's `deadlineDays` is 3, so the offer is still live when the player is handed it.
  The EARS "before the next day begins" is satisfied: the day after the halting one never runs.
- **`BiteRunDeps.checkHalt` returns a `BiteHalt`, and it is the ONE seam every class of halt
  arrives through** (#384). The floor latches and the overnight channel write the same
  `biteHaltRef`, so "the first signal of a run is the one that stopped the clock" is one rule
  over both classes rather than two lists with an ordering between them. A second
  `checkInterrupt` dep would be exactly the "second list beside the floor halts" the slice was
  filed to avoid.
- **`owner_interrupt` is ONE halt id and the moment rides the `{subject}` slot** (#384). The
  halt's cadence is written once in `data/clock-bites.json` (*"{subject}, so the run stopped
  there."*, matching the other three verbatim) and who needed you once in
  `data/owner-interrupts.json`. A fifth overnight prompt built next year needs **no new halt
  id, no runner edit and no new sentence shape** — only a declaration and a line of copy.
  `haltReason(id, config, subject?)` leaves an unfilled slot literal, the industry-wire rule.
- **A moment that only REPORTS is not declared, and that is the whole registry rule** (#384).
  `facility:capacity_built` and `news:headline_published` are notable and ask nothing; they ride
  the Reveal like any other beat. The test is whether the player has a *decision*. Declaring
  them with an `asksOwner: () => false` would be dead weight; **not declaring them is the
  answer**, and `tests/OwnerInterrupt.test.ts` publishes both through a whole week to pin it.
- **`slots` returning `null` is the ONE "this is not it" answer** (#384). It covers both "this
  raise is really a poach" (the two declarations share `staff:raise_requested` and split on
  `rivalName`) and "the subject cannot be named". A halt sentence naming nobody is worse than no
  halt, so a person no longer on the roster does not stop a run. One method, no second predicate
  path.
- **The channel is a PURE READ — it answers nothing, clears nothing, publishes nothing** (#384).
  The raise stays outstanding on `StaffOrg` and the People card presents it exactly as it does
  in day-by-day play. There is no second copy of any prompt in this slice, which is why "the
  interrupted prompt is the shipped prompt" is asserted as *the bus saw only the publish the
  test made*.
- **Nothing about #384 is persisted and `WORLD_SNAPSHOT_VERSION` stays 21.** A halted bite ends
  MANAGERIAL, which is where the save already writes from; the latch lives for one synchronous
  run.
- **`Alert.alert` is DEAD on web and must never come back** (delete-a-save session, 2026-08-11).
  react-native-web ships `class Alert { static alert() {} }`. It compiles, type-checks and runs,
  and does nothing — so every confirmation routed through it was inert on the target the game is
  actually played and driven from. `useConfirm()` / `ConfirmDialog` on the kit barrel is the one
  confirmation surface; `tests/ConfirmDialog.test.tsx` scans all of `src/` for the call. A test
  that *mocks* `Alert.alert` and asserts the app called it proves nothing (that is exactly what
  `SettingsScreen.smoke` was doing while the shipped button did nothing) — drive the real dialog.
- **Every per-slot cell key is minted in `SlotStore.ts` and nowhere else** (same session).
  `snapshot:<id>` was built in `src/app/services.ts`, so `deleteSlot` could not see it and a
  deleted career left its whole weekly-snapshot window in storage, unreachable and un-deletable.
  A slot's cells are one key space: `slot:` / `checkpoint:` / `snapshot:` are wiped together, and
  a new per-slot cell goes in that file beside the delete that has to reach it. The pre-fix
  orphans in an existing save are **not** swept — same rule as the pre-#374 ledger.
- **The bite bet is READ off `days[0].prepBet`, never held in a second slot** (#383).
  `biteBetVerdictScoreline` takes the days and reads the first one's captured bet itself rather
  than accepting a bet, so no caller can hand it day four's. The per-day capture deliberately
  keeps running inside a bite — that is what feeds each day's own beat into the pooled feed — and
  a `biteBetRef` beside it would be a second copy of one fact with a way to disagree. A future
  session "finishing" this with a ref in `useDayLoop` is adding the disagreement, not the
  capture. Nothing is persisted: a bite runs synchronously and ends MANAGERIAL, so there is no
  mid-bite save, and `WORLD_SNAPSHOT_VERSION` stays 21.
- **A run whose FIRST day had no lean is not scored, even if a later day has one** (#383). The
  first non-null bet down the run is a later day's posture; adopting it would invent a wager out
  of a mid-week restock the player never placed. `days[0].prepBet?.stockedCategory` is the whole
  test.
- **The bite verdict counts DAYS the category was asked for, not units** (#383). The bet is about
  days — you wagered the lean carries N days — so a count of units would let one busy Saturday
  speak for a week the store was wrong about. The denominator is the days that RAN, which is also
  how a halted bite is scored on the M it got rather than the N it wagered.
- **The bite names the crowd with the SAME `dominantCrowdWant` rule the day uses, and `null`
  falls back** (#383). A run that named no favorite (nothing asked, or a dead tie) states the
  tracer's span scoreline rather than a verdict — a bet nobody can settle is not scored, and the
  bite must not learn a second crowd rule. Note the day grain falls back to `readCategory` on a
  dead day and the bite does **not**: a week is long enough that silence is an answer.
- **The span clause stays IN FRONT of the bite verdict** (#383). "3 of 7 days run" is what states
  that the player did not get the run they wagered on; a verdict that replaced it would report a
  bet nobody placed. The day grain replaces its scoreline with the verdict; the bite prefixes it.
- **`stakes` is DATA, optional-with-a-refine, and the day is the only bite without one** (#383).
  `ClockBitesConfigSchema` refuses a bite with `days > 1` that omits it, so a fourth rung cannot
  ship blind; the day carries none because it is watched as it happens, and a required-but-unread
  string is the dead `tagline` #378 had to delete. The picker states it verbatim and words
  nothing.
- **`matchClause` takes its window now, like `matchReaction`** (#383). It was still printing
  "nothing closed today" on the bite fallback path. Any future scoreline helper that names a
  window must take one rather than inheriting the day's default.
- **`tunables.reveal.drama.starBudget` IS GONE and must not come back** (#382). The budget lives
  on the bite in `data/clock-bites.json`, and `buildReveal` reads the **day bite's** through
  `biteStarBudget('day')` rather than keeping a constant of its own — the day is a bite. Two
  budgets is two places to disagree about the same day, which is the whole reason one was deleted
  rather than left beside the other. `tests/RevealBudget.test.ts` scans both files for the string.
  `drama.crownBudget` stays in tunables: it caps a *ranking*, not a window.
- **The star budget grows SUB-LINEARLY and the schema refuses a shrink** (#382). 5 / 9 / 14
  against 1 / 7 / 30 days. Seven days of reactions at seven times the stars is a scroll, not a
  beat; a longer bite carrying a *smaller* budget is a typo, and `ClockBitesConfigSchema` rejects
  it. **The day's 5 must not move** — it is the pre-#382 shipped number, and moving it changes the
  tracer's live reading for a reason nobody filed.
- **The leftover line is the BITE's, deliberately absent at day grain** (#382). A day's handful of
  beats through a day's budget is the feed doing its job; the statement exists because a bite
  discards multiples more. Adding it to `buildReveal` would change a day's Reveal, which #382 filed
  as identical to before the slice. It is **one line, never an expandable list** — a surface that
  can show everything is a report, not a Reveal — and it carries the bite's own span word, the same
  rule `matchReaction` learned on #381's drive.
- **A crowned record is admitted BEFORE the budget is spent, and the reservation must not
  reorder the feed** (#382). `rankDramaPool` reserves crowns and then fills the remaining budget in
  drama order, emitting the admitted set in the pool's own order. Under the *shipped* weights a
  crown already outranks any win (`recordBroken` 2 vs. a win's clamped ceiling of 2, crowns leading
  the arrival tiebreak), so the reservation cannot be observed in normal play — that is exactly why
  it exists rather than the weighting being trusted, since retuning the drama weights is C2-class
  calibration. `tests/RevealBudget.test.ts` drives it at the one limit where it bites (the #373
  month verdict, weight 2.5, is the only candidate that outscores a crown). **`drama.crownBudget`
  still caps how many crowns take slots** — the reservation guarantees the survivors of that cap,
  it does not repeal it.
- **The remainder counts what the RANKING cut, not every event of the week** (#382). Non-starworthy
  walk-offs are dropped at the eligibility gate and were never candidates; counting them would
  inflate the line into a claim the feed cannot back. The halt and match-summary reactions are not
  drama and are not counted either.
- **The DAY bite is the live floor and must never route through the runner** (#381). `Run the
  Day` is `handleNextDay`; only bites *above* the day call `runBite`. Running the day headless
  would delete the floor view and its intra-day pause/speed control — the opposite of what B4
  extends, which is the existing control *upward*. `runBite('day', …)` still works and is
  unit-tested; the app deliberately does not take that path, and the picker draws only
  `days > 1`.
- **`checkHalt` is asked AFTER the day, and the halting day counts** (#381). A bite stops at the
  first moment the store needs a human and **the bite is over** — no queued remainder, no
  auto-resume, and the module holds no state between calls to make one possible. A run that
  silently continued past the thing that interrupted it would be the bite making the player's
  decision for them. A future session "finishing" this with a resume is reversing the ruling.
- **`tierGate:month_verdict` fires unconditionally every month, so a bite crossing a month
  boundary ALWAYS halts there** (#381, `TierGate.ts:200-211`). That is the design: the month's
  grade is the moment you must look, and it is what syncs the month bite to the calendar after
  its first run. Do not "fix" it by grading only decisive verdicts.
- **The doors are in `data/clock-bites.json` and the predicates in code, joined by
  `resolveBiteCoverage` deriving from `buildManagerStatus`** (#381). It reads no act-gate
  predicate a second time. This is the #371 lesson applied: a `hasDeskManager`-style boolean
  living in code satisfied every staff door at once and had to be deleted. A second read here is
  how the button and the desk start disagreeing about who is covering what.
- **ClockBite takes no EventBus and imports no sibling** (#381). The halt signals are latched by
  the composition root because it is the only layer that knows what "a moment the player is
  needed" looks like in this app. `runBite` also does **not** check the door — `availableBites`
  is the door, the picker obeys it, and that separation is what lets the runner's tests drive a
  week with no roster.
- **A bite skips the per-day recap modal and the per-day autosave, and does ONE closing write**
  (#381). Seven recaps nobody dismissed is noise; seven `void async` writes racing for one slot
  is how the last write ends up stale. `biteCrossedSnapshotDayRef` carries whether the run owes
  the 7-day history snapshot so that cadence is not silently dropped, and the cash delta is
  accumulated across the run — a week's delta is the week's, not its last day's.
- **Per-day Reveal beats are captured AS EACH DAY CLOSES** (#381). The daily refs
  (`matchTallyRef`/`closesRef`/`walkOffsRef`/`recordsRef`/`fniVerdictRef`) are cleared *before*
  each `nextDay()`, so a runner reading only the final day would silently swallow six days of
  wins, walk-offs, crowns and month verdicts. `biteDaysRef.current != null` is the one "a bite is
  running" fact, so the day-close handler cannot disagree with the runner about the mode.
- **A one-day bite delegates straight to `buildReveal`, morning bet included** (#381). The bet at
  BITE grain is **#383's** and is deliberately not resolved by the tracer: pooling a week of
  per-day bets into one verdict is a different bet, and inventing one now would be a rule the
  player was never shown placing. The bite Reveal passes `prepBet: null`.
- **`matchReaction` takes the window it covers, and "today" is only correct at day grain**
  (#381). The pooled feed shipped a week's figure as `$47,366 gross today` on the first drive — a
  number the player can check and find wrong, which is the one thing this feed cannot do. Any
  future grain must pass its own span word rather than inheriting the default.
- **The star budget is UNCHANGED at bite grain, on purpose** (#381). A week's Reveal uses the
  same `tunables.reveal.drama.starBudget` a day does. Scaling it — and stating what the feed
  leaves out rather than dropping it silently — is **#382**, which is the seam this tracer left
  open, not an omission to patch here.
- **Nothing about the bite is persisted and `WORLD_SNAPSHOT_VERSION` stays 21** (#381). The
  picker's default is the day, every time. A remembered bite is a standing instruction to skip,
  which is the opposite of a bet you place each time. `tests/worldSnapshot.test.ts` pins it and
  `tests/BitePicker.reachability.test.tsx` scans the composition layer for a persisted bite id.
- **#381's determinism is asserted at the SEEDED CONTROLLER scope, never as a full
  `snapshotWorld` re-run** (`tests/ClockBite.determinism.test.ts`). Two fresh same-seed *worlds*
  legitimately diverge on the sales floor; two same-seed `DayLoopController`s do not. Seven
  hand-driven days and seven runner-driven days produce identical FloorSim surfaces, and the
  controller lands MANAGERIAL on both a complete and a halted run — which is what makes
  mid-bite checkpointing a thing that cannot exist rather than a thing that was skipped.
- **The store's worth is COST BASIS + cash, and `getStoreWorth()` is the one place it is
  added** (#380). `Inventory.getStockValue()` sums `purchasePrice + reconCost`, never
  `bookValueFn` — a market appraisal would move the total on a day the player did nothing,
  which is the disconnection the figure exists to remove. Swapping in market value silently
  breaks all three checkable rules (a buy leaves the total flat, a close raises it by the front
  gross, a wholesale-out lowers it by the quote's `gain`) and makes the shipped caption false.
  Move the label with the rule or leave both alone. A surface that sums its own is the failure
  the single getter prevents.
- **Facility and floorplan are UNASKED, not omitted** (#380). Facility has no dollar value in
  the engine (#358 counts built spaces) and floorplan is a daily carrying cost, not a debt
  balance. Whether a built bay is a sellable asset is a design question nobody has put; until
  it is ruled on, adding either term would be a rule the player cannot verify. The figure is
  labeled for exactly what it sums, which is what keeps it honest in the meantime.
- **Cash stays the PRIMARY figure on every surface** (#380). Every bankruptcy check, tier gate
  and career-ending face branches on `economy.cash`; a bigger worth figure beside it would be a
  lie of a different kind. The worth line is secondary by design, not by oversight.
- **`HomeDashboardInputs.cash` is GONE and must not come back** (#380). The HUD takes
  `storeWorth` and reads its headline figure *and* its "Cash on Hand" label out of the same
  `buildStoreWorth` model the worth line under it uses. Re-adding a separate `cash` input is
  how a headline starts disagreeing with the line beneath it.
- **Finance takes `storeWorth` as its own PROP, never a field on `FinanceDashboardModel`**
  (#380). Everything in that model is a reading of the selected time *window*; this is a
  reading of this *moment*. Folding it in would make the position appear to move when the range
  chips change.
- **A nav tab with no composed room THROWS, and there is no stub to fall back to** (#378).
  `composeShellTabs` (AppShell barrel) is the one binding of `loadNavTabs()` to `tabContent`.
  Re-introducing a render-time fallback — even "just for a new tab being built" — recreates the
  exact artifact this slice deleted: a dead surface that nothing fails over and that the next
  session reads as unfinished work. A sixth tab is a room wired in the composition root or it is
  a crash.
- **`NavTabDef` is `{ key, label }` — `tagline` is GONE and must not come back as data** (#378).
  It captioned the deleted stub and had no other reader; `tests/NavGating.test.tsx` pins the
  string out of `data/nav-tabs.json`. A future subtitle is a surface decision with a reader, not
  three unread strings parked in the IA file.
- **The #378 source scans match on the literal dead copy, so do not quote it** (#378).
  `tests/Composition.completeness.test.ts` fails any file under `src/` containing `StrategicTab`
  or the old "coming in a later slice" line, and any file claiming People / Finance / Growth are
  placeholders. A comment *describing* the deletion trips it — word it around the copy rather
  than exempting the scan, which is how a scan stops guarding anything.
- **The skill track keeps a SHARED 0…cap axis; the ceiling dims the tail, it does not rescale
  the bar** (#377). Rescaling each person's bar to their own limit — the literal reading of the
  issue's "the per-hire cap as the end of the track" — makes a rookie capped at 30 sitting at 30
  draw the same full bar as a veteran capped at 95 sitting at 95, and the roster panel exists to
  compare people down the page. `ProgressBar.mark` (hairline at the hire value) + `.reach`
  (scrim past the ceiling) put all three numbers on one shared axis. Do not "finish" this by
  rescaling, and do not fold `mark`/`reach` into the existing `tick` (a second *segment*, a
  different reading — they are ignored in `tick` mode).
- **A static axis draws NO growth furniture, and most axes are static** (#377). `grows` is
  `growth_counter != null`; only `pricing`, `t_o_closing` and `condition_reading` carry one in
  `data/staff-skills.json`, and all three are manager axes — so a Tier-1 salesperson's card is
  honestly all "Fixed at hire" and the growth reading first appears on a UCM. That is the data
  as filed (magnitudes are S14/#286), not a narrowed slice, and a card with no marks on it is
  not a bug.
- **The per-hire ceiling is an ENGINE read and must never be re-derived at a call site** (#377).
  The headroom rolls from `masterSeed` + the staff id inside `StaffFactory`; a surface computing
  its own would name a limit the engine does not clamp to. `NPC.perHireSkillCap` →
  `StaffOrg.getSkillGrowth(staffId)` is the one path. Nothing is stored, so a save round trip
  re-derives the same ceiling and **`WORLD_SNAPSHOT_VERSION` stays 21** — no migration.
- **The morale sentence is stated at neutral too, deliberately** (#377). An omitted line reads
  as a surface that forgot, not as "no effect", and the player cannot tell those apart by
  looking. Nothing calibrated moved and nothing could — both halves of #377 are reads of values
  the engine already computes.
- **`BarChart` clamps negatives to zero and `LineChart` does not — pick by the data's sign**
  (#376). `BarChart`'s `Math.max(0, d.value)` is deliberate; a signed series charted on it
  reads as break-even. Anything that can go below zero (a P&L, a delta, an equity position)
  uses `LineChart`, whose `signedDomain` always contains zero so the baseline is a real
  position on the axis. Consequence for #375's department bars: a negative department gross
  draws a zero-length bar with its negative `valueLabel` beside it. That is the existing
  primitive's behavior, not a #376 regression.
- **The Finance hero and the P&L trend share ONE `bucketDaily` call, deliberately** (#376).
  Two computations that agree today is how the two charts stacked on one screen start
  describing the same window on different clocks. Do not give the trend its own bucketing.
- **`dailyPnL` reads `PnLSummary.entries`, and must not become an engine call per bucket**
  (#376). Those entries *are* the set `getPnL`'s totals are computed from — accrual, with
  `inventoryAcquisition` already dropped — and each is day-stamped. A second read path is how
  a chart starts disagreeing with the Net Income printed above it.
- **The statement rounds ONCE and the residue lands on OVERHEAD, never on the total** (#376).
  A live 30-day window printed `$2,713 + $35,479 = $38,191` before this rule; each summed line
  is now the sum of the already-rounded lines above it, and `deduction = netTotal −
  departmentTotal`. Net Income is the figure stated by the headline card and by
  `getDepartmentPnL`, so it is the one that must match everywhere — a balancing line absorbing
  rounding is what a real statement does. Do not "fix" the overhead line back to
  `money(-overhead)`; it can legitimately differ by a dollar from #375's caption above it.
- **Headline sparkline series are NORMALIZED, and raw dollars is the bug that was there**
  (#376). `Sparkline` takes [0,1] samples (`clamp01`), so the pre-#376 raw-dollar series drew
  every figure over 1 at the top of the plot — a $2k day and a $6k day were the same height.
  `normalizeSeries` maps against a zero-inclusive domain, which is also what puts Net Income's
  negative days below where zero sits. A future series added to a `FinanceStat` must go
  through it. PVR still carries **no** series, for its own documented reason (undefined on a
  day with no units).
- **A delta chip requires the prior window to fit ENTIRELY inside the career** (#376).
  `financeHasPriorWindow` replaced `prior.toDay >= 1`, which let day 10's "7D" chip compare
  seven days against the three that happened and report a collapse that was only the clamp.
  A clamped prior window is a *different span*, and two different spans are not a
  period-over-period move.
- **`profitCenter` omitted means `store` OVERHEAD, and that default is load-bearing** (#375).
  It is what keeps every untagged post — pre-#375 saves, every harness, a call site somebody
  forgets — below the gross line instead of flattering a department. A future session that
  "tidies" it to throw on a missing tag, or picks a different default, silently re-attributes
  the whole existing corpus.
- **`sum(departments.gross) − overhead === netIncome` is the product, and both reads share ONE
  filter** (#375, the private `pnlEntries`). A department cut with its own entry filter is how
  four grosses start disagreeing with the Net Income printed beside them. Do not add a second
  filter, and do not add a per-department running accumulator beside the ledger — the ledger
  IS the record (the `weeklyPayrollStub` lesson, #353).
- **`overhead` is store expenses NET of store revenue** (#375), so the reconciliation stays one
  subtraction. On a **pre-#375 save it reads large and NEGATIVE** — a month of untagged revenue
  sitting on the store line (the live drive read −$35,479 over 30 days). That is the documented
  "a pre-tag ledger reads as overhead" behavior, not a bug, and it does not happen to a career
  started after this commit. Do not back-fill an old ledger.
- **Payroll is NOT departmental cost of sale, by design** (#375). Techs and advisors draw one
  aggregate daily wage in this sim, not flat rate, and StaffOrg posts it as a single line;
  splitting it needs a second wage model nobody asked for. The statement is departmental gross
  → less store overhead → net income. Allocating payroll across departments is a different
  mechanic, not "finishing" this one.
- **PARTS NOW RELIEVE ON CONSUMPTION, and before #375 they never did** — the half #374 left
  open. Orders debit cash as `inventoryAcquisition`, which the accrual P&L drops whole, so
  every part the store bought had been off the statement since #374 and Net Income was
  overstated by it. `PartsInventory.consume` posts `postCostOfSale(lot.unitCost, 'Parts used:
  <category>')` at the part's own department. A **miss relieves nothing**. `PART_PROFIT_CENTER`
  has **no default**: a new `PartCategory` without a home there is a compile error rather than a
  silent charge to overhead. `PartsInventoryDeps.economy` now requires `postCostOfSale` as well
  as `postExpense`, so a test spy must supply both.
- **The department attribution rides `DeptDispatchProfile.profitCenter`** (#375), beside the
  pricing, RNG namespace and event family a department already owns. The shared engine names
  neither department. `tests/DeptDispatch.profitCenter.test.ts` runs two profiles differing only
  in department-owned fields, so a hard-coded `'service'` inside the engine fails the body-shop
  half while every Service test still passes.
- **The ledger tag is a NAMED OBJECT (`PostTag`/`ExpenseTag`), not trailing positional args**
  (#375). `postExpense(x, 'Recon', undefined, 'sales')` was the alternative. `tagFields` OMITS
  an absent key rather than writing `undefined`, which is what keeps an untagged entry's
  snapshot byte-identical — `EconomySnapshot.schemaVersion` stays 1, `WORLD_SNAPSHOT_VERSION`
  stays **21**, and there is no migration to look for.
- **The panel OMITS an inactive department, it does not draw a zero** (#375). `active` (the
  center posted *anything* in the window) is the test, **not** `gross !== 0` — so a Tier-1
  store draws no "Body Shop" bar asserting a loss on collision work it never did, while a
  department that burned parts and billed nothing still shows its negative bar. Do not
  "simplify" the filter to a nonzero check.
- **`getPnL` is a READ of the ledger, not the ledger** (#374). It drops
  `inventoryAcquisition` entries from the totals **and** from `entries`; `snapshot().ledger`
  is still the complete record. A future test asserting an acquisition shows up in
  `getPnL().entries` is asserting the pre-#374 rule — assert it against the ledger, which is
  where the #255 category test was moved.
- **`postCostOfSale` publishes NO event, deliberately** (#374). `economy:expense_posted` means
  cash moved and Telemetry's `cashCurve` is its only consumer. Firing it from a non-cash entry
  would corrupt the one thing that event exists for. Do not "fix" the silence for consistency.
- **Only `Inventory` relieves, and only `purchasePrice`** (#374). One private
  `relieveCostOfSale`, called from `sellVehicle` and `wholesaleOut` — the two doors a unit
  leaves by. Relieving `costBasisOf` would bill recon twice (it is already operating spend on
  the day it was incurred). Trade-ins and #296 seed units are relieved too even though their
  `purchasePrice` never cost cash; that is correct, not an oversight.
- **A pre-#374 ledger is NEVER back-filled** and needs no migration (`nonCash` is optional
  inside the module's own blob, `schemaVersion` stays 1, `WORLD_SNAPSHOT_VERSION` stays 21).
  An old save's historical months read more profitable than they were, because their
  acquisitions have no matching relief. The ledger records what was posted; the rule governs
  how it is read. Synthesizing relief entries would be inventing history the store never had.
- **A trade is settled by ONE debit of the whole ALLOWANCE, not two of equity and payoff**
  (#379). The two halves the issue names — the equity the customer never hands over, and the
  lien payoff wired out — come out of the same pocket and sum to the allowance, which is also
  the number `Inventory.acquireFromTrade` books as the unit's `purchasePrice`. One number
  describes both sides, so splitting it into two ledger lines would be one economic event
  written twice, and two numbers that can disagree about what a trade cost.
- **The trade allowance is `inventoryAcquisition`, and that is what keeps net income still**
  (#379). It is cash converted into a car, exactly like an auction buy: the accrual P&L drops
  it whole and the cost returns as the `postCostOfSale` relief when that trade unit resells.
  A plain `postExpense` would have charged the store for the same car twice — once as a deal
  expense now and once as relief later — and would have shown up as a five-figure phantom loss
  on a trade-heavy month. It also lands the allowance in the Home cash-delta's "into stock"
  column, which is where it belongs.
- **It is `forceDebit`, not `postExpense`, on purpose** (#379). By the time it fires, revenue is
  posted and the unit is off the lot; the lienholder is paid whether the store can afford it or
  not. A solvency throw there would abort a deal that had already half-happened. A store that
  takes a trade it cannot cover legitimately goes negative — that is the honest outcome, and
  the bankruptcy machinery already reads `economy.cash`.
- **Revenue stays the full `agreedPrice` and must never be netted** (#379). Front gross, PVR and
  every gross reading in the game are built on the selling price. The correction is on the cash
  side only, which is exactly why it was filed apart from #374.
- **`TradeSettlement { equity, allowance }` travels to the close as one object** (#379). Two
  positional numbers that differ by the payoff is the shape the original defect lived in; the
  equity shrinks what the store *collects*, the allowance is what the store *pays*. Do not
  collapse them at the StaffDispatch seam.
- **A pre-#379 save is NEVER swept for un-offset trades** (#379). `restore` reads cash verbatim.
  Its balance is generous by the allowances it never paid, the same way a pre-#374 ledger's
  months read more profitable than they were: the ledger records what was posted, and the rule
  governs what happens from here. Synthesizing corrective debits would invent payments the store
  never made.
- **The #286 bands MOVED and must not be tuned back inside this slice** (#379). Same command,
  same 100 seeds, before → after: T2 reached **91 → 69**, median survival **360 → 203 days**,
  bankrupt **28% → 60%**, completed **59 → 16**, search score **0.4320 → 0.3218**. **The
  `FAILED:` percentage FELL, 92% → 83%, and that is not an improvement** — the median failure
  day fell with it (118 → 90) because a run that goes broke early stops accruing the miss
  streaks and forced contractions that scored the old cohort as failed. It is the same trap the
  recipe warns about, pointing the other way: read the causes, not the percentage.
- **#180 moved and #181 did not** (#379). Live calibration: positive **39.3% → 35.8%**,
  apathetic **51.7% → 54.3%**, closes **290 → 274**, trades **122 → 113** (trade rate 42.1% →
  41.2%), `costOverAsk` **1.113 → 1.026** — a store with an honest bank stocks cheaper metal.
  The #181 early-game floor is **byte-identical** (1.0% positive, closes=39): the green-operator
  run barely trades at all, so there was nothing there to be paid twice for.
- **#363 and #364 are both BUILT (2026-08-07).** The two out-of-phase live defects are closed.
- **Phase 9 is DONE — all twelve B2 slices landed.** Nothing in it is outstanding.
- **`bestFniPvr` is a MONTH mark with no volume floor, and that is not an oversight** (#373).
  `bestPvr`'s `pvrMinUnits` exists because a one-unit day's PVR is just that deal's gross, which
  `bestSingleDeal` already crowns. Nothing else in the game measures the **back end**, so a thin
  month's F&I average is the only reading of it there is. Do not add a symmetric floor "for
  consistency". An all-cash month sets it to nothing rather than to zero — `tryBreak` refuses a
  non-positive — and a month with no units crowns nothing at all.
- **The month verdict's mix read is ONE comparison and Balanced can never fail it** (#373).
  `fniPosture[].financedShareBand` asks whether the month's financed share was inside the band
  that posture is a bet on; the two failures (`too_few_financed` / `too_many_financed`) are the
  same rule from opposite ends, because reserve is earned on financed contracts and nowhere else.
  Balanced spans [0,1] deliberately — it is the posture that makes no bet on the mix. Do not
  "fix" that by giving it a band, and do not add a second situation table beside the one number.
- **The verdict's tone follows the MIX, not the money** (#373). A month can earn well and still
  have been the wrong standing bet; which crowd the dial was pointed at is the lesson the beat
  exists to teach. A future session reading a fat-but-mismatched month as a bug is reading it
  backwards.
- **#373 did NOT bump the envelope — it was `RecordsSnapshot` schemaVersion 1 → 2** (the seventh
  mark plus `monthBackGross`/`monthUnits`). Per `docs/save-migration-recipe.md` the `modules` key
  set did not change, so `WORLD_SNAPSHOT_VERSION` stays **21**, `data/fixtures/tier-2.json` was
  deliberately not re-stamped, and there is no v21→v22 migration to look for. `restore` takes the
  `AnyRecordsSnapshot` union and a v1 blob's missing mark materializes as `null` — **not** as
  `{...undefined}`, which is what the old unconditional spread would have produced and what the
  feed would then have tried to crown.
- **`resolveFniDeskPerson` is the ONE F&I desk pick and #370's rule now has three readers**
  (#373). The month verdict names the person, `resolveFniDesk` maps them to skills for the close,
  and `getFniStructuringSkill` composes their morale for the peak meter. A verdict that named a
  different manager than the one the deals ran on is exactly the drift the single pick prevents.
- **The posture reaches the composition root through TWO getters over one piece of slot state**
  (#373): `getFniPostureMarkupPts` (prices a deal) and `getFniPostureId` (names the month). Two
  rather than one that returns both, so the pricing path cannot read a label and the reporting
  path cannot read a rate. Both are read off `fniPostureIdRef`, not React state, so a month
  closing in the same tick as a dial change reports what was actually standing.
- **The month verdict is told the MORNING AFTER, by construction** (#373). `clock:month_ended`
  fires during the Next Day transition, so the verdict lands in the following day's ref — the
  same window `bestMonthGross`'s crown has always arrived in, which is why the two ride the same
  bite for free. The refs are cleared **before** `nextDay()` runs; a session that "tidies" that
  ordering silently deletes the beat.
- **Nothing calibrated moved and nothing could** (#373). The verdict is a pure read, `bestFniPvr`
  is a scoreboard entry nothing branches on, and no harness assembles a Reveal at a month close.
  `#180` still reads 39.3% / 51.7%, closes=290.
- **An advertising campaign has TWO lanes and they ride ONE clock** (#372).
  `DemandInfluenceInput.personWeights` (optional ⇒ every segment-only producer byte-identical)
  ramps on the same lag/decay as `weights`, because a campaign's two halves are one lever;
  separate clocks would let a push arrive as one crowd and settle as another. `weights` is now
  **optional too**, and `buildAdvertisingInfluence` returns an input if **either** lane pulls —
  not taste: the daily bill is read back off the *running input*, so a crowd-only campaign that
  resolved to `null` would have run free. The schema **refuses a campaign declaring neither**.
- **`CustomerPool.skewSegmentArchetypes` is the ONE place the crowd skew is applied** (#372),
  the same rule `resolveSegmentArchetypes` exists for one level down: the spawn draw and the
  #371 finance-mix projection both go through it, so the crowd the wire promises is the crowd
  that walks in. A skew that would zero every candidate returns the segment **unskewed** —
  advertising bends who walks in, it cannot close a segment the heat map still spawns, and an
  empty list would fall through to a persona that does not belong to that segment at all.
- **The person weights bend the WITHIN-segment roll only, and that is not a gap** (#372).
  `tradesperson` is 100% of `truck` and `retiree` only lives in `suv`, so a crowd skew that also
  moved the segment draw would be the vehicle lane written twice on a clock the player cannot
  see. The cross-segment half is the campaign's own `weights`; both shipped campaigns carry
  both lanes. Do not "fix" the truck segment's inertness by coupling the two lanes.
- **DemandShaper takes `personArchetypes` the way it takes `segments`** (#372) — passed in by
  `createWorld` off `SALES_ARCHETYPES`, so the module keeps no CustomerPool dep and a campaign
  cannot name a buyer the game does not spawn (unknown key ⇒ throws at campaign start). Omitted
  ⇒ the lane is closed.
- **#372 did NOT bump the snapshot.** The two person vectors are optional on the wire and a
  pre-#372 schema-3 blob restores as "this lever skews nobody", which is what it meant. There is
  no migration to look for.
- **Nothing calibrated moved and nothing could** (#372) — no harness or script runs a campaign,
  so `#180` still reads 39.3% / 51.7%, closes=290. Campaign **costs and magnitudes are
  placeholders owed to a C2-class calibration pass**, as the issue filed them.
- **`NewsAccessRead.hasDeskManager` IS GONE — a staff door names the role that opens it**
  (#371). The read carries `staffedDesks`, the roster's role ids, and
  `data/news-progression-gating.json` says which role each `kind: 'staff'` unlock needs
  (`role`, schema-required there and schema-refused on a subscription unlock). The old boolean
  satisfied *every* staff door, so the moment a second desk existed the finance-mix lane would
  have opened free for any store with a used car manager. `resolveWireAccess` hands over the
  whole roster's roles rather than an allowlist — half the rule in code and half in data is how
  the two drift. Do not re-introduce a per-desk boolean.
- **A lane's `requires` can be a LIST, and ANY one of them opens it** (#371). `lockFor` still
  returns the first shut door (all a headline row has space for); `NewsAccess.locksFor` returns
  every shut door, which is what lets the finance-mix row state both ways in. The lane is bought
  (`finance_mix_feed`) **or** hired into (`fni_desk`) — a locked row naming only the
  subscription sells a store what the hire already gives them free.
- **`finance_desk` is a wire lane with NO headlines behind it, deliberately** (#371). The
  Growth finance-mix panel reads it. What the player is allowed to *know* is one door model
  whether the answer arrives as a story or as a number; a second gate for the panel would be
  the same rule written twice. A future test that asserts every lane maps to a publishable
  `(source, reliability)` pair is asserting the wrong rule.
- **The crowd's finance mix is DERIVED in closed form, never sampled** (#371,
  `NPC/factories/CrowdMixProjection.ts`). It draws no randomness — `tests/FinanceMixRead.test.ts`
  hands it a counting `Math.random` and asserts zero calls — because a *gated* read that
  consumed a seeded stream would make a fixed seed replay differently depending on what the
  player bought (#122). `tests/NewsGating.reachability.test.tsx` runs two same-seed worlds 20
  floor days apart, one subscribed and one cold, and pins the arrival stream identical.
- **The payment traits are integrated by ENUMERATING SUBSETS, not by averaging effects**
  (#371). They are independent Bernoullis, and the two keys are different kinds of fact:
  averaging would let a partial `must-finance` chance *partly* forbid cash (it is categorical)
  and would smear the [0,1] clamp on `payment.cash_probability` (it is additive). The #153
  split has to survive the integration. Each subset goes through the same `resolveEffects`
  machinery the roll uses, so a third payment trait needs no change to the projection.
- **`creditMix` describes the FINANCED crowd, weighted by `P(finance | archetype)`** (#371).
  Credit and payment leaning correlate through the archetype — the best-credit retiree is also
  the likeliest cash buyer — so an all-comers credit mix would systematically flatter the book
  the F&I office actually writes. Do not "simplify" it to the whole crowd. The bands arrive as
  data (`{tier, minScore}` off `data/credit-tiers.json`), **not** as a classifier function: a
  classifier answers "which tier is this score", never "how much of a distribution lands here",
  and the second question is the whole read.
- **`resolveSegmentArchetypes` is on the CustomerPool barrel and is the ONE reading of
  `demandShaper.segmentArchetypes`** (#371). `createWorld`'s private map-building is gone; the
  spawn draw and the finance-mix projection both go through it. Two copies of that filter +
  normalization is how a forward read starts describing a crowd that never walks in.
- **Nothing calibrated moved and nothing could** (#371). The projection is a pure read, no
  harness opens the lane, and the only engine change outside MarketIntel is a `World` getter.
- **The peak meter measures the WHOLE DEAL against the fall-through, not the back end**
  (#370), and that correction is what makes the crest exist. Weighed on reserve alone, the
  aggressive posture is the maximum at every credit mix under the shipped numbers (+3–6% over
  Balanced at A/B, ties at C/D) — the meter would have shipped saying "always gouge". A
  contract the lender passes on costs the store the **sale** (#367 fires before
  `trade:resolved` and the customer walks), so each book sample carries
  `dealGross = frontGross + productGross` and the curve is `(dealGross + reserve) × stick`.
  With that, the shipped config reads exactly as the grill designed: peak at **Balanced** for a
  green or absent desk, sliding to **More per deal** at a `finance_structuring` around 70, and
  Balanced again for a subprime-heavy book. **Do not "simplify" the meter back to back gross.**
- **The CSI cost is reported BESIDE the money, never folded into it** (#370). A satisfaction
  point is not a dollar; inventing an exchange rate to bend the curve would be a second pricing
  rule the player can neither see nor move. `satisfactionCostPerDeal` rides the projection and
  the surface states it as its own sentence ("a cost this total does not count").
- **The meter's credit mix is the store's OWN BOOK, not a modeled crowd** (#370). #371 is what
  puts the *crowd's* finance mix on the wire; this reads the contracts already written.
  `deal:closed` gained `creditTier` and `DealRecord` gained `creditTier` + `loanAmount`, both
  optional, restored by the existing `...d` spread — **inside the module's blob, so
  `WORLD_SNAPSHOT_VERSION` did not move and there is no migration.** A record missing either
  sits outside `getFinancedBook()` rather than being patched with a guess, so a fresh store (and
  the `tier-2` fixture) reads the empty state. `amountFinanced` is the stored `loanAmount`, NOT
  `agreedPrice − downPayment` — trade equity shrinks the note too.
- **The tier is CARRIED, never inferred from `apr`** (#370). The shipped `buyRate` +
  `markupCapPts` bands happen to be disjoint, so a tier could be decoded by arithmetic today —
  and that decode would break silently on the next edit to `data/credit-tiers.json` while the
  meter went on reporting a peak. Do not "save a field" by re-deriving it.
- **`resolveDeskSkill` is now exported from the StaffDispatch barrel** (#370) and
  `World.getFniStructuringSkill()` composes it with the same person-pick `getFniDesk` uses
  (extracted in `createWorld` as the named `resolveFniDesk`). The meter must project against the
  number the next contract is judged at; a surface reading the raw roster composite would drift
  from the close exactly when the desk's morale was down. Do not re-derive either half at a UI
  call site.
- **Nothing about #370 moved a calibration number and the live bands are unchanged**
  (#180 still reads 39.3% / 51.7%, closes=290). The whole slice is a read plus two optional
  recorded fields; no harness hires an `f&i-manager` and none reads the book.
- **The two F&I frontiers have DIVERGED, and that is #369's design ruling** (the decision #368
  left open). `finance_structuring` extends the **lender's** `fniDealKill` frontier
  (`resolveSafeFrontierPts`); it deliberately does **not** move `fniCsiDrag.fairMarkupPts`,
  because a slicker structurer changes what the bank will buy, not how gouged the customer feels.
  Consequence: a sharp desk makes "More per deal" *survivable*, never *free* — the deals stop
  falling through and the satisfaction hit keeps landing. The shipped-file test still pins the two
  base numbers equal (that is the unstaffed store, where the player learns ONE line); do not read
  the divergence at a staffed desk as a drift bug, and do not couple the two "for consistency".
- **The max frontier extension is not a free number** (#369). `structuringFrontierMaxPts` 0.0075
  is exactly the reach from Balanced (0.0175) to "More per deal" (0.0250), so a reference-grade
  structurer clears the aggressive posture with zero fall-through and everything short of it pays
  a real rate. Moving `fniPosture.more-per-deal.markupPts` or `safeFrontierPts` without moving
  this changes what the top of the skill ladder buys — move them together or say which.
- **The back end runs on the F&I MANAGER once one is hired, not on the salesperson** (#369), and
  the desk arrives as ONE closure (`StaffDispatchDeps.getFniDesk`) carrying `staffId` +
  both composites. The composition root picks **one person** — the strongest `f&i-manager` by the
  role's composite, the same rule the resolver uses for salespeople — because a deal is worked by
  somebody; a per-skill maximum across the roster would staff a manager nobody hired. **The desk's
  own morale multiplies both composites.** Omitted ⇒ `null` ⇒ the salesperson presents the two
  ungated products on the flat #367 frontier. **`null` is "no finance office", not "skill 0"** —
  they coincide numerically today and are written separately so a future nonzero-at-zero extension
  cannot grant itself to a store that never hired anyone.
- **No calibration moved and none could** (#369). Nothing in `tests/` or `scripts/` hires an
  `f&i-manager`, so every harness runs with `getFniDesk` ⇒ `null`. A future calibration bot that
  *does* hire one is opting into both effects at once (attach off a different skill, and a moved
  frontier) — expect the bands to move and say so rather than reading it as a regression.
- **The premium shelf needed no gate of its own** (#369). `unlockedRoles` is already derived from
  the roster, so the four `requiredRole` products unlock with the hire that presents them. All six
  unlock together (grill Q10) and `tests/FniManagerDesk.test.ts` scans `src/ui/**` for any product
  id or menu call — a session adding a per-product switch is re-opening a closed grill and will
  fail that test.
- **A markup derived by subtraction needs `RATE_EPSILON`, and the reason is not cosmetic**
  (#368). `customerRate − buyRate` does not round-trip in binary floating point — Tier C's
  0.129 + 0.0175 comes back 1.6e-17 *over* 0.0175 — so a naive `over <= 0` test would have had
  the Balanced posture publish a ~1e-15 satisfaction hit on every financed close, silently ending
  the reproducibility of every seeded calibration run. `csiDrag.ts` guards it at 1e-9 and a test
  walks all four shipped tiers. **#367's `fallThroughProbability` does not have this bug** — it
  judges `quote.markupPts`, which is exact — and was deliberately left alone. Any future code
  that reconstructs a markup by subtraction needs the same guard.
- **`fniCsiDrag.fairMarkupPts` and `fniDealKill.safeFrontierPts` are the SAME LINE on purpose**
  (#368), pinned equal by a shipped-file test: one frontier is what the player learns to read the
  dial. They are separate keys because they are separately measured and because #369 moves the
  lender's frontier with `finance_structuring` — carrying the customer's fairness line along with
  it is a design decision to make there, not a calibration nudge. Do not collapse them into one
  constant, and do not move one alone without saying which.
- **The CSI drag is keyed on the MARKUP, never on the products** (#368, grill Q3). Attaching a
  menu is the F&I desk's job; over-marking the rate is the gouge, so a cash deal takes no drag at
  any attach. **Chargebacks are a later refinement layer on this same variable** and are
  deliberately not built — a session adding them to `fniCsiDrag` is building the next layer, not
  finishing this one.
- **The deal-kill frontier is a flat `data/` constant and #369 is the slice that moves it**
  (#367). `fallThroughProbability(markupPts, config)` reads `fniDealKill.safeFrontierPts`
  directly; extending it with the F&I manager's `finance_structuring` is grill Q5's "the peak
  slides toward aggressive" and belongs to #369, not to a helpful second parameter added early.
- **Nothing falls through at or under the frontier, and that is why no calibration moved**
  (#367). Balanced sits ON `safeFrontierPts` (0.0175) and the unstaffed `ambientMarkupPts`
  (0.0075) under it, so the whole pre-#367 harness corpus is byte-identical. A future session
  that raises `fniPosture.balanced.markupPts` past the frontier — or lowers the frontier — is
  charging every existing calibration run a fall-through rate it was never measured with. Move
  them together or not at all.
- **A subprime buyer cannot be over-marked at all, and it is emergent** (#367). Tier D's
  `markupCapPts` is 0.0100, below the frontier, so the aggressive posture clamps down to a safe
  markup on exactly the customers who have no alternative. That falls out of the existing cap
  table; do not "fix" it as an oversight.
- **The fall-through is read BEFORE `trade:resolved`, not at `closeDeal`** (#367). The guard sits
  at the head of `resolveTradeThenClose` because a trade resolving in between would materialize a
  trade unit onto the lot for a sale that never happened. There is deliberately **no unwind
  path** — nothing settles off a contract nobody bought. Consequence: a doomed deal never
  escalates a trade review, which is why `PlayerTradeDecisionResult` has no fall-through case
  while `PlayerDiscountDecisionResult` does (`{ status: 'finance_fell_through' }`, its own modal
  recap — the player closed that customer, so "customer walked" would point them at the wrong
  lever).
- **`walkOffContext`/`processContext` carry the fall-through like any late walk** (#367). It is
  a post-process walk: residual heat, follow-up eligibility, reputation hit. Do not special-case
  it out of the walk bookkeeping because the customer "agreed to buy" — they left without a car.
- **`fniReserve.balancedMarkupPts` is GONE and the desked markup lives in the `fniPosture`
  catalog** (#366). `resolveFinanceQuote` takes a named `{ deskStaffed, postureMarkupPts }`,
  and the posture reaches DealEngine as `getFniPostureMarkupPts?: () => number` — a closure
  wired in `createWorld` off `useLevers`, read live. Omitted ⇒ the catalog default ⇒ the old
  `balancedMarkupPts` number exactly, which is what keeps every pre-#366 harness byte-identical
  (#180 still reads 39.3% / 51.7%). Do not re-introduce a second desked-markup number beside
  the catalog, and do not read `ambientMarkupPts` as a posture — it is the no-desk answer and
  the dial cannot move it (grill Q2).
- **The posture is SLOT state and there is NO migration to write** (#366, grill I7 —
  contradicting the parked grill doc's own earlier note). It persists as one id via
  `persistCurrentSave`, restores in `loadActiveSlotIntoGame`, resets on New Game.
  `tests/worldSnapshot.test.ts` asserts two same-seed worlds at opposite postures snapshot
  identically, so a future session cannot add the bump "for consistency".
- **"More deals" works through the EXISTING PTI gate, not a new check** (#366, grill I3 paying
  off twice). The payment is built at the marked-up rate, so a thinner markup lowers the
  payment and more buyers qualify. Do not add a separate "posture affects close rate" term.
- **The #346 Prep test now asserts THREE levers.** That assertion exists to keep *navigation*
  out of Prep, and the locked IA calls Prep "pure pre-open policy" — a third policy lever
  (#366's Finance Office block) is what that admits. The button count moves with the levers;
  do not read a fourth policy lever as an IA violation, and do not park a nav link there.
- **The posture dial stays SELECTABLE with no F&I manager on staff** (#366). It renders the
  plain-language reason it does nothing yet instead of greying out: a store can set its
  standing posture before it has anyone to carry it out, and a dead control with no explanation
  is what the copy rule exists to prevent.
- **A queued `deleteDatabase` was left pending on the web dev-save IndexedDB (2026-08-08).**
  The `dealership` DB hit the documented "max of 3 slots reached" state; the delete was issued,
  returned `blocked`, and never completed because the app holds a connection — after which
  `indexedDB.open` hangs in that tab. The next reload will likely clear the three dev slots.
  They are regenerable from DEV · START AT TIER. Cleaner next time: delete a slot through the
  Load screen rather than dropping the database.
- **`data/credit-tiers.json`'s `apr` is GONE and `TierDefSchema` is `.strict()`** (#365). The
  key is `buyRate` — the lender's cost of money — plus `markupCapPts` per tier; the customer's
  rate is `buyRate + markup`. `.strict()` is load-bearing: a stale `apr` would otherwise be
  silently stripped and the file would look fine while reserve read zero. Do not relax it, and
  do not add lender flats (grill I2 — a flat is a second pricing rule the player can neither
  see nor move).
- **`computeMonthlyPayment(params, apr)` takes the RATE, not a `TierDef`** (#365), and
  `LoanParams` no longer carries `tier` (`StructureParams` does, for `structure()` only). The
  point is that quoting the wrong rate has to be a visible choice at the call site. Every
  payment a customer sees is built from the marked-up rate — `structure()` resolves it through
  `quoteFinance` — which is what makes the structural deal-kill free: PTI already measures the
  payment, so an over-marked deal fails the existing affordability gate with **no new check**
  (grill I3). `SalesProcess.CreditTierPolicy.apr` is the CUSTOMER's rate; feeding it `buyRate`
  is the regression `tests/SalesProcess.affordability.test.ts` now guards.
- **One quote serves both the gate and the close.** StaffDispatch and CustomerPool call
  `dealEngine.quoteFinance(tier)` once and hand the same `{ buyRate, markupPts, customerRate }`
  to affordability and to `closeDeal` — so the rate a buyer is qualified at is the rate they
  sign, by construction rather than by two call sites agreeing. `CloseDealParams.buyRate`
  omitted ⇒ equals `apr` ⇒ zero spread ⇒ no reserve, which is what leaves every pre-#365
  harness byte-identical.
- **Reserve POSTS REVENUE, and the first cut of #365 wrongly did not.** `economy.postRevenue(
  reserveGross, 'F&I: finance reserve')` fires at the close. Without it the Finance tab reported
  back gross the books never saw and the breakdown could not reconcile with its own Net Income —
  and the pacing harness measured *zero* change from the whole slice, which is the tell. Do not
  "fix" a future accounting question by removing it; the receivable lag from lender funding is
  not modeled anywhere here and inventing one for this line alone would be a second rule.
- **The desk read is a closure, not a roster reference.** `DealEngineDeps.getFniDeskStaffed?:
  () => boolean`, wired in `createWorld` off `staffOrg.currentRoster`; omitted ⇒ false ⇒
  `ambientMarkupPts`, the honest T1–T2 answer (grill Q2 — no player lever until #366). DealEngine
  must never import StaffOrg.
- **The KPI split is inside the module's blob, so there is no envelope bump** (#365, same call
  as #359/#151). `DealRecord.productGross`/`reserveGross` are optional and `restore` materializes
  them as zeroes: a pre-split deal's `backGross` stays whole and simply claims no reserve.
  `WORLD_SNAPSHOT_VERSION` did not move and there is no migration to look for.
- **The reserve bar is labelled "Rate Reserve", not "Finance Reserve".** The kit's horizontal
  `BarChart` clips its name column at ~13 characters — caught on the web drive, where the label
  rendered as "inance Reserve". The caption carries the full sentence. Check a long bar label
  against the rendered chart, not just the model test.
- **A customer's payment leaning is drawn on its OWN seeded stream, not out of `trait_pool`**
  (#153). Incidence is an optional `payment_traits` map on the person archetype
  (`seedFor('traits.payment')`). The shared-pool version was implemented first and reverted:
  at `trait_count 1..2` it makes a cash buyer *less* likely to be price-sensitive (the axes
  are orthogonal), and widening a 3-wide pool diluted the personality mix the **#94** sales
  calibration measures — its apathetic band went 10.2% → 9.7% and failed. **Do not "simplify"
  this back into `trait_pool`**, and do not add a future orthogonal axis there either; the
  separate stream is what keeps the personality draw byte-identical (#94 still reads
  85.7 / 10.2 / 4.2).
- **The #153 payment traits use TWO effect keys and that is deliberate.**
  `payment.cash_probability` is an additive shift on the visit archetype's base;
  `payment.must_finance` is categorical, and **wins when a customer carries both**. Collapsing
  them into one scalar with a dominating negative was considered and rejected — it flattens a
  leaning and a category into two sizes of one knob, and is not absolute against a customer
  who drew both. Neither trait needs an exemption from the cash-affordability gate: **that gate
  only ever pushes a customer toward finance, never away from it.**
- **#153's live-band movement is dose-dependent, so it is NOT the #151 trajectory-divergence
  signature.** Halving every incidence rate lands halfway (positive 38.7% → 36.1% → 33.3%,
  trade rate 43.3 → 41.3 → 39.3 — cash buyers trade less, and trade-incidence is keyed by
  `paymentMethod`). Rates were therefore chosen to leave the calibrated bands where they are
  rather than re-centring them: **C2 owns these magnitudes (grill I9)**, and a trait slice does
  not get to move the store's close rate 5pp on its way past. Final read: positive 35.8%,
  apathetic 54.3%, both inside their current windows, nothing re-centred.
- **Three walk-driven magnitudes were retuned by #363 and the small numbers are deliberate.**
  `walkSatisfactionPenalty` −1 → **−0.12**, `walkPressure` 0.5 → **0.05**, `angerPressure`
  2.0 → **0.4**. All three had been set against a producer that never fired; the live floor
  walks ~88% of its ups, so at the old values one career drove a competently-run store's
  satisfaction 70 → 12.5 and **pinned regulatory pressure at 80 — the AG threshold, terminal
  at Tier 1**. Do not read the magnitudes as timidity: `walkSatisfactionPenalty` is charged
  ~2.6 times a day, every day. Full reasoning + measurements in the log entry below and in
  `src/game/Reputation/CLAUDE.md`.
- **Phase 5c is DONE — the whole UI-layout rebuild landed 2026-08-02** (#346 Operations, #347
  People, #348 nav stacks, #349 Growth, #350 chart kit, #351 Finance). Every defect in
  `docs/audits/ui-layout-audit.md` is closed out: no placeholder tabs, no dead Operations
  destinations, and walking into a room no longer unmounts the console. **Do not re-grill the
  IA** — `docs/planning/second-level-ia.md` (locked 2026-06-12) stays authoritative; where
  shipped and locked disagree, locked wins.
- **The round-1 script was REFRESHED against the shipped app on 2026-08-06 and is now
  accurate — do not re-walk it from the pre-5c version.** Every navigation path in the old
  script had drifted: hiring moved to **People → Hiring**, the auction is entered from
  **Operations → Lot → Go to the Auction**, and the demand readout / market report / wire all
  moved off Home into **Growth** (Home keeps a Market *glance* that routes there). The known-
  dark list still claimed Finance and Growth were placeholder tabs. Both halves were rewritten
  together — `docs/planning/playtest-round-1.md` and `data/playtest-script.json`, which is what
  the phone actually renders — and the card was re-read in the running app.
- **The script now also measures phases 6 + 7, which did not exist when it was written**:
  wages and the signing fee on the Day 0 hire, payroll on the Day 3 second hire, the six-space
  lot cap on the Day 2 buy, the wholesale quote on Day 4 and the valve on Day 5, and a roster
  sweep for raise asks / rival offers (which sit on a person's card and never interrupt — that
  is deliberate, and whether the player *finds* them is a round-1 question, not a defect to
  pre-emptively fix). The observation sheet is 14 questions, not 12.
- **Both staff gates are ruled — no decision stands in front of the next build.** `/decide C1`
  2026-08-02, `/decide A2` 2026-08-03. A2's rejected alternatives (overflow lot, forced
  wholesale, refused trades, soft cap, prep-as-its-own-capacity) are recorded **with reasons**
  in §3 A2 — do not reopen them, and in particular do not re-propose an overflow lot, which the
  director raised and then withdrew on inspection.
- **#353 and #354 ARE verified on web (2026-08-06) — their log entries' "web drive was
  impossible" lines are superseded.** The blocker was never the app: `left_click` delivers
  `pointerdown` and then hangs, flushing `pointerup` only on the *next* `computer` call, so a
  single click leaves the press half-finished. **Issue every click twice**; both report a
  30s timeout, and the UI responds. The full path drives fine — start menu → T2 fixture →
  tabs → floor sim → day close → recap modal → Finance. Written up in `.claude/skills/verify`;
  do not file another BLOCKED verdict against the pane without trying the double-click.
  **Update, later the same day (#356): single clicks worked, returning immediately with no
  timeout.** So the double-click is a *fallback*, not a standing rule — click once, read the
  page, and only re-issue if nothing moved. And when a press seems dead, check the console
  before the app: three "dead" T2 presses were really `Cannot create slot: max of 3 slots
  reached` from earlier sessions. Clear it by deleting the `dealership` IndexedDB — which
  needs a page reload first, since an open connection blocks the delete.
- **A hidden Browser pane makes measuring charts unverifiable, and it looks exactly like a bug.**
  No `ResizeObserver` and no `requestAnimationFrame` fire, so react-native-web's `onLayout` never
  runs, `useChartWidth` stays 0, and `BarChart`/`Sparkline` collapse to an empty 0-height div.
  `DonutChart` still paints (explicit `size`, never measures) — that contrast is the fastest
  tell. Probe + guidance are in `.claude/skills/verify`; do not report a measured chart broken
  without running it.
- **#352 is built — `data/staff-slots.json` is now the ONE ceiling in the game.** `headcountCapByTier`
  is gone from the JSON and the schema; `staffOrg.headcountCap` survives only as the *derived* sum of
  the tier's role slots. Every wage slice from here sits on `getSlots`/`getSlotBoard`. The table is
  monotonic and the schema **refuses a file that decreases**, so the CSV's T4/T5 `f&i-manager` omission
  cannot be re-introduced as a removal. Do not add a second cap beside it.
- **The Tier-2 dev fixture holds a UCM, whose desk does not open until T3** — the slot board reads it
  honestly as "1 of 0". That state predates #352 (the flat cap allowed 8 bodies at T2 regardless of
  role) and is unreachable in real play, since `hireTier` gates the UCM at T3 and no tier takes a desk
  away. It is a stale fixture, not a live bug; over-capacity displays plainly and blocks further
  hiring, which is the same grammar A2 R2 gives the lot cap ("36 of 35").
- **5a issue states on GitHub are not trustworthy.** #334 was CLOSED-but-undone. Check each
  of #335–#339 against the repo before assuming it landed. (#339 is closed as **sliced**, not
  built — its work was #343/#344/#345, all three now built.)
- **The seeded-RNG separator is a NUL byte, and it is invisible.** `deriveSeed` joins namespace
  and ctx with U+0000. #342 nearly shipped a whole-game determinism break by retyping that line
  with a space. `tests/Rng.test.ts` carries the regression lock that caught it — never weaken it.
- **Staff have TWO grades and they are not interchangeable** (#353). `grade` is derived live
  from the **grown** `effectiveSkills` and climbs; `paidGrade` is stored on `Staff`, stamped at
  hire, and is what the wage is computed from. Every wage number the player sees or the ledger
  charges comes from `paidGrade`. Reading the current grade to price someone is the rejected
  "wage auto-follows grade" and silently kills #356's raise trigger.
- **Both staff prices now come out of `data/staff-pay.json` and nowhere else** (#355). The hire
  fee is `hireFeeMultiple × that candidate's daily wage`; `staffOrg.hiringCostByTier` is gone from
  the JSON and the zod schema. `CandidateListing.hiringCost` keeps its name but is per **person**,
  not per role tier — do not re-introduce a second price table beside the wage book, and do not
  read the name as "the role's price". Consequence for tests: the `noPay()` helper now makes hires
  **free**, so any suite asserting that a hire costs something must pass a real wage table
  (`wageSetup` in `tests/StaffOrg.test.ts`).
- **The wage a member is paid is now STORED, not derived** (#357). `Staff.paidWage` is what the
  drain charges; `paidGrade` records the grade it was agreed at and still drives the raise
  trigger. They can legitimately disagree — a matched rival offer pays *above* the grade's book
  wage — so never "fix" a card by re-deriving the wage from `paidGrade`. Consequence for tests:
  a helper that drops someone's `paidGrade` to fake an outgrown rookie **must clear `paidWage`
  too** (`payAtGrade` in `tests/StaffOrg.test.ts` does), or restore keeps the old money and the
  ask is correctly suppressed.
- **`staff:quit` has TWO publishers since #357** — StaffMorale's threshold check and StaffOrg's
  declined/expired rival offer. StaffOrg's own subscriber removes them from the roster either
  way; that is the single departure path and there must not be a second. The payload's `morale`
  is optional (absent on a poach) and `name` is required, because HistoryLog records a person.
- **Do not add a "poachable" floor or a "recently poached" flag.** Target selection is one rule
  — the daily chance scales with grade — and the two suppressions are the absence of a decision
  (an open prompt, or an offer that does not beat current pay). Both were considered and are
  deliberately not there.
- **`flatPay`/`noPay` are FLAT across grades, so no test built on them ever raises a demand**
  (#356). The ask is suppressed when the asked wage does not actually beat the paid one — a
  prompt whose two buttons cost the same is a decision with nothing in it. A suite that wants
  to exercise a raise must pass a table with a real wage curve (`WAGE_TABLE` /
  `TOP_GRADE_TABLE` in `tests/StaffOrg.test.ts`).
- **`payVsMarketBonus` is GONE and the two replacements are sign-checked by schema** (#356):
  `paidAtMarketBonus` must be positive, `paidBelowMarketPenalty` negative (same for
  `raiseAcceptedBonus`/`raiseRefusedPenalty`). A positive penalty would mean underpaying
  cheers people up and would read as balance rather than a dropped minus sign. StaffMorale
  reads the comparison off `StaffOrg.getPayBoard().askingWage` — never re-derive it there.
- **A refusal has no quit path of its own.** It lowers morale and the standing overnight
  risk check takes it from there. Do not add a "quits because refused" branch — the one the
  design ruled on is the existing `StaffMorale` → `staff:quit`.
- **The #352–#362 issues can name files 5c deleted.** #354 was filed against
  `src/ui/PersonnelScreen/PersonnelScreen.tsx:22` and a `flexDirection` defect in it; #347 had
  already deleted that whole screen and the kit `ProgressBar` that replaced it sizes fills by
  **percentage width**, so the defect was gone. The slice was written off
  `docs/audits/ui-layout-audit.md`, which predates the rebuild. **Check a named `file:line`
  against the repo before treating it as live** — and never re-create a deleted defect to
  satisfy the letter of a criterion. Assert the criterion against the surface that actually
  ships.
- **The RN-Testing-Library suites (`App.saveFlow`, `InTabNavigation.reachability`) flake under
  full-suite CPU load.** Two `waitFor` assertions failed on one `npm test` run and a *different*
  one failed on the next; all pass in isolation three times over and the full suite is green on
  a re-run. Timing, not a regression — re-run before investigating, and do not "fix" them by
  loosening what they assert.

- **Construction jobs live INSIDE the `facility` blob, and that was not an envelope bump**
  (#359). `FacilitySnapshot` went `schemaVersion` 1 → 2 (`built` + `jobs` + `jobSeq`);
  `restore` takes the `AnyFacilitySnapshot` union and a #358 v1 blob restores as "nothing
  being built". `WORLD_SNAPSHOT_VERSION` stays **21**, `data/fixtures/tier-2.json` was
  deliberately **not** re-stamped, and there is no v21→v22 migration to look for. Do not add
  one.
- **`FacilityCeilingSchema`/`loadFacilityCeilings`/`FacilityCeilingTable` are RENAMED** to
  `FacilityDataSchema`/`loadFacilityData`/`FacilityDataTable` (#359), and `FacilityDeps.ceilings`
  is now `FacilityDeps.data` — the file holds construction prices as well as ceilings, so the
  old name was a lie. `createFacility` now requires `bus`, `economy` and `getCurrentDay`; suites
  that only READ capacity take `readOnlyFacility(() => tier)` from `tests/helpers/facility.ts`.
- **A block is the size of one job, not a divisor** (#359). `blockSize` is clamped down to the
  room left under the ceiling and priced for what it actually builds (5 against a gap of 4
  builds 4 for 4× the unit cost). That is what makes the ceiling exactly reachable with ONE
  pricing rule; do not add a prorated or full-price "last block" special case. The ceiling is
  measured against built **plus in flight**, so the same space cannot be bought twice.
- **A fresh world at any tier is already AT its ceilings, so every Build button is disabled**
  (#358 seeds built = ceiling). Room to build only exists after a tier-up, which is the whole
  point of A2 R1. To exercise construction on web you must stand the store below its ceiling —
  edit `built` in the saved `facility` blob and reload, the way the #359 drive did. This is not
  a bug, and "the build surface does nothing" on a fresh save is the expected reading.

- **Built capacity CARRIES OVER on tier-up, and that is a real behavior change** (#358). A
  fresh world seeds at its tier's ceilings, so nothing about a new game moved; but a store
  that tier-ups keeps the bays it had, and the ceiling is all that rises. That is A2 R1
  ("buildings are bought") and it is what makes #360's `facility` gate face measurable at all
  — do not "fix" a Tier-3 world showing 0 body bays by granting capacity at tier-up. **A test
  that fakes a tier by forcing `tierManager` must also call
  `world.facility.restore(createDefaultFacilitySnapshot(tier))`** — the same shape a tier-N
  save carries. Two suites already do (`AdvisorHiring.reachability`, `CrossDepartmentPersistence`).
- **`baysByTier` is GONE from both dispatch configs and from `data/tunables.json`** (#358). The
  engines take a `bays` **count** (`DeptDispatchDeps`), fed per-day by each department package
  from `facility.getBuilt()`. Omitted ⇒ 1 bay. Do not re-introduce a per-tier bay table beside
  the Facility module, and do not read the tier for a bay count anywhere.
- **`facility:capacity_built` is the module's ONE event** (#359, superseding #358's "no bus"
  note). It fires from `clock:day_started` when a job lands, carrying the kind's new TOTAL in
  `built` and the delta in `units`. There is deliberately no `construction_started` event —
  it would have a publisher and no subscriber, which is the dead code this repo deletes.

- **The `facility` gate face is NO LONGER DORMANT, and every "skip stepped" filter is gone**
  (#360). `TierGate`'s `computeVerdict` and `getTierRequirements` used to filter
  `kind !== 'stepped'`; both now filter only on "is a configured face" (which is what keeps
  the `streak` control tunable out). A stepped face is read **live** off `signals[id]`, never
  sampled — there is no `levelSamples.facility`/`trendSamples.facility` and nothing about it
  in the snapshot. Do not add nightly sampling to make it "consistent" with cash/CSI: a
  monthly average would report a bar the store has already cleared as still short, and would
  make the same construction worth more early in the month than late.
- **The facility score is a MEAN OF PER-KIND RATIOS, not a combined total** (#360,
  `Facility.getFacilityScore`). Built ÷ ceiling per kind, averaged over the kinds the tier has
  a ceiling for, each capped at 1. A combined built÷ceiling would let the lot (35 spaces at T3
  against 6 service bays) buy the whole score while the shop ran on one bay. A kind with a 0
  ceiling is **excluded**, not scored 0 — that is why a fully built-out T1/T2 store reads 100
  despite having no body bays, and why arriving at T3 *drops* the score.
- **The face label is "Facility Build-Out", not the old "Facility / Image"** (#360,
  `data/tier-gate.json`). The image half was re-homed onto the T4+ OEM stream by
  goals-targets decision 4 and is not what this face measures; the old label only survived
  because the face was invisible. Renaming it is the plain-language rule, not a design change.
- **A T3 world is where this face exists at all** — `data/tier-gate.json` lights `facility`
  only at tier 3. To see it on web, edit `slot:<id>` (NOT `snapshot:<id>` — the live save the
  app loads is the slot record) and set `modules.tierManager.currentTier` to 3.

- **Buying cars is capped now, and any test that bulk-buys the board will fail** (#361). Four
  suites did — `Composition.completeness`, `DemandShaper.reachability`, `Reveal.reachability`,
  `MatchPayoff.reachability` — all with "buy every affordable listing" loops written when the
  lot was unlimited. The fix is one line, `if (world.inventory.getLotOccupancy().atCapacity)
  break;`, not a bigger lot: a **tier-1 lot holds six cars and the #296 seed already parks
  three of them**, so a green world can buy exactly three. Do not "fix" a new failure of this
  shape by raising a ceiling.
- **`Inventory` gained ONE new read and ONE new dep, and neither has a second copy** (#361).
  `getLotOccupancy()` → `{ occupied, built, spacesOpen, atCapacity }` is the only place the
  rule lives; both surfaces state it and neither counts its own list. Built spaces arrive
  through `getBuiltLotSpaces?: () => number`, wired to `facility.getBuilt().lotSpaces` — the
  same closure idiom as the bay seam, read live so finished construction reopens the lane by
  itself. **Omitted ⇒ uncapped**, which is what keeps the pre-#361 harnesses honest; a
  0-default would have silently frozen every test world.
- **`occupied >= built` is the freeze, so "back at the cap" is still frozen.** A trade always
  lands and can put the lot at 7 of 6; selling one leaves 6 of 6, which still refuses a buy.
  The rule is "back **under**", not "no longer over" — a test asserting the lane reopens after
  one sale is asserting the wrong rule.
- **A car in prep occupies a space.** Recon is a cost, not a place, and the #295 frontline hold
  only governs whether walk-ins can be *shown* the car. No off-lot state was invented and none
  should be — prep-as-its-own-capacity is one of A2 R2's five recorded rejections, along with
  forced wholesale, the overflow lot, refusing the trade, and a soft cap with a fee.

- **`inventory:vehicle_sold` now means A PERSON BOUGHT THIS CAR, and only that** (#362). A
  wholesale-out publishes `inventory:vehicle_wholesaled` instead — **including the #162
  recon-abandon path**, which used to publish `vehicle_sold` and was therefore feeding
  MarketEconomy a wholesale dump as a *retail comp* (dragging the segment's price index down)
  and staging the wholesaler in InstalledBase as a future owner. The abandon path keeps its
  own price rule (`book − reconSpentToDate`); only which event it is changed. A suite
  asserting `vehicle_sold` on an abandon is asserting the old lie —
  `tests/Inventory.recon.test.ts` was updated and now asserts **zero** `vehicle_sold` there.
- **Wholesale proceeds come off BOOK, never off `askingPrice`** (#362), and there is exactly
  one place the rule lives: `Inventory.getWholesaleQuote()`. The Lot room states that quote
  and never re-derives a price or subtracts its own cost basis. The quote is a **pure read** —
  nothing leaves the lot and no money moves until `wholesaleVehicle()` — which is what lets
  the confirmation sheet show proceeds and the realized loss *before* it commits.
- **There is deliberately no gate on recon status or the frontline hold for wholesaling**
  (#362). Both describe a car already sitting on the lot burning money, and the units the
  player most wants to dump are exactly the ones they regret. Do not add "you can't dump a
  car mid-recon" — that is a second ceiling for a mechanic whose whole point is one rule.
  This is also **not** the rejected "forced wholesale on overrun" (A2 R2): the player picks
  the unit and sees the number.

- **#286 closed the #180 gap: `live` positive is now 28.5%, not 2.2%** — and the cause was
  NOT what #180 suspected. Willingness-to-pay already sat ~6% *above* the ask and the quadrant
  was accepting 58% of worked ups. The store's **cost basis sat above its own asking price**
  (`floor/ask` = 1.32), so the deal was dead on price before the customer formed an opinion.
  Four terms, each a mis-model rather than a number needing a nudge: recon was a flat dollar
  figure per condition (half the value of a cheap rough unit) → now `conditionTiers[*].reconPct`;
  the auction lane centred at book with a 1.20 ceiling (you could pay 20% OVER book at a
  wholesale auction) → now 0.85, matching the wholesale haircut the same module already pays
  out; the retail markup was thinner than the basis → +0.10; and a wholesale comp was measured
  against the bare anchor, so once the lane moved below book every purchase drifted the segment
  down. Full write-up: `docs/planning/pricing-demand-spine.md` §6.
- **The residual gap to `reference` (85%) is the Value meter, not price.** A six-space lot
  yields a best-of-six match (Value ≈ 0.60) against #94's perfect one (≈ 0.85), and Value
  dominates `objectiveDeal`. Closing it is a stocking-capacity question — the tier ladder —
  **not another pricing knob**. Do not re-open the price model chasing the last 55 points.
- **Centering the auction below book alone was tried and reverted in #180 and that finding
  still stands** — `meanMultiplier` 0.85 on its own moved the close rate ~0.4pp, because recon
  was eating the spread. It is one of three terms, never the fix by itself.
- **Both calibration bots now run the #362 release valve, and that is load-bearing** (#286).
  Without it the harness measures a store that *cannot restock*: a unit nobody will buy holds
  one of six spaces forever, mean lot age climbed to 123 days and the close rate halved twice
  over (62% → 22%). Same class of correction as the standing float top-up — the bot has to make
  the standing decisions an operator makes. Do not read a future age-driven collapse as an
  economy regression before checking the bot still disposes.
- **`no_fit` is 71% and that is recorded as real tier-1 scarcity, not a stocking bug** (#286).
  The lot is measurably FULL (6.01 of 6 spaces, 5.0 past the frontline hold) and still cannot
  match 7 of 10 walk-ins — six cars is a thin draw against six SPACED axes plus an affordability
  gate. It rose from 51% because cars now actually sell (composition churns instead of
  presenting the same frozen six) and the ask is 10 points higher. **`pickVehicleForMatch`
  filters on affordability BEFORE fit, so a customer priced out reads as `no_fit` rather than
  as a price walk** — worth surfacing separately one day, and the reason markup was not raised
  further (+0.10 is the measured peak of total cars sold; past it the close band keeps improving
  while the store sells fewer cars).
- **The balance harness no longer bankrupts before Tier 2** (#286, supersedes the standing
  "expected, don't investigate" note). `npm run balance -- pacing`: 90 of 100 seeds advance to
  T2, median survival 360 days, bankruptcy 19%. The new pacing miss is the opposite one — **T1
  now clears in a median 1.0 month against a 2.0-month target** (status OUT). That is a
  tier-gate calibration question, not a pricing one.
- **`customer:resolved` now covers walks too, and CustomerPool is still its only publisher**
  (#363, superseding #180's "subscribe `staff:auto_resolved` when reading outcomes" note for
  the *resolution* question). Three drivers reach it — `deal:closed`, `staff:auto_resolved`
  with `outcome: 'no_sale'`, and `dispatch`. Do not add a fourth publisher in another module:
  the session lifecycle and the terminal-stage guard that stops one customer resolving twice
  both live in `CustomerPool`. `staff:auto_resolved` remains the right subscription for the
  *close-quality* fields it uniquely carries (`brand`, `badReview`, `matchQuality`).
- **`SalesProcess.residualHeat` is the ONE definition of walk warmth** (#180). It was
  hand-copied between `CustomerPool` and the #94 harness; the weights now live in
  `data/sales-process.json` `heat` and must sum to 1 (schema-refused otherwise). Do not
  re-derive the formula at a call site — that duplication is what let the two drift.
- **A green operator's floor is a QUALITY floor, not a volume floor** (#181). The green solo
  profile (0.35/0.40) closes 3.0% of worked ups against the competent 0.75/0.75 operator's
  2.4% — but **every one of those closes is a low-trust forced close** (0.0% positive against
  `live`'s 2.2%), and `trust_collapse` walks go 17 → 115. Do not "fix" a future #181 failure
  by expecting green to sell *less*; the axis skill moves here is whether the customer leaves
  happy. `data/market-calibration.json#earlyGame` states its two margins as **distances** from
  `live`/`reference`, and a schema refine enforces the whole band sits under
  `live.positiveMin − marginBelowLive` — so #286 cannot raise `live` without moving the floor.
- **#286 gave the recon bands a real denominator** (superseding #181's "acquisitions are
  starved" note). A green six-space lot turned 9 units in the window before and turns **43**
  now, with 29 completed recons and the tail actually firing (1 hit, 2.3%). The tail *rate*
  stays a documented ceiling guard; `reconOverrunMin/Max` (mean realized ÷ estimated recon) is
  still the band with power — 1.072× measured against the ~1.061 `data/recon-variance.json`
  implies. Do not tighten the tail rate to look precise.
- **Two customers can be held on the SAME unit** (#181 → **#364**, FIXED 2026-08-07). Nothing
  reserves a vehicle while a `trade:escalated` / `discount:escalated` review is pending, and
  nothing should — the first resolution drives the car off the lot and the second customer now
  **walks** (`vehicle_sold_to_other`) instead of dying on `No lot vehicle` inside
  `DealEngine.closeDeal`. Both harnesses have dropped the `try/catch` +
  `escalationsLostToSoldUnit` tally they carried as the workaround.
- **The #180 harness deliberately capitalizes its bot** (`BOT.floatFloor`/`floatTopUp`). At a
  2% close rate the store goes insolvent long before 600 worked ups, which would silently
  shrink N and make the bands move whenever calibration changed. Solvency + pacing are the
  balance harness's job (`scripts/balance-harness/`), not this test's. It also pins the
  salesperson's **base** skills to 0.75/0.75 (derived from the catalog's caps, not hardcoded)
  while leaving morale free to drift — the drift is the emergent variance under test.

- **ANY new term in the `pickVehicleFor` argmax re-routes the whole #180 seeded run, and its
  size is not what does it** (#151). Adding per-brand reputation moved the live band 28.5% →
  39.0% positive / 64.5% → 51.7% apathetic / 213 → 290 closes — and `matchWeight` **0.05 and
  0.15 shift it by the same amount in the same direction** while **0.001 reproduces the
  pre-#151 run exactly**, because at that size the term never flips a near-tie. So a moved
  band here is evidence of trajectory divergence, not of a strength or balance regression, and
  **this harness cannot be used to choose a match weight** — a C2-class pass owns those
  magnitudes. The apathetic band was re-centred on the new measurement at its old width
  (0.58–0.72 → 0.45–0.59); `positiveMin` was left at #286's 0.24 because a floor that is still
  cleared is not evidence for a new floor. Business-level pacing did **not** move (91/100 to
  T2, 18% bankrupt, median survival 360, T1 still 1.0mo vs the 2.0 target). Full reasoning:
  `data/market-calibration.json#live._doc`.
- **Per-brand reputation feeds off `staff:auto_resolved`, never `deal:closed`** (#151), and it
  is the only consumer of that event's new `brand` field. The pairing it needs — which make,
  and how the delivery went (`badReview`) — exists on exactly one event; `deal:closed` carries
  no satisfaction signal, so sourcing it there would mean re-deriving one at a second call
  site. **A walk moves no brand.** `ReputationSnapshot` went v1 → v2 (module-owned; the
  `modules` key set is unchanged, so there is **no envelope bump and no migration to look
  for** — a v1 blob restores as "no make has a record yet"). And there is deliberately **no
  brand-reputation screen**: `tests/Reputation.perBrand.test.ts` fails if any UI file reads
  `repFor`/`brandReputation`.
- **#152 uses TWO product keys and that is the same call #153 made.** `loanSensitivity` is the
  scalar — attach is multiplied by `1 − loanSensitivity × (1 − financedShare)`, so 0/absent is
  flat across every structure. `requiresFinancing` is **categorical and checked ahead of the
  roll**: GAP covers the gap between a loan balance and the car's value, so it cannot attach to
  a cash deal at any sensitivity or any RNG value. Collapsing the gate into "sensitivity 1.0"
  reproduces today's behavior and is wrong for tomorrow's — **C2 owns these magnitudes (I9)**,
  and a calibration pass must not be able to tune loan-gap coverage onto a cash sale.
- **The attach roll is drawn for EVERY available product, including a gated one** (#152). The
  `continue` sits after `rng()`, so gating GAP does not shift the stream for the products after
  it and the same customer on the same seed sees the same menu decisions. That is what makes
  `tests/DealEngine.attach.test.ts` able to assert the flat products' attach counts are
  **exactly** equal across cash / standard / heavy-down rather than merely close. Do not move
  the gate above the draw to "save" a call.
- **`computeAutoFni` takes ONE named input, not four positional args** (#152, the #365 pattern):
  a menu presented against no structure was the silent default, so `deal` is required and every
  call site states it. **StaffDispatch resolves down payment / loan amount BEFORE presenting** —
  it used to attach first — which also means trade equity correctly shrinks the note and thins
  the menu with it.
- **The live #180 bands moved and the pacing blend rose, and neither is a calibration change**
  (#152). Nothing in `data/market-calibration.json` was touched. Fewer products attach on cash
  and heavy-down deals ⇒ less back gross ⇒ a different cash trajectory, which is the documented
  #151 sensitivity of that seeded run. Both bands still hold.
- **`KPISnapshot.backEndByStructure`'s three buckets are DISJOINT** (#152) — `heavyDown` is
  carved out of `standardFinance`, so the three `backGross` figures sum to total back gross.
  That is deliberately unlike the older `financeUnits`, which counts heavy-down deals too. Each
  bucket carries `perUnit` because a total only reports which structure was commonest. All of it
  is derived from `DealRecord` fields already persisted: **no envelope bump, no migration.**
- **`ZERO_KPI_SNAPSHOT` is now exported from the KPIDashboard barrel** (#152). Four test
  fixtures were each hand-writing the full snapshot shape, so every new KPI field broke all four
  the same way; they spread the constant now. A fixture that needs "empty" must not re-copy the
  shape.
- **A long bar `valueLabel` is clipped by the chart, not just a long label** (#152, extending
  #365's lesson). The horizontal `BarChart` reserves `VALUE_COLUMN = 56px` and draws the value as
  SVG text past the plot edge, so `"$2,100 · 3 cars"` is cut off. The unit counts therefore live
  in the caption — which also suppresses them entirely on an empty window, because "averaged
  over 0 cash" reads as a broken sentence rather than a fact.
- **The F&I posture is SLOT state, not world state** (phase 9 gate, I7). The parked grill's own
  note said the standing volume↔gross posture needed a `WORLD_SNAPSHOT_VERSION` bump and a
  migration. It does not — every sibling lever (`tradePolicy`, `pricingStrategy`, `sourcingLean`)
  persists as an id on the save slot via `persistCurrentSave` (`src/app/useLevers.ts:105`), and
  the posture joins them. Do not go looking for a migration to write.
- **`data/credit-tiers.json`'s `apr` is the CUSTOMER's rate today, and that is the lie phase 9
  fixes** (I2). It becomes `buyRate` — the lender's cost of money — with the customer's rate being
  `buyRate + markup`. Same numbers, honest name. Deliberately **no lender flats**: a flat is a
  second pricing rule the player can neither see nor move.
- **F&I gets ONE player input and it is not per-deal** (phase 9, Q5 + Q9). A three-position store
  posture — "More per deal" / "Balanced" / "More deals" — that the F&I manager executes optimally
  within. There is no manual deal screen, no per-product switch (Q10), and no slider. A future
  session proposing any of those is re-opening a closed grill.

## Phase table

Status: `pending` → `active` → `done`. "Decision first" = a DECIDE unit must run before
slicing/building that phase (the doc's `[NEW]` items, ungrilled designs, and forks —
resolved just-in-time at the phase boundary, never earlier). **Every gate below has a
prepared context row in `.claude/skills/decide/gates.md`** — run `/decide` (or `/decide <gate>`
to jump one early); it loads the gate rather than re-deriving it.

| # | Work (doc section) | Decision first? | Status |
|---|---|---|---|
| 1 | A1 advisor hiring + promotion wiring (#323, #324), + A3 hygiene (close #269, #266, #297) | — | done |
| 2 | A4 silent-system surfacing: #267, #187, #179, manager status card, recovery states, indictment producers | — | done |
| 3 | B1 Reveal ranking + records | — | done |
| 4 | B3 news/adverse-events engine (#176–#179) | — | done |
| 5 | C3 playtest gate (#74), round 1 — HITL | — | **handed over 2026-08-06** — script refreshed + verified in-app; with the director. Closes on their verdict |
| 5c | UI layout rebuild — #346 Operations · #347 People · #348 nav stacks · #349 Growth · #350 chart kit · #351 Finance (all built 2026-08-02) | — (locked IA already ruled it) | done |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338; #339 sliced into #343→#344→#345, all built; see `docs/agent-workflow-notes.md`) | — | done |
| 5b | Module-boundary debt clearance (#341, #342), surfaced by #335's scan | — | done |
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`** | done — #352–#357 all built |
| 7 | A2 staff slots / facility scale | **LOCKED 2026-08-03 — `path-to-finished-product.md` §3 A2** | done — #352 + #358–#362 all built |
| 8 | C2 calibration campaign (#286 + #180/#181) | — | done — all three built |
| 9 | B2 F&I plug-in #2 (+#151–#153) | **LOCKED 2026-08-07 — `fni-mechanics-grill-state.md`** (grill CLOSED, Q1–Q10 + 9 internal calls) | **COMPLETE 2026-08-08** — all twelve slices built (#151, #153, #365, #152, #366–#373) |
| 10 | D1 People + Finance + Growth dashboards (chart kit first) | — | **COMPLETE 2026-08-11** — re-scoped by subtraction, filed as #374–#378 + #380 (and #379 out of phase); all built |
| 11 | B4 drive-the-clock (absorbs #124) | **RULED 2026-08-11 — `engagement-spine.md`** (bite unlock = the cover your people give you) | **COMPLETE 2026-08-12** — #381–#385 all built; closed #124 |
| 12 | F1 onboarding (#213) + F2 + F3 + D3 plain-language pass | **RULED 2026-08-12 — `path-to-finished-product.md` §6 D3, §8 F2, §8 F3** (5 rulings; F3 = none, CLOSED) | **active** — sliced as #386–#395 + #213; #386–#389 built, next is #390 |
| 13 | H1 fictional brands (#246) | — | pending |
| 14 | E1 Tier 4 — OEM engine, courtship, NCM, brand archetypes | — | pending |
| 15 | E2 Tier 5 — BDC | **ADJUDICATE fixed-ops-manager fork** | pending |
| 16 | E3 Tier 6 — GM automation + multi-store | — | pending |
| 17 | E4 Tier 7 — prestige + synergy endgame | — | pending |
| 18 | E5 ladder-wide gate/pacing verification | — | pending |
| 19 | G1 audio/haptics + G2 motion pass | **DECIDE G1 direction; ADJUDICATE [NEW]: G1, G2** | pending |
| 20 | G3 visual completion (#252, icon/splash/store) + D4 a11y (#268) | — | pending |
| 21 | G4 performance/device pass | **ADJUDICATE [NEW]** | pending |
| 22 | H2–H5 ship gates: docs, QA capstones, store readiness, final calibration + playtest | — | pending |

## Log

Newest 3 only. Older entries: `docs/planning/build-state-archive.md`.
- 2026-08-14 — **BUILT #395** (F1 — progressive disclosure: a teaching beat fires when its
  mechanic first matters). **PHASE 12 IS COMPLETE.** #213 taught the store's opening moves on day
  one; everything the game grew after that spine was written — the service annuity, the morning
  bet, parts levels, the body shop's two customers, the finance desk's second profit, runs longer
  than a day — had no teacher at all. A front-loaded tour of all seven on day one is seven things
  forgotten by the time any of them is reachable, so each is stated at the moment it starts
  mattering. Seven beats: `failure_stakes` (folded in from #394), `morning_bet`,
  `service_annuity`, `fni_posture`, `parts_pars`, `channel_posture`, `bite_ladder`.
  **The trigger is DATA and the condition is CODE, and that split is the design.**
  `data/teaching-beats.json` (schemaVersion **2**) declares `events` — the published events that
  make the game re-ask a beat's question — and `when`, a condition id. `BEAT_CONDITIONS` in
  `src/app/teachingBeats.ts` holds the predicates, and TypeScript requires that record to be total
  over `BEAT_CONDITION_IDS`, so a condition the catalog names but nobody answers does not compile.
  "When does this matter" is a design fact somebody should read in one file; "is it true of this
  store right now" is a live World read, and only the composition root may make one. A beat for a
  condition that already exists needs **no code at all**.
  **The runner names no beat, no mechanic and no event — and that is checked, not claimed.**
  `createTeachingBeatChannel` is generic over the id type, so the shipped catalog and a test's
  synthetic beats run byte-identical code; `tests/TeachingBeats.test.tsx` scans the runner's source
  for every `TEACHING_BEAT_ID` and every `EVENT_NAME` and requires none of them to appear.
  **`EVENT_NAMES` is new, and adding an event now means two lines.** `EventMap` is an interface, so
  `EventName` is erased at build time and a JSON catalog naming an event had nothing to validate
  against — a typo'd or renamed event would be a subscription that silently never fires, the one
  failure mode of a registration table you cannot find by playing the game. `events.ts` now exports
  the catalog as a runtime tuple with `EVENT_NAMES_ARE_EXHAUSTIVE` beneath it: a mutual-`Exclude`
  check that resolves to `never` — and so refuses its `= true` — the moment the list and the map
  disagree in either direction. It earned itself on the first run by naming five events my
  `domain:verb` grep had missed (`tierGate:month_verdict`, the three `installedBase:*`,
  `serviceDemand:intake_ready`).
  **#394's beat was folded in, and its ordering rule became structural.** The raise left
  `useDayLoop`'s `onDayComplete` and became a declaration (`floor:day_complete` + `cash_first_low`).
  #394 pinned "raised BEFORE the bite early-return" by comparing source positions; a beat now rides
  its own bus subscription, so there is no early return above it to step over, and the test asserts
  the handler contains **no** raise at all. Two mechanisms for one kind of moment was the
  alternative, and the one-at-a-time rule needs a single queue regardless — `stakesBeat` became
  `beatQueue`, drained FIFO, `StakesBeatCard` became `TeachingBeatCard`.
  **`events` is an ARRAY, wider than the issue's `event`, because one mechanic starts mattering by
  more than one route** — a service advisor arrives by hire **or** promotion, a part can be missing
  on either department's line. The conditions read the **roster**, never the payload's `roleId`,
  which is what lets one predicate answer for both routes without knowing two payload shapes.
  `deal_financed` is the single payload read, through a structural `payloadField` rather than a
  cast, because whether a closed deal financed is a fact about that deal and not about the store
  afterwards.
  **The web drive found the one condition that was wrong, and it was wrong in an instructive way.**
  `prep_bet_offered` first read "the store has spent on stock" (`inventoryAcquisitionSpend > 0`).
  That is **true on day 1**: reconditioning the #296 seed lot posts `inventoryAcquisition` before
  the player has bought anything (the Home card reads `-$7.4k into stock` on the opening day). So
  the beat fired against a lot the store came with, telling the player about a wager they had not
  made — and landing on top of the #213 spine's fourth step. It now reads `currentDay() > 1`:
  `nextDay()` skips its advance on the cold start, so day 2 is the first morning the player has had
  a night to change the lot. Driven live: day 1 opens with the spine coachmark and no card, day 2's
  `clock:day_started` raises the beat, and `bite_ladder` stays silent at Tier 1 with no cover.
  **The full suite caught a cost the unit tests could not: a condition asked once per game-day
  must be cheap.** `bite_ladder` rides `clock:day_started` and stays untaught for a whole Tier 1
  career, and its first version called `availableBites(coverage)` — whose default argument is
  `loadClockBites()`, a `require` plus a full Zod parse. A parse per game-day took four live-app
  drive suites from ~13s to 29–37s and over their 30s timeout. The catalog is parsed once in
  `createTeachingBeatContext` now. Anything expensive belongs in the context factory, which is
  built once, never in a predicate.
  **The seven live-app drive suites flake on THIS MACHINE, and that was attributed rather than
  assumed.** Under full-suite parallelism a rotating subset of `Onboarding`, `Hints.reachability`,
  `Hints.coverage`, `App.saveFlow`, `App.recapPersistence`, `InTabNavigation.reachability` and
  `FniPosture.reachability` blows a 30s timeout on its FIRST test; each passes standalone in
  11–17s. Running the full suite with this slice **stashed** fails **six** of the same suites on
  plain HEAD, so it is machine contention on the heaviest mounts and not something #395 introduced.
  A future session seeing this should re-run the suite alone before chasing it, and should not
  "fix" it by widening timeouts blind.
  **One card, three generic section headers, chip and accent from data.** "What's happening / Why it
  matters / What you can do" are the same three questions of every beat, so a new beat needs four
  sentences and no layout. `badge` + `tone` carry warning-vs-new; `tone` is bound to the kit's
  `BadgeTone` with `satisfies` at the catalog boundary, so the card never casts.
  **Marked taught at RAISE, not at dismissal** — `isCashLow` is true every day once it is true at
  all, so a mark deferred to the "Got it" press would re-raise on every tick. Nothing is persisted
  beyond the per-slot `teaching:<id>` cell #386 minted, so "Show hints again" re-arms the beats with
  the hints and the spine, and `WORLD_SNAPSHOT_VERSION` stays **22**. Full suite green; the `#180`
  live calibration is byte-identical at `costOverAsk` 1.026.
- 2026-08-13 — **BUILT #213** (F1 — the first-run spine: five numbered coachmarks that teach one
  day of this game). A new career opened on a full console with no idea which of five tabs mattered
  first. It now opens on *"Step 1 of 5 — start by reading the market"*, and walks: read the market →
  find the coverage gap → stock to match it → run the day → read what the day gave back.
  **The spine adds NO state, and that is the load-bearing decision.** A step is done because its own
  id sits in the slot's `teaching:<id>` cell (#386), **or** because the hint whose control performs
  it has already retired into that same cell. `data/spine-steps.json` says which:
  `completedBy: 'auction_buy'` on the stocking step, `completedBy: 'run_day'` on the day step. So
  "the player has bought a car at the auction" is one fact stored once, and `useSpine` holds no
  `useState`, no cursor and nothing persisted (`tests/Onboarding.test.tsx` asserts the absence by
  scanning the hook). `WORLD_SNAPSHOT_VERSION` stays 22. "Show hints again" re-arms the spine with
  everything else because there is nothing else to re-arm.
  **Anchored by COMPOSITION, never floated — this is why there is no measurement code.** The
  surface that owns a region renders its coachmark (`spine.coachmarkFor(anchor)` → a
  `CoachmarkModel`, the `hint` idiom exactly), so a step whose region is not mounted produces
  **nothing at all**. The EARS "skip rather than render an unanchored overlay" is satisfied
  structurally: there was never an overlay to place. Five anchors, each its own region, enforced by
  a loader refine — `home-region-market`, `demand-readout`, `lot-sourcing`,
  `app-shell-action-footer`, `day-recap-modal`. A future session reaching for `measure()` and an
  absolute-positioned spotlight is rebuilding the failure mode this shape avoids.
  **Completion is per-step; ORDER only decides which unfinished step draws.** A player who runs a
  day before stocking has genuinely run a day, and the spine does not go back and teach it to them.
  **Every door to the console counts, and the web drive is what found that.** The step is "go and
  read the market", not "use this particular control" — Home's market glance, the gate strip and the
  **tab bar** all reach the demand console, so `changeTab` routes a Growth tab press through
  `openGrowth`. Driving it on web with only the glance wired left a player who used the tab bar
  staring at an instruction they had already followed.
  **"What should I do?" is a LADDER, not a tutorial leftover.** While the spine runs, the answer is
  the next unfinished step. After it, `nextAdviceId` reads three live facts off the World —
  `bankruptcyMonitor.isCashLow`, a live `buildCoverageGap`, `getLotOccupancy().spacesOpen` — and the
  last rung (`run_the_day`) is unconditionally true, which is what stops the entry going dead.
  `buildDemandEntries` was extracted in `config.ts` so the coverage question has ONE answer rather
  than the console's mapping and a second copy for the menu.
  **`TaughtId = TeachingBeatId | SpineStepId`, over the one in-memory set in `useHints`.** The #394
  ruling forbids a second progress store; a `useSpineProgress` hook beside `useHints` would have
  been exactly that. Widening the two methods is the honest statement that the cell is one id space
  with three catalogs feeding it (`hints.json`, `teaching-beats.json`, `spine-steps.json`).
  **The acknowledgment is classified `viewOnly`, and so is the menu fold.** `coachmark` and
  `menu-advice` are named in `data/hints.json` because teaching commits the store to nothing — the
  #388 coverage scan demands every rendered pressable be one thing or the other, and it would have
  failed by name otherwise.
  **Web drive: all five anchors, live, on a fresh T1 career.** Step 1 on Home's Market region at
  open; the Growth tab press retiring it and step 2 drawing under the coverage line; step 2's "Got
  it" retiring it and step 3 drawing **nothing** on Growth (its anchor is the Lot) then appearing
  under "Go to the Auction" once there; step 4 in the footer above the bite ladder; step 5 inside
  the day-close recap after a skip-to-close. The menu answered *"Now run the day"* mid-spine and,
  once finished, *"You have empty spaces on the lot…"* — the live ladder's `lot_has_room` rung on a
  3-of-6 lot. Two nav guards (`NavGating`, `InTabNavigation`) were updated from the literal
  `onTabChange={tabs.setActiveTab}` to the named handler plus its delegation; the contract they
  guard — the shell reports the tap, `tabs` owns the state — is unchanged.

- 2026-08-13 — **BUILT #394** (F2-R2 — the tier-1 failure stakes, stated once the first time cash
  goes low). A new player used to learn the failure model from the EndCard: the first time they
  heard that running out of money ends the career was when it already had. The store now says it
  while there is still something to do about it.
  **The threshold is a measured number, not a guess.** `data/failure-tunables.json` gains
  `warningCashFloor: 12500`, calibrated over a 100-seed naive-policy cohort (360 days): 62 of 100
  careers ever cross it, median first crossing **day 198**, median **35 days of runway** to the bad
  end, and 8 of those 62 recovered and finished the full run. $10,000 crosses on *exactly the same
  62 careers* and buys only 30 days — the extra $2,500 costs no additional warnings and returns
  five days, which is why it is not the rounder number.
  **Two cash levels, two questions, one owner.** `cashFloor` (0) is what sustained insolvency is
  measured against; `warningCashFloor` is the level at which the player can still act.
  `BankruptcyMonitor.isCashLow` and `.daysBelowFloorToFail` are live reads on the module that owns
  both, so no surface re-derives a threshold and the sentence quotes the rule rather than repeating
  a number that could drift. Neither is latched, neither is persisted, `WORLD_SNAPSHOT_VERSION`
  stays 22.
  **Tier 1 ONLY, and that is what makes the sentence true.** Running out at T1 ends the career; at
  T2 it contracts you back a tier and at T3+ it buys a compliance bill — both already stated by the
  #326 recovery beat when they land. Telling a T2 owner their career is about to end would be a
  claim the engine contradicts, so the gate is honesty, not narrowing. Found by reaching for the T2
  dev fixture to drive it.
  **A beat is the other half of the teaching cell, not a second progress store.** `data/hints.json`
  could not carry this: `HINT_IDS` is closed and every entry must map to a control some surface
  renders (`tests/HintCopy.test.ts`), and a stakes warning has nothing to press. So
  `data/teaching-beats.json` + `src/ui/copy/teachingBeats.ts` — the `emptyStates` shape exactly —
  and retirement goes into the **same** `teaching:<id>` cell #386 minted. `useHints` grew
  `hasTaught`/`markTaught` beside `hintFor`/`markUsed` over **one** in-memory set, because two sets
  over one cell is two copies of one fact and "Show hints again" would clear only whichever half
  remembered to listen.
  **This is the one copy catalog allowed to quote money, and that follows #387 rather than excepting
  it.** A hint is written once against every store, so a dollar figure in one is a claim the player
  can check and find wrong. A beat is fired against ONE store's position and the player is about to
  act on it — so `{cash}` and `{reach}` are exact, through the kit's `money`. The reach clause is
  omitted **whole** for a store with no headroom rather than stated about $0, and it reads
  `getFacility().available`, never a backstory id.
  **Raised BEFORE the bite early-return, and it does not halt the run.** A warning a multi-day bite
  could skip is a warning the player who most needs it never gets. It does not stop the clock
  because #384's rule is that a moment halts a run when it puts a *decision* in front of the owner;
  this one reports, and the card is waiting when the run ends MANAGERIAL.
  **Fixed a rules violation in the file the number went into:** `loadFailureTunables` /
  `loadIndictmentTunables` were `rawConfig as T`, so a mistyped key produced `cash < undefined` —
  always false — and the failure model would have failed silently, forever. Both go through
  `parseData` now, with a refine that refuses a `warningCashFloor` at or below `cashFloor`.
  `npm run typecheck` clean, **278 suites / 6064 tests** green.
  **Web drive (ex-banker T1 career, DEV console → cash $8,000 → close the day):** the card renders
  *"Your cash is running low."* with the store's own **$8,000**, the consequence carrying the rule's
  own **7** days, and — because this founder has a line — *"You also have $50,000 you have not
  drawn on your line of credit."* off the live facility read. "Got it" dismissed it; the next day
  closed at **$526**, far deeper than the first dip, and said **nothing**. Once per career, proved
  on the running app.
  Filed out of phase: **#397** — four more `data/` loaders still load as raw casts.
  Next: **BUILD #213** (F1 — the first-run spine coachmarks + the "What should I do?" InGameMenu
  entry); its dep #386 is met.


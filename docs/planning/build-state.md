# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phase 5 — #74 round-1 playtest (HITL). The script is prepared, verified and HANDED OVER
as of 2026-08-06.** It now sits with the director; nothing in the repo blocks it.

**Phases 6 and 7 are COMPLETE as of 2026-08-06** — the whole #352–#362 slice landed. Both
gates were closed before a line was written (C1 2026-08-02 `staff-teeth-design.md`, A2
2026-08-03 `path-to-finished-product.md` §3 A2) and nothing in the slice reopened them.

**The next `/next` does NOT wait on the playtest.** If the director's round-1 notes have
landed (as a comment on #74 or a pasted export), the unit is triaging them per §7's Class
A/B protocol. If they have not, the unit continues **phase 8 — C2 calibration campaign**. A
human gate is never a reason for a session to end with nothing built.

**Phase 8 is UNDER WAY: #180 landed 2026-08-06, #181 landed 2026-08-07** — the live engine has
a calibration harness (it closes **2.2%** of worked ups against #94's 85%) and now a measured
**floor** underneath it. Remaining in the phase: **#286**, the retune that closes the gap.
Read the #286 comment before touching any pricing tunable — the mechanism is measured, and the
obvious lever was already tried and reverted. **#286 now has two commitments to satisfy, not
one:** raise `live` toward `reference`, *and* keep `earlyGame` below it by its stated margin —
the schema refuses a `data/market-calibration.json` where the floor is not a floor.

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

- **The live engine closes ~2% of worked ups against #94's 85%, and #180 measured why.**
  The rejecting mechanism is the **price floor, not the quadrant**: 415 of ~486 walks are
  below-floor `no_close`, against 37 patience-drain and 17 trust-collapse. #94 demos every
  customer a *perfect* SPACED match (Value ≈ 0.85); a six-space tier-1 lot yields best-of-six
  (Value ≈ 0.4), and `reservationPrice` scales with Value, so willingness-to-pay lands under
  `vehicleCost + minGross` before the quadrant is consulted. Full numbers + the knob list are
  in the #286 comment. **Closing that gap is #286, not a stray tuning edit** — and
  `data/market-calibration.json` carries `reference` (the #94 commitment) *and* `live` (the
  measured state) precisely so nobody can rename the measurement the target. A test asserts
  the gap is still recorded.
- **Centering the auction below book was TRIED and REVERTED** (#180). `motivatedSeller`
  `meanMultiplier` 1.0 → 0.85 with ceiling 1.2 → 1.0 moved the close rate ~0.4pp. It is not
  the dominant term; the Value/price-sensitivity drag is. Do not re-propose it as the fix.
- **`staff:auto_resolved` is the live outcome truth, and `customer:resolved` is not** (#180).
  The live floor publishes `customer:resolved` **only on a close** — a walk never publishes
  it at all, so `FollowUpPool`, `Reputation`'s walk penalty, `RegulatoryMeter`'s walk pressure
  and `TierManager.customersServed` are all starved in real play. Filed as **#363**;
  deliberately not folded into #180 because publishing walks changes live balance. When
  reading outcomes, subscribe `staff:auto_resolved`.
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
- **Acquisitions are gated by sales, and that starves any per-acquisition band** (#181). A
  six-space lot only reopens when a unit leaves, so a green store turns **9 units in 110 days
  and 13 in 400**. The recon-tail *rate* band is therefore a documented ceiling guard, not a
  measurement; the band with power is `reconOverrunMin/Max` (mean realized ÷ estimated recon,
  every unit contributes — 1.087× measured against the 1.061 `data/recon-variance.json`
  implies). Do not tighten the tail rate to look precise, and do not extend the run to chase
  the denominator: 400 days buys 4 more units for 4× the runtime.
- **Two customers can be held on the SAME unit, and resolving both throws** (#181 → **#364**).
  Nothing reserves a vehicle while a `trade:escalated` / `discount:escalated` review is
  pending; the first resolution drives it off the lot and the second dies on `No lot vehicle`
  inside `DealEngine.closeDeal`. Ordinary on a six-space lot, reachable in the app. The #181
  harness `try/catch`es it and tallies `escalationsLostToSoldUnit`; **that guard is the
  workaround, not the fix** — #364 owns what the second customer actually sees.
- **The #180 harness deliberately capitalizes its bot** (`BOT.floatFloor`/`floatTopUp`). At a
  2% close rate the store goes insolvent long before 600 worked ups, which would silently
  shrink N and make the bands move whenever calibration changed. Solvency + pacing are the
  balance harness's job (`scripts/balance-harness/`), not this test's. It also pins the
  salesperson's **base** skills to 0.75/0.75 (derived from the catalog's caps, not hardcoded)
  while leaving morale free to drift — the drift is the emergent variance under test.

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
| 8 | C2 calibration campaign (#286 + #180/#181) | — | active |
| 9 | B2 F&I plug-in #2 (+#151–#153) | **RESUME parked grill** (fni-mechanics-grill-state.md) | pending |
| 10 | D1 People + Finance + Growth dashboards (chart kit first) | — | largely absorbed by 5c (#349/#350/#351); re-scope when reached |
| 11 | B4 drive-the-clock (absorbs #124) | decide bite-unlock schedule while building (spine STILL-OPEN) | pending |
| 12 | F1 onboarding (#213) + F2 + F3 + D3 plain-language pass | **ADJUDICATE [NEW]: F2, F3, D3** | pending |
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

- 2026-08-06 — **BUILT #180** (live-engine calibration verification — phase 8 opens). The
  #94 test proves the sales-process balance *in a vacuum*: a perfect inventory match every
  time, static price stubs, no market, no trades, no morale. #180 asks the question it
  cannot — does that calibration survive contact with the actual game? It does not, and the
  test now says so precisely.
  **The instrument.** `tests/MarketEconomy.calibration.test.ts` drives the real
  `createWorld`: live MarketEconomy providers, the real lot bought off the real auction
  board, seeded weather, demand shaping, competitor drift, trades with negative equity,
  morale drifting under the salesperson's feet, carrying cost eating the cash that buys the
  next unit. 601 worked ups over 369 days, deterministic across runs, ~12s alone / ~39s under
  full-suite load.
  **Two things had to become observable first, because the live close threw them away.**
  `staff:auto_resolved` now carries `badReview` on a close (the low-trust forced close — the
  negative-but-deal band) and `heat` on a walk. Before this the only satisfaction signal on
  the bus came from `customer:resolved`, which re-derives it by re-running the process
  against a **stub vehicle nobody was shown**. Both new fields are read off the close that
  actually happened.
  **`residualHeat` got one home.** The walk-warmth formula was hand-copied between
  `CustomerPool` and the #94 harness with hardcoded 0.5/0.3/0.2 weights, and the live path
  needed a third copy. It is now `SalesProcess.residualHeat` with the weights in
  `data/sales-process.json` `heat`, schema-refused unless they sum to 1.
  **The finding: the live engine closes 2.2% of worked ups against #94's 85%.** And the
  rejecting mechanism is *not* the quadrant close — 415 of ~486 walks are below-floor
  `no_close`, against 37 patience-drain and 17 trust-collapse. Over that population customers
  land at **0.992 of our ask** while our cost sits at **1.237 of it**. Cause: #94 demos a
  perfect SPACED match (Value ≈ 0.85), a six-space tier-1 lot yields best-of-six (Value ≈
  0.4), and `reservationPrice` scales with Value — so willingness-to-pay falls under
  `vehicleCost + minGross` before the quadrant is consulted. Separately, **51% of all
  arrivals leave on `no_fit`**: half the floor walks because six cars couldn't match their
  want-vector.
  **What I did NOT do, deliberately.** The issue's AC authorizes retuning `data/` until the
  bands pass. I tried the most defensible single lever — centering auction buys below book
  (`meanMultiplier` 1.0 → 0.85, ceiling 1.2 → 1.0, since a dealer buys wholesale) — and it
  moved the close rate ~0.4pp. **Reverted**, because it is not the dominant term and leaving
  an unjustified balance edit in the tree is worse than none. The real retune is a whole-
  economy judgment about gross per deal and how scarce a tier-1 lot should feel, which is
  exactly **#286** (same phase, literally "calibration pass"). Full numbers + the knob list
  are filed as a comment there.
  **So the bands are two sets, not one.** `data/market-calibration.json` carries `reference`
  (the #94 design commitment) and `live` (measured). The test asserts `live` as a regression
  guard *and* asserts the gap to `reference` is still recorded — green and honest, rather
  than green by asserting today's brokenness is correct.
  **Filed #363 in passing:** a live-floor walk never publishes `customer:resolved` at all, so
  `FollowUpPool`, `Reputation`'s walk penalty, `RegulatoryMeter`'s walk pressure and
  `TierManager.customersServed` are starved in real play — ~587 walks a run reaching none of
  them. Not folded in here: publishing walks changes live balance and needs its own
  verification. 218 suites / **2851** tests, typecheck clean.
  Next: **#181** (early-game floor verification), which #180 unblocks — then #286.

- 2026-08-06 — **HANDED OVER: the #74 round-1 playtest script (phase 5, HITL).** The unit
  was preparing the script and giving it to the director. Preparing it turned out to be real
  work: the script was written before the 5c layout rebuild and before phases 6 and 7, and
  **every navigation path in it had gone stale.**
  **What had drifted.** Hiring is on **People → Hiring**, not Operations. The auction is
  entered from **Operations → Lot → Go to the Auction** — the Lot owns sourcing (locked IA
  §4). The demand readout, the weekly market report and the industry wire all moved off Home
  into **Growth**; Home keeps a Market *glance* whose whole job is to route there, so "read
  Home top-to-bottom" would have had the director staring at a two-line card. The wire's paid
  lanes are named "auction data feed" and "competitor price tracking" on screen, not
  `auction_data`/`competitor_tracking`. And the known-dark list still told them Finance and
  Growth were placeholder tabs — 5c built both. A stale script is worse than no script: it
  spends the one resource this gate is short of, which is the director's patience.
  **What it now measures that it couldn't before.** Day 0's hire reads the signing fee and
  the daily wage and then the payroll line (hiring costs money twice now); Day 2's buy happens
  against a six-space lot the seed already fills half of; Day 3's second hire is a capacity
  question *with a price on it*; Day 4 reads the wholesale quote without taking it and sweeps
  the roster for raise asks and rival offers; Day 5 takes the valve if the unit still hasn't
  sold, and reads the Growth console including Build Out and the gate board. Session B gained
  payroll-at-T2, a roster sweep, and "do you know what would get you to Tier 3".
  **Both halves were rewritten together.** `docs/planning/playtest-round-1.md` is the human
  doc; `data/playtest-script.json` is what the phone actually presents (#333) and is the one
  the director will read at 11pm on day 4. Editing only the doc would have shipped the drift.
  **Deliberately NOT fixed, because it is a round-1 question.** A raise ask and a rival's
  offer wait on a person's card and never interrupt — so a player who doesn't open People can
  lose someone to a rival and only learn it from Deal History. Whether that reads as tension
  or as a missed beat is exactly what the round is for; pre-emptively adding an interrupt
  would answer it for them. It is a script step and a probe instead.
  **Two stale claims corrected in passing:** §5 said nothing in the UI showed the finance mix
  — Finance now splits gross into Cash vs Financed and Deal History names the method per
  deal, so the gap narrowed to down payment / credit tier / the credit-blocked walk reason.
  And `data/nav-tabs.json`'s `_doc` still called three tabs placeholders.
  **Verified in the running app**, not just typechecked: reloaded the web target and reopened
  the guide — the Day 0 card renders all seven new steps, both probes and the new known-dark
  list, and the button reads **▤ 1/9 · 0/7**. 217 suites / **2841** tests, typecheck clean.
  Next: **phase 8, C2 calibration (#286 + #180/#181)** unless the director's round-1 notes
  land first, in which case triage those. The gate does not block the queue.

- 2026-08-07 — **BUILT #181** (the early-game floor — the progression has a proven bottom).
  #180 proved the #94 calibration does not survive contact with the game for a **competent**
  operator. #181 asks the complementary question: is there anywhere to climb *from*? A career
  whose day-1 state performs like its end state has no progression in it, and every skill
  gate, promotion and hire in `StaffOrg` would be decoration. Now there is a test that says
  otherwise.
  **The instrument is #180's, with one variable changed.** Same `createWorld`, same master
  seed, same stocking bot, same six-space lot, same capital floor — only the operator differs.
  `tests/MarketEconomy.earlyGameFloor.test.ts` runs the green solo operator the career starts
  you as (0.35/0.40 raw composites) instead of 0.75/0.75, hires **no UCM**, never pays for a
  pre-buy inspection, and leaves the trade policy at its `data/` default. Those are the four
  things a green player has not bought yet. 200 worked ups over 110 days, deterministic, ~5s.
  **Pinning an off-diagonal profile needed a real derivation.** #180 could fill every skill to
  the same fraction, which lands on the diagonal (`E === T`). A green operator is deliberately
  *off* it — better at being trusted than at closing — so the fill is parameterized by how
  each skill leans (`fᵢ = α + β·leanᵢ`) and the two composites are solved as a 2×2 against the
  live catalog. Hardcoding the three fractions would have let a retuned
  `data/staff-skills.json` silently move the green profile; instead the realized profile is
  asserted and a catalog change fails loudly.
  **The finding is the SHAPE of the floor, not its height.** A green operator closes about as
  often as a competent one — 3.0% of worked ups against #180's 2.4% — but **every single one
  of those closes is a low-trust forced close**: 0.0% positive against `live`'s 2.2%, and
  `trust_collapse` goes from 17 walks to 115, becoming the dominant non-fit reason. Skill does
  not buy you volume in this economy; it buys you customers who are *happy*. That is a
  cleaner, more interesting floor than "green sells less", and it is what the bands now
  record.
  **Margins are distances, not a second set of bands.** `data/market-calibration.json`
  `earlyGame` states `marginBelowLive` / `marginBelowReference` as gaps from `live` and
  `reference`, and a schema refine enforces that the whole early-game band sits under
  `live.positiveMin − marginBelowLive`. When #286 raises `live`, the floor must move with it
  or the assertion fails. A floor that stops being below the ceiling is not a floor.
  **The recon-tail band is honestly labelled as a ceiling guard.** Acquisitions are gated by
  sales — a six-space lot only reopens when a unit leaves — so a green store turns **9 units
  in 110 days, and only 13 if ground out to 400**. Zero surprises fired against an expectation
  of ~0.45. Banding a rare event over that denominator would be banding luck, so the rate gets
  a documented ceiling and the load-bearing band is the **mean recon overrun** (realized ÷
  estimate, every unit contributes): measured 1.087× against the 1.061 the
  `data/recon-variance.json` bucket mix implies. Its min sits just under 1 on purpose — that
  is the assertion that buying blind is a cost, not a coin flip. Both tighten on their own
  once #286 makes the lot turn. Carrying burn came in at **$18.63/unit/day**.
  **Filed #364 in passing.** Two customers can be held on the *same* unit — a six-space lot
  makes it ordinary — and whoever is resolved first drives it away; resolving the second
  throws `No lot vehicle` straight out of `resolvePlayerDiscountDecision`. Reachable in the
  app, not a harness artifact. The test guards and tallies it rather than asserting around it;
  what the second customer should *see* is a design call about the prompt, not a calibration
  change. 219 suites / **2863** tests, typecheck clean.
  Next: **#286** — the retune that closes the #180 gap. It now has a floor to preserve as well
  as a ceiling to reach.

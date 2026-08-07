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
A/B protocol. If they have not, the unit is **phase 8 — C2 calibration campaign (#286 +
#180/#181)**, which is where the pointer goes on its own. A human gate is never a reason for
a session to end with nothing built.

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

- 2026-08-06 — **BUILT #362** (wholesale this unit — the release valve). **Phases 6 and 7 are
  COMPLETE.** The only path that turned a unit back into cash was abandoning recon after a
  surprise, so with the lot cap live (#361) sitting at 35 of 35 holding three units nobody
  wants was a dead end with no move in it. Now there is one, and it costs you something.
  **One rule for the price: book value with a `data/` haircut.** Off **book**, never off the
  asking price — the ask is what you hope a retail customer pays, and a wholesale buyer is
  buying to resell. That is exactly why the valve realizes a loss rather than being a free
  undo. `getWholesaleQuote()` is the only place the rule lives; the room states it and never
  re-derives a price or subtracts its own cost basis.
  **Any owned unit, no second ceiling.** No gate on recon status and none on the #295
  frontline hold: both describe a car already sitting on your lot burning money, and the
  units you most want to dump are the ones you regret. This is also *not* the rejected
  "forced wholesale on overrun" — the player picks the unit and sees the number.
  **The quote is a pure read, which is what makes the confirmation possible.** This is the
  one action that realizes a loss on purpose, so it never fires off a single tap: the sheet
  says what the buyer pays, what you have in it, and *$2,598 loss* in red. A valve whose
  price you cannot read is not a decision.
  **Both wholesale-outs now leave by the same door, and that fixed a real defect.**
  `inventory:vehicle_wholesaled` is published by this valve *and* by the #162 recon abandon.
  It is deliberately not `inventory:vehicle_sold` — that event means a person bought this
  car, and MarketEconomy was recording the abandon-path dump as a **retail comp**, feeding a
  wholesale price into the segment's price index; InstalledBase was staging the wholesaler as
  a future owner. The abandon path keeps #162's price rule; only which event it is stopped
  being a lie.
  **HistoryLog records it with its own `inventory` kind and a plain badge** — *"Wholesaled the
  2022 Chevrolet Silverado 1500 — $14,724, a $2,598 loss."* Naming the car matters: this is
  what you look back at when the month closes short. It must never wear the reward badge a
  closed retail deal wears.
  **Driven on web at a T3 store, single clicks.** Wholesaled a Silverado for $14,724 against a
  $17,322 basis; cash moved $190,925 → **$205,649** exactly, the lot 8 of 12 → 7 of 12, and
  the entry landed in Deal History under a grey INVENTORY badge between two gold SALEs. Then
  stood the store at its cap (`built.lotSpaces` → 7 in the slot, restored after) and reloaded:
  *7 of 7 spaces taken · no spaces open*, *"No spaces open — sell a unit before you buy
  another"*, auction lane closed. **Keep It** changed nothing. **Wholesale It** took the unit
  and the same card flipped to *"The wholesale auction — where the next unit on this lot comes
  from"*; the lane read *Lot: 6 of 7 spaces* and was buyable again — #359, #361 and #362
  meeting with no extra wiring, because occupancy is read live. 217 suites / **2841** tests,
  typecheck clean.
  Next: **phase 8, C2 calibration** — but #74 (the round-1 playtest, HITL) sits ahead of it in
  the commit sequence and is pending, not blocked.

- 2026-08-06 — **BUILT #361** (the lot cap governs buying — *6 of 6 spaces taken · no spaces
  open*). Lot size has been CSV tier truth since the beginning and nothing enforced it, so
  "match your inventory to demand" had no squeeze in it. Now it does: a full lot at the wrong
  end of the demand mix is a problem you have to sell your way out of.
  **One number, and every owned car is in it — prep included.** `Inventory.getLotOccupancy()`
  is the only place the rule lives; the Lot room and the auction lane both state it and
  neither counts its own list. There is no off-lot state in the model and none was invented:
  recon is a cost, not a place, and the #295 frontline hold only governs whether walk-ins can
  be *shown* the car. A unit in prep is sitting on your lot costing you money either way, and
  prep-as-its-own-capacity is one of A2 R2's five recorded rejections.
  **Checked at the bid, so units already won count.** `buyFromAuction` throws; the UCM's
  auto-source **stops** instead, because a full lot is a normal morning and not a programming
  error. That is what makes "you cannot win six cars into four spaces" true for the desk as
  well as the player. A refusal changes nothing — no cash moves, the listing stays on the
  board — the same shape #359 gave a refused construction buy.
  **A trade always lands, and may put you at 7 of 6.** It is part of a sale already made;
  refusing it would unwind a closed deal. Buying then stays frozen until occupancy is back
  **under** the cap — 6 of 6 is still frozen, "under" not "no longer over". Self-correcting by
  construction: the deal that brings a trade in also takes a car out. No overflow lot, no
  forced dump, no new vehicle state.
  **Built spaces come from Facility and are read live**, through `getBuiltLotSpaces` — the
  same closure idiom as the bay seam, never a module reference. So a construction job that
  landed this morning reopens the lane with no further player action, which is #359 and #361
  meeting: you buy the space, then you buy the car. Omitting the dep leaves the lot uncapped,
  which is what keeps pre-#361 harnesses honest.
  **Four suites bulk-bought the board and now stop at the cap.** A tier-1 lot holds six cars
  and the #296 seed already parks three, so a green world can buy exactly three — the loops
  gained one `atCapacity` break each, not a bigger lot.
  **Driven on web at the T2 fixture, single clicks.** *5 of 12 spaces taken · 7 open* on the
  Lot room and *Lot: 5 of 12 spaces* in the lane; bought a $7,000 Cherokee and watched both
  tick to 6 while cash fell exactly $7,000. Then stood the store at its cap in the saved
  `facility` blob (lotSpaces → 6) and reloaded: **6 of 6 spaces taken · no spaces open**, the
  lane's count in red, the closed banner above the board, and the buy button reading **No
  Spaces Open** with $215,734 in the bank — deliberately not "Insufficient Funds", because it
  is not a money refusal. Closed day 31 with the lot full: the recap read *"Your lot was SUVs;
  the crowd wanted sedans"* with five sedan walk-aways, and the UCM auto-source bought nothing
  and threw nothing on the rollover. 216 suites / **2828** tests, typecheck clean.
  Next: **BUILD #362** (wholesale this unit — the aged-inventory release valve).


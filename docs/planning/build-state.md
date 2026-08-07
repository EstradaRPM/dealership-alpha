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
A/B protocol. If they have not, the unit continues the phase pointer below. A human gate is
never a reason for a session to end with nothing built.

**Phase 8 is COMPLETE as of 2026-08-07** — #180, #181 and **#286** have all landed. The live
engine now closes **28.5%** of worked ups against the 2.2% #180 measured, the early-game floor
held its shape (0.5% positive for a green operator, so the progression still has a bottom), and
the balance harness went from "bankrupts before Tier 2" to **90 of 100 seeds reaching T2** with
a median survival of the full 360 days.

**Phase 9's gate is CLOSED as of 2026-08-07.** The parked F&I grill was resumed and finished —
`docs/planning/fni-mechanics-grill-state.md` is no longer a parked tree, it is a locked design.
The next `/next` on phase 9 is a **SLICE**.

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
- **#286 gave the recon bands a real denominator** (superseding #181's "acquisitions are
  starved" note). A green six-space lot turned 9 units in the window before and turns **43**
  now, with 29 completed recons and the tail actually firing (1 hit, 2.3%). The tail *rate*
  stays a documented ceiling guard; `reconOverrunMin/Max` (mean realized ÷ estimated recon) is
  still the band with power — 1.072× measured against the ~1.061 `data/recon-variance.json`
  implies. Do not tighten the tail rate to look precise.
- **Two customers can be held on the SAME unit, and resolving both throws** (#181 → **#364**).
  Nothing reserves a vehicle while a `trade:escalated` / `discount:escalated` review is
  pending; the first resolution drives it off the lot and the second dies on `No lot vehicle`
  inside `DealEngine.closeDeal`. Ordinary on a six-space lot, reachable in the app. The #181
  harness `try/catch`es it and tallies `escalationsLostToSoldUnit`; **that guard is the
  workaround, not the fix** — #364 owns what the second customer actually sees. **#180 now
  carries the same guard** (#286): once closes became common the collision reached that harness
  too, and it crashed the suite outright until the guard went in.
- **The #180 harness deliberately capitalizes its bot** (`BOT.floatFloor`/`floatTopUp`). At a
  2% close rate the store goes insolvent long before 600 worked ups, which would silently
  shrink N and make the bands move whenever calibration changed. Solvency + pacing are the
  balance harness's job (`scripts/balance-harness/`), not this test's. It also pins the
  salesperson's **base** skills to 0.75/0.75 (derived from the catalog's caps, not hardcoded)
  while leaving morale free to drift — the drift is the emergent variance under test.

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
| 9 | B2 F&I plug-in #2 (+#151–#153) | **LOCKED 2026-08-07 — `fni-mechanics-grill-state.md`** (grill CLOSED, Q1–Q10 + 9 internal calls) | active — next unit is SLICE |
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

- 2026-08-07 — **DECIDED phase 9's gate: the parked F&I grill is CLOSED** (`/decide`). It had sat
  paused since 2026-07-08, and it was paused for a good reason — it had surfaced the game-wide
  engagement problem, which had to be answered first. That answer (`engagement-spine.md`) landed
  and repositioned F&I from the spine's tracer to its **second plug-in**, so the tree could be
  resumed knowing what F&I is *for*: proving the Reveal grammar spans from a daily beat up to a
  monthly strategic verdict.
  **Four rulings, taken in the order the doc's own re-entry note prescribed** (start at the
  demand-mix→F&I-ceiling coupling, since it is both an open mechanic and the emergence hook).
  **Q7 — the finance mix is read AHEAD, on the wire.** It becomes a MarketIntel lane behind the
  same door model every other lane has (`src/game/MarketIntel/types.ts:43-57`), opened by the paid
  data subscription or by the F&I manager on the desk. The reasoning is the spine's: a posture set
  blind is a coin flip, and the whole grammar is "a bet you place, the Reveal resolves." It also
  gives the T3 hire a second reason to exist beyond attach rates. **Q8 — the player can BUY a
  different crowd, credit-wise, and it is built in B2.** Advertising campaigns gain
  person-archetype weights beside the vehicle-type weights they already carry (today only
  `suv 0.85 / sedan 0.55 / truck -0.2`, `data/tunables.json:117-133`) — a "we finance anyone" push
  pulls a lower-credit, must-finance crowd, a certified-preowned push pulls high-credit cash. This
  is the standing demand-influence requirement and the F&I ceiling seen from two ends; a ceiling
  you can read but not move is half a mechanic, so it does not get sorted into a later demand
  slice. **Q9 — the posture dial is three positions**, "More per deal" / "Balanced" / "More
  deals", persisted as a slot id exactly like `tradePolicy` (`data/tunables.json:774` is the shape
  to copy). Q5 had already killed slider-hunting; three stops let the Q4 peak meter read as "the
  peak is at Balanced this month," which is a legible bet, where a 0–100 number would read as
  something to optimize. **Q10 — no product-level control.** All six unlock at T3 and the manager
  owns the menu. A per-product switch is a second control surface with nothing in it: turning off
  `etch` is strictly worse unless CSI drag is priced per product, which is a fourth rule on a
  mechanic whose point is one dial.
  **Nine internal calls were made rather than asked**, and one of them is a correction to the
  grill doc itself: the posture is **slot state, not world state**, so there is no snapshot
  envelope bump and no migration to write — the doc's own parked note was wrong
  (`src/app/useLevers.ts:105`). The others: reserve lives inside `DealEngine` with `backGross`
  splitting into `productGross`/`reserveGross`; `credit-tiers.json`'s `apr` becomes `buyRate` with
  the customer's rate being `buyRate + markup` and **no lender flats**; structural deal-kill falls
  out of the `ptiCap`/`maxTerm`/`ltvCeiling` already in the tier table, so half of Q3's tension
  needs no new machinery; #152 is one per-product `loanSensitivity`; #153 rides the existing
  `resolveEffects` machinery; #151's per-brand reputation is ambient depth feeding Reveal text,
  not a dashboard; one deal-kill curve in `data/`; and every magnitude is owed to a #286-class
  calibration pass, not to this design.
  Recorded in `fni-mechanics-grill-state.md` (rewritten from "PARKED (resumable)" to "COMPLETE"),
  with the ruling summarised into `path-to-finished-product.md` §4 B2 and the gate row moved to
  `.claude/skills/decide/gates.md`'s Settled section.
  Next: **SLICE phase 9** — the design is closed, so the next unit files the issues.

- 2026-08-07 — **BUILT #286** (the C2 retune — **phase 8 COMPLETE**). #180 measured that the
  live engine closes 2.2% of worked ups against #94's 85% and named the price floor as the
  rejecting mechanism. #286 had to find out *why the floor was where it was*, and the answer
  was not the one #180 filed.
  **The diagnosis contradicted the hypothesis, and measuring beat theorising.** #180's write-up
  blamed the reservation model — a best-of-six lot yielding Value ≈ 0.4 against #94's perfect
  0.85, dragging willingness-to-pay under cost. I instrumented `closeAndPrice` on the live floor
  before touching a tunable, and the customers were fine: Value measured **0.599** (not 0.4),
  price sensitivity **0.41** (not the 0.6–0.85 the issue assumed), the reservation price sat
  **6.5% ABOVE our ask**, and the quadrant was accepting **58%** of worked ups. What was broken
  was the store: **`floor/ask` = 1.32**. Our cost basis was a third higher than our own asking
  price, so `closeable` was false 91% of the time and nothing downstream ever got a say.
  **Four terms produced that, and every one was a mis-model rather than a number wanting a
  nudge.** (1) Recon was a **flat dollar figure per condition** ($500/$1,200/$2,800) applied to
  a catalog spanning a $3.5k beater and a $40k luxury car — on the tier-1 lot a rough unit's
  recon ran to *half its value* while the anchor's condition discount takes only 12% off, so
  buying rough was never a decision, it was a trap. It is now
  `conditionTiers[*].reconPct` (0.04/0.09/0.16), one rule in `Inventory.reconEstimateFor`, read
  by all three acquisition lanes. (2) The **auction lane centred at book with a 1.20 ceiling** —
  you could pay 20% *over* book at a wholesale auction, while `inventory.wholesale.haircutPct`
  pays you out at book × 0.85 on the way out. Centring the buy side at 0.85 makes the two sides
  of one market symmetric. (3) The **retail markup (1.20–1.28) was thinner than the basis it
  had to cover**; +0.10. (4) A **modelling bug the retune exposed**: a wholesale comp was
  measured against the bare anchor, so the moment the lane moved below book *every purchase*
  recorded a negative comp and drifted the segment down — buying well would have quietly
  devalued the player's own inventory. Wholesale comps now reference `anchor ×
  motivatedSeller.meanMultiplier`, symmetric with retail's `anchor × markup`.
  **The result: `live` positive 2.2% → 28.5%**, apathetic 97.7% → 64.5%, negative-deal 0.2% →
  7.0%, 213 closes against 88. The early-game floor **held its shape** — a green operator still
  closes at a rate a competent one would recognise while almost none of those customers leave
  happy (0.5% positive against 28.5%) and `trust_collapse` is still its signature walk (106 vs
  11). Skill buys happy customers here, not volume, and that is still true after the retune.
  **The balance harness is the business-level proof:** it went from the standing "bankrupts
  before Tier 2" to **90 of 100 seeds reaching T2**, median survival the full 360 days.
  **Two things I did not tune away.** `no_fit` rose 51% → 71%, and it is real: the lot is
  measurably FULL (6.01 of 6 spaces) and still cannot match 7 of 10 walk-ins, because six cars
  is a thin draw against six SPACED axes plus an affordability gate. It rose because cars now
  *sell*, so composition churns. That is the pressure that makes lot spaces worth building —
  A2 R1's whole point. And the residual gap to `reference` is now the **Value meter, not
  price**: a six-space lot yields best-of-six, Value dominates `objectiveDeal`, and closing
  that is a stocking-capacity question for the tier ladder rather than another pricing knob.
  Both are written into `data/market-calibration.json`'s docs so the next reader inherits the
  reasoning, not just the numbers.
  **Harness correction, both bots: they now run the #362 release valve.** Without it the test
  measured a store that cannot restock — a unit nobody will buy holds one of six spaces
  forever, mean lot age climbed to 123 days and the close rate halved twice over (62% → 22%).
  That is the harness failing to make a decision every operator makes, exactly like the
  standing float top-up. `MAX_DAYS` rose 400 → 600 to keep the 600-worked-up sample, because
  the live floor works ~1.2 customers a day.
  219 suites / **2863** tests, typecheck clean, and driven on web (T2 fixture → Operations →
  Lot): live asks, carrying, aging and wholesale quotes all render, the RAV4's $11,922 quote
  being exactly 0.85 × its $14,026 book.
  Next: **phase 9 — B2 F&I plug-in #2**, which opens with a DECIDE (the parked grill).

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

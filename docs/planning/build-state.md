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

**Phase 9's gate is CLOSED as of 2026-08-07** and the phase is **SLICED as of 2026-08-07** —
`docs/planning/fni-mechanics-grill-state.md` is a locked design, and B2 is now twelve filed
issues. The next `/next` on phase 9 is a **BUILD**. **#151 landed 2026-08-07** — eleven left.

### Phase 9 — B2 F&I plug-in #2 (filed 2026-08-07)

| # | Slice | Deps |
|---|---|---|
| ~~#151~~ | ~~per-brand `Reputation.repFor(make)` replaces the `pickVehicle` stub — ambient, no screen (I6)~~ **BUILT 2026-08-07** | — |
| #152 | attach scales with amount financed — one per-product `loanSensitivity` (I4) | #365 |
| #153 | cash-buyer / must-finance traits through `resolveEffects` (I5) | — |
| #365 | **tracer** — `apr`→`buyRate` + `markupCapPts`, `computeReserve`, back gross splits into `productGross`/`reserveGross` (Q1/Q2, I1–I3) | — |
| #366 | the posture dial — three positions, slot-persisted like `tradePolicy`, **no snapshot bump** (Q5/Q6/Q9, I7) | #365 |
| #367 | deal-kill — one curve in `data/`, an over-marked deal falls through (Q3 primary, I8) | #366 |
| #368 | CSI drag — an over-marked customer publishes `reputation:satisfaction_hit` (Q3 secondary) | #365 |
| #369 | the F&I manager works the deal — `finance_structuring` frontier, `product_presentation` attach (Q2/Q5/Q10) | #367 |
| #370 | the peak meter — twin opposed bars, the crest is not the max (Q4) | #366, #367, #369 |
| #371 | the crowd's finance mix read ahead on the wire — MarketIntel lane, F&I manager is a third opener (Q7) | — |
| #372 | advertising buys a different crowd — person-archetype weights on campaigns (Q8) | — |
| #373 | the monthly F&I verdict — Reveal reactions + the PVR record (engagement spine plug-in #2) | #365, #366, #371 |

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

- **#363 is BUILT (2026-08-07). #364 is still open and still has no phase assignment** — two
  customers held on the same unit, the second resolution throwing `No lot vehicle`. It is
  reachable in real play and phase 9's queue starts at #152, so the chronological rule will
  not pick it up on its own. On the merits it belongs before the remaining F&I feature work,
  since it is a crash.
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
| 9 | B2 F&I plug-in #2 (+#151–#153) | **LOCKED 2026-08-07 — `fni-mechanics-grill-state.md`** (grill CLOSED, Q1–Q10 + 9 internal calls) | active — sliced into #151–#153 + #365–#373; **#151 BUILT 2026-08-07**, eleven left |
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

- 2026-08-07 — **BUILT #363** (the live floor's walks reach the rest of the game). A walk on
  the live sales floor published only `staff:auto_resolved`, so `customer:resolved` never
  fired for one — and four systems were dead in real play while looking healthy in isolation:
  the whole BDC follow-up pool never filled, walks cost no reputation, regulatory walk
  pressure never accrued, and `TierManager.customersServed` counted closes only (~3% of the
  floor). `CustomerPool` now bridges `staff:auto_resolved`/`no_sale` onto `customer:resolved`.
  **The bridge belongs in CustomerPool, not in StaffDispatch, and that is the load-bearing
  call.** `customer:resolved` is the customer *lifecycle* event: the session, the
  `customer:state_changed` transition, and the guard that stops one customer resolving twice
  all live in the pool. So the pool gained a second live-floor subscription beside its
  `deal:closed` one and stayed the sole publisher — three drivers, one owner.
  **A pre-process walk resolves at `heat: 0` rather than not resolving.** `no_fit` is 71% of
  the floor and carries no warmth by design (a customer the lot had nothing for never got far
  enough to leave a temperature). They are still an up who was on the floor and left, so they
  count as served and cost what a walk costs; they simply are not worth a callback, which
  `FollowUpPool`'s existing `heat <= 0` guard already expresses. No new carve-out.
  **The close half was a lie worth fixing in the same slice.** `CustomerPool` re-ran the
  entire sales process against `STUB_VEHICLE_SPACED` to produce the close's satisfaction —
  scoring the visit against a car nobody was shown, and emitting a phantom
  `customer:gate_evaluated` stream for gates that never ran. The live floor already measures
  this honestly, so the trio now travels with the close: `closeDeal` takes an optional
  `salesQuality`, `deal:closed` round-trips it, `CustomerPool` publishes it. **DealEngine never
  reads it** — only the flow that ran the process can know it. Absent (legacy harnesses,
  direct `closeDeal` callers) the local evaluation still speaks, so the no-DealEngine path is
  byte-for-byte unchanged. The formula itself moved to `SalesProcess.resolutionQuality`, the
  sibling of `residualHeat` and for the same reason — the 0.6/0.4 retention blend was two
  hardcoded magic numbers in `CustomerPool` and is now `data/sales-process.json` `retention`,
  schema-refused unless the weights sum to 1.
  **Turning the producer on was a live-balance event, and it revealed three magnitudes that
  had been calibrated against something that never fired.** First measurement: satisfaction
  70 → **12.5**, review → 15.9, arrivals collapsed with it (the #180 harness could only
  collect 457 of its 600 sample in 600 days), and **regulatory pressure pinned at 80.0 — the
  AG-complaint threshold, terminal at Tier 1**. The store was being shut down for walking the
  same share of its ups every real dealership walks. Retuned: `walkSatisfactionPenalty`
  −1 → **−0.12** (against `closedDealSatisfactionBonus` +3), `walkPressure` 0.5 → **0.05**,
  `angerPressure` 2.0 → **0.4**. The small numbers are not timidity — the walk penalty is
  charged ~2.6 times a day, every day.
  **−0.12 was chosen on the pacing targets, not on feel.** −0.08 sends T1→T2 to a median 2.0
  months (status OUT, too fast); −0.12 holds it at 3.0 against the 3.5 target (WITHIN), which
  is the same read the pre-#363 baseline gave. Measured against a stashed baseline on the same
  100 seeds: survival median 360 = 360, bankruptcy 19% vs 18%, T2 reached 87 vs 91, T1 still
  1.0mo vs the 2.0 target (the standing, unrelated miss). **Better** than baseline: FAILED
  92% → 88%, median failure day 98 → 117, insolvency *throws* 3 → 0. **Worse**: seeds reaching
  T3 18 → 9 — reputation now costs arrivals, which slows the ladder, and that is the mechanic
  working rather than a defect. A 12-seed probe isolates the rest: audit failures 1 → 0,
  indictment contractions 11 → 8, so the indictment deaths in the pacing report are
  **pre-existing and slightly improved**, not something this slice introduced.
  Final live-engine read: 600 reached in 555 days, positive 38.7%, apathetic 53.0%, warm-walk
  share 95.9%, satisfaction **48.5**, review 60.0, regulatory pressure **0.3**, 313 follow-ups
  worked through the pool, `customersServed` 2083 against the ~280 closes it used to count.
  **The four consumers are pinned in the ASSEMBLED world** by
  `tests/LiveFloorWalk.reachability.test.ts` — a module unit test cannot tell "wired" from
  "wired to nothing", which is exactly how this went dark for so long. The #180 harness also
  permanently reports all four now (`[#363 walk consumers]`), so the next retune can see what
  the walk volume does to them.
  223 suites / **2896** tests, typecheck clean.
  Next: **#364** (the `No lot vehicle` crash) — or **BUILD #152** if the director places phase
  9's queue first.

- 2026-08-07 — **BUILT #151** (per-brand reputation — the first of phase 9's twelve). The
  `pickVehicleFor` matcher has carried a `reputationBonusFn` stub returning 0 since #145;
  `Reputation.repFor(brand)` is now the real thing, and the store's record selling a make is
  a live term in every walk-in's match.
  **The input is `staff:auto_resolved`, not `deal:closed`, and that was the load-bearing
  call.** Per-brand standing needs two facts about the same event — *which make* and *how the
  delivery went* — and only the live outcome truth (#180) carries both: it gained a `brand`
  field beside the `vehicleCategory` it already published, and it already carried `badReview`
  (the low-trust forced close). `deal:closed` has no satisfaction signal at all, so feeding
  off it would have meant re-deriving one at a second call site — the exact duplication
  `residualHeat` was consolidated to kill. A walk moves no brand: a customer who never owned
  the car says nothing about it.
  **Three rules, and the third one is a trap-remover.** Standing is keyed by the canonical
  brand id (#224, the same join key the match scores by), carried from sold deals only, and
  **mean-reverts overnight on the same night and by the same rule as the store-wide
  scalars**. Without the drift one rough early run would stain a make for the whole career,
  which is a trap rather than depth. An unseen make reads 0 — no record is neutral, not bad.
  **`repFor` stays the honest state and the weight lives at the boundary.** The composition
  root wires `reputationBonusFn: repFor(brand) × brandReputation.matchWeight`; how much a
  shopper *cares* is the matcher's business, so it is applied in `createWorld` rather than
  baked into the module's read. Read live, so a brand's record moves the very next customer.
  **The calibration finding is the part worth keeping.** Adding the term moved the #180 live
  band: same seed, 28.5% → 39.0% positive, 64.5% → 51.7% apathetic, 213 → 290 closes. I
  measured three weights before touching the band, and the shift is **the same direction and
  the same size at 0.05 and at 0.15**, while 0.001 reproduces the pre-#151 run *exactly* —
  the term either flips a near-tie or it does not, and flipping one re-routes the whole
  600-up seeded trajectory. So this is trajectory divergence from a new score term, **not a
  strength effect, and the harness cannot be used to pick the weight** (a C2-class pass owns
  that magnitude). The apathetic band is re-centred on the new measurement at its old width
  (0.58–0.72 → 0.45–0.59); `positiveMin` is deliberately left where #286 put it, because a
  floor that is still cleared is not evidence for a new floor. All of it is written into
  `data/market-calibration.json#live._doc` so the next reader inherits the reasoning.
  **The business-level pacing did NOT move**: `npm run balance -- pacing` reads 91 of 100
  seeds to T2 (was 90), bankruptcy 18% (was 19%), median survival the full 360 days, and T1
  still clearing in a median 1.0 month against the 2.0 target — the same open miss, no worse.
  **Anti-orphan, because this mechanic has no screen by design** (I6 — ambient depth). A
  number that moves in a module nobody reads is indistinguishable from one that never moves,
  so `tests/BrandReputation.reachability.test.ts` pins both ends in the *assembled* world,
  and `tests/Reputation.perBrand.test.ts` asserts no UI file reads the surface at all.
  Snapshot went v1 → v2 (module-owned; the `modules` key set is unchanged, so **no envelope
  bump and no migration** — a v1 blob restores as "no make has a record yet", which is what
  every pre-#151 save actually was).
  221 suites / **2875** tests, typecheck clean.
  Next: **BUILD #152** — unless the director places #363/#364 first (see Blockers).

- 2026-08-07 — **SLICED phase 9 (B2, F&I as plug-in #2) into twelve issues** — #365–#373 filed,
  #151–#153 absorbed in place. The design was closed the same day, so this session did nothing
  but turn the ruling into build order.
  **The tracer is the reserve, and it had to be, because the honest naming and the missing half
  of back gross are the same change.** #365 renames `credit-tiers.json`'s `apr` to `buyRate`
  (the field has always been the customer's rate wearing the lender's name), adds
  `markupCapPts`, computes the reserve off the existing amortization, and splits `backGross`
  into `productGross` + `reserveGross` on both `ClosedDealResult` and `deal:closed`. Everything
  else in the phase reads one of those two halves.
  **The slicing call worth recording: the three teeth are separate issues on purpose.** #367
  (contractual deal-kill — the lender won't buy an over-marked deal), #368 (CSI drag) and #365's
  free structural kill (a marked-up payment breaching `ptiCap`/`maxTerm`/`ltvCeiling` — I3, no
  new machinery) fail in three different ways and are calibrated against three different
  signals. Merging them would have produced one slice where a miscalibrated curve is
  indistinguishable from a mis-wired gate. The director was offered the merge and declined it.
  **#151–#153 were absorbed as filed, not re-filed.** The grill doc says "absorbed as filed",
  and re-filing them would have left three older duplicates that the chronological rule picks
  up first. Their bodies now carry the locked scope (I4/I5/I6), EARS criteria and corrected
  deps — and #151 shrank in the process: the original body floated a per-*segment* reputation
  surface beside the per-brand one, which I6 rules out entirely. Per-brand reputation is ambient
  depth feeding Reveal text; there is no brand-reputation screen, and a criterion now says so.
  **Two things the slice deliberately does not build**, both because a closed grill already said
  no: a per-product on/off control (Q10 — #369 carries a criterion asserting the surface does not
  exist) and a continuous markup slider (Q9 — three named positions, and #370's peak meter is
  what makes them legible). A future session proposing either is re-opening the grill.
  **Q8 lands inside B2 rather than in a later demand slice** (#372), which is the one place the
  phase reaches outside F&I: advertising campaigns gain person-archetype weights beside the
  vehicle-type weights they already carry. Read-without-move is half a mechanic — #371 tells you
  the crowd leans cash, #372 is how you answer.
  **Flagged, not decided: #363 and #364 have no phase.** Both are live defects out of phase 8 —
  walks never publishing `customer:resolved` (starving four systems) and two customers held on
  one unit throwing `No lot vehicle`. Phase 9's queue starts at #151, so the chronological rule
  will never reach them on its own. Recorded in Blockers with the recommendation that they go
  first; placing them is the director's call, not a slice's.
  Next: **BUILD #151** — the lowest-numbered open, deps-met issue in the phase.

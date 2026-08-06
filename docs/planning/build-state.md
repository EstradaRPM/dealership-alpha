# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phases 6 + 7 — staff teeth & staff slots / facility scale — SLICED 2026-08-04, now BUILD.**

Both gates are closed (C1 2026-08-02 `staff-teeth-design.md`, A2 2026-08-03
`path-to-finished-product.md` §3 A2) and the combined slice is filed as **#352–#362, in build
order**. **#352–#357 closed phase 6 (C1 staff-teeth); #358, #359 + #360 have landed — next
unit: BUILD #361**, the lot cap on buying. Work them in number order; the deps are stated in
each issue's Notes.

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
| #361 | lot cap governs buying ("31 of 35"), trade always lands | 7 |
| #362 | wholesale this unit — the aged-inventory release valve | 7 |

(Phase 4 B3 closed 2026-07-22 — #176, #177, #178; #179 landed earlier in A4.)

## Blockers

- **Phase 5c is DONE — the whole UI-layout rebuild landed 2026-08-02** (#346 Operations, #347
  People, #348 nav stacks, #349 Growth, #350 chart kit, #351 Finance). Every defect in
  `docs/audits/ui-layout-audit.md` is closed out: no placeholder tabs, no dead Operations
  destinations, and walking into a room no longer unmounts the console. **Do not re-grill the
  IA** — `docs/planning/second-level-ia.md` (locked 2026-06-12) stays authoritative; where
  shipped and locked disagree, locked wins.
- **Phase 5 (#74) is no longer blocked on the doors.** The script is still
  `docs/planning/playtest-round-1.md`, presented in-game (#332/#333); its §1 "no web path" line
  is stale as of #338. It sits behind the 6+7 slice in the commit sequence, not behind any
  defect.
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
| 5 | C3 playtest gate (#74), round 1 — HITL | — | pending (doors fixed; sequenced after the 6+7 slice) |
| 5c | UI layout rebuild — #346 Operations · #347 People · #348 nav stacks · #349 Growth · #350 chart kit · #351 Finance (all built 2026-08-02) | — (locked IA already ruled it) | done |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338; #339 sliced into #343→#344→#345, all built; see `docs/agent-workflow-notes.md`) | — | done |
| 5b | Module-boundary debt clearance (#341, #342), surfaced by #335's scan | — | done |
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`** | done — #352–#357 all built |
| 7 | A2 staff slots / facility scale | **LOCKED 2026-08-03 — `path-to-finished-product.md` §3 A2** | active — #352 + #358–#360 built; #361–#362 open |
| 8 | C2 calibration campaign (#286 + #180/#181) | — | pending |
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

- 2026-08-06 — **BUILT #360** (the facility gate face — the dormant fifth face gets a
  producer). *Facility Build-Out · 23% built vs 50%*. The face has been declared in
  `data/tier-gate.json` since #232 and skipped defensively by the engine ever since,
  because nothing produced a number for it. A2 R1's whole reason for making buildings
  purchasable was to give it one.
  **One rule: built ÷ ceiling, per kind, averaged.** Not a combined total. A combined
  built÷ceiling would let the lot buy the entire score — 35 spaces against 6 service bays at
  T3 — while the store ran a one-bay shop; averaging the per-kind ratios makes every
  department's room count the same. Each ratio caps at 1, so a save standing over a ceiling
  reads as done rather than as extra credit.
  **A kind the tier has no ceiling for is EXCLUDED, not counted as unbuilt.** Body bays are 0
  below T3, and "0 of 0 built" would peg a fully built-out Tier-1 store at 67 for a building
  the tier forbids. The flip side is the teeth: **arriving at T3 drops the score**, because
  the body shop just became something you are allowed — and therefore expected — to build.
  That is the only reason the exclusion is worth a rule at all; under a combined total a
  zero ceiling cancels out of both sides and the choice would be invisible.
  **Stepped means read LIVE, never sampled.** No `levelSamples`, no rolling window, nothing
  in the snapshot: the face stands exactly where it stands until the player builds, then it
  steps. A monthly average would report a bar the store has already cleared as still short,
  and would make the same construction worth more early in the month than late. It is also
  why the strip renders it as the cash gauge **minus the trend arrow** — an arrow here would
  read "flat" every day the player did not build and mean nothing.
  **In-flight construction is worth zero to the score**, which is the same rule the ceiling
  measures the other way (committed = built + in flight). Confirmed on screen: buying a body
  bay left the face at 23% with *Building 1 bay — opens day 38* on the row above it.
  **Both "skip the stepped face" filters are deleted, in the verdict and in
  `getTierRequirements`.** They now filter only on "is a configured face", which is what
  keeps #250's `streak` control tunable out. The requirements filter had to move with the
  verdict: it exists so the Growth climb can never foreshadow a bar the gate does not grade,
  and after this it must equally not hide one it does. `GrowthTab.reachability`'s assertion
  flipped from `not.toContain('facility')` to `toContain`.
  **Renamed the label to "Facility Build-Out".** "Facility / Image" promised an image
  standard that goals-targets decision 4 re-homed onto the T4+ OEM stream; the stale name
  only survived because the face was invisible. Making it visible made it a plain-language
  defect, not a design question.
  **Driven on web at a T3 store holding T2's buildings** — the carry-over state #358 created.
  Lot 12 of 35, service 2 of 6, body 0 of 3 ⇒ **23% built vs 50%** on the Home strip
  (arithmetic: (12/35 + 2/6 + 0)/3), the same figure spelled out on the Growth board directly
  under the build surface that produced it, and "% on track" fell 100% → **41%** as the T3
  bars lit. **The live save is `slot:<id>`, not `snapshot:<id>`** — editing the latter changed
  nothing and cost a reload to find out. 216 suites / **2806** tests, typecheck clean.
  Next: **BUILD #361** (lot cap governs buying — "31 of 35" — trade always lands).

- 2026-08-06 — **BUILT #359** (construction — capacity is bought with cash and days).
  *Lot spaces · 8 of 12 built · $3,000 each · 2 days to build* → **Build 4 spaces —
  $12,000** → *Building 4 spaces — opens day 33*. Physical capacity stopped being a
  number you were handed and became a number you buy, which is what A2 R1 was for.
  **The construction DELAY is the mechanic, not a garnish.** Instant capacity collapses
  the decision to "do I have the cash"; a two-to-three-day build makes you buy capacity
  *ahead* of demand, which is the actual dealership decision. Stored as an absolute
  `completesOnDay` compared against the current day at the morning settle — the #295
  frontline-hold idiom exactly, so nothing decrements a counter that could drift out of
  step with the calendar across a save/load. Also answers the tier CSV's own open row 16
  ("Time to upgrade? construction time?").
  **A block is the size of one job, not a divisor.** `blockSize` is clamped down to the
  room left and priced for what it actually builds — 5 against a gap of 4 builds 4 for
  $12,000 — so the ceiling is always exactly reachable *without a second pricing rule*.
  The alternative (a full-price partial block, or a prorated "last block") is two rules
  where one will do.
  **Committed capacity is built PLUS in flight, and that is what the ceiling measures.**
  It is why the same space can never be paid for twice, and why the lot button flipped to
  "Built out to the tier limit" the instant the job was scheduled rather than three days
  later. In-flight units are worth nothing on the floor until they land — `getBuilt()`
  never counts them.
  **A refusal changes nothing at all.** `at-ceiling` and `cannot-afford` are checked
  before the debit, so no cash moves and no job is scheduled; the container commits and
  re-reads rather than guarding first, because the engine owns every rule the button could
  get wrong. The two refusals get **different sentences**: "Built out to the tier limit"
  is an achievement, "Not available at this tier" is a lock, and a body shop at T2 is the
  second one.
  **Prices are FLAT across the ladder** (`data/facility.json` gained a `construction`
  block; `facilityData.ts` is now the module's catalog, `loadFacilityData`). A service bay
  costs what a service bay costs — a per-tier price table would be a second number beside
  the ceiling and would make the same purchase mean two things depending on where the
  player stood. Numbers are placeholders pending C2 (#286).
  **First `facility:*` publisher, and only one event.** `facility:capacity_built` carries
  the kind's new TOTAL plus the delta, published from `clock:day_started` so finished
  capacity is standing *before* the day's department drain snapshots its bay count. No
  `construction_started` event — it would have had a publisher and no subscriber.
  **No envelope bump.** Jobs live inside the existing `facility` blob, which is the
  module's own `schemaVersion` 1 → 2 (`AnyFacilitySnapshot` is the union `restore` takes).
  A #358 v1 blob restores as "nothing being built" — the state every save already was in —
  so `data/fixtures/tier-2.json` needed no re-stamp and the v1 path stays exercised in
  real play.
  **The surface is in GROWTH, derived from the locked charter, not a new IA fork.** Growth
  is "work ON the business — everything that compounds"; buying buildings compounds and
  spends the same cash inventory wants. It sits directly above the gate board because the
  `facility` gate face (#360) is what will grade it.
  **Driven on web at T2, single clicks, no timeouts.** T2 fixture → a day closed (the
  autosave wrote the v2 blob with `jobs: []` through the real path) → stood the store below
  its ceiling in the saved blob → reloaded: *8 of 12 built* / **Build 4 spaces — $12,000**.
  Pressed it: cash $222,734 → **$210,734** (exactly $12,000, and Home's next-day delta read
  *-$12,000 vs yesterday*), the row held at *8 of 12 built* with *Building 4 spaces — opens
  day 33*, and the button flipped to "Built out to the tier limit". Ran days 31→33; on the
  morning of day 33 it read **12 of 12 built** with the pill gone, service bays untouched at
  *2 of 4*. 216 suites / **2793** tests, typecheck clean.
  Next: **BUILD #360** (facility score lights the dormant tier-gate `facility` face).

- 2026-08-06 — **BUILT #358** (the Facility module — built capacity, tier as the ceiling).
  Physical capacity stopped being a per-tier constant nobody owns: `src/game/Facility/` holds
  built lot spaces, service bays and body bays as persisted state, and the tier's number
  became the **ceiling** over each. That is A2 R1 — *desks come with the tier, buildings are
  bought* — made structural before #359 lets anyone spend money on it.
  **`baysByTier` left in the same commit that replaced it**, out of `data/tunables.json` *and*
  both zod schemas (`serviceDispatchData.ts`, `bodyShopDispatchConfig.ts`). Fifth placeholder
  deleted across 6+7 (`headcountCapByTier` #352, `weeklyPayrollStub` #353, `hiringCostByTier`
  #355, `payVsMarketBonus` #356), and the same bug each time: a number the player could never
  own. The dispatch engines now take `bays` — a count, the narrowest possible dep — replacing
  `facilityTier` + a config lookup. `min(bays, advisors)` is untouched.
  **The ceiling is derived from the live tier and never stored**, so a tier-up cannot leave a
  stale ceiling behind and there is nothing in it to migrate. Only what is BUILT persists.
  **Carry-over is the behavior change, and it is the ruling, not an oversight.** A fresh world
  seeds at its tier's ceilings, so nothing about today's play moves — but a store that
  tier-ups keeps the bays it had. That is exactly what makes the dormant `facility` gate face
  (#360) measurable as built ÷ ceiling; "tier grants everything" would peg it at 100 forever.
  The consequence surfaced immediately in two suites that fake a tier by forcing
  `tierManager` on a fresh T1 world: they now also have to say the store built out, which they
  do through `createDefaultFacilitySnapshot(tier)` — the same shape a tier-N save carries.
  **No `facility:*` event, and the module takes no bus.** Nothing in this slice *changes* a
  built number; construction (#359) is the first publisher. An event with no publisher is dead
  code, and this repo's rule is to delete those, not to pre-add them.
  **`data/facility.json` follows the slot table's precedent exactly** (#352): monotonic by
  schema (a file that decreases is refused — a tier never takes capacity away), all seven
  tiers stated per row so a missing key can never read as "no capacity" and silently shut a
  department, and an out-of-range tier clamped into the ladder. Where the CSV stops (service
  bays at T3, lot/body at T5) the last value repeats, flagged as C2 calibration, not design.
  **Envelope v20 → v21, and the migration reads the save's ACTUAL tier** out of the
  `tierManager` blob rather than defaulting to 1 — the #314 Body-Shop-gate idiom. A migrated
  Tier-3 store keeps running the bays it was already running; defaulting to 1 would have taken
  a franchise store's shop away on load. `data/fixtures/tier-2.json` re-stamped **in place**
  through the real migrate + restoreWorld + snapshotWorld path (not `gen:fixtures` — the
  harness bot never reaches T2), and it now carries `{lotSpaces:12, serviceBays:4, bodyBays:0}`,
  which is precisely what the retired constant gave it.
  **Driven on web at T2, single clicks, no timeouts.** The re-stamped fixture restored through
  the new `facility` key (Day 31, $222,734, Tier 2), Operations → Service rendered, and a full
  day opened, ran and closed on the Reveal recap — so the drain built against the Facility-fed
  bay count end to end. 216 suites / **2776** tests, typecheck clean.
  Next: **BUILD #359** (construction — buy capacity with cash + days, ceiling enforced, Growth
  build surface).

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
order**. **#352–#355 have landed — next unit: BUILD #356** (raise demands + `payVsMarketBonus`
made real). Work them in number order; the deps are stated in each issue's Notes.

| # | Slice | Phase |
|---|---|---|
| ~~#352~~ | ~~per-role slot table = the hiring cap; `headcountCapByTier` deleted~~ **BUILT 2026-08-05** | 7 → unblocks 6 |
| ~~#353~~ | ~~`data/staff-pay.json`, derived grade, `paidGrade`, daily payroll drain; `weeklyPayrollStub` deleted~~ **BUILT 2026-08-05** | 6 |
| ~~#354~~ | ~~People surface: grade + wage per card, total daily payroll~~ **BUILT 2026-08-05** (the skill-bar `flexDirection` defect was already dead — #347 deleted `PersonnelScreen`) | 6 |
| ~~#355~~ | ~~hire fee = multiple × daily wage; `hiringCostByTier` retired~~ **BUILT 2026-08-06** | 6 |
| #356 | raise demands (ask/answer) + `payVsMarketBonus` made real | 6 |
| #357 | rival offers on the same event family (retention + poaching, one moment) | 6 |
| #358 | `src/game/Facility/` owns built spaces + bays, one bay truth; `baysByTier` retired | 7 |
| #359 | construction: buy capacity with cash + days, ceiling enforced, Growth build surface | 7 |
| #360 | facility score lights the dormant tier-gate `facility` face | 7 |
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
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`** | active — #355 built; #356–#357 open |
| 7 | A2 staff slots / facility scale | **LOCKED 2026-08-03 — `path-to-finished-product.md` §3 A2** | active — #352 built; #358–#362 open |
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

- 2026-08-06 — **BUILT #355** (the talent-scaled hire fee). What you pay to sign someone is now
  `hireFeeMultiple × their own daily wage`, so one number in `data/staff-pay.json` prices both
  signing them and keeping them.
  **`hiringCostByTier` left in the same commit that replaced it** — out of `data/tunables.json`,
  out of `StaffOrgConfigSchema`, out of the one call site. That is the third flat per-tier table
  deleted in this phase (`headcountCapByTier` #352, `weeklyPayrollStub` #353), and the same bug
  each time: a price that ignores the thing it is pricing. Under it a grade-5 closer and a
  greenpea both signed for exactly $1,000.
  **The fee is derived, not a second table, because a second table drifts.** `hireFeeMultiple`
  already lived in the pay book (#353 put it there for this slice); nothing new was added to
  `data/`. `CandidateListing.hiringCost` **keeps its name** — renaming it would have churned
  `staff:hired`'s payload, the balance harness's policy, and the People card for no gain — but it
  now means "what this **person** costs to sign", never "what this role costs".
  **A role the pay book does not name throws instead of falling back.** The old code ended
  `?? 1000`, so an unnamed role silently signed for a default; the fee now inherits the wage
  read's loud failure, which is the same grammar the slot table uses.
  **The compiler drove the test sweep, and it exposed two assertions that the change would have
  quietly hollowed out.** `noPay()` (the helper for suites that hire people to exercise something
  else) makes the fee **$0**, which turned "throws when cash is insufficient" and "deducts hiring
  cost from Economy cash" into tautologies — both now run on a real wage table. Economy's
  "payroll pushes cash negative" test opened the store with one day's float; it now opens with the
  two signing fees plus that float, and states the fee's size as it does so.
  **The grade-5-vs-grade-1 criterion is asserted on a forced grade, not a hoped-for pool.** The
  same seeded person is read through bands that put everyone at the top of the ladder and bands
  that put everyone at the bottom — same `staff.id`, grade 5 vs grade 1, strictly different fee.
  Fishing two grades out of the archetype board would have made the test a fact about one seed.
  **Driven on web at T2/Day 32**: three applicants for the *same* Service Advisor desk quoted
  **$1,300** (Grade 3 · $260/day), **$700** (Grade 1 · $140/day) and $700 — under the retired
  table all three read $1,000. Hiring the $700 candidate moved cash $184,305 → $183,605, exactly
  the number on the card. 215 suites / **2725** tests, typecheck clean.
  Next: **BUILD #356** (raise demands + `payVsMarketBonus` made real).

- 2026-08-05 — **BUILT #353** (the wage book + the nightly payroll drain). Payroll finally
  scales with the roster: every person burns a daily wage set by grade (1–5) × role, and that
  is the entire pay model.
  **`weeklyPayrollStub` left in the same commit that replaced it** — out of `data/tunables.json`,
  out of `EconomyConfigSchema`, out of the call site — so the old flat $800/week cannot be read
  and typecheck. Economy's `clock:overnight_payroll` subscription posts **rent only** now;
  StaffOrg owns the salary book because it owns the roster. ~20 test files carried
  `weeklyPayrollStub: 0` in an `EconomyConfig` literal; excess-property checking made that a
  mechanical, compiler-verified sweep rather than a search.
  **Two calls the design doc left open were resolved in code, and both are load-bearing.**
  Grade bands the **0–1 ratio**, not the raw `effectiveness` composite: that composite is a
  weighted *sum* whose range depends on how many axes a role grants (1.5 for a salesperson, 3.7
  for a UCM), so absolute edges against it would have made every manager a grade 5 and capped
  every salesperson at 3. The shipped edges put the ladder's own anchors where
  `staff-performance-ladder.md:27` says they belong — green 0.35 → grade 2, mature 0.75 → grade 4.
  And it reads the **grown** `effectiveSkills`, not the base roll: the base composite never
  changes, so banding it would have frozen every grade for the whole career and left #356's
  raise trigger with nothing to fire on. One formula serves both readings — `compositeRatio`
  now takes skill *values* and is exported from NPC, so `effectivenessRatio` keeps passing base
  skills and **every promotion/capability gate stays calibrated exactly where it was**.
  **`paidGrade` is the one new field on `Staff`, and it is stamped at `hire()`, never by the
  factories** — a candidate on the board is not on anyone's payroll, so `paidGrade` is what
  "employed here" means. The wage charged is `wage(role, paidGrade)`; growth never silently
  reprices anyone (the rejected "wage auto-follows grade"), which is precisely what leaves
  `grade > paidGrade` as the whole raise trigger with no new counters. A promotion keeps
  `paidGrade` and moves the wage by role — you took the desk, you get the desk's pay.
  **No save-envelope bump.** The field sits inside the staffOrg blob, so per the recipe it is
  that module's problem: `restore` materializes a missing `paidGrade` from the member's current
  grade, which is behavior-neutral — they load paid what they are currently worth, so the
  trigger starts quiet exactly as a fresh hire does. The tier-2 fixture needed no re-stamp.
  **`forceDebit`, not `postExpense`** — payroll you cannot afford is meant to push cash negative
  and wake `BankruptcyMonitor`, not throw and abort the overnight sequence (the same idiom rent
  and the marketing drains use). An empty roster posts **nothing**, not a $0 entry.
  **Two data-shape rules are schema, not convention:** the wage table refuses a file where a
  higher grade costs less (a transposed digit would read as balance instead of a typo), and the
  grade bands must strictly increase or a grade is unreachable. A role the pay book does not
  name throws, the same grammar the slot table uses — a free employee is the bug being deleted.
  **The Browser pane was not compositing frames**, so the click-through drive was impossible
  (no screenshot ⇒ no coordinate clicks, and the T2 dev button carries no a11y ref). The
  evidence is `tests/Payroll.reachability.test.ts` instead: a real `createWorld` charging the
  *shipped* pay book, and the drain landing as its own "Payroll" bar through the real
  `groupExpenses` rather than folding into "Other". That runs in CI; a web drive does not.
  215 suites / **2711** tests, typecheck clean.
  Next: **BUILD #354** (People surface: grade + wage per card, total daily payroll, the skill-bar
  `flexDirection` fix).

- 2026-08-05 — **BUILT #354** (the People wage surface). Grade and daily wage now sit on every
  card, and the roster's total daily drain sits under the slot board that produced it.
  **The issue's central defect was already dead, and the file it named no longer exists.**
  #354 was written against `src/ui/PersonnelScreen/PersonnelScreen.tsx` — the `SkillRow` that
  sized its fill with `flex: ratio` inside a container missing `flexDirection: 'row'`, so every
  skill bar rendered identically. **#347 deleted that screen**; the People tab renders kit
  `Meter` → `ProgressBar`, which sizes the fill with a **percentage width**, not flex, and
  carries `fillTestID` precisely so proportion is assertable. The existing smoke test already
  locked one member's two skills at 70% / 20%; this slice adds the criterion's *other* reading —
  two **members** differing on the same axis (70% vs 15%). No source change was needed and none
  was invented; a stale `file:line` in an issue is not a defect to re-create.
  **The payroll total is a PROP, not a sum over the cards.** `world.staffOrg.dailyPayroll` is the
  same number `clock:overnight_payroll` charges, so the screen and the ledger cannot drift; a
  test pins a `dailyPayroll` that deliberately disagrees with the cards to prove the surface is
  reading the engine rather than re-adding. Same rule for the per-member numbers: they come off
  `getPayBoard()` keyed by staff id, and a candidate's off `CandidateListing.grade`/`dailyWage`,
  so the card and `hire()` agree by construction.
  **A divergent grade is stated as two numbers, never blended** — `Grade 4 · Paid at grade 3 ·
  $340/day`. Averaging them would name a wage nobody is paying and would hide exactly the gap
  #356's raise demand fires on. The phrasing covers *both* directions of divergence, because a
  promotion changes which skills the composite weighs and can move the derived grade **down**
  while `paidGrade` stays put.
  **Two money numbers on one candidate card needed labels, not just placement.** The sign-on fee
  keeps the head-right slot and now carries a `to sign` caption; the wage sits under the role as
  `Grade 2 · $220/day`. Unlabelled, they read as two prices for the same thing.
  **The payroll row does not render with an empty roster** — a `$0/day` line is a number the
  player can do nothing with, and the "Nobody on payroll" hint already says it. Same rule the
  slot board follows for a job nothing can reach.
  **The web drive was impossible again for the documented reason**: the Browser pane is hidden,
  so `document.visibilityState` is `"hidden"` and `requestAnimationFrame` fires zero frames — the
  rAF probe itself times out, and every `computer` click with it. Evidence is two reachability
  tests instead, on a real `createWorld`: the candidate card states the engine's own grade+wage,
  the *same string* appears on the roster card after hiring (proving `paidGrade` is stamped from
  the listing), and the payroll line matches `staffOrg.dailyPayroll` exactly. Those run in CI.
  215 suites / **2720** tests, typecheck clean.
  Next: **BUILD #355** (hire fee = multiple × daily wage; `hiringCostByTier` retired).

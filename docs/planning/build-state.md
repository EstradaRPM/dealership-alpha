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
order**. **#352 and #353 landed 2026-08-05 — next unit: BUILD #354** (the People wage surface).
Work them in number order; the deps are stated in each issue's Notes.

| # | Slice | Phase |
|---|---|---|
| ~~#352~~ | ~~per-role slot table = the hiring cap; `headcountCapByTier` deleted~~ **BUILT 2026-08-05** | 7 → unblocks 6 |
| ~~#353~~ | ~~`data/staff-pay.json`, derived grade, `paidGrade`, daily payroll drain; `weeklyPayrollStub` deleted~~ **BUILT 2026-08-05** | 6 |
| #354 | People surface: grade + wage per card, total daily payroll, skill-bar `flexDirection` fix | 6 |
| #355 | hire fee = multiple × daily wage; `hiringCostByTier` retired | 6 |
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
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`** | active — #353 built; #354–#357 open |
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

- 2026-08-05 — **BUILT #352** (per-role slot table). Scarcity is per **job**, not per body:
  `data/staff-slots.json` is role → count per tier, and it is now the only headcount ceiling
  in the game.
  **`headcountCapByTier` left in the same commit that replaced it** — gone from
  `data/tunables.json`, gone from the zod schema, gone from both call sites — so nothing can
  read the old flat `{1:4, 2:8, 3:16}` and typecheck. `staffOrg.headcountCap` survives as a
  *derived* read (the sum of the tier's slots) because the criterion asked for it, but there is
  no second number that could disagree with the table.
  **Three things the CSV did not say, resolved in data rather than left to the implementer.**
  The table is **monotonic** and `StaffSlotTableSchema` refuses a file that decreases — the CSV's
  dropped `f&i-manager` row at T4/T5 is an omission, and the schema now makes re-reading it as a
  removal impossible. Every role states all seven tiers explicitly; a missing tier key would read
  as "no slots", which locks the player out of a job and looks like balance instead of a broken
  file, so `slotTotalFor` **clamps** an out-of-range tier and `getSlots` **throws** for a role the
  table does not name. The promotion-only worker roles (`lot-porter`, `technician`) each mirror the
  role they promote into — the bench that feeds a desk is as wide as the desk it feeds — which puts
  `technician` at 0 at T1, where no service department exists.
  **Slots gate promotion, not just hiring, and that is where the worker roles are enforced at all.**
  `promote()` throws on a full target and `getPromotionOptions` filters them out, so no surface
  renders a press the engine would refuse. Since `src/app/config.ts` keeps worker roles off the
  hiring surface, their slot counts would otherwise have been inert data.
  **The People tab's "N of cap" line is now the slot board**, and an empty slot IS the hire
  affordance — pressing an open desk selects that job in the hiring pool. A candidate is blocked by
  the **selected job's** desks, not the store total: the regression the flat cap caused was that
  filling the sales floor shut off hiring for the whole store, service desk included.
  **A row earns its place two ways only** — the tier opened a desk you can hire into, or somebody
  is sitting in one. The first web drive showed "Lot Porter 0 of 2" and "Technician 0 of 1" at T2:
  permanently empty rows for jobs nothing can reach, which is exactly the foreshadow tile the locked
  IA bans. Both are gone.
  **Driven on web at T2/Day 31**: the board reads Salesperson 2 of 2 · Service Advisor 0 of 1 ·
  Used Car Manager **1 of 0**, the three salesperson applicants all say "No desk open for this job",
  and pressing the open Service Advisor desk swapped the pool to three service advisors offering
  "Hire — $1,000". The "1 of 0" is the stale T2 fixture (a UCM whose desk opens at T3, hireable back
  when the cap counted bodies) displayed honestly — the same grammar A2 R2 gives the lot cap.
  No save migration: slots are derived from tier + roster. 212 suites / **2671** tests, typecheck clean.
  Next: **BUILD #353** (wage book + daily payroll drain).

- 2026-08-04 — **SLICED phases 6 + 7 as one pass** → **#352–#362**, filed in build order, every
  issue carrying EARS acceptance criteria with named tests.
  **The order puts the slot table first and the wage stack immediately behind it**, because #352 is
  C1's scarcity cap (R3) and is the only hard dependency between the two phases; everything else in
  A2 (facility, lot cap) is orthogonal to wages, so it lands after staff-teeth is fully live rather
  than in front of it. Sequence: **#352** slots → **#353** wage book + daily drain → **#354** People
  surface → **#355** hire fee → **#356** raises → **#357** rival offers → **#358** Facility module →
  **#359** construction → **#360** facility gate face → **#361** lot cap → **#362** wholesale.
  **Two engine slices deliberately ship without UI, and two UI slices deliberately trail their
  engine.** #353 charges the wage before #354 displays it — a wage shown on a card and not charged
  is a lie on screen for a commit; the drain is honest the day it appears, reading in the ledger as
  "Payroll". #358 changes *no* behavior on purpose (built capacity is seeded to today's per-tier
  constants), so the risky part — moving bays from constant to owned state behind one provider — is
  verifiable on its own before #359 lets anyone spend money on it.
  **Three retirements are criteria, not cleanup.** `headcountCapByTier` (#352), `weeklyPayrollStub`
  (#353), `hiringCostByTier` (#355) and `baysByTier` (#358) each leave their JSON *and* their zod
  schema in the same slice that replaces them, so typecheck fails if anything still reads the old
  number. Two truths that can disagree is the bug this build order exists to avoid.
  **One placement call was made rather than escalated:** the facility build surface goes in
  **GROWTH**, derived from the locked charter's filing test — "work ON the business, everything that
  compounds across months" (`second-level-ia.md` §1). Facility expansion compounds and competes with
  inventory cash; it is not a room you walk into. The *occupancy* read ("31 of 35") lives where the
  stock does, on the Lot room and the auction surface. This is a charter application, not a new IA
  fork.
  **Two source gaps were resolved in the issues rather than left for the implementer to trip on:**
  the CSV's staff row stops repeating `f&i-manager` at T4/T5 (an omission — the table is monotonic,
  a tier never removes a desk), and it never names `lot-porter`/`technician` at all (they are
  promotion-only per `src/app/config.ts:249`, so their slots gate promotion, and a role the UI offers
  at a tier may never hold 0 slots — that is the A1 regression class inverted). Roles that do not
  exist yet (NCM, BDC manager) sit in the table unused; the fixed-ops-manager row is still an open
  gate at phase 15, and the slot table is data, so it changes without code.
  Every issue names its rejected alternatives with the director's reasons — draw-against-commission
  (#353), wage-auto-follows-grade and fixed-at-hire (#356), and R2's five (#361, chief among them the
  **overflow lot**, which the director raised and withdrew). No slice may reopen one.
  Next: **BUILD #352**.

# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phase 5c — UI layout rebuild (#346–#351), director-directed 2026-08-02**

(Phase 4 B3 closed 2026-07-22 — #176, #177, #178; #179 landed earlier in A4.)

## Blockers

- **Phase 5 (#74) is blocked behind phase 5c, by director call 2026-08-02.** A drive-through
  audit on the web target found **6 of the 9 destinations reachable from Operations open an
  empty or dark screen at Tier 1**, and two of the five primary tabs are placeholder cards.
  Round 1's script routes the player through Operations on Day 0 and every day after, so
  running it now measures the doors, not the loop. Audit: `docs/audits/ui-layout-audit.md`.
  The script itself stays valid — it is `docs/planning/playtest-round-1.md`, presented in-game
  (#332/#333), and its §1 "no web path" line is stale as of #338.
- **The layout was never re-decided — it was never built.** `docs/planning/second-level-ia.md`
  (locked 2026-06-12) already specifies the fix for nearly every audited defect. The
  UI-rebrand chain stopped after Home (S1–S4, S3a–S3f); no Operations/People/Finance/Growth
  slice was ever filed. #346–#351 are that filing. **Do not re-grill the IA** — where shipped
  and locked disagree, locked wins.
- **Phase 5b is done** (#341, #342) — as is 5a. **There is no agent-side work left before the
  playtest.** Phase 6's gate is now ruled (`/decide C1`, 2026-08-02); phase 7's is not, and
  C1's R3 made it a prerequisite — so the next `/next` is **`/decide A2`**, not a BUILD.
- **Phase 6 cannot be sliced alone.** C1's scarcity ruling points at the CSV's per-role staff
  counts, and nothing in the repo enforces them (`staffOrg.headcountCapByTier` is a flat
  `{1:4,2:8,3:16}`). Rule A2 first, then slice 6 and 7 together — building staff-teeth against a
  flat cap leaves half the mechanic inert.
- **5a issue states on GitHub are not trustworthy.** #334 was CLOSED-but-undone. Check each
  of #335–#339 against the repo before assuming it landed. (#339 is closed as **sliced**, not
  built — its work was #343/#344/#345, all three now built.)
- **The seeded-RNG separator is a NUL byte, and it is invisible.** `deriveSeed` joins namespace
  and ctx with U+0000. #342 nearly shipped a whole-game determinism break by retyping that line
  with a space. `tests/Rng.test.ts` carries the regression lock that caught it — never weaken it.

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
| 5 | C3 playtest gate (#74), round 1 — HITL | — | blocked on 5c |
| 5c | UI layout rebuild — #346 Operations · #347 People · #348 nav stacks · #349 Growth · #350 chart kit · #351 Finance | — (locked IA already rules it) | active |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338; #339 sliced into #343→#344→#345, all built; see `docs/agent-workflow-notes.md`) | — | done |
| 5b | Module-boundary debt clearance (#341, #342), surfaced by #335's scan | — | done |
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`.** Next unit: SLICE (after phase 7) | pending |
| 7 | A2 staff slots / facility scale | **ADJUDICATE [NEW]** — **run before phase 6's build** (C1's R3 made the CSV slot table staff-teeth's scarcity gate) | pending |
| 8 | C2 calibration campaign (#286 + #180/#181) | — | pending |
| 9 | B2 F&I plug-in #2 (+#151–#153) | **RESUME parked grill** (fni-mechanics-grill-state.md) | pending |
| 10 | D1 People + Finance + Growth dashboards (chart kit first) | — | pending |
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

- 2026-08-02 — **AUDITED the whole UI on the web target; filed phase 5c (#346–#351).**
  Director drove the #74 playtest request into a layout audit. Record:
  **`docs/audits/ui-layout-audit.md`** — every surface driven live at T1, every tappable target
  pressed, each control traced to its wiring.
  **The finding is an absence, not a disagreement.** `second-level-ia.md` locked the second-level
  IA on 2026-06-12 and it was never decomposed into issues past Home. Operations still runs the
  #215 shell tracer composition: five hardcoded department buttons routing to one generic
  empty-queue screen, **Lot among them** — an empty queue while three cars sit on the lot one tab
  away, when the locked IA gives Lot the entire stock pipeline (list + pricing + auction). Prep
  holds three navigation links the IA explicitly bans there, plus the advertising lever the IA
  assigns to Growth. `OwnershipLevers` is the **last pre-kit surface anywhere** — raw `colors`
  import + literal `StyleSheet` values — which is why the tab's top and bottom look like two
  different games. People renders only manager delegation (all three ABSENT at T1) while its
  chartered roster + hiring sit two levels down inside Operations. Finance and Growth are
  placeholder cards carrying *"coming in a later slice"* copy — the foreshadow-tease IA rule 3
  forbids. Pushed screens unmount the tab bar, which IA §3 names as the pattern to replace.
  **Also surfaced, outside the layout:** all three salesperson candidates cost exactly $1,000
  against 48%/70%/62% effectiveness (`tunables.json:252` keys cost to role class), so the first
  decision the game asks for has a strictly dominant answer — inside phase 6's C1 ruling already;
  and roster members have no names.
  **Sequencing:** #74 moved to `blocked on 5c`. The script is fine; the doors it walks the player
  through are not. Build order is #346 → #347 → #348 → #349 → #350 → #351.
- 2026-08-02 — **RULED C1 staff-teeth** (`/decide C1`) — the last designed-but-ungrilled core
  mechanic. Record: **`docs/planning/staff-teeth-design.md`**; §5 C1 flipped to
  `[LOCKED 2026-08-02]`; gate row moved to `gates.md`'s Settled section.
  **The measured "zero teeth" state was worse than the spine claimed, and all five facts are in
  the doc's table.** Payroll is a flat `$800/week` constant (`weeklyPayrollStub`, posted at
  `Economy.ts:67`) — the fifth hire costs **$0/week**. Hire cost is flat per role class
  (`StaffOrg.ts:175`); no salary field exists at all (`staff-roles.json` has none, and
  `StaffOrg/CLAUDE.md:57` claimed otherwise — stale). The candidate board is wiped and rerolled
  **every morning** (`StaffOrg.ts:145`), so disliking today's three costs one free day. And
  `payVsMarketBonus` fires **unconditionally** every payroll night (`StaffMorale.ts:93`) —
  a placeholder wearing a mechanic's name.
  **R1 — one daily wage, grade × role. Commission was rejected, and the standing recommendation
  going in was wrong on its own terms.** The director's objection is recorded because it is the
  reusable lesson: draw-against-commission is **four comp structures**, not one (sales/F&I on
  commission, techs flat-rate hours, advisors salary + service cut, managers salary + dept bonus)
  — four rules to explain one line item, against a hard standing bar of *playable, enjoyable,
  easy to understand*. And the case for it ("a flat drain never teaches you anything") is
  **backwards**: a fixed cost against variable revenue is exactly what makes a slow day hurt;
  commission partly self-insures a bad week. The simpler rule was also the sharper one.
  **R2 — raises are a moment you play.** They ask, you pay or refuse; refusing feeds the existing
  `StaffMorale` → `staff:quit` path. Chosen over auto-repricing and fixed-forever because it is a
  *decision*, which is precisely `poaching-cut.md`'s finding. **Retention and poaching are now one
  mechanic** — a rival offer is the same prompt with a name and a deadline, so spine §5's required
  poaching teeth cost no second thing to learn.
  **R3 — the CSV slot table is the scarcity cap.** No rarity roll, no persistent named labor
  market: you can't field five A-players because you don't have five slots (T1 = 1 salesperson),
  and the wage gates quality on top. **This makes phase 7 (A2) a prerequisite for phase 6's build**
  — `headcountCapByTier` is a flat `{1:4,2:8,3:16}` with no per-role breakdown, so nothing
  enforces the CSV today and the slot half would sit inert. Recorded in the doc §6, in the phase
  table, and as a note on A2's `gates.md` row.
  **Internal calls (8, all in doc §3), two of which do real work:** `grade` is a *derived* band of
  the existing `effectiveness` composite — not a second source of truth; and `paidGrade` (stored
  at hire) vs current grade **is** the whole raise trigger, falling straight out of the Model B
  growth already shipped in #294. No new state machine, no new counters.
  **A director-reported UI defect is folded into C1's scope, with a root cause.** Skill bars look
  identical for every employee: `SkillRow` (`PersonnelScreen.tsx:22`) sizes the fill with
  `flex: ratio` against a `flex: 1 - ratio` spacer, but `skillBarBg` (`:565`) never sets
  `flexDirection: 'row'` — RN defaults to **column**, so fill and spacer stack vertically in a
  6px-tall box and the bar carries zero information. The A-vs-B comparison this entire gate
  depends on is currently impossible to make on screen, so it is not a later polish pass.
  **Not a build — nothing under `src/` changed but one stale `StaffOrg/CLAUDE.md` line** (it
  claimed `staff-roles.json` holds salaries; it holds none). Suite run anyway to prove that:
  199 suites / **2469** tests green, unchanged counts from #342.
  Next /next is **`/decide A2`** (phase 7) per R3's sequencing finding, then SLICE 6+7.
  **Carried into phase 6's slice, unfixed by design:** the `PersonnelScreen` skill-bar defect
  above. It is a ~2-line fix (`flexDirection: 'row'` + `overflow: 'hidden'` on `skillBarBg`),
  independent of everything else, and blocks nothing — a decision unit does not get to start
  building the phase it just unblocked.
- 2026-08-01 — **BUILT #342** (seeded RNG gets its own module) — **phase 5b is done, and with
  it every agent-side item before the #74 playtest.**
  **The fork went to a new module, not a re-export.** `src/game/NPC/Rng.ts` → `src/game/Rng/`
  (`Rng.ts` + a two-line barrel + `CLAUDE.md`), 34 import lines rewritten. Re-exporting from
  NPC's barrel was the one-line option and it is the wrong one: it would make determinism part
  of NPC's *public promise*, a claim about NPC that isn't true, and it would leave `Inventory →
  NPC`, `Weather → NPC`, `PartsInventory → NPC` as dependencies that exist for no domain reason.
  Sixteen modules plus `createWorld` plus the harness draw from it — that is infrastructure, in
  the same class as `data/`. `tests/Rng.test.ts` now asserts **both** directions: the two
  functions are on the Rng barrel, and they are still *absent* from NPC's.
  **The move nearly broke every stream in the game, and the catch is the story.** `deriveSeed`
  joins namespace and ctx with a **literal NUL (U+0000)** — invisible in an editor, rendered as
  a space by the file-read path, and therefore silently retyped as a space when the file was
  copied to its new home. Ten suites went red: `deriveSeed(12345, 'customer', {day:1,slot:0})`
  came back `2170378250` instead of `3789376038`. Every seed in the game had moved. **The only
  thing standing between that and a commit was the regression lock** — a single hard-coded
  expected seed, exactly the kind of assertion that looks redundant next to the
  same-input-same-output tests around it. It is now commented at the call site with why the
  byte is load-bearing (collision-proofing *and* fixture compatibility) and how to re-verify.
  Two-sided proof that determinism survived: the code in `Rng.ts` is **byte-identical to the
  pre-move original** apart from that comment, and a 5-seed × 150-day competent pacing run
  captured **before** the move is `cmp`-identical to the same run after. `data/**` untouched,
  so the committed tier fixtures are the same bytes and `tests/tierFixtures.test.ts` is green.
  199 suites / **2469** tests (2467 + the two new barrel assertions), typecheck clean.
  **The allow-list is 81/71 → 22 reach-ins / 13 files**, and both bulk classes are gone (#341
  cleared `parseData`, this cleared `NPC/Rng`). It does **not** become empty, as #342's fourth
  criterion assumed — the residue is 22 individually-argued one-offs, mostly tests asserting
  against a module's internal Zod schemas. So the file survives as a short list of decisions
  rather than a backlog; `.claude/hooks/README.md` now says that.
  One trap found while cleaning up: `hooks:test`'s "grandfathered reach-in is not blocked" case
  named `createWorld → NPC/Rng`, which this change turned from grandfathered into blocked — the
  selftest would have gone red on a correct repo. It now names a pair that is genuinely in the
  allow-list, with a comment saying the case must be re-pointed whenever a class is cleared.
  `.claude/hooks/selftest.mjs`'s other Rng probes pointed at a path that no longer exists;
  repointed at `NPC/schemas/staff`. ADR-0001 carries an amendment note rather than a rewrite.
  Next /next is **`/decide C1`** (staff-teeth grill) — phase 6. Not a BUILD.

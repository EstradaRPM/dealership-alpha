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
- **Phase 5b is done** (#341, #342) — as is 5a. Phase 6's gate is ruled (`/decide C1`,
  2026-08-02); phase 7's is not, and C1's R3 made it a prerequisite — so **`/decide A2` is the
  unit that follows phase 5c**, before any phase-6 slice.
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
| 5c | UI layout rebuild — ~~#346 Operations~~ · ~~#347 People~~ (both built 2026-08-02) · #348 nav stacks · #349 Growth · #350 chart kit · #351 Finance | — (locked IA already rules it) | active |
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

- 2026-08-02 — **BUILT #347** (People rebuild) — the org tab exists now, and the drive found
  two engine defects on the way that are fixed with it.
  **People is one surface with three sections.** `people-region-roster` · `people-region-hiring`
  · `people-region-managers`, all kit-styled off `useTheme()`. Before this the tab rendered
  *only* the delegation card — three ABSENT rows at Tier 1 — while the roster and the candidate
  pool sat two levels down behind Operations → Prep → Hire Staff, in the wrong tab entirely.
  **`PersonnelScreen` is gone, not restyled — and so is the `personnel` route.** The old flow
  pushed a full-screen route that unmounted the tab bar (IA §3 names that as the pattern to
  replace) and hid every candidate's skills behind a modal. Hiring now resolves **in place**:
  the handlers write through `StaffOrg` and `bump()` re-renders the same tab. Driven live —
  pressing Hire moved "1 of 4" to "2 of 4" and the candidate onto the roster with a morale
  meter, no navigation. Its container, its two test files, and its 600 lines of raw-`colors`
  StyleSheet went with it; `PeopleTabContainer` replaces it and the two reachability tests that
  drove the old container (#323 advisor hiring, #324 promotion) now drive the new one.
  **Candidates are comparable now, which is the point of the section.** All three render inline
  — traits, both composites, every skill — instead of one-at-a-time in a modal, because the
  A-vs-B read is the decision. (The flat $1,000 price against unequal quality is C1's ruling,
  not this slice's.)
  **Staff have names.** `data/person-names.json` + `NPC.rollPersonName`, and `name` is a
  non-enumerable **derived** getter on `StaffWithComposites` — `(masterSeed, staff.id)`
  determines it, exactly like #294's per-hire skill cap. That is why it cost no field on
  `Staff`, no change to the `.strict()` schema, and **no save migration**: `restore` hands
  `rehydrateStaff` the same `masterSeed`, so the people you saved are the people you load
  (locked by a round-trip test).
  **Two defects the web drive surfaced, both fixed at the engine.** (1) The UCM's card read
  **"Work quality 275%"** — `effectiveness` is a weighted *sum* over a role's skills, so its
  range is role-dependent (1.5 for a three-axis salesperson, 3.7 for a six-axis UCM) and two
  roles were never comparable. Added `effectivenessRatio`/`trustworthinessRatio` = composite ÷
  the ceiling that skill set implies. **The raw composites are untouched** — every promotion and
  capability gate reads those, and re-scaling them is a balance change C1/C2 own. (2) The pool
  offered **a person already on the roster**: a staff id is `staff:<archetype>:<day>:<slot>` and
  the pool is rebuilt from the seed on every reload (#190, deliberately not persisted), so it
  regenerated the id you hired — and hiring them again would have pushed a duplicate id,
  breaking every id-keyed binding (StaffMorale, StaffDispatch). `buildCandidatesForRole` now
  skips hired ids and walks the slot forward to keep the pool full.
  **Also landed:** skill *labels* are data — `data/staff-skills.json` carries a required
  `label`, so no surface can render `t_o_closing` as "t o closing" again; `staffOrg.headcountCap`
  is a public read so the tab shows "2 of 4" and stops offering a hire that would throw (A2/C1
  swap the CSV slot table in behind it); and `ProgressBar`/`Meter` gained `fillTestID` so a bar's
  **width** is assertable — the skill-bar defect carried in from C1 was `flex: ratio` inside a
  container that never set `flexDirection: 'row'`, and nothing could have caught it.
  **No Development section, deliberately** — IA rules 1 + 3, with a regression lock asserting its
  absence so no foreshadow tease creeps in before the training mechanic exists.
  **Driven on web at T1** (Continue → People): roster with names + proportional skill bars,
  three distinguishable candidates (32% / 41% / 72% work quality), hire resolving in place, and
  Operations showing Prep's two levers with no hiring entry anywhere. 201 suites / **2512**
  tests, typecheck clean.
  Next: **BUILD #348** (in-tab nav stacks).

- 2026-08-02 — **BUILT #346** (Operations rebuild) — the first and largest phase-5c slice.
  Six of the nine destinations the audit counted from Operations are gone or now open a real
  room; the tab is one visual language top to bottom.
  **The Lot became a room instead of a queue.** `src/ui/LotRoom/` + `LotRoomContainer`, a new
  `lot` Navigator route the dock's Lot tile opens (`handleDeptPress`), holding the whole stock
  pipeline the locked IA §4 gives it: the stock list with days-on-lot and carrying cost, the
  per-unit `Tune ›` entry into the pricing screen, the inline asking-price field, the standing
  pricing strategy, and sourcing. **The auction lives here now** — it was a button in Prep.
  Before this, tapping Lot opened `DepartmentScreen` on `departmentQueue.getQueue('lot')`:
  *"Nothing waiting in Lot"* while three cars sat on the lot one tab away.
  **Prep is now what the IA says it is: two levers, one block, zero navigation.** Hours and
  trade policy. `OwnershipLevers` went from 463 lines with its own `StyleSheet` off the raw
  `colors` map — **the last pre-kit surface anywhere in the app** — to a kit surface reading
  every value through `useTheme()`. Its own `"NEXT-DAY PREP"` heading is gone, which was the
  duplicate that rendered directly under the tab's `SectionHeader "Prep"`.
  **Where the evicted controls went, and why hiring did not wait for #347.** Stock list +
  price rows + pricing strategy + auction → the Lot room. Advertising → the demand console's
  "What You're Promoting" section (the readout of what that lever does), which Growth inherits
  whole in #349. Hiring → **People**, as a roster-count + `Hire Staff` entry. #347 owns the
  People rebuild, but the criterion "Prep contains no navigation links" makes hiring
  unreachable the moment Prep loses it, so the entry landed with the eviction rather than one
  slice later; #347 replaces it with the real roster + hiring pool.
  **Reuse over reinvention.** The three chip selectors (hours, trade policy, pricing strategy,
  advertising) all run on `DeptControls`' existing `ChipRow`, which grew one optional
  `disabled` prop so the floor-open lock survives the migration. No fourth chip implementation.
  **Two guards worth keeping.** The kit no-leak test now scans migrated *surfaces*, not just
  `src/ui/kit/` — hex/rgb literals and a raw `colors` import both fail it, with comments
  stripped first because this repo cites issues as `#346`, which is a valid 3-digit hex to that
  pattern. And `actionFooterClearance(theme)` derives the shell's bottom inset from the CTA it
  has to clear (label line box + padding), so a re-skin can't silently shrink the gap that
  audit P8 was about.
  **Driven on web at T1** (three units on the lot): dock → Lot room renders all three units
  with carry lines and editable prices → `Go to the Auction` opens Auction Lane → back returns
  to the Lot room; People → `Hire Staff` opens Personnel; Operations scrolled to the bottom
  shows Prep's two cards clear of the Open Floor CTA. 201 suites / **2496** tests, typecheck
  clean. One drive note: a click that "opened the floor" from the Lot room was a stale
  ref→coordinate mapping, not a bug — the capture-listener readback in `.claude/skills/verify`
  is what proved it.
  Next: **BUILD #347** (People rebuild).
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

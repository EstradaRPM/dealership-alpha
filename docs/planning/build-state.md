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
  and locked disagree, locked wins. (Audit rows O5 and the six dead Operations destinations are
  closed out as of #348; #349 took the Growth placeholder and the Home market stack. Finance is
  the last placeholder tab — #350/#351.)
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
| 5c | UI layout rebuild — ~~#346 Operations~~ · ~~#347 People~~ · ~~#348 nav stacks~~ · ~~#349 Growth~~ (all built 2026-08-02) · #350 chart kit · #351 Finance | — (locked IA already rules it) | active |
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

- 2026-08-02 — **BUILT #349** (Growth) — the tab stops being a placeholder card, and two
  homeless surfaces get the room the locked IA assigned them.
  **The demand console is one room now.** `src/ui/GrowthTab/` + `GrowthTabContainer`: the heat
  read, who's been walking in, the targeting levers, the advertising campaign, then the weekly
  market report and the industry wire. Before this the readout lived on **Home** — whose charter
  is glances only — and the campaign lever had been evicted to the console in #346 while the
  console itself still rendered in the wrong tab.
  **The wire and the weekly report MOVED, not copied.** `IndustryWire`, `WeeklyMarketReportCard`
  and both their models are `git mv`'d out of `src/ui/HomeTab/` into `src/ui/GrowthTab/`; the
  HomeTab barrel now carries a pointer comment instead of the exports. Leaving them under
  `HomeTab/` would have been a lie in the tree for the next agent to trip on.
  **Home keeps a glance that routes, and the glance can't disagree with the room.**
  `buildMarketGlance` is a projection of the *console's own model* ("Buyers want SUVs most" /
  "Running Local radio · $75/day"), not a hand-written summary — so drift is impossible by
  construction. Both Home glances now deep-link: the market card and the gate strip each open
  Growth (IA rule 4).
  **The tier-gate board is the detail surface the gate never had.** `GateBoard` + the pure
  `buildGateBoard`: each face opened up with every number the engine already computes (pace
  line, cushion, still-to-go, per-day-needed, projected finish; threshold vs month-average vs
  right-now; rolling average + window), then **the climb** — what the next rung asks for and how
  many banked months stand in the way. Deliberately a **separate model from `gateStripModel`**:
  "compress to one line" and "show all of it" are different jobs. No "% on track" here — that
  compression is the glance's job. No bottleneck callout either (decision 2: facts, no coach).
  **Two engine surfaces grew, both narrow.** `tierGate.getTierRequirements(tier)` returns a
  tier's standing spec with **the same filter the month-end verdict uses**, so the board can
  never foreshadow a bar the gate doesn't grade (facility is data-present/engine-dormant and is
  excluded); `null` past the top of the ladder simply drops the climb section rather than
  rendering a tease. And **the advertising campaign now costs money** — `dailyCost` on the
  tunables schema, `getAdvertisingDailyCost()`, and a `clock:day_ended` `forceDebit`, the same
  standing-spend shape ServiceMarketing's arms and the wire subscription already use. A demand
  lever with no price is a strictly dominant choice; the spend is what makes the campaign
  section a decision at all. The price rides every chip, so campaigns compare without selecting.
  **`Sparkline` moved into the kit** — the CSI trend face renders in two surfaces now, and a
  second hand-rolled copy would let them drift. `GrowthTab` joins `MIGRATED_SURFACES` in the
  kit no-leak scan.
  **The web drive found two defects, both fixed before commit.** (1) The campaign chips showed
  no price at all — `advertisingOptions` carries a `dailyCost` *number* and the view wants a
  formatted `costLabel`; the composition root never bridged them. (2) The climb read **"for 2
  straight months"** directly above **"month 0 of 1"** — `ruleLabel` was quoting the NEXT tier's
  streak when the months-to-climb is how long it takes to leave where you *are*. Both are locked
  by tests.
  **Driven on web at T1** (Continue, the Playtest R1 slot — left exactly as found, campaign
  toggled back off): Home shows the two-line market glance with no readout/wire/report anywhere
  → the glance opens the Demand Console → the gate strip opens the same tab → `Local radio ·
  $75/day` selects in place and adds "Billed $75/day while it runs." → Home's glance updates to
  "Running Local radio · $75/day" → `Next up: Tier 2` lists 15 units / $30,000 gross / $150,000
  cash over "for one month to move up." 206 suites / **2558** tests, typecheck clean.
  Next: **BUILD #350** (chart kit).

- 2026-08-02 — **BUILT #348** (in-tab navigation stacks) — the structural half of phase 5c.
  Walking into a room no longer costs you the console.
  **The route map split in two, and the compiler enforces it.** `RootRouteParamMap` holds the
  whole-app flow states (boot, start menu, character creation, the game, the in-game
  menu/KPI/history overlays, the end card); `TabRouteParamMap` holds the six sub-screens that
  live inside a tab — `lot` · `auction` · `pricing` · `department` · `service` · `bodyShop`.
  **`nav.navigate('auction')` no longer typechecks.** That call is exactly what used to unmount
  the 5-tab shell, so the locked IA §3 rule is now a compile error rather than a convention
  someone has to remember; `tests/Navigator.test.ts` carries a `@ts-expect-error` lock on it.
  **`TabStacks` is the second machine in the Navigator module** — one stack per tab, pure and
  framework-free like the Navigator core, generic over the tab key so nav stays independent of
  the shell's taxonomy. It owns the **active tab as well as** each tab's position, which
  **retired the lifted `shellTab` `useState`** in `useDayLoop` whose own comment described the
  workaround the unmount pattern forced ("without lifting this the tab would reset to Home on
  return"). Pushes land on whichever tab is active, so there is **no route→tab table to drift**.
  Its `useSyncExternalStore` snapshot is a `version` counter, not the top entry — two different
  tabs sitting at their roots both read `current === undefined`.
  **AppShell grew exactly one prop.** With `stackScreen` present it renders that in the body and
  keeps the tab bar mounted and interactive; the tab bar is now one node shared by both body
  modes, so the two can't drift apart. `shellOwnsTopInset` in the composition root now also
  requires no stack screen — the hero bleeds behind the status bar, a pushed room does not.
  **Both IA carve-outs are untouched and now locked by tests:** the live floor is still a
  full-screen MODE with no tab bar, and the day recap / trade / discount spotlights are still
  the overlay channel above the Navigator (asserted rendering with the shell mounted behind).
  **`RouteContent` stays the root switch; `TabStackContent` is its sibling** for the in-tab
  routes — RouteContent lost ~200 lines and each file stays a readable screen switch.
  **The React Navigation trigger count is now 1 of 4** and recorded in the module's `CLAUDE.md`:
  a root stack plus five sibling tab stacks, two levels, deepest observed path 2 (Lot →
  pricing). Re-open the build-vs-adopt call if a third level appears.
  **Driven on web at T1** (the Playtest R1 slot, left untouched at Day 1): Operations → Lot room
  renders with all five tabs still lit and Operations still selected → `Go to the Auction` goes
  a second level deep with the shell intact → People shows its own roster at its own root →
  Operations returns to the **Auction Lane, exactly where it was left** → Back, Back lands on the
  dock. Open Floor still suspends the console entirely. 203 suites / **2527** tests, typecheck
  clean.
  Next: **BUILD #349** (Growth tab).

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

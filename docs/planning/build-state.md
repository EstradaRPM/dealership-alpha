# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phases 6 + 7 — staff teeth & staff slots / facility scale — SLICE (both together).**

A2 was ruled 2026-08-03 (`/decide A2`), so both gates standing in front of the next build are
now closed: C1 locked 2026-08-02 (`staff-teeth-design.md`), A2 locked 2026-08-03
(`path-to-finished-product.md` §3 A2). **Next unit: SLICE 6 and 7 as one pass** — C1's R3 makes
the slot table staff-teeth's scarcity cap, so wages and slots have to land in one build order or
half of each mechanic sits inert.

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
- **Phase 6 cannot be sliced alone.** C1's scarcity ruling points at the CSV's per-role staff
  counts, and nothing in the repo enforces them (`staffOrg.headcountCapByTier` is a flat
  `{1:4,2:8,3:16}`). A2 is now ruled, so **slice 6 and 7 together** — building staff-teeth
  against a flat cap leaves half the mechanic inert. A2's internal call 1 deletes
  `headcountCapByTier` outright rather than leaving it beside the slot table.
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
| 5 | C3 playtest gate (#74), round 1 — HITL | — | pending (doors fixed; sequenced after the 6+7 slice) |
| 5c | UI layout rebuild — #346 Operations · #347 People · #348 nav stacks · #349 Growth · #350 chart kit · #351 Finance (all built 2026-08-02) | — (locked IA already ruled it) | done |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338; #339 sliced into #343→#344→#345, all built; see `docs/agent-workflow-notes.md`) | — | done |
| 5b | Module-boundary debt clearance (#341, #342), surfaced by #335's scan | — | done |
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`.** Prerequisite (A2) now ruled | pending — SLICE with 7 |
| 7 | A2 staff slots / facility scale | **LOCKED 2026-08-03 — `path-to-finished-product.md` §3 A2** | pending — SLICE with 6 |
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

- 2026-08-03 — **RULED A2** (phase 7, staff slots + facility scale) via `/decide A2`. Recorded in
  `path-to-finished-product.md` §3 A2, `[NEW]` → `[LOCKED]`. **Both staff gates are now closed;
  the next unit is a single SLICE covering phases 6 and 7.**
  **R1 — desks come with the tier, buildings are bought.** Tier-up hands you the CSV's staff
  desks outright (T3 = 3 sales + UCM + F&I + SA + BSA, empty and waiting); lot spaces and bays
  are purchased with cash + construction days up to the tier's ceiling, and you arrive at a new
  tier holding the previous tier's built capacity. The two ends were both rejected: granting
  everything leaves no money decision anywhere on the ladder *and* leaves the `facility` gate face
  in `data/tier-gate.json` with nothing to measure; buying everything puts a construction gate in
  front of hiring on top of C1's cost + wage and makes tier-up change nothing until you spend
  again. The split is what lights that dormant face — **built capacity ÷ tier ceiling × 100** —
  and what puts facility spend in direct competition with inventory cash.
  **Construction time is real** (~2–3 days, `data/`), reusing #295's frontline-hold idiom. Instant
  capacity collapses the decision to "do I have the cash"; a delay makes you buy *ahead* of demand.
  That also answers the CSV's own open row 16 ("construction time? Idk if necessary").
  **R2 — the lot cap governs buying; a trade always lands.** Every owned unit takes a space,
  **prep included** — there is no off-lot state in the model and none was invented (a `LotVehicle`
  exists and accrues carrying cost from `arrivalDay`; recon is a cost, not a place, and the
  frontline hold only governs whether walk-ins can be *shown* the car). One number, "31 of 35."
  The cap is checked **at the bid**, counting won-and-inbound units, so you cannot win six cars
  into four spaces. A trade always comes in and may put you at 36 of 35; being over freezes buying
  until you're under. Self-correcting by construction — a deal that brings a trade in takes a car
  out — which is exactly why it needs no machinery.
  **An overflow lot was raised by the director and withdrawn by the director**, and the reasoning
  is the durable part: an overflow slot beats a wholesale-at-a-loss in nearly every case, so the
  choice only ever resolves one way, and a dominated option is a confirmation dialog rather than a
  decision — *and* parking the unit keeps inventory the same, so the trade neither helped nor hurt.
  It would have bought a second inventory list, paused recon clocks, FIFO promotion, save fields
  and a UI surface for a moment that isn't a moment. Forced wholesale, refused trades, a soft cap
  with an overflow fee, and prep-as-its-own-capacity are recorded rejected alongside it. **Do not
  re-propose any of them.**
  **One thing fell out of R2 and ships with A2 on its own merits:** there is no voluntary
  wholesale-out today — the only dump path is abandoning recon after a surprise
  (`Inventory.ts:789`, #162). Lot-locked with three aged units and no way to convert them to cash
  is a dead end, so the inventory card gets a "wholesale this unit" action as the aged-inventory
  release valve, **not** as a full-lot penalty.
  Seven internal calls recorded in the section (chief among them: `headcountCapByTier` is deleted
  rather than kept beside the slot table; bays become owned persisted state read through one
  provider so `min(bays, advisors)` keeps a single truth; a new `src/game/Facility/` module owns
  built capacity + the facility score).
  Next: **SLICE phases 6 + 7 together.**

- 2026-08-02 — **BUILT #351** (Finance) — the last placeholder tab, and the books learned what
  day it is. **Phase 5c is complete.**
  **The tab is the locked IA's grammar, top to bottom.** `src/ui/FinanceTab/` +
  `FinanceTabContainer`: time-range chips → four headline stat cards with sparklines and
  vs-prior-period deltas → the hero gross-written trend → how deals were funded (donut) and
  where the money went (bars) → the deal-KPI block. Deal history and month-close results are
  siblings pushed **inside** the tab.
  **The range chips are the whole slice, and nothing in the engine could serve them.**
  `DealRecord` had no day, `deal:closed` carries none, and the Economy ledger was never
  persisted — so "Today" would have been a lifetime total relabelled. Three narrow engine
  surfaces make them honest: `kpiDashboard.getSnapshot(range?)` + `getDailyTotals(range)` over
  day-stamped deals; the Economy ledger persisted **whole and never pruned** (it IS the P&L, and
  a window that loses its early days reports a profit nobody made); and
  `tierGate.getMonthVerdicts()`. The daily series emits a row for **every** day in the window
  including days with no deals — a series that skips the quiet days draws a shape the business
  never had.
  **Only the month's GRADE is stored.** The verdict event fires once and `resetMonth` erases
  what produced it, so nothing else could reconstruct how a past month graded. Each month's
  *financials* are re-derived over its day window from the deal log and the ledger, so the
  results screen can never disagree with the dashboard about the same days.
  **Two live defects fell out, both fixed.** Economy's cursor latched only on `clock:day_ended`,
  which stamped every deal closed on day N with **day N-1** — invisible while the only consumer
  was a lifetime total, exactly one day wrong the moment Finance windows the ledger. And a
  private cursor reads **1 for the rest of any session resumed from a save**, because a restore
  fires no clock event; the web drive caught that one live (a day-31 deal landed on day 1).
  Both modules now take a **`getCurrentDay` provider off the clock** — the shape TierGate
  already used — so there is no cursor left to persist or mis-restore, and the clock's own
  `advanceDay` ordering puts overnight spend on the concluded day for free.
  **`KPIDashboard` stops being a screen.** It was a full route behind the in-game menu, which is
  why nobody read it; it is now an embedded kit-styled block with two consumers passing
  different snapshots (Finance the selected range's, the month-close interstitial the month's) —
  a KPI row reads identically in both because there is only one of it. `HistoryScreen` moved the
  same way, root route → tab route. **Both root routes are deleted and pushing them onto the
  root Navigator no longer typechecks** (`tests/Navigator.test.ts` carries the `@ts-expect-error`
  lock). The market-state panel (#179) rode along and is alive in a tab instead of a dead menu.
  **PVR carries no sparkline on purpose** — it is undefined on a zero-unit day, so a per-day
  series would draw zeroes on quiet days and read as a collapse in per-deal profitability that
  never happened. Deltas are **suppressed, not shown as "+100%"**, when the prior window is empty
  or zero. Every stat card renders an empty state rather than a zero that reads as a result.
  **Driven on web at T2/Day 31**: a closed deal shows under Today as 1 unit / $2,603 / PVR
  $2,603 with the funding donut at Cash 100%, the 30D chip re-reads as "Day 2–31 · 30 days",
  and both siblings push with the tab bar mounted and Back returning.
  **The donut paints a real `react-native-svg` path — #350's open question is answered.** The
  *measuring* charts could not be confirmed on screen: **a hidden Browser pane delivers no
  `ResizeObserver` callbacks**, so `onLayout` never fires and `useChartWidth` stays 0. Proven an
  environment artifact (a bare ResizeObserver probe also never fires) and written into
  `.claude/skills/verify` with the probe, so the next agent does not chase it as a bug.
  211 suites / **2644** tests, typecheck clean.
  Next: **DECIDE A2** (phase 7) — phase 5c is done, and C1's R3 made A2 a prerequisite for
  slicing phase 6.

- 2026-08-02 — **BUILT #350** (chart primitives) — the enabling kit slice #351 Finance
  depends on. `react-native-svg@15.12.1` (via `expo install`, SDK-54 matched) is now a
  dependency; `GaugeArc` predates it and stays a pure-`View` build.
  **The geometry is a separate pure module and that is the point.** `chartScale.ts` holds every
  number the three primitives draw — scales, the nice-tick ladder, bar bands, ring segments, and
  the SVG `d` strings themselves — with no React and no theme. A wrong chart is then an
  assertion on a path string instead of a screenshot: 22 of the 37 new tests never render
  anything. It also means an animated or canvas-backed rewrite reuses the same math behind the
  same props.
  **`theme.series` is a new token family, deliberately not a `colors` role.** The semantic roles
  carry meaning (`reward` is money, `danger` is a loss); a donut slice for "sedans" means
  nothing but "not the one beside me", and a red one would read as a problem. Slots assign in
  fixed order and **never cycle** — a seventh category folds into one muted "Other", it does not
  wrap back to slot 1 and impersonate the first. The six hues are not taste: candidate orderings
  were enumerated and run through a palette validator against the app's own card surface, and
  the shipped order is the best-scoring passing one (worst adjacent colorblind ΔE 22.7, normal
  vision 22.2, all six inside the dark lightness band, all ≥3:1 on both the card and the base).
  `series.ts` records those numbers so the next hue change re-runs the check instead of eyeballing.
  **Bars carry one hue by default.** The category axis already states identity, so coloring by
  category doubles the encoding and burns the palette on nothing; per-datum `tone` is the
  exception that earns its color — the one bar a surface is making a point about. A donut is the
  opposite case (a slice has no axis to name it), so it always ships its legend, with the label
  in ink roles and the swatch carrying the color.
  **`Sparkline` was rebuilt, not wrapped.** It was extracted to the kit as *bars* in #349; it is
  now a real trend line — area fill in the tone's translucent role, 2px stroke, the newest sample
  dotted so "where it ended" reads. Same props, same barrel export, no call-site edits: exactly
  the substitution the kit contract promises. Its two consumers (Home's gate strip, Growth's gate
  board) are untouched.
  **A chart must be told its width or measure it.** `useChartWidth` reads the container via
  `onLayout`; **tests get no layout pass, so a test must pass `width`** — written into the kit's
  `CLAUDE.md` because the failure mode is a chart that silently renders nothing.
  Empty states are per-primitive and mandatory (a blank plot is indistinguishable from a broken
  one), negative values are **dropped** from a composition rather than mirrored (folding one in
  would silently overstate every other slice), and a slice too thin to see still draws a
  minimum-width mark, because an invisible slice reads as a missing category.
  **Web drive is partial, and honestly so.** The bundle rebuilds with the new native dependency
  and the app boots, navigates and renders every tab with zero new console errors — that is the
  dependency-linkage risk retired. **No chart paints on screen yet**: `BarChart`/`DonutChart`
  have no consumer until #351 by the issue's own charter, and `Sparkline`'s live face only
  appears from Tier 3, since `data/tier-gate.json` grades `csi` at tier 3 only (confirmed on the
  T2 dev slot: `document.querySelectorAll('svg').length === 0`, and the gate board's "THIS MONTH"
  correctly lists units/gross/cash with CSI under "NEXT UP: TIER 3"). **#351's first job is to
  confirm react-native-svg actually paints under react-native-web.**
  207 suites / **2599** tests, typecheck clean.
  Next: **BUILD #351** (Finance).

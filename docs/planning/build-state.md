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
order**. **Next unit: BUILD #352** (the per-role slot table — the prerequisite every wage slice
sits on). Work them in number order; the deps are stated in each issue's Notes.

| # | Slice | Phase |
|---|---|---|
| #352 | per-role slot table = the hiring cap; `headcountCapByTier` deleted | 7 → unblocks 6 |
| #353 | `data/staff-pay.json`, derived grade, `paidGrade`, daily payroll drain; `weeklyPayrollStub` deleted | 6 |
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
- **#352 comes first and nothing in phase 6 works without it.** C1's scarcity ruling points at the
  CSV's per-role staff counts, and nothing in the repo enforces them today
  (`staffOrg.headcountCapByTier` is a flat `{1:4,2:8,3:16}`). Build a wage against a flat cap and
  half the mechanic sits inert. The CSV stops repeating `f&i-manager` at T4/T5 — that is a source
  omission, not a removal; the slot table is **monotonic** (a tier never takes away a desk).
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
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`** | active — sliced (#353–#357) |
| 7 | A2 staff slots / facility scale | **LOCKED 2026-08-03 — `path-to-finished-product.md` §3 A2** | active — sliced (#352, #358–#362) |
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

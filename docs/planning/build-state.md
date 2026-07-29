# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

## Current phase

**Phase 5 — C3 playtest gate (#74), round 1 — HITL**

(Phase 4 B3 closed 2026-07-22 — #176, #177, #178; #179 landed earlier in A4.)

## Blockers

- **Phase 5 (#74) is waiting on the user.** The round-1 script is written
  (`docs/planning/playtest-round-1.md`), the in-game capture tool (#332) is built, and the
  script itself is now **in the game** (#333) — the day's card presents itself at each
  boundary, so the round is a guided handoff rather than a doc to consult on a second
  screen. Playing costs one tap per reaction, nothing has to be written down during a
  session, and the export carries the script trace + probe answers alongside the flags and
  deal/walk tables. The unit that unblocks it is the user playing Session A (5 days, fresh
  T1) + Session B (3 days, T2 fixture) on device, exporting the playtest log (DEV →
  PLAYTEST LOG → Export) and answering the 12-question sheet at a keyboard. Nothing
  agent-side can advance it — there is no autonomous runtime surface for the GUI (see
  `.claude/skills/verify`).

  **While it waits, `/next` works phase 5a** (agent-harness hardening, #334–#339) — it is
  real filed work that does not depend on the playtest, and #338 directly removes the
  `/verify` BLOCKED ceiling that every phase-5-and-later slice currently pays. Phase 5 is
  still the gate; 5a is what there is to build while the gate is held by the user.

## Phase table

Status: `pending` → `active` → `done`. "Decision first" = a DECIDE unit must run before
slicing/building that phase (the doc's `[NEW]` items, ungrilled designs, and forks —
resolved just-in-time at the phase boundary, never earlier).

| # | Work (doc section) | Decision first? | Status |
|---|---|---|---|
| 1 | A1 advisor hiring + promotion wiring (#323, #324), + A3 hygiene (close #269, #266, #297) | — | done |
| 2 | A4 silent-system surfacing: #267, #187, #179, manager status card, recovery states, indictment producers | — | done |
| 3 | B1 Reveal ranking + records | — | done |
| 4 | B3 news/adverse-events engine (#176–#179) | — | done |
| 5 | C3 playtest gate (#74), round 1 — HITL | — | active |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338→#339; see `docs/agent-workflow-notes.md`) | — | active |
| 6 | C1 staff-teeth | **GRILL (ungrilled core mechanic)** | pending |
| 7 | A2 staff slots / facility scale | **ADJUDICATE [NEW]** | pending |
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

- 2026-07-29 — SLICED **phase 5a (agent-harness hardening)** out of a field survey of
  AI-agent game-dev tooling, run at the user's request and written up as
  `docs/agent-workflow-notes.md`. The survey's verdict on the field: the 49-agent "studio"
  frameworks solve a consistency-across-many-streams problem this project does not have
  (one product, one director, locked spec, one-unit-per-session discipline) — take their
  **hooks and path-scoped rules**, skip the org chart; spec-driven tooling (Spec Kit, Kiro,
  OpenSpec) is a lateral move because issue #1 + `spec-condensed.md` + the issue queue
  already *is* a spec-first pipeline, with **EARS notation** the one portable piece; the
  live frontier worth taking is automated balancing ([RuleSmith](https://arxiv.org/abs/2602.06232)
  = engine + agents + Bayesian optimization over a rule space) and vision-driven GUI QA.
  Things this repo already does that the field does not: the `/next` never-end-in-analysis
  contract, reachability/anti-orphan tests, `docs/*-recipe.md`, and `build-state.md` itself.
  Six gaps filed, ordered cheap-first because the cheap ones compound: **#334** trim
  build-state to live state + archive the log (this file is 669 lines and `/next` reads all
  of it every session), **#335** hooks for the module-boundary convention (today enforced by
  the root CLAUDE.md admitting "no lint rule enforces this") + the save-envelope re-stamp
  ritual, **#336** `paths:`-scoped rules so per-module CLAUDE.md loads without being
  remembered, **#337** EARS acceptance criteria on filed slices, **#338** a drivable web
  target (web `StorageDriver` + `react-native-web`) so `/verify` stops returning BLOCKED on
  every surface slice — **this supersedes the verify skill's "do not install
  react-native-web" line**, which was correct only while the `expo-sqlite` block stood —
  and **#339** fix the harness's dishonest bankruptcy metric (a run dying ~day 125 currently
  scores clean) then add a Bayesian search over a declared tunable manifest, feeding #286 a
  ranked diff instead of a from-scratch hand-tune. Phase 5a is workable **while phase 5
  waits on the user**; it does not substitute for the playtest — the felt questions stay a
  human gate. **#340** was filed after the other six, by asking what they still don't cover:
  they close the *tooling* gap, but the rate limiter on the remaining phases is director
  decision bandwidth — six of seventeen are blocked on a GRILL or ADJUDICATE. `/decide` is
  the prep unit for one gate (context loaded, internal forks decided by the agent and never
  asked, player-facing forks presented with evidence + a recommendation, ruling recorded so
  it never reopens) — the same activation-cost fix #332/#333 were for the playtest. It sits
  **second** in build order despite being newest: one skill file, and the only item that
  unblocks anything on the product side. Next /next BUILDs **#334**.
- 2026-07-28 — BUILT + closed **#333** (guided playtest script in-game) — phase 5 tooling,
  filed and built in-session after the user said the #332 overlay "is not nearly as guided
  as I had hoped": #332 recorded what the player *noticed* but never what the round **asked
  them to do**, which stayed in the doc + a browser companion page. A second screen is a
  handoff you have to remember to consult, and by day 3 nobody does — losing exactly the
  instructions the measurement depends on (*one salesperson, a second on day 3*; *cut one
  ask and raise another*). **DECISION (asked, user chose):** the 12-question observation
  sheet **stays a keyboard exercise** — probes are the in-the-moment half, and typing twelve
  paragraphs on a phone would add activation cost rather than remove it (same split as
  #332). **`data/playtest-script.json`** holds round 1 as data: both sessions flattened into
  ONE linear list of day nodes (brief + step checklist + probes tagged
  `day_open`/`day_close`); the markdown doc stays the human-readable source of truth.
  **The cursor IS the log** — `deriveGuideState` returns the first day node not marked done,
  derived purely from `step` entries, so there is no second cursor to persist and nothing to
  desync; it survives a Reset Save, session B's whole second career, and unscripted extra
  days. Ticking a step is *evidence*; the reserved `DAY_DONE_STEP_ID` marker is what
  advances. Two new **append-only** entry kinds (`step`, `answer`) with last-write-per-id
  winning, so a mis-tap is corrected by tapping again rather than mutating history.
  **`src/ui/PlaytestGuide/`** is the card (brief, tickable steps, one-tap probe chips + free
  text, known-dark list inline, `Day done →`); FAB reads `▤ 3/9 · 2/4`. **Presentation is
  bus-driven** — `clock:managerial_prep` + `floor:day_complete`, because a phase change
  doesn't reliably re-render the overlay channel — and a due boundary **queues behind** the
  recap, month close, chapter card, recovery beat, end card and both escalation modals
  rather than stacking on a beat the player is already reading; a day-close boundary with
  every probe answered is dropped instead of interrupting for an empty card. **Export** gains
  a `## Script trace` section rendering the FULL script with checkboxes — an *unticked* step
  is signal (the instruction couldn't be followed), so it must be visible rather than absent.
  Script §1 rewritten: the browser companion page is retired.
- 2026-07-27 — BUILT + closed **#332** (in-game playtest capture) — phase 5 tooling,
  filed and built in-session after the user asked whether the observation data was worth
  capturing in-app rather than in a separate artifact. **DECISION (asked, user chose
  "build it"):** split the capture by *when the observation happens* — in-the-moment
  reactions go in the game, the 12-question reflection sheet stays in the doc. Typing
  twelve paragraphs on a phone would *add* activation cost; tapping once when something
  annoys you removes it. New **`src/game/PlaytestLog/`** in the Telemetry mold (nothing in
  the sim reads it): a **manual flag** on an always-on-screen ⚑ FAB above the DEV button
  (context stamped at *tap* time, not save time — the useful moment is when the player
  reacted, not when they finished typing; note optional, four canned one-tap notes), plus
  **auto-capture** of `deal:closed` (full finance structure) and `staff:auto_resolved`
  `no_sale` (the *named* walk reason the on-screen line flattens away). Capture stays
  attached all session — the finance mix is a **rate** question, so a partial sample
  answers it wrongly; `deal:closed` carries no day so the day comes from an injected clock
  cursor (the HistoryLog/Records seam). **Export** is one markdown blob with the §5 deal
  table and the cash-vs-finance split + average down **computed**, not left to be
  eyeballed. **Persistence is its own `StorageDriver` cell** (`driverFactory('playtest-log')`
  in `services.ts`), deliberately outside the world save envelope: no version bump, no
  migration for a dev tool, and the log survives `Reset Save` so it spans a whole
  multi-day round rather than one career. Write-behind through one serialized chain; a
  failed write is **swallowed, never retried** (a rejected chain would silently stop all
  later appends — caught by a test, and each append rewrites the whole blob so a dropped
  write self-heals). AdminConsole gains a PLAYTEST LOG section (counts / Export / confirmed
  Clear). **Script §1 + §5 rewritten** — §5 no longer asks for any hand-transcription.
  **The two unobservable #74 criteria are still a real round-1 finding** (finance-mix
  surface + a distinct credit-blocked walk reason); this makes them answerable without
  pretending the gap is closed. Tests: 24 unit + 9 reachability/composition (incl.
  anti-orphan wiring guards on AppOverlays/AppRoot/AdminConsole); typecheck + full suite
  (2345, +33) green. /verify: BLOCKED for the live-GUI drive as usual — reachability +
  wiring guards are the reachable ceiling. **Phase 5 still blocked on the user playing
  it**, but the activation cost is now materially lower.
- 2026-07-22 — **PREPARED the #74 round-1 playtest** (phase 5's HITL unit): wrote and
  handed off `docs/planning/playtest-round-1.md`, and filed the round-1 notes home as a
  comment on #74. **Session A** = fresh T1 career, 5 scripted days — the capacity criterion
  is measured by *contrast* (one salesperson Days 1–2, a second before Day 3) rather than by
  vibe, Day 1 runs at 1× end-to-end to calibrate the felt day length before any skipping,
  Day 2 is the auction, Day 4 moves two prices. **Session B** = the Tier 2 dev fixture, 3
  days, one probe per day (manager delegation card / paid intel lanes / Service as a second
  business). Ends in a 12-question observation sheet and the explicit proceed / adjust /
  rethink call. **FINDING surfaced while writing it — two acceptance criteria are currently
  unobservable in play:** nothing in `src/ui/**` renders a deal's payment method, down
  payment, or credit tier (`deal:closed` carries all of it, `events.ts:411`), and the LTV
  block is a *pick-time filter* (`SalesProcess/affordability.ts:93`) so a credit-blocked
  buyer walks as `no_fit` — "wanted something you didn't have" — indistinguishable from an
  empty-shelf walk. The script routes around it via the DEV Event Log so the criteria can
  still be answered this round, but the gap is a real round-1 finding and likely becomes a
  follow-on issue (finance-mix surface + a distinct credit-blocked walk reason), not a
  calibration nudge. Also flagged in-script: DEV → Time Skip advances `GameClock` directly,
  not the day loop, so it is NOT a fast-forward for playing days; no T3 fixture exists
  (known C2 item); Finance/Growth tabs are known-dark. Triage protocol restated from #105
  (Class A broken → fixed before Class B flat is judged; miscalibrated number = data fix
  inside #74, logic defect = its own issue; all tuned values in ONE calibration commit).
  **Phase 5 now blocked on the user playing it** — see Blockers. Next /next either collects
  the results (Class A → Class B triage, then the calibration commit) or, if the user hasn't
  played yet, moves to phase 6 (C1 staff-teeth — DECIDE/GRILL, the ungrilled core mechanic).
- 2026-07-22 — BUILT + closed **#178** (B3 S3 — news progression gating). The
  wire now has an *access* half. New module **`src/game/MarketIntel/`** — "what
  the player is allowed to KNOW, and what that access costs" — in the
  ServiceMarketing mold (library/factory, no bus, composition root drives
  `advanceDay`). Three lanes, three currencies: **public** (lot talk, the trade
  magazine, factory recall/incentive bulletins — vague, late, or genuinely
  public) is free; **paid** (`auction_data` $45/day, `competitor_tracking`
  $30/day, both T2+) buys the numbers behind stories you already hear; **staffed**
  (a used car manager on the desk) opens the forward calls.
  **DECISION (asked, user chose):** #178's "Market Analyst hire" was adjudicated
  onto the **UCM**, not a net-new role — the channel-desk lock (UCM/NCM/GM, SM
  dropped) came *after* #178 was written and already owns intel, and §3's
  "advise = free on hire" makes the gate the *hire itself*, never a skill
  threshold (a green UCM reads the same wire a seasoned one does; skill buys
  precision elsewhere, #284). So the two axes are money and people, cleanly split.
  **Gating is a READ-SIDE lens:** the engine publishes every headline regardless,
  so the seed stream — and replay (#122) — is byte-identical whether or not
  anything is unlocked (asserted with two same-seed worlds, one fully subscribed).
  `data/news-progression-gating.json` holds unlocks + lanes + gating copy; lane
  matching is by **specificity** (exact source 2 > exact reliability 1, ties by
  declaration order), never array order, and the first lane is a free catch-all
  so a voice added without a lane **fails OPEN** — same philosophy as #177's
  source fallback. A test cross-checks every `(source, reliability)` the catalog
  can publish against its intended lane, so an unintended free lane is caught at
  review. **UI:** a locked headline keeps its place in the chronology — dimmed,
  padlocked, still naming who filed it and when, with the report replaced by
  "{source} filed a report you can't read yet." Seeing *that* somebody reported
  something without the number is the tease. The wire footer ("What you're not
  reading") lists every door with a withheld-count badge, the plain-language
  hint, and — for a subscription the player's tier already sells them — a
  Subscribe/Cancel button right there; a below-tier door shows the tier sentence
  and no button, a staff door shows the hire sentence (hiring stays on People,
  no second hiring surface). **The weekly column's forward calls ride the same
  door** — otherwise the column would be a free back way into the leading tier;
  its recap half was never gated. New `marketIntel` world key, envelope **19→20**
  + migration (behavior-neutral: subscribed to nothing, which is what a loaded
  career was already paying for); tier-2 dev fixture migrated in place (5 lines)
  via the real `migrateWorldSnapshot`. Two kit icons (`lock-closed`,
  `checkmark`); `bump` threaded to GameScreen for the toggle. Tests: 20 in
  `tests/MarketIntel.test.ts` (free lane, tier sweep 1–5, both currencies,
  fail-open, specificity, gateHeadlines, catalog cross-check, billing, snapshot
  round-trip incl. a discontinued product) + 15 in
  `tests/NewsGating.reachability.test.tsx` (live world withholds + leaks nothing,
  seed-identical either way, subscriptions open exactly their lane, daily billing
  measured against a twin unsubscribed world, the UCM hire opening the calls,
  weekly-column calls, save/load, composition guards, panel behavior) + a v19→20
  migration test. **All costs are first-pass → #286.** **Observation for #286:** in
  a bare bus-driven world the paid lanes barely fire — block reports need the
  player's own transactions and competitor tracking needs rivals repricing — so
  the felt value of `auction_data` scales with how much you're actually trading.
  /verify: BLOCKED for the live-GUI drive (native expo-sqlite + no
  react-native-web + on-device-only HITL path) — reachability + smoke +
  wiring-guard cited as the reachable ceiling. **PHASE 4 (B3) CLOSED** — #176,
  #177, #178 all landed (#179 closed in A4). Pointer advanced to phase 5 (C3
  playtest gate #74, round 1 — HITL). Next /next runs the **#74 playtest** unit:
  prepare and hand the user the playtest script; the artifact is the filed
  calibration notes/issue.
- 2026-07-21 — BUILT + closed **#177** (B3 S2 — news sources expansion + the
  weekly market report). The wire got three more voices and, next to it, a
  second *shape* of news: a column. **Voices** were mostly data, which was the
  point of #176's catalog design — 36 new templates across `trade_press`
  ("Dealer Trade Weekly", a fictional pub: mostly forward calls + lagging
  texture, plus the two macro shocks it voices), `oem_bulletin` ("Factory
  bulletin", direct only), and `competitor_watch` ("Competitor watch", the
  tracked-with-numbers sibling of vague lot talk). The one structural hook is
  `PublishInput.source`: a shock declares its announcing voice through the
  catalog's new **`shockSources`** map (a recall is the factory's news, a fuel
  story is the trade's), and a filter matching nothing **falls back to the full
  pool** so a copy gap can never swallow a headline about something that really
  happened. **DECISION — the OEM voice needed something real to talk about:**
  recalls existed as shocks but "model-year changes / incentive shifts" did not,
  so rather than narrate events the engine doesn't have, two real shocks were
  added to `data/market-shocks.json` (`oem_incentive_push`,
  `model_year_changeover`) with genuine negative used-value effects. Competitor
  headlines now quote a percentage derived from the **same lean→price mapping
  the pricing screen's comparables use** (`Δlean × 2 × competitorSpread`), and
  name the segment the rival leans hardest into (from `segmentAffinity`) — the
  shelf you actually compete with. **The weekly column** is a new
  `weeklyReport.ts` sub-system: publishes on `publishDayOfWeek` (0 = Monday)
  inside the module's ONE day tick, ordered **last** (`shocks → heat → news →
  weeklyReport`) because it sums up a week of wire. It is a *card, not a
  headline* — never spends the daily budget, never enters the ring buffer,
  stands until replaced. Aggregates three things already true in the engine:
  the week's per-segment heat move against a baseline **the column itself
  captured when the week opened** (so the number is the week, not the career),
  a tally of the week's wire by trust tier + per-segment mention counts
  (accumulated off `news:headline_published`), and up to `maxForwardCalls`
  forward calls. **Calls are deterministic from state and deliberately
  fallible:** a `shock` call reads `shocks.previewArrival` across
  `lookaheadDays` and fires only `callHitProb` of the time; a `drift` call is
  momentum extrapolation off the week's own move, and is **skipped when the
  shock call already named that segment** so the column never says one thing
  twice with two justifications. A career opening off-cadence gets a short
  first column covering the days actually played — never a fabricated seven.
  Copy (summaries keyed by week shape up/down/mixed/quiet, call lines keyed by
  basis × direction, headings, tally sentence) lives in the `weeklyReport` block
  of `data/news-templates.json`. **Persistence split decision:** the article
  (summary + call prose + moves + tally) is frozen into the save, but static
  chrome (title/subtitle/headings/tally sentence) is filled at *render* from the
  live catalog — a copy retune reaches the standing card instead of being frozen
  into old saves. `MarketEconomySnapshot` v2→**3**, world envelope **18→19** +
  migration; tier-2 dev fixture migrated in place via the real
  `migrateWorldSnapshot`. UI: new Home region "Market Report" between Market and
  Industry Wire, rendering `WeeklyMarketReportCard` — two halves with the wire's
  own two badges (recap = **Recap**, calls = **Rumor**), so the column teaches no
  second trust vocabulary and the calls can't be mistaken for the recap; a move
  that rounds to nothing reads "0%", not the wire's floored fake 1%.
  New event `market:weekly_report_published`; `useWorldState` subscribes
  explicitly (the day-tick bump would cover it incidentally — stated beats
  inherited). Tests: 27 in `tests/MarketEconomy.weeklyReport.test.ts` (cadence,
  re-baselining, week shapes, tally + clearing, all four call behaviors incl.
  the no-double-call rule, determinism same-seed/cross-seed, mid-week save/load)
  + 11 in `tests/WeeklyMarketReport.reachability.test.tsx` (live world × 30/60
  real day ticks, read model, save/load through the world seam, anti-orphan
  guards, card behavior) + 9 new `#177` cases in the news suite (voice coverage,
  shock→voice mapping over the WHOLE shock catalog, fallback, rival pct +
  segment). typecheck + full suite (2276) green. **All magnitudes are
  first-pass → #286.** /verify: BLOCKED for the live-GUI drive (native
  expo-sqlite + no react-native-web + on-device-only HITL path) — reachability +
  smoke + wiring-guard cited as the reachable ceiling. Phase 4 open set now
  **#178** only. Next /next BUILDs **#178** (news progression gating —
  CareerProgression hook).
- 2026-07-21 — BUILT + closed **#176** (B3 S1 — news engine + reliability tiers
  + the Home-screen Industry Wire). The market engine now *talks*. New
  `MarketNews` sub-system inside MarketEconomy (`src/game/MarketEconomy/news.ts`)
  publishing `news:headline_published` across the three reliability tiers that
  ARE the mechanic: **direct** (block report on the player's own comps, a shock
  landing/lifting, a rival visibly repricing), **leading** (the analyst desk's
  forward call — see below), **lagging** (confirming a heat move the player's
  own numbers already showed). `data/news-templates.json` ships 40 templates
  across 10 structural triggers + 3 sources (`auction_report` / `analyst_desk` /
  `lot_talk`), and owns ALL player-facing wire copy including the trust badges
  (**Confirmed / Rumor / Recap**) and their plain-language notes — so wording
  retunes in one data file and #177's three new voices are a data addition.
  **The leading tier is real, not decorative:** `shocks.previewArrival(day)` is
  a new PURE lookahead over the arrival/pick/param rolls (they're functions of
  `(masterSeed, day)`), so the desk genuinely reads tomorrow's dice. It is
  deliberately NOT gated on `maxConcurrent`/the dup guard — a previewed shock
  may never land, which is the honest shape for a rumor. `rumorHitProb` (0.5)
  decides whether a real setup gets called at all; `falseAlarmProbPerDay` (0.06)
  fires calls on days when nothing is coming. `step` and `previewArrival` share
  one `rollArrival` helper so they can't drift on the seed stream.
  **Three decisions inside the slice:** (1) **`market:segment_heat_updated` is a
  change event, not a heartbeat** — new `heatMonitor.ts` sub-system reports a
  segment only when it moves ≥ `heatMonitor.deltaThreshold` **since last
  reported** (not since yesterday), so sub-threshold daily wobble stays silent
  but slow persistent drift eventually reports once. Directly applies the #267
  lesson. First tick captures a silent baseline. (2) **Inventory comps reach the
  wire via `news.recordComp`, not a bus subscription** — the facade already
  computes each transaction's delta-vs-anchor for the comp window, and
  re-deriving it in the news engine would duplicate the anchor math and drag the
  anchor config in. The block report aggregates a day's comps and publishes on
  the NEXT day's tick (an auction recap is next-morning news). (3) **ONE
  `clock:day_started` subscription with an explicit internal order** —
  `shocks.step → heatMonitor.step → news.step` — instead of three independent
  subscriptions, so the sequence is a property of the module rather than of bus
  registration order. Also refactored `createSegmentHeatBySegment` out of
  `createSegmentHeat` (every heat term was always per-segment; the monitor now
  asks directly instead of fabricating a placeholder vehicle) and made
  `ShockModFn`'s vehicle arg optional. Volume control: `maxHeadlinesPerDay` (3)
  is a hard gate spent in arrival order, `maxHeadlines` (12) is the ring buffer.
  Persistence: `MarketEconomySnapshot` v1→**2** (adds `heat` + `news`; the news
  blob carries the ring buffer, the day budget, un-reported comps AND live shock
  tags so a shock spanning a save/load still resolves under its own name), world
  envelope **17→18** + migration; tier-2 dev fixture **migrated in place** (14
  lines, via the real `migrateWorldSnapshot`) per the known harness-bankrupts-
  pre-T2 constraint + the #322/#329 precedent. UI: `IndustryWire` panel in a new
  Home "Industry Wire" region below Market (the readout is what you can verify
  about your own lot; the wire is everyone else's word), each line badged with
  its trust tier + source + Today/Yesterday/Day-N stamp, legend tap-to-expand.
  Composition-root `buildIndustryWire(world)` in `src/app/config.ts`;
  `useWorldState` bumps on `news:headline_published` (headlines publish mid-day,
  not only on the day tick). Two new kit icons (`chevron-up`/`chevron-down`).
  Tests: 31 in `tests/MarketEconomy.news.test.ts` (catalog coverage, all three
  tiers, false-alarm rate respected at 0 and 1, lead-window bound, per-day cap +
  lazy day reset, ring buffer, determinism same-seed / divergence cross-seed,
  persistence incl. cross-save shock resolve, heat-monitor thresholds) + 9 in
  `tests/IndustryWire.reachability.test.tsx` (live world × 90 real day ticks
  producing real headlines with no unfilled slots, seed replay + divergence,
  read model through `buildIndustryWire`, save/load through the real world seam,
  anti-orphan guard on GameScreen + useWorldState source, panel behavior +
  empty state). typecheck + full suite green. **All magnitudes are first-pass →
  #286.** /verify: BLOCKED for the live-GUI drive (native expo-sqlite + no
  react-native-web + on-device-only HITL path) — reachability + smoke +
  wiring-guard cited as the reachable ceiling. Phase 4 open set now #177, #178.
  Next /next BUILDs **#177** (news sources expansion + weekly market report;
  dep #176 now closed).
- 2026-07-19 — BUILT + closed **#331** (day gross/units read from Records, not
  the unpersisted `useDayLoop` ref) — the #329/#330 trailing hygiene. The app
  layer now keeps **no day tally of its own**: `grossTodayRef` is deleted and
  `grossToday` is *derived at render* — `worldRef.current?.records.getDayTotals()
  .gross ?? 0` — with a `useReducer` tick bumped off `deal:closed` as the render
  trigger (`setGrossToday` dropped from the `DayLoop` interface too). The
  day-close handler reads the same accessor for the recap's `gross` and the
  `buildReveal` argument. **Two decisions inside the slice:**
  (1) **Records now clears its day accumulators on `clock:day_started`, not at
  `floor:day_complete`.** The accumulator belongs to the day the clock sits on,
  and the clock doesn't move at day-complete — it moves on Next Day. Without
  this, the day-close consumers would read 0 (Records subscribes first and used
  to reset immediately). Bonus: a reload in the MANAGERIAL window restores the
  closed day's figure instead of a zero.
  (2) **The HUD value is read at render, not inside the `deal:closed` handler.**
  `useDayLoop` subscribes at mount, *before* a World (and therefore Records)
  exists, and the bus dispatches in subscription order — an in-handler read
  would miss the very deal that triggered it. Reading at render is order-proof,
  and it makes the mid-day-reload criterion free (no re-seeding on the load
  path). **Ordering hazard noted for later:** the same mount-before-world order
  means `useDayLoop`'s `floor:day_complete` handler can run *ahead* of Records'
  in a session where the world is created after mount, which would empty
  `recordsRef` for #330's crowns; the gross read is immune (deals are all in by
  then) but the crown ordering guarantee is currently only proven at the bus
  level, not through the mounted app — worth a guard when B4 touches the day
  loop. Tests: new `tests/dayGross.reachability.test.ts` (live-world day totals
  across close → day-complete → next-day-open + composition guards that no
  `grossTodayRef`/`setGrossToday` survives), a mid-day save/reload world-seam
  test in `worldSnapshot.test.ts`, a Records reset-timing test, and the updated
  `buildReveal` composition regex. typecheck + full suite (2188, +4) green.
  **PHASE 3 (B1) CLOSED** — #328/#329/#330/#331 all landed; pointer advanced to
  phase 4 (B3 news/adverse-events engine, #176–#179). Next /next: phase 4's
  issues are already filed (#176–#178; #179 closed in A4) → BUILDs the lowest
  deps-met open.
- 2026-07-19 — BUILT + closed **#330** (B1 S3 — crowned record reactions on the
  Reveal feed). The B1 loop is closed: a broken high-water mark surfaces as a
  **crowned reaction on the SAME feed** as the day's wins and walk-offs (records
  are never a separate screen), ranked by the extensible axis #328 left open.
  `useDayLoop` accumulates `records:broken` into a per-bite `recordsRef` (reset
  each day alongside `closesRef`/`walkOffsRef`) and passes it to `buildReveal`;
  Records is wired in `createWorld` so it settles the day *inside*
  `floor:day_complete` ahead of the app handler — every crown is in the ref when
  the feed is assembled. `buildReveal` gains a third `DramaCandidate` kind
  (`record`) with per-mark plain-language copy naming the mark, its new value and
  the number it displaced ("Best per-car average yet — $2,100 a car, beating
  $1,850" — never "PVR"; Hermes-safe `$` grouping, no temperature words).
  `scoreDrama` gains the **`recordBroken`** axis: a flat weight (2.0, above the
  win/loss axes, so a crown reliably takes a star slot) + a **`recordMargin`**
  term (0.5 × relative improvement), so smashing a mark outranks squeaking past
  one. New **`reveal.drama.crownBudget`** (=2) caps crowns per bite — a great day
  can beat four marks at once and without the cap the feed goes all-crown and the
  day's actual drama gets pushed off; the highest-margin crowns win the slots.
  **DECIDED in-slice** (the call #329 deliberately handed to the presentation):
  **a first-ever mark does NOT crown** — a crown means you beat yourself, a
  career's first day sets four or five marks at once, and it spares the feed the
  "longest selling streak: 1 day" crown. The mark stands in the scoreboard from
  the moment it's set; only the celebration waits for a beat. `isCrownworthyRecord`
  is the gate, mirroring `isStarworthyWalkOff`. **Ordering note:**
  `bestMonthGross` settles on `clock:month_ended` during the Next Day transition,
  so it lands in the *following* day's ref and crowns on that day's Reveal — the
  month's result is news you get the morning after it closes (documented at the
  ref). Tests: 19 unit + a live-world reachability test (a real broken mark lands
  a `crown-*` reaction; a first-ever mark does not) + composition wiring guards.
  typecheck + full suite (2184, +21) green. **FILED #331** for the #329 loose end
  (day gross still accumulated in the unpersisted `grossTodayRef` instead of read
  from `Records.getDayTotals()` — the two can disagree on screen after a mid-day
  reload). B1's three sliced issues (#328/#329/#330) are all closed; #331 is the
  trailing hygiene, the same shape as A3 trailing A1. Next /next BUILDs **#331**,
  then advances the pointer to phase 4 (B3 news/adverse-events engine).
- 2026-07-19 — BUILT + closed **#329** (B1 S2 — Records store + detection).
  New `src/game/Records/` module: the career's six durable high-water marks +
  the `records:broken` announcement #330 crowns. A **scoreboard, not a rule** —
  nothing in the sim branches on a mark. Marks: `bestDayGross`,
  `mostUnitsInDay`, `bestPvr`, `bestStreak` (settle on `floor:day_complete`),
  `bestSingleDeal` (on `deal:closed`, **front gross only** — the desk's win on
  the car, not the F&I box behind it), `bestMonthGross` (on
  `clock:month_ended`, carries a running 1-based `monthIndex`). **Gross =
  `frontGross + backGross`, units = one per `deal:closed`** — TierGate's exact
  formula, so a crowned "best month" agrees with the number the gate graded.
  `clock:day_started` cursor stamps deals (`deal:closed` carries no day — same
  problem HistoryLog solves the same way). DECISIONS made in-slice: **a selling
  day = ≥1 unit** (streak tracks floor momentum; profitability is the separate
  `bestDayGross` axis, so neither mark shadows the other — selling at a loss
  keeps the run alive); **`pvrMinUnits: 3`** (new `records` tunable block —
  a one-unit day's PVR is just that deal's gross, already `bestSingleDeal`, so
  PVR crowns only at volume held at gross; without it two records fire together
  on every fat single-deal day); **a first-ever mark still fires, with
  `previousValue: null`** (engine reports the truth, #330 decides whether a
  first-ever mark earns a crown — that's the seam rather than pre-deciding the
  presentation); strictly-greater breaks, ties don't, non-positive never crowns.
  **Ordering is load-bearing for #330:** the Reveal feed is assembled inside a
  `floor:day_complete` handler, and Records is wired in `createWorld` so it
  subscribes FIRST — every mark for the just-closed day has fired before the
  feed is built; guarded by a bus-level test, not just a comment. Persisted:
  envelope v16→17 + migration materializing `createDefaultRecordsSnapshot()`;
  the blob carries the in-progress **day AND month** accumulators so a mid-day
  or mid-month reload keeps the haul. tier-2 dev fixture **migrated in place**
  (19 lines, via the real `migrateWorldSnapshot`) — not regenerated, per the
  known harness-bankrupts-pre-T2 constraint + the #322 precedent. Tests: 21 in
  `tests/Records.test.ts` (per-mark beat-not-tie, day/month reset, streak
  break/continue, loss-day keeps streak, PVR volume gate, ordering guard,
  save/load round-trip incl. mid-day + mid-month, migration default) + 2
  world-seam tests. typecheck + full suite (2163, +23) green. **LOOSE END
  (carry into #330):** Records is now the game-side source of truth for day
  gross/units — it exposes `getDayTotals()` — but `useDayLoop` still computes
  the day total in an unpersisted, non-replay-safe React ref (`grossTodayRef`,
  `useDayLoop.ts:283`). This slice was engine-only so the rewire wasn't done;
  it belongs in #330 or its own slice. Next /next BUILDs **#330** (crowned
  record reactions on the Reveal feed + wire `recordBroken` into #328's drama
  axis) — deps #328 + #329 both now closed.
- 2026-07-18 — BUILT + closed **#328** (B1 S1 — unified drama-ranking for the
  Reveal feed). Replaced the two-track `rankTopCloses`/`rankTopWalkOffs`
  selection in `src/ui/Reveal/buildReveal.ts` with ONE drama axis across wins +
  starworthy losses. New `scoreDrama(candidate, ctx)` = weighted sum of per-axis
  terms — **match strength** (`weights.matchStrength × clamp01(matchQuality)`),
  **gross surprise** (`weights.grossSurprise × clamp01((gross − dayMeanGross) /
  grossSurpriseScale)`; only the upside registers, a thin front scores 0), and
  **walk-off pain** (`weights.walkOffPain × painByReason[reason] ?? basePain`).
  `rankDrama(closes, walkOffs, limit)` pools wins + starworthy losses (non-
  starworthy filtered out BEFORE scoring via the preserved `isStarworthyWalkOff`
  gate — now exported + reused by the floor toast in `useDayLoop`, replacing the
  `rankTopWalkOffs([w],1).length` idiom), scores, sorts drama-desc with a stable
  arrival-order tiebreak, slices to the **single unified `drama.starBudget`**
  (=5, replacing #320's `starBudget` 3 + #321's `lossStarBudget` 2). A dramatic
  loss can outrank a mild win and vice-versa. New `DramaCandidate` union
  (`{kind:'win',sale}` | `{kind:'loss',walkOff}`); scorer left **extensible** —
  `recordBroken` (#330) + coupling axes drop in as one more `weights` entry + one
  term, no ranker rewrite. New `tunables.reveal.drama` block (starBudget /
  grossSurpriseScale / basePain / weights{matchStrength,grossSurprise,
  walkOffPain} / painByReason) + Zod schema; old `reveal.starBudget` +
  `reveal.lossStarBudget` removed. All magnitudes first-pass → #286. Pure UI
  change; renderer + event stream + `RevealReaction`/`RevealModel` shapes
  untouched. Tests rewritten in `tests/Reveal.buildReveal.test.ts`: scoreDrama
  axis behavior (strong>weak fit, fat>thin gross, thin front adds nothing,
  painful>milder reason, weights-from-tunables), rankDrama pooling (fat win >
  thin win, wanted-in-stock walk > mild win, strong win > milder loss, non-
  starworthy dropped, budget cap, stable ties, no mutation), isStarworthyWalkOff
  gate, and buildReveal interleave (loss can outrank win on the feed, budget
  cap). typecheck + full suite (2140, +8) green. **Design note surfaced (defer to
  #286):** a lone close has zero gross-surprise (mean==its gross), so a single
  win maxes at `matchStrength·matchQuality` (≤1.0) and a full-pain `no_fit` walk
  (1.2) outranks it — losses currently the harsher beat, consistent with the
  spine; tuned in the calibration pass. Next /next BUILDs the phase's lowest
  deps-met open — **#329** (Records store + detection; independent of #328).
- 2026-07-18 — SLICED phase 3 (B1 Reveal ranking + records) via /to-issues into 3
  AFK tracer slices. **#328** (unified drama-ranking — replace the two-track
  `rankTopCloses`/`rankTopWalkOffs` in `src/ui/Reveal/buildReveal.ts` with ONE drama
  score across wins+losses, top-N per bite; axes today = match strength / gross
  surprise / walk-off pain; scorer left extensible for `recordBroken` + coupling
  axes; new drama-weight tunables; no deps). **#329** (Records store + detection —
  new `src/game/Records/` module tracking 6 high-water marks: best day gross, best
  month gross, PVR record, best streak, **best single deal (front)**, **most units
  in a day**; emits new `records:broken`; rides worldSnapshot w/ version bump +
  migration; engine+persist+tests only, no UI; no deps). **#330** (crowned record
  reactions on the Reveal feed + wire `recordBroken` into #328's drama axis; deps
  #328+#329). DECIDE within the slice — user asked what else/what's overkill:
  ADDED best-single-deal + most-units-in-a-day (distinct felt axes, cheap); SKIPPED
  best-week (redundant between day/month, earns its crown when B4 lands the week
  bite), best-quarter/year (T7 altitude → B5), reputation/CSI marks (ambient, not a
  bet-reveal). #328 and #329 independent (either order); #330 last. Reveal tracer
  (#319–#322) confirmed all closed/shipped; renderer=`src/ui/Reveal/`,
  bet-capture=`src/game/PrepBet/`, no records concept exists yet. Next /next BUILDs
  the lowest deps-met open of the phase (#328 or #329).
- 2026-07-17 — BUILT + closed #327 (IndictmentMonitor producers — the last A4
  issue). Wired the two subscribed-but-never-fired severe-event producers so all
  three indictment pressure inputs now fire in live play. **`deal:fraud_flag`**
  (DealEngine): payment packing — a *financed* deal whose F&I retail burden
  `Σ attached.price` exceeds `packFraction × agreedPrice` (data/deal-fraud.json,
  `packFraction 0.35`, via new `loadDealFraudConfig`) is a structuring/disclosure
  violation; emit sits alongside the lemon-law block in `closeDeal`, gated
  financed-only (a cash sale can't pack a payment). **`regulatory:audit_failure`**
  (RegulatoryMeter): sustained pressure sitting in the audit band
  `[auditThreshold, pressureThreshold)` (`auditThreshold 60` in
  failure-tunables.json `regulatory`) fails a compliance audit at the overnight
  tick — the escalating warning *below* the AG complaint. **Latched** (new
  `auditFailed`, persisted optional in RegulatoryMeterState, defaulted on
  restore — no envelope bump): one crossing = one failure, resets when pressure
  falls below the band; pressure that jumps straight to/over `pressureThreshold`
  skips the audit so the two signals stay distinct. IndictmentMonitor unchanged
  (already consumed both). Tests: DealEngine fraud producer (fires on packed
  finance; not on pricier car / cash / no-F&I) + RegulatoryMeter audit producer
  (fires once entering band; not below threshold; not on straight jump to AG;
  re-fires after dropping out; latch round-trips through save) + a new
  **end-to-end integration test** wiring the real RegulatoryMeter + DealEngine +
  IndictmentMonitor on one bus with real configs: fraud (+25) + audit (+20) +
  lemon (+15) cross the real threshold (50) → Tier-1 terminal indictment fires.
  typecheck + full suite (2132, +10) green. Docs updated (CareerProgression /
  DealEngine / Reputation CLAUDE.md). PHASE 2 (A4) CLOSED — all six items landed
  (#267/#187/#179/#325/#326/#327); pointer advanced to phase 3 (B1 Reveal
  ranking + records). Next /next: phase 3 has no filed issues yet → likely
  SLICEs B1 from path-to-finished-product.md §B1.
- 2026-07-17 — BUILT + closed #326 (recovery-state surfacing — contraction/
  consent-decree read as setback, not game-over). The four survivable recovery
  events (`career:bankruptcy_contraction`, `career:indictment_contraction`,
  `regulatory:ag_complaint_contraction`, `regulatory:ag_complaint_consent_decree`)
  were UI-dark; now each fires a full-bleed `RecoveryBeatCard` (a "Setback" beat
  naming cause/cost/path, reward-amber accent + "Keep going" action — visibly
  distinct from the terminal `EndCard`), drained FIFO from a new `recoveryQueue`
  in `useDayLoop` (non-terminal channel, mirrors `chapterQueue`; cleared on
  `career:game_over` so terminal always preempts). Plus a persistent
  `RecoveryBanner` pinned in the `AppShell` (new optional `banner` prop, above
  the primary-action footer, visible across all tabs) that DERIVES from persisted
  monitor state: `buildRecoveryBanners(world)` reads `bankruptcyMonitor.
  outstandingDebt` (debt overhang, amortizes weekly to 0) + `regulatoryMeter.
  isSuspended/suspensionDaysRemaining` (license-suspension window). Banner
  self-clears when the state resolves and survives save/load (both monitors
  persist through the world seam). DESIGN CALL: indictment-contraction and
  consent-decree are one-shot in the engine (stake/cash penalty, no lingering
  window), so they surface as a beat only — surfacing what the engine persists,
  NOT inventing a decree countdown (would smuggle a game-logic mechanic; the two
  monitors that DO persist a window drive the banner). Pure UI model +
  cause/cost/path copy + banner builder in `src/ui/NarrativeBeat/recoveryBeat.ts`
  (view owns wording, Hermes-safe `$` grouping — no Intl). Reactivity:
  `useWorldState` bumps on `regulatory:suspension_lifted` + `career:
  debt_payment_made` (clear path); onset re-renders via the queue setState.
  Tests: pure-builder unit (all 4 beats + banner active/clear/both-order) +
  live-world reachability (drives a real Tier-2 bankruptcy contraction →
  contraction event fires, tier drops to 1, monitor debt persists, banner raised;
  + save/load round-trip; + composition-source wiring guard for all four events
  + banner={ + RecoveryBeatCard) + component smoke. typecheck + full suite (2122,
  +21) green. /verify: BLOCKED for the live-GUI drive (native expo-sqlite + no
  react-native-web + on-device-only) — reachability+smoke+wiring-guard cited as
  the reachable ceiling. A4 open set now #327 only. Next /next BUILDs #327
  (IndictmentMonitor producers — the last A4 issue).
- 2026-07-17 — BUILT + closed #325 (manager status card — surface delegated
  capabilities). New People tab (was `null`) hosts `ManagerStatusCard`
  (kit-styled, MarketStatePanel mold): three UCM channel-desk gates rendered
  advise-vs-act (Delegated / Advising / Manual badge + plain-language copy that
  NAMES the delegation + a skill-vs-gate Meter), and the two fixed-ops managers
  (Service, Body Shop) present/absent with their automated ladder rungs.
  Composition-root `buildManagerStatus(world)` in `src/app/config.ts` REUSES the
  live act-gate predicates (`isAutoPricingUnlocked` / `isTradeApprovalUnlocked`
  (condition_reading gates trade-approve + sourcing on one threshold) /
  `isDiscountDeskingUnlocked` / `isServiceFunctionAutomated` /
  `isBodyShopFunctionAutomated`) read off each manager's GROWN `effectiveSkills`
  vs `tunables.managerGates`, so the card never disagrees with what the desk
  actually does. Reactive: `useWorldState` now bumps on `staff:hired/fired/
  promoted` + `clock:day_started` (the M7 overnight skill step) — no polling.
  Override invariant (§5) stated in the card footer. Pure UI types in
  `src/ui/PeopleTab/managerStatus.ts`; no new events. Tests: live-world
  reachability (gate-crossing flips `delegated`) + app-composition wiring guard +
  component smoke. typecheck + full suite (2101, +6) green. /verify: BLOCKED for
  the live-GUI drive (native expo-sqlite + no react-native-web + on-device-only
  HITL path) — persisted `.claude/skills/verify/SKILL.md`; reachability+smoke+
  wiring-guard cited as the reachable ceiling. A4 open set now #326/#327. Next
  /next BUILDs the lowest deps-met open (#326 recovery-state surfacing).
- 2026-07-17 — BUILT + closed #267 (surface CompetitorMarket drift as a
  player-facing notification). HistoryLog now subscribes to
  `competitor:price_changed` and appends a discrete `market`-kind entry — "Rival
  <brand> raised/cut prices." — directional on the `pricing` stat semantics
  (up = rival more expensive / pressure eased; down = undercut / pressure rose).
  Deliberately did NOT log the daily `market:competitive_pressure` heartbeat: it
  republishes the full roster every day and would flood the 200-cap log; that
  continuous ambient state is the KPI/market-visibility surface (#179), not a
  discrete retrospective entry — documented in HistoryLog.ts + its CLAUDE.md.
  No new event types (pure surfacing). Reaches the built world via the shared
  bus (createWorld.ts:886); HistoryScreen already renders market-kind entries.
  Tests: directional-entry unit test + heartbeat-not-logged test. typecheck +
  full suite (2095) green. A4 open set now #325/#326/#327. Next /next BUILDs the
  lowest deps-met open (#325 manager status card).
- 2026-07-16 — file created; /next skill installed. Phase 1 active. A1 has no dedicated
  open issue yet (it was residue of #297, which A3 closes) — first /next will SLICE phase 1.
- 2026-07-16 — SLICED phase 1 (A1) via /to-issues into #323 (advisor hiring tracer — the
  unblock; bays defaults confirmed sane so hiring one advisor flips capacity positive) and
  #324 (promotion path, blocked-by #323). Next /next BUILDs #323. A3 hygiene (close #269/#266/
  #297, refresh #209 + spec-condensed) trails A1 landing — bookkeeping, not sliced.
- 2026-07-16 — A3 HYGIENE done; PHASE 1 CLOSED, pointer advanced to phase 2 (A4). Closed
  #297 (Service+Body Shop PRD fully delivered incl. A1 residue), #269 (Body Shop v2-anchor
  superseded by the shipped #311–#318 build), #266 (fire is surfaced — PersonnelScreen
  onFire → staffOrg.fire, smoke-tested). Refreshed docs/spec-condensed.md (#209, commit
  ba79cb6): multi-slot save + start menu in scope, Body Shop off the not-yet-built list,
  module map updated. Next /next: phase 2 has open filed issues (#267/#187/#179) but also
  net-new surfacing work (manager status card, recovery states, indictment producers) with
  no issues yet → first phase-2 /next likely SLICEs A4, else BUILDs the lowest open of
  #179/#187/#267.
- 2026-07-16 — SLICED phase 2 (A4) via /to-issues: filed the three unfiled A4 items
  (the three filed ones #267/#187/#179 already existed). #325 (manager status card —
  surface delegated UCM per-skill gates + two fixed-ops managers; macro-spine §2 "delegation
  = permission"; design locked in manager-roles-channel-desk.md §3), #326 (recovery-state
  surfacing — the four contraction/consent-decree events are UI-dark today; render as
  narrative beat + persistent recovery banner, distinct from terminal end-card), #327
  (IndictmentMonitor producers — wire regulatory:audit_failure from RegulatoryMeter +
  deal:fraud_flag from DealEngine; both subscribed but unfired follow-ons per #271). All
  three AFK, independent (start in any order). A4 now fully issue-covered: open set =
  #179, #187, #267, #325, #326, #327. Next /next BUILDs the lowest deps-met open. #179 is
  blocked-by #157/#159/#173 (verify closed); #187 (poaching scale fix, no deps) is the
  likely lowest deps-met.
- 2026-07-17 — BUILT + closed #179 (KPI dashboard — market-state visibility). New
  `MarketStatePanel` (kit-styled, DemandReadout mold) renders inside the KPI dashboard
  below the deal KPIs: per-segment **used-value pressure** map (personality+drift+shock
  factors, tap-to-expand breakdown), **active market shocks** (days-remaining derived
  from `expectedEndDay − currentDay + 1`), **inventory valuation** (book/market/unrealized
  gross/weekly carry), **stale inventory** (aged count/share/capital vs the 45-day
  threshold). Pure builders in `src/ui/KPIDashboard/marketState.ts`; composition-root
  `buildMarketState(world)` in `src/app/config.ts` assembles from `marketEconomy`
  (personality/compHistory.segmentDrift/shocks.activeInstances/valuationFor) +
  `inventory.getLotVehicles()`, keyed on `demandShaper.segments`. Display band edges are a
  new `marketEconomy.valueHeatBands` tunable (no magic numbers). Respected the
  no-vague-labels rule: axis named ("used values vs baseline"), plain signed-% labels
  (Above/At baseline/Below), never "hot/cold" as a word. Wired into RouteContent's KPI
  route; kept the prop optional so the month-close recap stays deal-KPI-focused. Tests:
  pure-builder unit test + a **composition-seam reachability test** (buildMarketState
  against a live world: heat cells, valuationFor on a really-bought LotVehicle, a
  scheduler-driven shock folding into the segment cell) + smoke tests (panel renders,
  tap-expand, optional-prop omission). typecheck + full suite (2090) green. A4 open set
  now #267/#325/#326/#327. NOTE for #267: customer-poaching was cut (poaching-cut.md), so
  #267 reduces to surfacing `competitor:price_changed` / `market:competitive_pressure`
  only. Next /next BUILDs the lowest deps-met open (#267).
- 2026-07-16 — DECIDE + BUILT: resolved #187 by **cutting customer-poaching**
  entirely (not deferred — removed). User challenged whether the concept was even
  worth keeping; traced it forward and confirmed it's redundant with walk outcomes +
  reputation→volume + CompetitorMarket's ambient pressure, and subsumed by BDC (T5)
  win-back. Deleted PoachEngine/poachData/poach-config.json/CustomerPool.Poach.test;
  stripped the poach deps + market:competitive_pressure consume + runPoachChecks from
  CustomerPool; removed poach wiring from createWorld; dropped customer:poached from
  events.ts + Telemetry; trimmed the poach test from Composition.competitor.test
  (CompetitorMarket wiring/determinism tests kept). CompetitorMarket stays as the
  ambient market force (market:competitive_pressure = daily rival heartbeat;
  competitor:price_changed still feeds MarketEconomy). Decision recorded in
  docs/planning/poaching-cut.md; #187 closed. typecheck green. A4 open set now
  #179/#267/#325/#326/#327. Next /next BUILDs the lowest deps-met open (#267 or #179;
  #179 blocked-by #157/#159/#173 — verify closed).
- 2026-07-16 — BUILT + closed #324 (promotion path). StaffOrg now exposes
  `getPromotionOptions(staffId)` + `promote(staffId, toRoleId)` — the first callers of
  `NPC.promoteStaff`. Gate-aware: legal role edge (`promotes_to`) × target `hireTier`
  unlock × source role's `promotion_gates` (composites or grown `effectiveSkills`).
  In-place roster replace preserves the staff id (morale/dispatch survive); emits new
  `staff:promoted` event. PersonnelScreen roster card shows an "↑ <role>" affordance per
  legal target (only when options non-empty). Engine tests + a container reachability
  test (lot-porter→salesperson through the UI). typecheck + full suite green.
  A1 COMPLETE (#323 + #324). Next /next runs A3 hygiene: close #269/#266/#297, then
  refresh #209 + spec-condensed — bookkeeping trailing A1. After that, advance pointer
  to phase 2 (A4 silent-system surfacing).
- 2026-07-16 — BUILT + closed #323 (21e9743). buildHiringRoleOptions now data-driven:
  excludes only worker-tier roles, so service-advisor (T2) + body-shop-advisor (T3) are
  hireable → Service/Body Shop capacity min(bays,advisors) flips positive. Functional
  reachability test drives the hire through the PersonnelScreen container. typecheck + 2080
  tests green. Next /next BUILDs #324 (promotion path — deps met now #323 is in). A3 hygiene
  (close #269/#266/#297, refresh #209 + spec-condensed) still trails, after #324.

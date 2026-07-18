# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

## Current phase

**Phase 3 — B1 Reveal ranking + records**

(Phase 2 A4 closed 2026-07-17 — all six items landed: #267, #187, #179, #325, #326, #327.)

## Blockers

(none)

## Phase table

Status: `pending` → `active` → `done`. "Decision first" = a DECIDE unit must run before
slicing/building that phase (the doc's `[NEW]` items, ungrilled designs, and forks —
resolved just-in-time at the phase boundary, never earlier).

| # | Work (doc section) | Decision first? | Status |
|---|---|---|---|
| 1 | A1 advisor hiring + promotion wiring (#323, #324), + A3 hygiene (close #269, #266, #297) | — | done |
| 2 | A4 silent-system surfacing: #267, #187, #179, manager status card, recovery states, indictment producers | — | done |
| 3 | B1 Reveal ranking + records | — | active |
| 4 | B3 news/adverse-events engine (#176–#179) | — | pending |
| 5 | C3 playtest gate (#74), round 1 — HITL | — | pending |
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

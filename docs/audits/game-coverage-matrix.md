# Game Coverage Matrix — Current-State Audit

> **Scope:** State map only. No fixes proposed, no scope broadened beyond what the
> repo's docs/issues already agree on. Generated 2026-06-13 against `main` @ `deabef0`
> (clean tree).
>
> **Sources of truth used:** `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002,
> the composition root (`src/createWorld.ts`), the live UI tree (`App.tsx` + `src/ui/AppShell/`),
> the save/load seam (`src/worldSnapshot.ts`), the `tests/` inventory, and the open
> GitHub issue queue (`gh issue list --state open`, reconciled per-row).

> **This run adds three things to the standard pass (per request):** (1) every dark/partial
> verdict is reconciled against the live open-issue queue and tagged **filed (#N)** or
> **UNFILED GAP**; (2) forced matrix rows for Service, Bodyshop, OEM, BDC, Department
> decomposition, CompetitorMarket wiring, Demand-influence seam, and the four dashboards,
> regardless of how little code backs them; (3) **tier progression treated as a first-class
> system** — is advancement modeled, are the pacing thresholds externalized/tunable in `data/`,
> where is it dark. Every dark/partial is also classified **ENGINE** (mechanic/design work) or
> **UI** (renders existing state), since UI must trail locked mechanics.

> **Design intent (anchored 2026-06-05, unchanged):** the felt loop is **Dope Wars × Lemonade
> Stand** — buy low / sell high, ride out random adverse events, and *match an inventory
> "recipe" to the incoming buyer demand "weather,"* then watch customers stop or walk.
> F&I/loan is **auto-resolved by design** (managerial-watch loop); the player is *not* meant
> to perform F&I steps. Any older issue-history language to the contrary is superseded.

**Legend:** ✓ = present/complete · **Partial** = partially wired/surfaced · **Dark** = exists in code but unreachable in play · **Dev-only** = reachable only under `__DEV__` · **No / Missing** = absent · **N/A** = not applicable (infra)

**Tags in Notes:** `[ENGINE]` mechanic/design gap · `[UI]` surfacing gap on a built mechanic · `[#N]` filed issue · `[UNFILED]` no issue exists.

Columns: 1 System · 2 Defined in docs · 3 In code · 4 Reachable in play · 5 Surfaced in UI · 6 Save/load · 7 Onboarding · 8 Feedback/error states · 9 Tests · 10 Status notes

## Game-logic systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GameClock (day/overnight) | spec, CLAUDE.md | ✓ | ✓ | ✓ day counter/HUD | ✓ snapshot | No | ✓ recap | ✓ | Overnight resolution sequence via DayLoopController |
| CustomerPool + state machine | spec, ADR-0001 | ✓ | ✓ (FloorSim spawns) | Partial — state visible through HandPlay gates | **No** (by design) | No | ✓ via hand-play | ✓ many | In-flight state excluded from snapshot by design (day-boundary autosave + mid-day checkpoint) |
| DepartmentQueue | spec | ✓ | ✓ BottomNav | ✓ badges + DepartmentScreen | ✓ snapshot | No | ✓ badges | ✓ | 5 dept keys: sales/service/bdc/office/lot |
| StaffOrg (hire/fire/skills/threshold) | spec | ✓ | ✓ | ✓ multi-role hiring (salesperson + tier-gated managers incl. f&i-manager) | ✓ snapshot | No | ✓ candidate cards | ✓ | `buildHiringRoleOptions` tier-gates roles. **Fire still unsurfaced** `[UI][UNFILED]`. Staff has no risk/reward teeth yet `[ENGINE][#249]` |
| Inventory (recon/auction/aging/carry) | spec | ✓ | ✓ AuctionMenu | ✓ lot stats, Auction, Pricing | ✓ snapshot | No | ✓ inspection/aging warns | ✓ many | |
| DealEngine (pricing/F&I/loan/gross) | spec | ✓ | ✓ (auto-close + hand-play) | ✓ gross + match feeds DayRecap (#199) | Stateless | No | ✓ | ✓ many | F&I auto-resolved **by design**; f&i-manager hire reachable (T2+). No SalesWorkspace — correct, not a gap |
| Economy (cash/payroll/rent/P&L) | spec | ✓ | ✓ | ✓ cash HUD + MonthClose | ✓ snapshot | No | ✓ | ✓ | |
| Reputation + RegulatoryMeter | spec | ✓ | ✓ | ✓ RegulatoryGauge in FloorDashboard | ✓ snapshot | No | ✓ | ✓ | reviewScore + regulatory gauge shown |
| **CompetitorMarket (drift/poach)** | spec, ADR-0002 | ✓ | ✓ **wired** (`createWorld.ts:395–404`) | Partial — comps in PricingScreen | ✓ snapshot (#191) | No | No player-facing event | ✓ many (+Composition.competitor) | **Now instantiated + subscribed** (fires `market:competitive_pressure` + `competitor:price_changed`). Memory `competitormarket-not-wired` is **STALE**. Residual: poaching dormant at starting rep `[ENGINE][#187]`; drift/poach has no notification `[UI][UNFILED]` |
| CareerProgression / TierManager | spec | ✓ | ✓ | ✓ tier HUD, ChapterCard, EndCard | ✓ snapshot | No | ✓ | ✓ (CareerProgression.tier) | Backstory Day-1 mods + tier-up wired. Uses AND-threshold from `data/tier-progression.json`; see tier-progression deep-dive below |
| **TierGate (monthly gate engine, #232)** | goals-targets design | ✓ `src/game/TierGate/` | ✓ | ✓ GateStrip on Home (#233) | ✓ snapshot v4 | No | ✓ 4-band verdict | ✓ TierGate.test | **NEW since last audit.** Per-tier per-face targets (units/gross/cash/csi/facility) from `data/tier-gate.json`; 4-band Exceed/Meet/Near-miss/Miss on binding constraint |
| Failure/recovery paths (tier-aware) | spec §failure | ✓ monitors | ✓ terminal → EndCard | Partial — T1 terminal shown; T2 contraction / T3 consent-decree recovery not distinguished | via tierManager | No | ✓ EndCard | Partial | Recovery (non-terminal) under-surfaced `[UI][UNFILED]` |
| SaveStore (SQLite, multi-slot, snapshots) | spec, CLAUDE.md | ✓ | ✓ MainMenu + autosave | ✓ slot picker + rollback (SettingsScreen) | ✓ (is persistence) | No | Partial | ✓ many | Snapshot **v5**; weekly rolling snapshots reachable. Migration recipe doc pending `[#245]` |
| EventBus | spec | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | Sole cross-module channel |
| CapacityManager (demand vs capacity) | spec | ✓ | ✓ | ✓ funnel/recap leakCause | Per-day | No | ✓ leak cause | ✓ | |
| **FollowUpPool / BDC** | per-module | ✓ | ✓ **wired** (`createWorld.ts:503–507`) | ✓ BDC dept queue, morning callback | ✓ snapshot | No | ✓ | ✓ | Morning callback built. **Late-game BDC (appointments/booking, `bdc-rep` role) NOT built** `[ENGINE][UNFILED]` — appointments fork (ui-mapping #4) captured but not filed |
| NPC (traits/archetypes) | ADR-0001 | ✓ | ✓ | ✓ via customers/staff/competitors | Seed-derived | No | N/A | ✓ many | |
| **Service engine (ServiceQueue + ServiceDispatch)** | per-module | ✓ | ✓ Tier-2 gated (`createWorld.ts:513,751`) | ✓ Service dept queue + advisor auto-resolve (T2+) | ServiceQueue ✓ snapshot; Dispatch stateless | No | Partial — ticket-closed events | ✓ ServiceQueue + ServiceDispatch | Engine wired & tested. **Intake is procedural (seed×day), NOT bound to the customer base / NPC pool** — no service customers generated as NPCs `[ENGINE][UNFILED]`. Silent at T1 by design |
| StaffDispatch (floor drain) | per-module | ✓ | ✓ (floorSeams) | ✓ auto-resolve + escalation | Stateless per-day | No | ✓ exceptions | Partial (backfill `[#243]`) | |
| StaffMorale | per-module | ✓ | ✓ | ✓ per-staff MORALE chip in FloorDashboard | ✓ snapshot | No | Partial | ✓ | Feeds dispatch multiplier; visible |
| MarketEconomy (anchor/drift/pricing/trades) | market-economy lock | ✓ | ✓ | ✓ PricingScreen/valuations | ✓ snapshot | No | ✓ price position | ✓ many | Honest-book engine + hidden-lemon + carrying cost + trade-ins live |
| — News engine / ticker / weekly report | market-economy lock | **Missing** | No | No | No | No | No | No | **The Dope-Wars "adverse-events" pillar — unbuilt** `[ENGINE][#176–#179]`. Top loop gap |
| **Demand-influence seam (DemandShaper)** | #197, demand-influence mem | ✓ | ✓ **wired** (`createWorld.ts:567–575`) | ✓ DemandReadout (observed mix + targeting levers + coverage gap) | ✓ snapshot v2 | No | ✓ | ✓ DemandShaper + computeDemandFactor | **Player-influenceable, not a static readout**: three influence producers (inventory #211, reputation #211, advertising campaigns #212) + `demandControls`. #197/#211/#212 closed. Weather/season axis (#231) not confirmed built `[ENGINE][?]` |
| **OEM mechanics (allocation/floorplan/incentives)** | oem-relationship-engine | **No code** | No | No | No | No | No | No | **Design locked, parked, T4-gated** `[ENGINE][#223]`. Doc: `docs/planning/oem-relationship-engine.md`. Capture-not-build; zero code is correct (building now = chronological-order violation) |
| **Bodyshop engine** | spec (out of scope v1) | **No code** | No | No | No | No | No | No | **Deferred to v2 by spec** `[ENGINE]`. No module/stub. Intentional, not a v1 gap — but no design-record issue beyond the spec line `[UNFILED]` |
| Telemetry | per-module | ✓ | Dev-only | Dev-only (AdminConsole) | ✓ snapshot | No | N/A | ✓ | |
| HistoryLog (persistent player history) | #208 | ✓ | ✓ wired | ✓ HistoryScreen | ✓ snapshot | No | ✓ | ✓ | Durable deals/exceptions/shocks/tier-ups |
| KPIDashboard (logic + standalone UI) | spec, #179 | ✓ | ✓ on-demand | ✓ in-game menu + MonthClose | ✓ snapshot | No | Partial | ✓ | Market-state KPI slice still open `[UI][#179]` |
| DayLoopController / FloorSim (core loop) | #99/#107 | ✓ | ✓ core loop | ✓ FloorDashboard + speed/pause | Mid-day checkpoint (replay) | No | ✓ | ✓ many | Real-time day; deterministic replay; hours-of-op feeds day length (#207). Coverage backfill `[#243]` |
| SalesProcess (gate evaluation) | sales-process slice | ✓ | ✓ | ✓ hand-play gates | Stateless | No | ✓ walk/close | ✓ many | |
| EndCard / EndCardManager | spec | ✓ | ✓ game_over | ✓ EndCard | N/A | No | ✓ | ✓ smoke | CLAUDE.md doc pending `[#244]` |

## Player-facing UI systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| MainMenu (New/Continue/Load/Delete + Settings + LegacyWall) | save-load mem | ✓ | ✓ boot | ✓ | ✓ slots | No | Partial | **None** | No dedicated test |
| CharacterCreation | spec | ✓ | ✓ | ✓ | persists profile/seed | No | Partial | **None** | No test |
| AppShell (FIXED 5-tab IA) | #215, second-level-ia | ✓ `src/ui/AppShell/` | ✓ | ✓ Home/Operations/People/Finance/Growth | N/A | No | ✓ | Partial | **Retired `DayLoopShell` (#215/#228); the prior audit's IA-at-capacity gap is structurally RESOLVED.** Tabs never tier-gated |
| **Home tab** | home-hub mapping | ✓ `src/ui/HomeTab/` | ✓ | ✓ status dashboard + GateStrip + DemandReadout + recap | N/A | No | ✓ | Partial | Live, fully-backed surface |
| **Operations tab** | second-level-ia | ✓ `src/ui/OperationsTab/` | ✓ | ✓ dept dock (sales/service/bdc/office/lot) + prep levers | N/A | No | ✓ | Partial | Live |
| **People dashboard (staff)** | second-level-ia | Placeholder `StrategicTab` | ✓ (tab) | **Dark — "coming in a later slice"** | N/A | No | No | None | `[UI][UNFILED]` Roster + Hiring surface not built; staff-teeth design is the upstream `[ENGINE][#249]` |
| **Finance dashboard (analytics)** | analytics.png, second-level-ia | Placeholder `StrategicTab` | ✓ (tab) | **Dark — placeholder** | N/A | No | No | None | `[UI][UNFILED]` analytics.png is the Finance landing; needs a chart-primitives kit slice first. Not yet filed |
| **Growth dashboard (tier/demand/courtship)** | second-level-ia | Partial | ✓ (tab) | **Partial** — GateStrip lives on Home; Growth tab itself is placeholder | N/A | No | No | None | `[UI][UNFILED]` Growth = demand console + gate board + courtship/portfolio; tab still placeholder. Gate progress is surfaced (on Home), the Growth *home* is not |
| **Inventory dashboard/surface** | inventory.png mapping | Partial | ✓ via Operations | **Partial** — lot stats in FloorDashboard + Pricing + Auction; full inventory.png surface not built | N/A | No | ✓ | ✓ smoke (Pricing/Auction) | `[UI][UNFILED]` Inventory placement resolved → Operations sub-surface; rebrand slice not yet filed |
| DayRecap | #119/#199 | ✓ | ✓ | ✓ + match-payoff line (#199) | N/A | No | ✓ | ✓ smoke | |
| HandPlayModal (sales workspace) | #118 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| OwnershipLevers (pre-open levers) | #120 | ✓ | ✓ | ✓ in Operations | persists hoursOfOp | No | Partial | ✓ smoke | Hours-of-op effective (#207) |
| DemandReadout | #198 | ✓ | ✓ | ✓ on Home | reads DemandShaper | No | ✓ | ✓ smoke | Observed mix + targeting levers + coverage gap |
| AuctionMenu | #164 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| PricingScreen | #175 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| PersonnelScreen (hiring) | #120 | ✓ | ✓ | ✓ multi-role options | N/A | No | Partial | **None** | Deep-import fix pending `[#244]` |
| DepartmentScreen (generic queue) | #76 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| BottomNav | #76 | ✓ | ✓ | ✓ badges | N/A | No | ✓ | ✓ smoke | |
| MonthCloseInterstitial | #123 | ✓ | ✓ | ✓ hosts KPI snapshot | N/A | No | ✓ | ✓ smoke | |
| NarrativeBeat / ChapterCard | spec, #127 | ✓ | ✓ tier-up | ✓ | N/A | No | ✓ | ✓ smoke | |
| HistoryScreen | #208 | ✓ | ✓ in-game menu | ✓ | reads historyLog | No | ✓ | ✓ reachability | |
| SettingsScreen (rollback) | spec persistence | ✓ | ✓ MainMenu + in-game | ✓ | reads snapshots | No | Partial | via composition | No a11y options screen `[UI][UNFILED]` |
| LegacyWallView (completed careers) | spec | ✓ + LegacyStore | ✓ MainMenu route | ✓ | LegacyStore ✓ | No | Partial | ✓ reachability | |
| TradeEscalationModal | #170/#201 | ✓ | ✓ overlay on `trade:escalated` | ✓ | transient | No | ✓ | via composition | |
| DiscountEscalationModal | — | ✓ | ✓ overlay | ✓ | transient | No | ✓ | ✓ smoke | |
| Navigator (routing) | per-module | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | |
| CustomerCard | — | ✓ | **Dev-only** | Dev-only | N/A | No | N/A | ✓ smoke | |
| AdminConsole | — | ✓ | **Dev-only** | Dev-only | uses saveStore | No | N/A | None | Dev tooling |

## Cross-cutting / "obvious" systems

| System | Defined | Status | Notes |
|---|---|---|---|
| Core loop | #99/#107 | ✓ | DayLoopController/FloorSim real-time day, MANAGERIAL↔FLOOR_OPEN |
| Menus & navigation IA | #215, second-level-ia | ✓ | **5-tab AppShell landed (#228); the prior "shell at capacity" gap is resolved.** Per-tab second-level charters locked (`docs/planning/second-level-ia.md`) |
| Save/load | spec, #186 | ✓ multi-slot | Snapshot **v5**; persists ~18 modules incl. tierGate (v4), demandShaper (v2), competitorMarket, historyLog. CustomerPool & per-day funnels excluded by design |
| HUD/status display | #116/#117 | ✓ | FloorDashboard (+morale, +regulatory gauge) |
| NPC systems & skills | ADR-0001 | ✓ | Multi-role hiring surfaced; fire not `[UI]` |
| Dialogue/event/history log | #117/#127/#208 | ✓ | Persistent HistoryLog + chapter cards + recap |
| **Tier / progression systems** | spec, macro-loop-spine | Partial | TierManager (T1→T3 thresholds) + TierGate (monthly gate) both built; thresholds externalized to `data/`. **T4–T7 spine designed not built; advancement-rewire to gate streaks unbuilt** `[ENGINE][#250]`. See deep-dive below |
| **Department decomposition** (office/BDC/lot/sales/service/bodyshop) | DeptKey + second-level-ia | **Partial / DESIGN FORK** | 5 keys exist in code (`sales/service/bdc/office/lot`); **bodyshop is not among them** (v2). office/lot/bdc have **no staff roles** and their dept *meaning* (Office semantics, BDC-at-T1, follow-up-verb home) is **parked to a dept-mechanics design pass** `[ENGINE][UNFILED — fork]` |
| Failure/recovery | spec | Partial | Terminal→EndCard ✓; T2/T3 recovery under-surfaced `[UI]` |
| Settings/accessibility | spec | Partial | Rollback reachable; no dedicated a11y screen `[UI]` |
| Tutorial/onboarding | #213 | **Missing** | No tutorial/coachmarks/first-run/help `[ENGINE+UI][#213]` |
| Feedback/notifications | #117 | ✓ | Badges, floor events, exception alerts, recap, month-close, match-payoff |
| Ship-blocker: fictional brands | fictional-brands mem | **Open** | Real trademarks still in `data/vehicles.json` + `data/brand-tiers.json` `[ENGINE/data][#246]` — hard release gate |

---

## Tier-Progression Deep-Dive (first-class, per request)

**Is advancement modeled?** Yes — and in two cooperating engines:

1. **`TierManager`** (`src/game/CareerProgression/`) — the live advancement gate. Tracks
   `currentTier` + `customersServed`, reads live `economy.cash` and `reputation.reviewScore`,
   checks on `clock:overnight_payroll`. Advancement is a simple **AND-threshold** (all of
   minCash / minCustomers / minReputation met).
2. **`TierGate`** (`src/game/TierGate/`, **new since the last audit**, #232) — the monthly
   **4-band gate** (Exceed/Meet/Near-miss/Miss) over per-tier faces (units, gross, cash, csi,
   facility), surfaced as the Home `GateStrip` (#233). This is the *pacing/judging* engine.

**Are the pacing thresholds externalized & tunable?** **Yes — this is the good news.** The
gating numbers that pace time-to-advance live in `data/`, not in TypeScript:

- `data/tier-progression.json` — per-tier `triggerThreshold` (minCashOnHand, minCustomersServed,
  minReputationScore). E.g. T2 = 125k/100/62, T3 = 400k/300/75.
- `data/tier-gate.json` — per-tier per-face monthly targets + the band ratio thresholds.
- `data/tier-pacing-targets.json` — reference pacing tolerances.

These are open-ended, designer-editable runway knobs — exactly the spine that should time the
gravel-yard → paved-lot → showroom cadence. No magic numbers in code for the gates.

**Where it's dark (call it bluntly):**

- **The two engines aren't unified** `[ENGINE][#250]`. TierManager still advances on its own
  AND-threshold; the intended rewire — *advance by consuming TierGate verdict streaks and retire
  `triggerThreshold`* — is filed (#250) but **unbuilt**. Today there are two parallel notions of
  "ready to advance," and the data-driven monthly gate is not yet the thing that actually
  promotes you.
- **Only T1→T3 is modeled.** The T4–T7 macro-loop spine (`docs/planning/macro-loop-spine.md`)
  is designed but unbuilt; T4 advancement depends on the parked OEM engine `[ENGINE][#223]` and
  franchise-courtship (multi-signal: financial strength + sales record + CSI), neither in code.
- **No balance harness to tune the runway** `[ENGINE][#247]` — the pacing values are externalized
  but there's no policy-bot/headless sim to verify time-to-advance, and **no Tier-N dev fixtures**
  to start a playtest mid-climb `[ENGINE][#248]`.

---

## Key Observations

- **Two structural gaps from the 2026-06-09 audit are now resolved.** (1) The "managerial UI shell
  at capacity (#215)" gap is closed: `DayLoopShell` was retired and replaced by the **fixed 5-tab
  `AppShell`** (#228), with second-level charters locked. (2) **CompetitorMarket is wired** in
  `createWorld` (fires competitive-pressure + price-change), so the `competitormarket-not-wired`
  memory is now **stale** and should be updated.
- **A new progression spine landed: the monthly `TierGate` engine (#232) + Home `GateStrip`
  (#233).** Tier pacing thresholds are externalized to three `data/` files — the runway is tunable.
  The remaining work is *unifying* it with TierManager (#250), not building it.
- **The strategic half of the UI is honest placeholder.** People, Finance, and Growth render
  `StrategicTab` "coming in a later slice." Of the four dashboards requested: **Home/Operations are
  live; People (staff), Finance (analytics), and the Growth home are dark/placeholder; Inventory is
  partial** (Operations sub-surface). All four residuals are **`[UI]`** — they render mechanics that
  largely exist; none is blocked on missing engine except Growth's courtship/portfolio (T4+).
- **The Dope-Wars "adverse-events" pillar is still unbuilt (#176–#179)** — the news/ticker/shock
  engine. With demand read/influence/payoff landed, this is the single largest *loop* gap. `[ENGINE]`.
- **Service engine is wired and tested but customer-blind.** ServiceQueue/ServiceDispatch run at
  T2+, but intake is procedural (seed×day), **not generated from the customer base / NPC pool** —
  there are no service *customers* as NPCs. `[ENGINE][UNFILED]`.
- **OEM and Bodyshop are correctly absent.** OEM is design-locked and parked T4 (#223); Bodyshop is
  v2 out-of-scope. Neither has code; that is intended, not a gap.
- **Demand is player-influenceable, as designed.** DemandShaper exposes inventory, reputation, and
  advertising influence producers + `demandControls` — not a static readout. Its tracking issues
  (#197/#211/#212) are closed.
- **Onboarding remains entirely absent (#213).** The match skill is visible but taught nowhere.
- **Ship-blocker still open (#246):** real vehicle trademarks remain in `data/`. Hard release gate.
- **Test coverage** spans logic + smoke + reachability. UI placeholders (People/Finance/Growth) and
  FloorDashboard have no tests (presentation-only); StaffDispatch + DayLoopController backfill is
  filed (#243).

---

## Where Actual Structure Diverges From Intended Design

1. **Dual advancement logic (#250).** Intended design promotes on the data-driven monthly gate;
   code still promotes on TierManager's standalone AND-threshold. The gate is built and surfaced but
   not yet load-bearing for promotion. `[ENGINE]`.
2. **Department set is half-specified (design fork).** Code commits to 5 dept keys
   (`sales/service/bdc/office/lot`); **bodyshop is excluded** (v2) and office/lot/bdc carry **no
   staff roles**. The *meaning* of Office, whether BDC exists at T1, and where the follow-up verb
   lives are **parked to a dept-mechanics pass** (`second-level-ia.md` §5) — an unresolved,
   unfiled design fork, not a spec. `[ENGINE/design]`.
3. **Strategic tabs are scaffolding.** People/Finance/Growth are always-present placeholders by
   deliberate choice (nav is never tier-gated), but three of the four requested dashboards
   therefore render nothing yet. `[UI]`.
4. **Service runs without customers.** The engine exists and resolves tickets, but it is not wired
   to the NPC/customer base — service demand is synthetic. Diverges from the "real customers across
   departments" intent. `[ENGINE]`.
5. **The adverse-events pillar (#176–#179) is unbuilt** — the world has weather to *read* but no
   weather *changes* to react to. `[ENGINE]`.
6. **Doc drift (#209).** `spec-condensed.md` lists multi-slot save as out-of-scope; the code ships
   it. Stale doc, not wrong code.

---

## Session Handoff Summary

**Current state:** `main` @ `deabef0`, clean tree. The managerial day-loop is complete, reachable,
and well-covered. Since 2026-06-09 the **5-tab AppShell** replaced `DayLoopShell` (closing the IA
gap), the **monthly TierGate engine + Home GateStrip** landed, and **CompetitorMarket** is confirmed
wired. The tier-pacing thresholds are externalized to `data/` and tunable.

**Most important gaps now (highest leverage first):**
1. **News / adverse-events engine (#176–#179)** `[ENGINE]` — the unbuilt Dope-Wars "bust" pillar.
2. **Unify tier advancement onto the gate (#250)** `[ENGINE]` — make the data-driven monthly gate
   actually promote the player; retire the parallel threshold.
3. **Strategic dashboards — People (#249-backed), Finance/analytics, Growth home** `[UI]` — three of
   four dashboards are placeholders.
4. **Onboarding for the match skill (#213)** `[ENGINE+UI]`.
5. **Service ↔ customer-base wiring** `[ENGINE][UNFILED]` and **late-game BDC appointments**
   `[ENGINE][UNFILED]`.
6. **Ship-blocker: fictional brands (#246)** `[data]` — release gate.

**What the next session should do:** keep working the chronological queue. The decision-relevant
read for the UI-rebrand pass is that the *shell* is solved but three of its rooms are empty; the
decision-relevant read for the *game* is that progression is now built and tunable but not yet
unified, and the adverse-events pillar is still missing. Reconcile doc drift (#209) and update the
stale `competitormarket-not-wired` memory opportunistically.

# Game Coverage Matrix — Current-State Audit

> **Scope:** State map only. No fixes proposed, no scope broadened beyond what the
> repo's docs/issues already agree on. Generated 2026-06-17 against `main` @ `e2729e6`
> **(working tree dirty** — reflects uncommitted edits to `data/staff-roles.json`, the
> tier CSV, and several docs/tests from the in-session tier-canon fix, not a clean commit).
>
> **Sources of truth used:** `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002,
> the composition root (`src/createWorld.ts`), the live UI tree (`App.tsx` → `src/app/` →
> `src/ui/AppShell/`), the save/load seam (`src/worldSnapshot.ts`), the `tests/` inventory,
> and the open GitHub issue queue (`gh issue list --state open`, reconciled per-row).

> **Rubric correction this run (load-bearing):** a `✓` on a **player-facing column**
> (`Reachable`, `Surfaced`, `Feedback`) now means *a real player-felt loop runs through the
> system* — not "the code compiles and is wired." Any system whose **intake/demand is synthetic**
> (procedural `seed × day`, not bound to the NPC/customer base) is capped at **Partial** on those
> columns, and its verdict **leads with the hole**. This flips the **Service engine** from the prior
> run's `✓✓✓` to a customer-blind **stub**, and adds a **Profit-Center Reality Check** table so a
> stub and an absent system sit in the same not-real bucket. See that table — it is the headline.

> **This run measures coverage against the LOCKED tier progression:**
> `docs/planning/Gameplay Loops and Dealership progression tiers.csv` (the tier/facility/
> profit-center spine) + `docs/planning/manager-roles-channel-desk.md` (the manager model).
> A dedicated **Tier-Progression Deep-Dive** maps profit-center / staff-role unlocks tier-by-tier
> and reconciles `data/staff-roles.json` against the CSV. Every dark/partial is classified
> **ENGINE** (mechanic/design work) or **UI** (renders existing state).

> **Design intent (anchored 2026-06-05, unchanged):** the felt loop is **Dope Wars × Lemonade
> Stand** — buy low / sell high, ride out random adverse events, and *match an inventory
> "recipe" to the incoming buyer demand "weather,"* then watch customers stop or walk.
> F&I/loan is **auto-resolved by design** (managerial-watch loop); the player is *not* meant
> to perform F&I steps. Any older issue-history language to the contrary is superseded.

**Legend:** ✓ = present/complete · **Partial** = partially wired/surfaced · **Dark** = exists in code but unreachable in play · **Dev-only** = reachable only under `__DEV__` · **No / Missing** = absent · **N/A** = not applicable (infra)

**Player-facing-column rule:** ✓ on `Reachable` / `Surfaced` / `Feedback` asserts a real player-felt loop. Synthetic-intake systems are capped at **Partial** there even when fully coded.

**Tags in Notes:** `[ENGINE]` mechanic/design gap · `[UI]` surfacing gap on a built mechanic · `[#N]` filed issue · `[UNFILED]` no issue exists.

Columns: 1 System · 2 Defined in docs · 3 In code · 4 Reachable in play · 5 Surfaced in UI · 6 Save/load · 7 Onboarding · 8 Feedback/error states · 9 Tests · 10 Status notes

## Game-logic systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GameClock (day/overnight) | spec, CLAUDE.md | ✓ | ✓ | ✓ day counter/HUD | ✓ snapshot | No | ✓ recap | ✓ | Overnight resolution sequence via DayLoopController |
| CustomerPool + state machine | spec, ADR-0001 | ✓ | ✓ (FloorSim spawns) | Partial — state visible via floor/hand-play | **No** (by design) | No | ✓ via hand-play | ✓ many | In-flight state excluded by design (day-boundary autosave + mid-day checkpoint). **This is the real customer base — note that Service intake does NOT draw from it** |
| DepartmentQueue | spec | ✓ | ✓ dept dock | ✓ badges + DepartmentScreen | ✓ snapshot | No | ✓ badges | ✓ | 5 dept keys: sales/service/bdc/office/lot |
| StaffOrg (hire/fire/skills/threshold) | spec | ✓ | ✓ | ✓ hire **and fire** via PersonnelScreen (Operations sub-surface) | ✓ snapshot | No | ✓ candidate cards | ✓ | `buildHiringRoleOptions` tier-gates roles. **Fire now surfaced** (`PersonnelScreen.tsx:163` → `staffOrg.fire`) — #266 appears already satisfied. **Model-B skill growth live** (#294): effective skill = `base + growth×counter`, counters accrue overnight only `[ENGINE done]` |
| Inventory (recon/auction/aging/carry) | spec | ✓ | ✓ AuctionMenu | ✓ lot stats, Auction, Pricing | ✓ snapshot | No | ✓ inspection/aging warns | ✓ many | **Seed lot built** (#295/#296): 1 SUV/1 truck/1 sedan, value-banded, recon-complete, frontline-ready, deterministic, no t=0 debit |
| DealEngine (pricing/F&I/loan/gross) | spec | ✓ | ✓ (auto-close + hand-play) | ✓ gross + match feeds DayRecap | Stateless | No | ✓ | ✓ many | F&I auto-resolved **by design**; f&i-manager hire reachable (T3). No SalesWorkspace — correct, not a gap |
| Economy (cash/payroll/rent/P&L) | spec | ✓ | ✓ | ✓ cash HUD + MonthClose | ✓ snapshot | No | ✓ | ✓ | |
| Reputation + RegulatoryMeter | spec | ✓ | ✓ | ✓ RegulatoryGauge in FloorDashboard | ✓ snapshot | No | ✓ | ✓ | reviewScore + regulatory gauge shown |
| **CompetitorMarket (drift/poach)** | spec, ADR-0002 | ✓ | ✓ **wired** | Partial — comps in PricingScreen | ✓ snapshot | No | No player-facing event | ✓ many | Fires `market:competitive_pressure` + `competitor:price_changed`. Residual: poaching dormant at starting rep `[ENGINE][#187]`; drift/poach has no notification `[UI][#267]` |
| CareerProgression / **TierManager** | spec, macro-loop-spine | ✓ | ✓ | ✓ tier HUD, ChapterCard, EndCard | ✓ snapshot (schema v2) | No | ✓ | ✓ | **REWIRED (#250):** advances **solely** by consuming `tierGate:month_verdict` streaks (consecutive meet-or-better, reset on miss); `triggerThreshold` **retired**. At T3 arms `dossierReady` (no auto-T4). Prior "dual advancement" gap **CLOSED** |
| **TierGate (monthly gate engine, #232)** | goals-targets design | ✓ | ✓ | ✓ GateStrip on Home (#233) | ✓ snapshot | No | ✓ 4-band verdict | ✓ | Per-tier per-face targets from `data/tier-gate.json`; **load-bearing** — its verdict streak is what TierManager consumes to promote |
| **Career-ending monitors (Bankruptcy/Indictment/CareerEndings)** | spec §failure, #270–#272 | ✓ | ✓ **all wired** | ✓ → EndCard | ✓ snapshot (v6/v7/v8) | No | ✓ EndCard | ✓ | **Newly wired (#270/#271/#272)** — were dark/orphaned (#184). Caveat: IndictmentMonitor only live producer = `regulatory:lemon_law_incident`; `audit_failure`/`deal:fraud_flag` unwired follow-ons `[ENGINE][UNFILED]` |
| Failure/recovery paths (tier-aware) | spec §failure | ✓ monitors | ✓ terminal → EndCard | Partial — T1 terminal shown; T2 contraction / T3 consent-decree recovery not distinguished | via monitors | No | ✓ EndCard | Partial | Recovery (non-terminal) under-surfaced `[UI][UNFILED]` |
| SaveStore (SQLite, multi-slot, snapshots) | spec, CLAUDE.md | ✓ | ✓ MainMenu + autosave | ✓ slot picker + rollback (SettingsScreen) | ✓ (is persistence) | No | Partial | ✓ many | **Snapshot v8** (22 module keys); migration recipe doc landed (#245) |
| EventBus | spec | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | Sole cross-module channel |
| CapacityManager (demand vs capacity) | spec | ✓ | ✓ | ✓ funnel/recap leakCause | Per-day | No | ✓ leak cause | ✓ | |
| **FollowUpPool / BDC** | per-module | ✓ | ✓ **wired** | ✓ BDC dept queue, morning callback | ✓ snapshot | No | ✓ | ✓ | Morning callback built. **Late-game BDC (appointments/booking, `bdc-manager` role) NOT built** `[ENGINE][UNFILED]` — T5 canon |
| NPC (traits/archetypes) | ADR-0001 | ✓ | ✓ | ✓ via customers/staff/competitors | Seed-derived | No | N/A | ✓ many | Sales customers are NPC-bound; **service customers are NOT** (see Service row) |
| **Service engine (ServiceQueue + ServiceDispatch)** | per-module | ✓ | **Partial** | **Partial** | ServiceQueue ✓; Dispatch stateless | No | **Partial** | ✓ | **CUSTOMER-BLIND SYNTHETIC STUB — no real player loop runs through it.** Code genuinely exists (`ServiceQueue.ts` 77L + `ServiceDispatch.ts` 206L, wired `createWorld.ts:775`/`:1105`, persisted, tested) and a Service dept queue renders at T2+ with advisor auto-resolve — **but intake is procedural (`seed × day`), NOT drawn from CustomerPool/NPC.** The player sees a queue fed by fake demand they cannot influence. Per the player-facing-column rule, `In code`/`Tests` are ✓ but Reachable/Surfaced/Feedback are **Partial**. As a **T2 profit center it does not exist for the player** `[ENGINE][#269-adjacent / UNFILED for the customer-wiring]`. See Profit-Center Reality Check |
| StaffDispatch (floor drain) | per-module | ✓ | ✓ (floorSeams) | ✓ auto-resolve + escalation | Stateless per-day | No | ✓ exceptions | ✓ (backfilled #243) | Channel-desk gates (discount-desking #290, trade-approve #291, sourcing #293) resolve through it |
| StaffMorale | per-module | ✓ | ✓ | ✓ per-staff MORALE chip | ✓ snapshot | No | Partial | ✓ | Feeds dispatch multiplier; visible |
| **MarketEconomy (anchor/drift/pricing/trades/elasticity)** | market-economy lock, pricing-demand spine | ✓ | ✓ | ✓ PricingScreen/valuations/heat | ✓ snapshot | No | ✓ price position | ✓ many | **Pricing spine landed (#273–#287):** `askingPrice` is now the **close transaction anchor** (was cosmetic; marketPrice demoted to benchmark); unified elasticity curve (`demand-elasticity.json`) behind both days-to-sell AND FloorSim arrivals; intel-precision tiering (coarse gut→sharp UCM, #284); honest trade negative-equity distribution |
| **Manager channel-desk model (UCM desk)** | manager-roles-channel-desk | ✓ | ✓ | Partial — gates act invisibly; no manager-status surface | via StaffOrg | No | ✓ via exceptions | ✓ | **Built (#288–#294):** SM **dropped**, UCM owns desk. 4 act-gates on live top-UCM skill vs `tunables.managerGates.actThresholds`: auto-pricing (`pricing` #289), discount-desking (`t_o_closing` #290), trade auto-approve (`condition_reading` #291), sourcing auto-fill (`condition_reading` #293). **All magnitudes placeholder → calibration deferred to #286** |
| — News engine / ticker / weekly report | market-economy lock, #176–#179 | **Missing** | No | No | No | No | No | No | **The Dope-Wars "adverse-events" pillar — still unbuilt** `[ENGINE][#176–#179]`. Now the single largest loop gap |
| **Demand-influence seam (DemandShaper)** | #197, demand-influence mem | ✓ | ✓ **wired** | ✓ DemandReadout (heat console + targeting levers + coverage gap) | ✓ snapshot | No | ✓ | ✓ | **Player-influenceable**, vehicle-type **heat map** (#278): segment heat (sedan/truck/suv) drives spawn draw; influence producers (inventory/reputation/advertising); weather/season axis (#231) built. **Drives SALES demand only — service demand is not on this seam** |
| **OEM mechanics + NCM (allocation/floorplan/incentives)** | oem-relationship-engine | **No code** | No | No | No | No | No | No | **Design locked, parked, T4-gated** `[ENGINE][#223]`. No `new-car-manager`/NCM role in `data/staff-roles.json` either. Zero code is correct (T4 = higher tier) |
| **Bodyshop engine + Body Shop Advisor** | tier CSV (T3 canon), #269 | **No code** | No | No | No | No | No | No | **T3-CANON, ZERO CODE.** CSV places body shop at T3 (mirror of service engine → collision) with a `body-shop-advisor` role. **Neither engine nor role exists** (`data/staff-roles.json` has no `body-shop-advisor`; no `src/game/BodyShop/`). Design-record `[ENGINE][#269]`. See Profit-Center Reality Check |
| Telemetry | per-module | ✓ | Dev-only | Dev-only (AdminConsole) | ✓ snapshot | No | N/A | ✓ | |
| HistoryLog (persistent player history) | #208 | ✓ | ✓ wired | ✓ HistoryScreen | ✓ snapshot | No | ✓ | ✓ | Durable deals/exceptions/shocks/tier-ups |
| KPIDashboard (logic + standalone UI) | spec, #179 | ✓ | ✓ on-demand | ✓ in-game menu + MonthClose | ✓ snapshot | No | Partial | ✓ | Market-state KPI slice still open `[UI][#179]` |
| DayLoopController / FloorSim (core loop) | #99/#107 | ✓ | ✓ core loop | ✓ FloorDashboard + speed/pause | Mid-day checkpoint (replay) | No | ✓ | ✓ many | Real-time day; deterministic replay; hours-of-op feeds day length |
| SalesProcess (gate evaluation) | sales-process slice | ✓ | ✓ | ✓ hand-play gates | Stateless | No | ✓ walk/close | ✓ many | `pickVehicleForMatch` match-quality payoff (#199); reservation-price discount model (#274) |
| EndCard / EndCardManager | spec | ✓ | ✓ game_over | ✓ EndCard | N/A | No | ✓ | ✓ smoke | CLAUDE.md landed (#244) |
| **Balance harness + Tier-N fixtures** | #247/#248, tier-pacing-targets | ✓ | Dev/tooling | N/A (headless) | N/A | N/A | N/A | ✓ | Headless policy-bot sim + pacing/sweep/calibration reports (#247); start-a-world-at-any-tier dev fixtures (#248) |

## Player-facing UI systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **App composition (decomposed #242)** | architecture audit | ✓ `src/app/` | ✓ | ✓ `App.tsx`(24 ln) → `AppRoot` → `RouteContent` + `AppOverlays` | N/A | No | ✓ | Partial | **App.tsx 1991→24 lines**, state hooks + screens under `src/app/`. Concentrated composition risk resolved |
| MainMenu (New/Continue/Load/Delete + Settings + LegacyWall) | save-load mem | ✓ | ✓ boot | ✓ | ✓ slots | No | Partial | **None** | No dedicated test |
| CharacterCreation | spec | ✓ | ✓ | ✓ | persists profile/seed | No | Partial | ✓ smoke | |
| AppShell (FIXED 5-tab IA) | #215, second-level-ia | ✓ `src/ui/AppShell/` | ✓ | ✓ Home/Operations/People/Finance/Growth | N/A | No | ✓ | ✓ (NavGating + reachability) | Tabs **never tier-gated** (data-driven `nav-tabs.json`, guarded by `NavGating.test.tsx`). NOTE stale comment `AppShell.tsx:21-22` references retired #226 gating — comment rot only |
| **Home tab** | home-hub mapping | ✓ `src/ui/HomeTab/` | ✓ | ✓ status dashboard + GateStrip + DemandReadout (heat console) + recap | N/A | No | ✓ | Partial | Live, fully-backed surface |
| **Operations tab** | second-level-ia | ✓ `src/ui/OperationsTab/` | ✓ | ✓ dept dock (sales/service/bdc/office/lot) + prep levers + hiring/firing entry | N/A | No | ✓ | **No dedicated smoke/reachability test** for the tab composition `[UNFILED]` | Live; hosts Inventory/Pricing/Auction/Personnel sub-surfaces. **The Service dock tile renders the synthetic-intake stub** |
| **People dashboard (staff)** | second-level-ia | Placeholder `StrategicTab` | ✓ (tab) | **Dark — "coming in a later slice"** | N/A | No | No | placeholder render-tested only | `[UI][UNFILED]` Roster/hiring **reachable via Operations→Personnel**, but the dedicated People *dashboard* surface is unbuilt. Upstream staff-teeth mechanic is the active line `[ENGINE][#249 landed → grill next]` |
| **Finance dashboard (analytics)** | analytics.png, second-level-ia | Placeholder `StrategicTab` | ✓ (tab) | **Dark — placeholder** | N/A | No | No | placeholder only | `[UI][UNFILED]` analytics.png landing; needs a chart-primitives kit slice first. Not yet filed |
| **Growth dashboard (tier/demand/courtship)** | second-level-ia | Placeholder `StrategicTab` | ✓ (tab) | **Dark — placeholder** | N/A | No | No | placeholder only | `[UI][UNFILED]` GateStrip + DemandReadout live **on Home**; the Growth *home* (demand console + gate board + courtship/portfolio) is still placeholder |
| **Inventory dashboard/surface** | inventory.png mapping | Partial | ✓ via Operations | **Partial** — lot stats + Pricing + Auction; full inventory.png surface not built | N/A | No | ✓ | ✓ smoke (Pricing/Auction) | `[UI][UNFILED]` Inventory = Operations sub-surface; rebrand slice not yet filed |
| DayRecap | #119/#199 | ✓ | ✓ | ✓ + match-payoff line | N/A | No | ✓ | ✓ smoke | |
| HandPlayModal (sales workspace) | #118 | ✓ | ✓ (on FloorDashboard mode) | ✓ | N/A | No | ✓ | ✓ (FloorSim.handplay) | Lives on the floor surface, not the overlay channel |
| OwnershipLevers (pre-open levers) | #120 | ✓ | ✓ in Operations | ✓ | persists hoursOfOp | No | Partial | ✓ smoke | Hours-of-op effective (#207) |
| DemandReadout (heat console) | #198/#278/#280 | ✓ | ✓ | ✓ on Home | reads DemandShaper | No | ✓ | ✓ smoke + reachability | Heat-band granularity respects intel precision (coarse 3 / fine 5 by UCM skill). Sales demand only |
| AuctionMenu | #164 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| PricingScreen | #175 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | Days-to-sell + suggestion band sharpen with UCM intel precision |
| PersonnelScreen (hire + fire) | #120/#266 | ✓ | ✓ via Operations | ✓ multi-role options + Fire button | N/A | No | Partial | ✓ smoke | Barrel import fixed (#244). **Firing wired** (`PersonnelScreenContainer` → `staffOrg.fire`) |
| DepartmentScreen (generic queue) | #76 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | Renders any dept lane incl. the synthetic Service lane |
| BottomNav / dept dock | #76 | ✓ | ✓ | ✓ badges | N/A | No | ✓ | ✓ smoke | Mounted transitively via OperationsTab |
| MonthCloseInterstitial | #123 | ✓ | ✓ | ✓ hosts KPI snapshot | N/A | No | ✓ | ✓ smoke | |
| NarrativeBeat / ChapterCard | spec, #127 | ✓ | ✓ tier-up | ✓ | N/A | No | ✓ | ✓ smoke | |
| HistoryScreen | #208 | ✓ | ✓ in-game menu | ✓ | reads historyLog | No | ✓ | ✓ reachability | |
| SettingsScreen (rollback) | spec persistence | ✓ | ✓ MainMenu + in-game | ✓ | reads snapshots | No | Partial | ✓ smoke | No a11y options screen `[UI][#268]` |
| LegacyWallView (completed careers) | spec | ✓ + LegacyStore | ✓ MainMenu route | ✓ | LegacyStore ✓ | No | Partial | ✓ reachability | |
| TradeEscalationModal | #170/#201 | ✓ | ✓ overlay (`AppOverlays`) | ✓ | transient | No | ✓ | via composition | |
| DiscountEscalationModal | #281 | ✓ | ✓ overlay | ✓ | transient | No | ✓ | ✓ smoke | Reworked onto list-price axis (#281) |
| Navigator (routing) | per-module | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | |
| CustomerCard | — | ✓ | **Dev-only** | Dev-only (via AdminConsole) | N/A | No | N/A | ✓ smoke | |
| AdminConsole | — | ✓ | **Dev-only** | Dev-only | uses saveStore | No | N/A | None | Dev tooling |

## Cross-cutting / "obvious" systems

| System | Defined | Status | Notes |
|---|---|---|---|
| Core loop | #99/#107 | ✓ | DayLoopController/FloorSim real-time day, MANAGERIAL↔FLOOR_OPEN |
| Menus & navigation IA | #215, second-level-ia | ✓ | 5-tab AppShell; per-tab second-level charters locked. Never tier-gated |
| Save/load | spec, #186 | ✓ multi-slot | **Snapshot v8**; persists 22 modules incl. tierGate, demandShaper, competitorMarket, historyLog, and the 3 career-ending monitors (v6/v7/v8 migrations). CustomerPool & per-day funnels excluded by design |
| HUD/status display | #116/#117 | ✓ | FloorDashboard (+morale, +regulatory gauge) |
| NPC systems & skills | ADR-0001 | ✓ | Multi-role hiring + firing surfaced; Model-B skill growth live. **NPC base feeds sales only — not service** |
| Dialogue/event/history log | #117/#127/#208 | ✓ | Persistent HistoryLog + chapter cards + recap |
| **Tier / progression systems** | spec, macro-loop-spine, **tier CSV** | Partial | TierManager **now promotes on TierGate streaks** (#250, dual-logic gap closed); thresholds externalized + balance harness exists (#247/#248). **T1→T3 modeled; T4–T7 spine designed not built**; **T2 service is a stub, T3 body shop unbuilt** (see Reality Check). See deep-dive |
| **Department decomposition** (office/BDC/lot/sales/service/bodyshop) | DeptKey + second-level-ia | **Partial / DESIGN FORK** | 5 keys exist (`sales/service/bdc/office/lot`); **bodyshop is not among them**. office/lot/bdc have **no staff roles**; their dept *meaning* is parked to a dept-mechanics design pass `[ENGINE][UNFILED — fork]` |
| Failure/recovery | spec | Partial | Terminal→EndCard ✓ (all 3 monitors wired); T2/T3 recovery under-surfaced `[UI]` |
| Settings/accessibility | spec | Partial | Rollback reachable; no dedicated a11y screen `[UI][#268]` |
| Tutorial/onboarding | #213 | **Missing** | No tutorial/coachmarks/first-run/help `[ENGINE+UI][#213]` |
| Feedback/notifications | #117 | ✓ | Badges, floor events, exception alerts, recap, month-close, match-payoff, tier verdict |
| Ship-blocker: fictional brands | fictional-brands mem | **Open** | Real trademarks still in `data/vehicles.json` + `data/brand-tiers.json` `[ENGINE/data][#246]` — hard release gate |

---

## Profit-Center Reality Check (THE HEADLINE — does a real, player-felt loop run through each CSV profit center?)

> One binary question per profit center: **does the player today buy/serve, see real demand, and feel the
> payoff through this center?** `Yes` = a real loop runs. `Stub` = code may exist but the player can't feel it
> (synthetic/silent/absent demand). `Absent` = no code. **`Stub` and `Absent` are both red** — a stub is *not*
> closer to done than absence in any way the player can feel. This table overrides any optimistic ✓ elsewhere.

| Profit center | Tier (CSV) | Real player-felt loop? | Why |
|---|---|---|---|
| **Sales (used)** | T1 | ✅ **Yes** | The whole live loop: NPC customers spawn from CustomerPool against player inventory+price, FloorSim arrivals, match payoff on DayRecap, gross to Economy. This is the game today. |
| **Service** | T2 | 🔴 **Stub** | Engine coded + wired + tested, **but intake is synthetic (`seed × day`), not NPC-bound.** Player sees a queue fed by fake demand they can't influence or grow. **As a profit center it does not exist for the player.** Customer-wiring is `[ENGINE][UNFILED]`. |
| **Body Shop** | T3 | 🔴 **Absent** | **Zero code.** No `src/game/BodyShop/`, no `body-shop-advisor` role in `data/staff-roles.json`. CSV-canon T3 collision mirror of service. Design-record `[ENGINE][#269]`. |
| **F&I** | T3 | ✅ **Yes** (staffing-gated) | Auto-resolved **by design**; `computeAutoFni` attaches only role-unlocked products; `f&i-manager` (`hireTier 3`) reachable in PersonnelScreen; gross feeds the match payoff. The loop is "hire → upside appears," which is the intended lever — not a missing screen. |
| **New-car / OEM** | T4 | 🔴 **Absent** (correct) | OEM engine parked `[#223]`; no `new-car-manager`/NCM role. T4 = higher tier; absence is intended, listed so the upper runway isn't read as built. |
| **BDC / marketing** | T5 | 🔴 **Absent** (late-game) | Morning callback exists (FollowUpPool), but the T5 appointments/booking center + `bdc-manager` role is unbuilt `[ENGINE][UNFILED]`. Higher tier. |

**Read this table first.** Of the two profit centers inside the T1→T3 frontier that should run, **Sales and F&I are real; Service is a stub and Body Shop is absent.** That means **half of the profit centers the player should feel are not actually playable** — the prior audit's `✓✓✓` on Service hid exactly this.

---

## Tier-Progression Deep-Dive (measured against the locked CSV — second headline)

**Spine source:** `docs/planning/Gameplay Loops and Dealership progression tiers.csv` (tiers/facilities/
profit-centers/staff) + `docs/planning/manager-roles-channel-desk.md` (manager model: **UCM + NCM + GM;
Sales Manager is DEAD**). Current frontier is the **T1→T3** ladder.

### Profit-center / facility unlock — CSV canon vs code

| Tier | CSV profit centers added | Built? | Notes |
|---|---|---|---|
| **T1** Micro Used Lot | Sales only (service = recon/inspection, **no profit arm**) | ✓ | Sales process, seed lot, recon/inspection. ServiceQueue gated OFF at T1 — correct |
| **T2** Small Independent | **Service becomes a profit center** | 🔴 **Stub** | ServiceQueue/ServiceDispatch tier-2-gated + `service-advisor` role, **but intake is customer-blind** (seed×day, not NPC-bound). The profit center does not run for the player `[ENGINE][UNFILED]` |
| **T3** CPO / Large Indep. | **Body Shop** + **F&I dept** + **UCM** | **Partial** | **F&I** ✓ (`f&i-manager` T3) · **UCM** ✓ + **owns the desk** (channel-desk #288–#294 — the big T3 build) · **BODY SHOP 🔴 absent** (engine + `body-shop-advisor` role) `[ENGINE][#269]` |
| **T4** Single Franchise | **New-car / OEM dept** | ✗ (correct) | OEM engine parked `[#223]`; no `new-car-manager`/NCM role. T4 = higher tier |
| **T5** High-Volume Franchise | **BDC / marketing** | ✗ | FollowUpPool morning callback exists; late-game BDC (appointments, `bdc-manager`) + Bodyshop&Service Mgr unbuilt `[ENGINE][UNFILED]` |
| **T6** Multi-Franchise | **GM unlock → automation → buy franchise rights** | ✗ | `gm` role exists in data; GM-automation + multi-store unbuilt (T4+ macro spine) |
| **T7** Dealer Group | Sandbox scaling | ✗ | Not built (higher tier) |

### `data/staff-roles.json` reconciled against CSV staff columns

**Reconciliation of the memory's open item (`hireTiers may disagree with CSV`): NOW ALIGNED** in the
working tree — this session's edit set `f&i-manager` and `used-car-manager` to `hireTier 3` (= CSV T3),
`service-advisor` 2 (= CSV T2), `service-manager` 5 (= CSV T5), `gm` 6 (= CSV T6). (Uncommitted —
header notes the dirty tree.)

| Role in data | hireTier | CSV tier | Verdict |
|---|---|---|---|
| `lot-porter` | (worker) | feeder | OK (promotion feeder, not a CSV slot) |
| `salesperson` | T1 | T1 | ✓ |
| `technician` | (worker) | feeder | OK (feeds service-advisor) |
| `service-advisor` | 2 | T2 | ✓ role exists — **but the center it staffs is a stub** (synthetic intake) |
| `f&i-manager` | 3 | T3 | ✓ (fixed this session) |
| `used-car-manager` (UCM) | 3 | T3 | ✓ (fixed this session); owns the desk |
| `service-manager` | 5 | T5 | **Divergence** — CSV canon is a combined **"Bodyshop & Service Manager"**; current role is service-only (and user is "not sold on it") `[design fork][UNFILED]` |
| `gm` | 6 | T6 | ✓ |
| **`body-shop-advisor`** | — | **T3** | **MISSING** — canon T3 role absent `[ENGINE][#269]` |
| **`new-car-manager` (NCM)** | — | **T4** | **MISSING** — correct (T4-gated, parked `[#223]`) |
| **`bdc-manager`** | — | **T5** | **MISSING** — late-game BDC unbuilt `[ENGINE][UNFILED]` |

**Manager model in data is CORRECT:** no `sales-manager` anywhere in source/data (only planning docs +
an ADR). The SM-drop is reflected in `data/staff-roles.json`; UCM carries `condition_reading`/`pricing`/
`t_o_closing` and owns all four channel-desk gates.

### Advancement engine — now unified

The prior audit's headline tier gap (**dual advancement logic**) is **CLOSED**. `TierManager` advances
**only** by consuming `tierGate:month_verdict` streaks (strict-consecutive meet-or-better; `streaksByTier`
injected from `data/tier-gate.json`); the standalone `triggerThreshold` AND-gate is **retired**. At the
top modeled tier (T3) it arms `dossierReady` rather than auto-advancing — the Act-2 brand-application
hook (#223, parked). Balance harness (#247) + Tier-N fixtures (#248) now exist to tune the runway.

### Where the tier spine is still dark (bluntly)

- **T2 Service is a stub, not a profit center** — the engine resolves tickets, but demand is synthetic
  (`seed × day`), so the player never feels a service loop. A whole profit center is effectively absent. `[ENGINE][UNFILED]`.
- **T3 body shop has zero code** — engine and `body-shop-advisor` role both absent. It kept vanishing
  because it lived only in the CSV; now anchored by design-record `[#269]`. `[ENGINE]`.
- **T4–T7 designed, not built** — OEM/NCM (#223), BDC appointments, GM-automation, multi-store. Correct for
  the T1–T3 frontier but flagged so the upper runway isn't mistaken for built.
- **Calibration is deferred** — every channel-desk gate threshold, drift magnitude, skill-growth rate, and
  pricing/demand placeholder is a placeholder pending the **#286** tuning campaign.

---

## Key Observations

- **The single most important correction this run: Service is a customer-blind stub, not a built profit
  center.** The prior audit graded it `✓ Code · ✓ Reachable · ✓ UI surfaced · ✓ Tests` with the synthetic-intake
  fact buried as a `[UNFILED]` footnote — four checkmarks drowning the one fact that matters. Under the
  corrected rubric (synthetic intake caps player-facing columns at Partial), Service reads as what it is: a
  **Stub** sitting in the same red bucket as the absent body shop. **Half the profit centers (Service, Body
  Shop) do not run for the player.** See the Profit-Center Reality Check.
- **The Dope-Wars "adverse-events" pillar is the single largest *loop* gap (#176–#179)** — the
  news/ticker/shock engine. With pricing/demand, the match payoff, and progression all landed, this is the
  last unbuilt loop pillar. `[ENGINE]`.
- **The strategic half of the UI is honest placeholder.** People / Finance / Growth render `StrategicTab`
  "coming in a later slice." Home + Operations are live; Inventory/Pricing/Auction/Personnel are Operations
  sub-surfaces. All three placeholder rooms are `[UI]`.
- **Firing is now surfaced** (PersonnelScreen Fire button → `staffOrg.fire`, reachable via Operations) —
  **#266 appears already satisfied** in code despite being open; verify before closing.
- **The mechanical spine that IS real (Sales + F&I + pricing/demand + manager desk + progression) is largely
  built and unified.** The holes are: the news/shock pillar, and the two non-running profit centers (Service
  stub, Body Shop absent).
- **Onboarding remains entirely absent (#213).**
- **Ship-blocker still open (#246):** real vehicle trademarks remain in `data/`. Hard release gate.

---

## Where Actual Structure Diverges From Intended Design

1. **Service runs without customers (the headline divergence).** The engine resolves tickets, but intake is
   synthetic (`seed × day`), not wired to the NPC/customer base. Diverges directly from "real customers across
   departments" and from the CSV's "Service becomes a profit center" at T2. The player cannot influence or feel
   service demand. `[ENGINE]`.
2. **T3 body shop missing (#269).** The CSV makes body shop a T3 profit center mirroring the service engine,
   with a `body-shop-advisor` role. Neither exists in code or `data/staff-roles.json`. `[ENGINE]`.
3. **`service-manager` ≠ CSV "Bodyshop & Service Manager."** The data role is service-only; the CSV's T5
   fixed-ops manager spans body shop + service (and the user is undecided it should exist at all). Unfiled
   design fork. `[design]`.
4. **Strategic tabs are scaffolding.** People/Finance/Growth are always-present placeholders (nav is never
   tier-gated by design), so three of four requested dashboards render nothing yet. `[UI]`.
5. **The adverse-events pillar (#176–#179) is unbuilt** — the world has weather to *read* but no market/news
   shocks to react to. `[ENGINE]`.
6. **Department set half-specified** — 5 dept keys, bodyshop excluded, office/lot/bdc role-less; meaning
   parked to a dept-mechanics pass. `[ENGINE/design]`.
7. **Doc drift (#209).** `spec-condensed.md` lists multi-slot save as excluded; the code ships it.

---

## Session Handoff Summary

**Current state:** `main` @ `e2729e6`, **working tree dirty** (in-session tier-canon edits to
`data/staff-roles.json`, the tier CSV, and docs/tests). The managerial day-loop is complete and well-covered.
Since the last audit the **pricing-demand spine**, **channel-desk manager model**, **tier-advancement rewire**,
**balance harness + fixtures**, **career-ending monitors**, **App.tsx decomposition**, and **seed inventory**
all landed. The active line is **Phase-2 staff-teeth** (#249 calibration data landed; the staff-teeth grill is
the next design session).

**This regeneration's correction:** the rubric now caps synthetic-intake systems at **Partial** on player-facing
columns and adds the **Profit-Center Reality Check**. The result the prior audit obscured: **Service is a stub,
Body Shop is absent — half the profit centers do not run for the player.**

**Most important gaps now (highest leverage first):**
1. **Service ↔ customer-base wiring** `[ENGINE][UNFILED]` — turn the coded engine into a *played* T2 profit
   center by binding intake to the NPC base. The prior audit demoted this to "Medium / Partial"; it is top-tier.
2. **T3 body shop engine + `body-shop-advisor` role (#269)** `[ENGINE]` — the absent CSV-canon T3 profit center.
3. **News / adverse-events engine (#176–#179)** `[ENGINE]` — the last unbuilt Dope-Wars loop pillar.
4. **Staff-teeth mechanic** `[ENGINE]` — salary drain / talent-scaled hire cost / scarcity / poaching; #249
   data anchor landed, grill + build pending. Unlocks the People dashboard.
5. **Strategic dashboards — People, Finance/analytics, Growth home** `[UI]` — three placeholder rooms.
6. **Calibration pass (#286)** — tune every deferred channel-desk / pricing / skill-growth placeholder.
7. **Ship-blocker: fictional brands (#246)** `[data]` — release gate.

**What the next session should do:** continue the Phase-2 staff-teeth line, but note that the **Reality Check now
ranks Service-stub and Body-Shop-absent as the two load-bearing profit-center holes** in the T1→T3 frontier. **#266
(fire surfacing) looks already done** — verify and close. Reconcile doc drift (#209).
</content>
</invoke>

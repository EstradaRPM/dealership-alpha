# Game Coverage Matrix — Current-State Audit

> **Scope:** State map only. No fixes proposed, no scope broadened beyond what the
> repo's docs/issues already agree on. Generated 2026-07-13 against `main` @ `a711a7a`
> **(working tree dirty** — modified `.claude/settings.json` + untracked
> `docs/planning/engagement-spine.md`; neither affects code under audit).
>
> **Sources of truth used:** `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002,
> the composition root (`src/createWorld.ts` + `src/serviceDepartment.ts` +
> `src/bodyShopDepartment.ts`), the live UI tree (`App.tsx` → `src/app/` →
> `src/ui/AppShell/`), the save/load seam (`src/worldSnapshot.ts`, envelope **v16**),
> the `tests/` inventory (173 files), and the open GitHub issue queue.

> **What changed since the 2026-06-17 run (`e2729e6`):** the entire #297 PRD chain landed —
> **Service was rebuilt as a real installed-base profit center (#298–#310)** and the
> **Body Shop was built as the T3 collision mirror (#311–#318)**, both with pages, controls,
> manager automation, persistence, and tests. The **engagement-spine Reveal tracer (#319–#322)**
> is live in the day-close flow. The prior run's two headline holes (Service synthetic stub,
> Body Shop absent) are **closed at the engine level** — but **both centers are still not
> playable, for a new reason**: see the rubric note below and the Profit-Center Reality Check.

> **Rubric note this run (load-bearing):** the hollow-stub rule caps player-facing columns
> when a system's demand is synthetic *and uninfluenceable*. Service demand is now **NPC-bound**
> (InstalledBase owners accrued from real closed sales are the primary stream; the conquest
> walk-in floor is procedural but scaled by reputation + marketing — the designed levers).
> Body Shop demand is a **designed stochastic collision stream** (locked in the #297 PRD):
> procedural draws, but player-influenceable via reputation, insurance/retail channel posture,
> and weather-reading. Neither is a customer-blind stub anymore. **The cap that DOES apply this
> run: both departments' throughput is `min(bays, advisors on duty)`, and the advisor roles are
> unhireable in the UI** (`buildHiringRoleOptions`, `src/app/config.ts:147-158`, offers only
> salesperson + `manager`/`gm`-tier roles; `service-advisor`/`body-shop-advisor` are
> `customer-facing`-tier). No promotion path is wired into gameplay either (`NPC.promoteStaff`
> exists; nothing invokes it). **In live play both centers have zero capacity — the player can
> see them, read them, configure them, and never staff them.** `Reachable in play` is therefore
> capped at **Partial** for both, and their verdicts lead with the staffing hole.

> **Design intent (anchored 2026-06-05, unchanged):** the felt loop is **Dope Wars × Lemonade
> Stand** — buy low / sell high, ride out random adverse events, and *match an inventory
> "recipe" to the incoming buyer demand "weather,"* then watch customers stop or walk.
> F&I/loan is **auto-resolved by design** (managerial-watch loop); the player is *not* meant
> to perform F&I steps. **New anchor since the last run:** the **engagement spine**
> (`docs/planning/engagement-spine.md`, locked 2026-07-12) — ONE self-similar "Reveal"
> (starred reactions + plain-language scoreline) at the close of every bite of time, whose
> grain and clock zoom with the business T1→T7.

**Legend:** ✓ = present/complete · **Partial** = partially wired/surfaced · **Dark** = exists in code but unreachable in play · **Dev-only** = reachable only under `__DEV__` · **No / Missing** = absent · **N/A** = not applicable (infra)

**Player-facing-column rule:** ✓ on `Reachable` / `Surfaced` / `Feedback` asserts a real player-felt loop. A system the player cannot actually operate in live play (uninfluenceable demand, unstaffable capacity) is capped at **Partial** there even when fully coded.

**Tags in Notes:** `[ENGINE]` mechanic/design gap · `[UI]` surfacing gap on a built mechanic · `[#N]` filed issue · `[UNFILED]` no issue exists.

Columns: 1 System · 2 Defined in docs · 3 In code · 4 Reachable in play · 5 Surfaced in UI · 6 Save/load · 7 Onboarding · 8 Feedback/error states · 9 Tests · 10 Status notes

## Game-logic systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GameClock (day/overnight) | spec, CLAUDE.md | ✓ | ✓ | ✓ day counter/HUD | ✓ snapshot | No | ✓ recap | ✓ | Overnight resolution via DayLoopController |
| Weather (condition/season/leans) | #231 | ✓ | ✓ | ✓ Home weather card + forecast | Pure projection of (seed, day) — no state by design | No | ✓ outlook lines | ✓ | Drives attribute leans + traffic volume + CollisionStream spikes |
| CustomerPool + state machine | spec, ADR-0001 | ✓ | ✓ (FloorSim spawns) | Partial — via floor/hand-play | **No** (by design) | No | ✓ | ✓ many | Real NPC base. Now ALSO feeds Service via InstalledBase (closed sales accrue owners) |
| DepartmentQueue | spec | ✓ | ✓ dept dock | ✓ badges + DepartmentScreen | ✓ snapshot | No | ✓ badges | ✓ | |
| StaffOrg (hire/fire/skills) | spec | ✓ | **Partial** | **Partial** — hire/fire via PersonnelScreen, **but only salesperson + manager/gm roles are offered** | ✓ snapshot | No | ✓ candidate cards | ✓ | **HEADLINE HOLE: `buildHiringRoleOptions` filters out `customer-facing`/`worker` roles** (`config.ts:151-157`) — `service-advisor` (hireTier 2), `body-shop-advisor` (hireTier 3), `technician`, `lot-porter` are unhireable despite engine support (`getCandidates` tier-gated + tested). **Promotion DAG in data is never invoked by gameplay** (`NPC.promoteStaff` has no caller) `[UI+ENGINE][#297 story 38 / UNFILED as its own issue]`. Model-B skill growth live (#294) |
| Inventory (recon/auction/aging/carry/seed lot/frontline hold) | spec | ✓ | ✓ AuctionMenu | ✓ lot stats, Auction, Pricing | ✓ snapshot | No | ✓ inspection/aging warns | ✓ many | Seed lot (#295/#296), UCM auto-sourcing (#293) |
| DealEngine (pricing/F&I/loan/gross/trade) | spec | ✓ | ✓ (auto-close + hand-play) | ✓ gross + match feed the Reveal | Stateless | No | ✓ | ✓ many | F&I auto-resolved **by design**; f&i-manager hireable at T3 |
| Economy (cash/payroll/rent/P&L) | spec | ✓ | ✓ | ✓ cash HUD + MonthClose | ✓ snapshot | No | ✓ | ✓ | |
| Reputation + RegulatoryMeter | spec | ✓ | ✓ | ✓ REG PRESSURE chip + Home stat | ✓ snapshot | No | ✓ | ✓ | |
| CompetitorMarket (drift/poach) | spec, ADR-0002 | ✓ | ✓ wired | Partial — comps in PricingScreen only | ✓ snapshot | No | No player-facing event | ✓ many | Poaching dormant at starting rep `[ENGINE][#187]`; drift/poach silent `[UI][#267]` |
| CareerProgression / TierManager | spec, macro-loop-spine | ✓ | ✓ | ✓ tier HUD, ChapterCard, EndCard, GateStrip | ✓ snapshot | No | ✓ | ✓ | Advances solely on `tierGate:month_verdict` streaks (#250); arms `dossierReady` at T3 (Act-2 hook) |
| TierGate (monthly gate engine) | goals-targets | ✓ | ✓ | ✓ GateStrip on Home | ✓ snapshot | No | ✓ 4-band verdict | ✓ | Load-bearing promotion engine |
| Career-ending monitors (×3) | spec §failure | ✓ | ✓ wired | ✓ → EndCard | ✓ snapshot | No | ✓ EndCard | ✓ | IndictmentMonitor's only live producer = `regulatory:lemon_law_incident`; `audit_failure`/`deal:fraud_flag` producers unwired `[ENGINE][UNFILED]` |
| Failure/recovery paths (tier-aware) | spec §failure | ✓ monitors | ✓ terminal → EndCard | Partial — T2 contraction / T3 consent-decree recovery not visually distinguished from game-over | via monitors | No | ✓ EndCard | Partial | `[UI][UNFILED]` |
| SaveStore (SQLite, 3 slots, snapshots, mid-day checkpoint) | spec, #186 | ✓ | ✓ MainMenu + autosave + InGameMenu | ✓ slot picker + rollback | ✓ | No | Partial | ✓ many | Snapshot envelope **v16** (30 keys incl. installedBase, partsInventory, serviceQueue/marketing/insights, bodyShopQueue/insights, both posture scalars, prepBet) |
| EventBus | spec | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | Parallel `service:*`/`bodyshop:*` families on the shared dispatch engine |
| CapacityManager (sales demand vs capacity) | spec | ✓ | ✓ | ✓ funnel/recap leakCause | Per-day | No | ✓ leak cause | ✓ | |
| FollowUpPool / BDC callback | per-module | ✓ | ✓ | ✓ BDC dept queue, morning callback | ✓ snapshot | No | ✓ | ✓ | Morning callback only. **T5 BDC (appointments/booking/campaigns, `bdc-manager` role) not yet built** `[ENGINE][UNFILED]` — no dedicated BDC screen either |
| NPC (traits/skills/factories) | ADR-0001 | ✓ | ✓ | ✓ via customers/staff | Seed-derived | No | N/A | ✓ many | Promotion machinery built, never invoked in play (see StaffOrg row) |
| **DepartmentLine (shared dept backbone)** | #311 design record | ✓ | ✓ (via both packages) | N/A (infra seam) | N/A | N/A | N/A | ✓ | Service + Body Shop plug recipe packages into one enriched-intake + pricing-read seam |
| **InstalledBase (owner annuity)** | #297 PRD | ✓ | ✓ (accrues from real closed sales) | ✓ base-health readout on ServicePage | ✓ snapshot | No | ✓ | ✓ | Loyalty/CSI feedback, defection, return cadence, repeat-buyer leads back to Sales (#306) |
| **PartsInventory (par/supplier/lead-time/rush)** | #297 PRD | ✓ | ✓ (controls live) | ✓ stock-coverage readouts, par controls | ✓ snapshot | No | ✓ miss/rush | ✓ | Shared instance: 4 service + 4 collision categories |
| **ServiceDemand (mix composer)** | #297 PRD | ✓ | ✓ | ✓ demand-heat readout | Regenerates from seed+day+base (by design) | No | ✓ | ✓ | **NPC-bound primary stream** (InstalledBase owners) + rep/marketing-scaled conquest floor |
| **Service engine (Queue+Dispatch+Marketing+Manager)** | #297 PRD | ✓ | **Partial** | ✓ ServicePage (heat/coverage/base-health) + controls (par/supplier/posture/marketing) + floor card | ✓ snapshot | No | **Partial** | ✓ | **REAL ENGINE, UNSTAFFABLE IN PLAY: throughput = `min(bays, advisors)` and the player cannot hire a `service-advisor`** (see StaffOrg row). Demand, pages, controls, persistence, automation ladder (#310) all real — capacity is zero in live play `[UI][#297 story-38 residue]`. See Reality Check |
| **CollisionStream (Body Shop demand spine)** | #297 PRD, #313 | ✓ | ✓ | ✓ demand-heat + conquest-health on BodyShopPage | Regenerates from seed+day (by design) | No | ✓ | ✓ | Designed stochastic conquest: weather-spiked retail stream (rep-driven) + steady insurance-DRP stream; channel posture [insurance↔retail] is the identity lever |
| **Body Shop engine (Queue+shared dispatch+Manager)** | #297 PRD, #311–#318 | ✓ | **Partial** | ✓ BodyShopPage + channel/rush/par controls + floor card (T3-gated entry) | ✓ snapshot | No | **Partial** | ✓ | **Same unstaffable hole: `body-shop-advisor` unhireable** → zero capacity in live play `[UI][#297 story-38 residue]`. Engine/pricing/automation (#316) otherwise complete. See Reality Check |
| StaffDispatch (sales floor drain) | per-module | ✓ | ✓ | ✓ auto-resolve + escalations | Stateless per-day | No | ✓ exceptions | ✓ | Channel-desk gates resolve through it |
| StaffMorale | per-module | ✓ | ✓ | ✓ MORALE chip | ✓ snapshot | No | Partial | ✓ | |
| MarketEconomy (anchor/drift/elasticity/trades/intel) | pricing-demand spine | ✓ | ✓ | ✓ PricingScreen/valuations/heat | ✓ snapshot | No | ✓ | ✓ many | Full #273–#287 spine; magnitudes placeholder → #286 |
| Manager channel-desk (UCM gates ×4) | manager-roles doc | ✓ | ✓ | Partial — gates act invisibly, no manager-status surface | via StaffOrg | No | ✓ via exceptions | ✓ | `[UI][UNFILED]` status surface; thresholds placeholder → #286 |
| **Engagement-spine Reveal (starred reactions + scoreline + prep bet)** | engagement-spine.md, #319–#322 | ✓ | ✓ | ✓ DayRecapModal on every day close; bet captured at day open | ✓ prepBet in snapshot | No | ✓ | ✓ (buildReveal + reachability + PrepBet) | **The tracer is LIVE.** Remaining spine work: ranking tuning, records catalog, drive-the-clock (week/month bites), F&I plug-in #2, higher-tier grains `[ENGINE+UI][UNFILED]` |
| — News engine / ticker / shocks | market-economy lock, #176–#179 | **Missing** | No | No | No | No | No | No | **The Dope-Wars adverse-events pillar — still the largest unbuilt loop pillar** `[ENGINE][#176–#179]`. The spine doc names it the Reveal's loudest reaction source |
| DemandShaper + DemandControls (advertising) | #197, #278 | ✓ | ✓ | ✓ DemandReadout heat console + targeting levers + ad campaign selector | ✓ snapshot | No | ✓ | ✓ | Player-influenceable; sales demand only (Service has its own levers now — by design) |
| OEM / NCM (allocation/floorplan/incentives/courtship) | oem-relationship-engine, macro-spine §6–7 | **No code** | No | No | No | No | No | No | **T4 engine not yet built** `[ENGINE][#223 design record]`. No `new-car-manager` role in data. Next profit-center build in the ladder |
| T5 BDC / T6 GM–multi-store / T7 group endgame | tier CSV, macro-spine §4/§8 | **No code** | No | No | No | No | No | No | Not yet built. `bdc-manager` role absent; GM role exists in data (hireTier 6) with no automation engine behind it; batch-sim `[#124]` |
| Telemetry | per-module | ✓ | Dev-only | Dev-only (AdminConsole) | ✓ snapshot | No | N/A | ✓ | |
| HistoryLog | #208 | ✓ | ✓ | ✓ HistoryScreen | ✓ snapshot | No | ✓ | ✓ | |
| KPIDashboard | spec, #179 | ✓ | ✓ on-demand | ✓ menu + MonthClose | ✓ snapshot | No | Partial | ✓ | Market-state slice open `[UI][#179]` |
| DayLoopController / FloorSim | #99/#107 | ✓ | ✓ core loop | ✓ FloorDashboard + speed/pause | Mid-day checkpoint | No | ✓ | ✓ many | Service + Body Shop drains ride the same day loop |
| SalesProcess (gates/match) | sales-process slice | ✓ | ✓ | ✓ hand-play + match payoff | Stateless | No | ✓ | ✓ many | |
| EndCard / LegacyWall | spec | ✓ | ✓ | ✓ | LegacyStore ✓ | No | ✓ | ✓ | |
| Balance harness + tier fixtures | #247/#248 | ✓ | Dev/tooling | N/A | N/A | N/A | N/A | ✓ | Pacing report no longer hides modeled bankruptcies (b91d5a6). Competent bot still bankrupts pre-T2 — expected pre-staff-teeth/#286 (see memory `balance-harness-stall-expected`) |

## Player-facing UI systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| App composition (`src/app/`) | #242 | ✓ | ✓ | ✓ AppRoot → RouteContent + AppOverlays | N/A | No | ✓ | Partial | |
| MainMenu (New/Continue/Load/Delete/Settings/LegacyWall) | #186 | ✓ | ✓ boot | ✓ 3 slots, per-slot metadata | ✓ | No | Partial | ✓ | Dev tier-start row `__DEV__`-gated |
| CharacterCreation | spec | ✓ | ✓ | ✓ | ✓ profile/seed | No | Partial | ✓ smoke | |
| AppShell (FIXED 5-tab IA) | #215 | ✓ | ✓ | ✓ Home/Operations/People/Finance/Growth | N/A | No | ✓ | ✓ NavGating | Tabs never tier-gated |
| Home tab (status + GateStrip + DemandReadout + recap chip) | home-hub | ✓ | ✓ | ✓ | N/A | No | ✓ | Partial | Live, fully backed |
| Operations tab (dept dock + levers + sub-surfaces) | second-level-ia | ✓ | ✓ | ✓ incl. ServicePage + BodyShopPage entries (BS entry T3-gated) | N/A | No | ✓ | No dedicated composition test `[UNFILED]` | |
| **People dashboard** | second-level-ia | Placeholder | ✓ (tab) | **Dark — placeholder** | N/A | No | No | placeholder only | `[UI][UNFILED]`; hire/fire lives in Operations→Personnel |
| **Finance dashboard** | analytics.png | Placeholder | ✓ (tab) | **Dark — placeholder** | N/A | No | No | placeholder only | `[UI][UNFILED]`; needs chart-primitives kit |
| **Growth dashboard** | second-level-ia | Placeholder | ✓ (tab) | **Dark — placeholder** | N/A | No | No | placeholder only | `[UI][UNFILED]`; GateStrip/DemandReadout live on Home instead |
| DayRecap → **Reveal** | #319–#322 | ✓ | ✓ | ✓ every day close, reopenable | prepBet ✓ | No | ✓ | ✓ | The one felt beat; scoreline resolves the morning bet |
| ServicePage + DeptControls | #308/#309 | ✓ | ✓ | ✓ heat/coverage/base-health + 4 control groups | ✓ | No | ✓ | ✓ smoke | Renders a center the player can't staff (see Reality Check) |
| BodyShopPage + DeptControls | #315/#318 | ✓ | ✓ (T3+) | ✓ heat/coverage/conquest-health + channel lever | ✓ | No | ✓ | ✓ smoke | Same staffing caveat |
| HandPlayModal / FloorDashboard / OwnershipLevers / DemandReadout / AuctionMenu / PricingScreen / DepartmentScreen / BottomNav / MonthClose / ChapterCard / HistoryScreen / SettingsScreen / LegacyWall / Trade+Discount modals / Navigator | (various) | ✓ | ✓ | ✓ | (various) | No | ✓ | ✓ smoke | All carried ✓ from prior run, unchanged |
| PersonnelScreen (hire + fire) | #120/#266 | ✓ | ✓ | **Partial — role list omits advisor/worker roles** | N/A | No | Partial | ✓ smoke | Fire surfaced (**#266 satisfied — verify & close**). The role-filter is the headline hole |
| CustomerCard / AdminConsole | — | ✓ | **Dev-only** | Dev-only | N/A | No | N/A | ✓/None | By intent |

## Cross-cutting / "obvious" systems

| System | Defined | Status | Notes |
|---|---|---|---|
| Core loop | #99/#107 | ✓ | Real-time day, MANAGERIAL↔FLOOR_OPEN, Reveal on close |
| Menus & navigation IA | #215 | ✓ | 5 fixed tabs; 3 of 5 are placeholder rooms |
| Save/load | #186 | ✓ | Envelope v16, 3 slots, mid-day checkpoint, migration recipe doc |
| HUD/status | #116/#117 | ✓ | + service & body-shop floor cards |
| NPC systems & skills | ADR-0001 | Partial | Hiring surfaced only for salesperson+managers; promotion never invoked in play |
| Tier / progression | macro-spine, CSV | Partial | T1→T3 modeled & promoted via gate streaks; **T2/T3 profit centers unstaffable in play**; T4–T7 engines not yet built |
| Failure/recovery | spec | Partial | Terminal ✓; T2/T3 recovery under-surfaced `[UI]` |
| Settings/accessibility | spec | Partial | Rollback ✓; no a11y screen `[UI][#268]` |
| Tutorial/onboarding | #213 | **Missing** | Nothing anywhere — no tutorial, coachmarks, help |
| Feedback/notifications | #117 | ✓ | Reveal + badges + exceptions + recap + month-close + verdicts |
| Audio / haptics / game-feel | — | **Missing** | No sound, music, or haptic layer exists anywhere `[UNFILED]` (noted; whether it's agreed design is a user call — flagged in the path-to-finished doc) |
| Ship-blocker: fictional brands | #246 | **Open** | Real trademarks still in `data/vehicles.json` + `data/brand-tiers.json` — hard release gate |

---

## Profit-Center Reality Check (THE HEADLINE — does a real, player-felt loop run through each CSV profit center?)

> One binary question per profit center: **does the player today buy/serve, see real demand, and feel the
> payoff through this center?** `Yes` = a real loop runs. `Stub` = code exists but the player can't feel it.
> `Absent` = no code. **`Stub` and `Absent` are both red.**

| Profit center | Tier (CSV) | Real player-felt loop? | Why |
|---|---|---|---|
| **Sales (used)** | T1 | ✅ **Yes** | The live game: NPC customers vs inventory+price, match payoff, Reveal, gross to Economy |
| **Service** | T2 | 🔴 **Stub — one seam from real** | Engine, NPC-bound demand (InstalledBase), page, controls, persistence, manager automation ALL real. **But `service-advisor` is unhireable in the UI → `min(bays, advisors)` = 0 → zero throughput in live play.** The player watches demand arrive and can never serve it |
| **Body Shop** | T3 | 🔴 **Stub — same seam** | Full T3 collision mirror built (#311–#318) incl. insurance/retail channel identity. **`body-shop-advisor` unhireable → zero capacity in live play** |
| **F&I** | T3 | ✅ **Yes** (staffing-gated) | Auto-resolved by design; `f&i-manager` hireable at T3; gross feeds the Reveal |
| **New-car / OEM** | T4 | 🔴 **Absent** | Not yet built — next profit-center engine in the build order `[#223]` |
| **BDC / marketing** | T5 | 🔴 **Absent** | Morning callback exists; the T5 appointments/campaigns center + `bdc-manager` not yet built |

**Read this first.** The June audit's two red centers were rebuilt at enormous effort — and both remain
red **for a one-screen UI reason**: the hiring surface never offers the advisor roles the CSV staffs them
with. Closing that single seam (plus verifying capacity/bays defaults) flips two profit centers from
Stub to Yes. It is the highest-leverage single change in the repo.

---

## Tier-Progression Deep-Dive (against the locked CSV)

### Profit-center / facility unlock — CSV canon vs code

| Tier | CSV adds | Built? | Notes |
|---|---|---|---|
| **T1** Micro Used Lot | Sales only (recon-only service) | ✓ | Live |
| **T2** Small Independent | Service profit center + service advisor | **Engine ✓ / play 🔴** | Real annuity engine; advisor unhireable (see Reality Check) |
| **T3** CPO / Large Indep. | Body Shop + F&I + UCM | **Engine ✓ / play Partial** | F&I ✓, UCM desk ✓ (#288–#294), Body Shop engine ✓ but advisor unhireable |
| **T4** Single Franchise | New-car / OEM dept + NCM | ✗ | Engine + role + courtship not yet built `[#223]` |
| **T5** High-Volume | BDC dept + `bdc-manager` + fixed-ops manager | ✗ (roles partial) | `service-manager` + `body-shop-manager` exist in data (hireTier 5, automation ladders #310/#316); `bdc-manager` absent; CSV's combined "Bodyshop & Service Manager" is now TWO roles in data — divergence to adjudicate |
| **T6** Multi-Franchise | GM → full automation → buy franchise rights | ✗ | `gm` role in data (hireTier 6); no GM-automation engine, no multi-store |
| **T7** Dealer Group | Sandbox scaling + prestige endgame | ✗ | Not yet built |

### `data/staff-roles.json` reconciled against CSV staff columns

| Role | hireTier | CSV tier | Verdict |
|---|---|---|---|
| `lot-porter`, `technician` | (worker) | feeders | In data; **unhireable in UI and promotion never fires** — feeders are decorative today |
| `salesperson` | 1 | T1 | ✓ hireable |
| `service-advisor` | 2 | T2 | Role + archetypes + engine gate ✓ — **not offered by the hiring UI** |
| `f&i-manager` | 3 | T3 | ✓ hireable |
| `used-car-manager` | 3 | T3 | ✓ hireable, owns the desk |
| `body-shop-advisor` | 3 | T3 | Role + archetypes + engine gate ✓ — **not offered by the hiring UI** |
| `service-manager` | 5 | T5 | ✓ hireable; automation ladder live (#310) |
| `body-shop-manager` | 5 | T5 | ✓ hireable; automation ladder live (#316). CSV canon is ONE combined fixed-ops manager — two-role split is an implemented divergence to adjudicate `[design][UNFILED]` |
| `new-car-manager` (NCM) | — | T4 | **MISSING** — lands with the OEM engine `[#223]` |
| `bdc-manager` | — | T5 | **MISSING** — lands with the BDC build `[UNFILED]` |
| `gm` | 6 | T6 | ✓ in data; engine behind it not yet built |

### Where the tier spine is still dark (bluntly)

- **T2/T3 profit centers are unstaffable in live play** — one hiring-UI seam (plus verifying bays defaults) gates both. `[UI]`
- **CSV staff *counts* are not modeled** — the CSV staffs T4 with 6 salespeople/2 advisors etc.; nothing enforces or surfaces slot counts per tier. Unverified whether hiring N advisors is even bounded. `[ENGINE][UNFILED]`
- **T4–T7 engines not yet built** — OEM/NCM + courtship (#223), BDC appointments, GM automation + multi-store (#124 batch-sim is a slice of it), T7 prestige/synergy endgame.
- **Every magnitude is a placeholder** pending the #286 calibration campaign; the harness's competent bot still goes bankrupt pre-T2 (expected pre-staff-teeth).

---

## Key Observations

- **The single most important finding this run: both rebuilt profit centers are one UI seam from real.**
  The #297 chain delivered exactly what the June audit demanded — NPC-bound service demand, a true
  collision mirror, pages, controls, persistence, automation — and the loop still cannot run because
  the hiring surface never offers `service-advisor`/`body-shop-advisor`. Tests hire through the engine
  directly, so nothing caught it. This is a small fix with two-profit-centers leverage.
- **The engagement spine landed its tracer and it's live.** The Reveal (starred reactions + scoreline +
  morning bet) renders on every day close. The spine's next steps (ranking tuning, records, F&I plug-in,
  drive-the-clock, higher-tier grains) are the game's active fun-delivery line.
- **The news/adverse-events pillar (#176–#179) is now unambiguously the largest unbuilt loop pillar** —
  and the spine doc gives it a home (the loudest reactions on the Reveal feed).
- **Three of five tabs are still placeholder rooms** (People / Finance / Growth).
- **Onboarding remains entirely absent (#213); there is no audio/haptic layer at all.**
- **Stale issues:** #269 (premise contradicts canon + the shipped build), #266 (fire is surfaced),
  #297 (delivered except the advisor-hiring residue). #209 doc drift still open.
- **Ship-blocker #246 (real brands in data/) still open.**

---

## Where Actual Structure Diverges From Intended Design

1. **Advisor roles unhireable + promotion unwired** — the CSV's tier staffing cannot be executed by the
   player; feeders (`lot-porter`, `technician`) are decorative. `[UI+ENGINE]`
2. **CSV staff counts unmodeled** — no per-tier slot structure. `[ENGINE][UNFILED]`
3. **Fixed-ops manager split** — CSV's one "Bodyshop & Service Manager" is two data roles with two
   automation ladders. Implemented divergence; adjudicate and update CSV or data. `[design]`
4. **Strategic tabs are scaffolding** — People/Finance/Growth placeholders. `[UI]`
5. **Adverse-events pillar unbuilt** (#176–#179). `[ENGINE]`
6. **Doc drift** (#209) — spec-condensed still says single-save. `[doc]`

---

## Session Handoff Summary

**Current state:** `main` @ `a711a7a`. Since the June audit the repo closed its two biggest engine
holes (Service annuity #298–#310, Body Shop mirror #311–#318) and landed the engagement-spine tracer
(#319–#322). The felt game today is: T1 sales loop + Reveal, with T2/T3 department depth visible but
unstaffable, three placeholder dashboards, no news engine, no onboarding, no audio, placeholder balance.

**Most important gaps now (highest leverage first):**
1. **Surface advisor hiring** (+ verify bays defaults) — flips Service AND Body Shop from Stub to real `[UI]`.
2. **News / adverse-events engine (#176–#179)** — the last loop pillar; feeds the Reveal.
3. **Staff-teeth** (salary drain / scaled cost / scarcity / poaching) — the risk/reward hole; unlocks People dashboard + #286.
4. **Engagement-spine continuation** — drive-the-clock, records, F&I plug-in #2.
5. **Calibration campaign (#286)** — every number is a placeholder; harness bot bankrupts pre-T2.
6. **Strategic dashboards** (People / Finance / Growth) `[UI]`.
7. **Onboarding (#213)**; **T4–T7 engines** (#223 OEM, BDC, GM/multi-store, T7); **ship gates** (#246 brands, #209).

**Stale issues to reconcile:** close #269 (superseded by the shipped Body Shop), #266 (fire surfaced),
and #297 once advisor hiring lands. The `fictional-brands` and `balance-harness` memories remain accurate.

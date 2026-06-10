# Game Coverage Matrix — Current-State Audit

> **Scope:** State map only. No fixes proposed, no scope broadened beyond what the
> repo's docs/issues already agree on. Generated 2026-06-09 against `main` @ `5c46b52`
> (clean tree).
>
> **Sources of truth used:** `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002,
> the composition root (`src/createWorld.ts`), the live UI tree (`App.tsx`), the
> save/load seam (`src/worldSnapshot.ts`), the `tests/` inventory, and the open
> GitHub issue queue.

> **Why this run (framing, not a finding):** this audit is the left-hand inventory column
> for an upcoming **UI-mapping pass**. The plan is to agree a *final-look* UI (drafted as
> images) and then map every existing mechanic onto a surface in that look. So the load-bearing
> question this time is not "what's dark" but **"what mechanics now exist and therefore need a
> home in the final UI."** Read the "Where Structure Diverges" and the gap summary's UI sections
> with that lens. The single most relevant finding for that purpose: surfacing has become *broad
> but architecturally incoherent* — surfaces were added by appending into `DayLoopShell`
> (see #215), so nearly every mechanic is reachable, but the shell is now a pile, not a layout.

> **Design intent (anchored 2026-06-05, unchanged):** the felt loop is **Dope Wars × Lemonade
> Stand** — buy low / sell high, ride out random adverse events, and *match an inventory
> "recipe" to the incoming buyer demand "weather,"* then watch customers stop or walk.
> F&I/loan is **auto-resolved by design** (managerial-watch loop); the player is *not* meant
> to perform F&I steps. Any older issue-history language to the contrary is superseded. See
> divergences and `docs/audits/game-gap-summary.md`.

**Legend:** ✓ = present/complete · **Partial** = partially wired/surfaced · **Dark** = exists in code but unreachable in play · **Dev-only** = reachable only under `__DEV__` · **No / Missing** = absent · **N/A** = not applicable (infra)

Columns: 1 System · 2 Defined in docs · 3 In code · 4 Reachable in play · 5 Surfaced in UI · 6 Save/load · 7 Onboarding · 8 Feedback/error states · 9 Tests · 10 Status notes

## Game-logic systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GameClock (day/overnight) | spec, CLAUDE.md | ✓ | ✓ | ✓ day counter/HUD | ✓ snapshot | No | ✓ recap | ✓ | Overnight resolution sequence wired via DayLoopController |
| CustomerPool + state machine | spec, ADR-0001 | ✓ | ✓ (FloorSim spawns) | Partial — state visible through HandPlay gates | **No** (not in worldSnapshot) | No | ✓ via hand-play | ✓ many | In-flight state not persisted; day-boundary autosave + mid-day checkpoint cover it by design |
| DepartmentQueue | spec | ✓ | ✓ BottomNav | ✓ badges + DepartmentScreen | ✓ snapshot | No | ✓ badges | ✓ | |
| StaffOrg (hire/fire/skills/exception threshold) | spec | ✓ | ✓ | ✓ **multi-role hiring now surfaced** (salesperson + tier-gated managers incl. f&i-manager) | ✓ snapshot | No | ✓ candidate cards | ✓ | Hiring no longer hard-coded to salesperson; `buildHiringRoleOptions` tier-gates roles. **Fire still unsurfaced.** |
| Inventory (recon/auction/aging/carry) | spec | ✓ | ✓ AuctionMenu | ✓ lot stats, Auction, Pricing | ✓ snapshot | No | ✓ inspection cost/aging warns | ✓ many | |
| DealEngine (pricing/F&I/loan/gross) | spec | ✓ | ✓ (auto-close + hand-play) | ✓ gross + match feeds DayRecap payoff (#199) | Stateless (no snapshot) | No | ✓ | ✓ many | F&I auto-resolved **by design**; f&i-manager hire now reachable (Tier 2+). No SalesWorkspace — correct, not a gap |
| Economy (cash/payroll/rent/P&L) | spec | ✓ | ✓ | ✓ cash HUD + MonthClose | ✓ snapshot | No | ✓ | ✓ | |
| Reputation + RegulatoryMeter | spec | ✓ | ✓ | ✓ **regulatory pressure now surfaced** (RegulatoryGauge in FloorDashboard) | ✓ snapshot | No | ✓ | ✓ | reviewScore + regulatory gauge both shown (#2c2cbce) |
| CompetitorMarket (drift/poach) | spec, ADR-0002 | ✓ | ✓ (wired #183) | Partial — comps in PricingScreen | ✓ snapshot | No | No | ✓ many | **Poaching dormant at starting reputation (#187 open)** |
| CareerProgression / TierManager | spec | ✓ | ✓ | ✓ tier HUD, ChapterCard, EndCard | ✓ snapshot | No | ✓ | ✓ | Backstory Day-1 mods + tier-up wired |
| Failure/recovery paths (tier-aware) | spec §failure | `Bankruptcy/Indictment/CareerEndings` monitors ✓ | ✓ terminal → EndCard | Partial — Tier-1 terminal shown; Tier-2 contraction / Tier-3 consent-decree recovery not clearly surfaced | via tierManager | No | ✓ EndCard | Partial | Recovery (non-terminal contraction) under-surfaced |
| SaveStore (SQLite, multi-slot, snapshots) | spec, CLAUDE.md | ✓ | ✓ MainMenu + autosave | ✓ slot picker + **rollback now reachable** (SettingsScreen) | ✓ (is persistence) | No | Partial | ✓ many | Weekly rolling snapshots reachable via SettingsScreen from MainMenu + in-game menu |
| EventBus | spec | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | Sole cross-module channel |
| CapacityManager (demand vs capacity) | spec | ✓ | ✓ | ✓ funnel/recap leakCause | Per-day, not persisted | No | ✓ leak cause | ✓ | |
| FollowUpPool / BDC | per-module | ✓ | ✓ | ✓ BDC dept queue | ✓ snapshot | No | ✓ | ✓ | Morning callback wired |
| NPC (traits/archetypes) | ADR-0001 | ✓ | ✓ | ✓ via customers/staff/competitors | Seed-derived | No | N/A | ✓ many | |
| ServiceQueue | per-module | ✓ | Tier-2 gated | ✓ Service dept queue (Tier 2+) | ✓ snapshot | No | Partial | ✓ | Silent at Tier 1 by design |
| ServiceDispatch (ServiceFloorDrain) | per-module CLAUDE.md | ✓ | ✓ (wired #206, floorSeams, Tier 2+) | ✓ auto-resolves service queue with advisors | Stateless per-day | No | ✓ ticket-closed events | ✓ | Service silent at Tier 1 by design |
| StaffDispatch (floor drain) | per-module | ✓ | ✓ (floorSeams) | ✓ auto-resolve + escalation | Stateless per-day | No | ✓ exceptions | ✓ | |
| StaffMorale | per-module | ✓ | ✓ | ✓ **now shown** — per-staff MORALE chip in FloorDashboard staff strip | ✓ snapshot | No | Partial | ✓ (StaffMorale + ConditionIndicators.reachability) | Feeds dispatch multiplier; now visible (#2c2cbce) |
| MarketEconomy (anchor/drift/pricing) | market-economy lock | ✓ | ✓ | ✓ PricingScreen/valuations | ✓ snapshot | No | ✓ price position | ✓ many | |
| — News engine / ticker / weekly report | market-economy lock | **Missing** | No | No | No | No | No | No | #176–#179 open, not built. The Dope-Wars "adverse-events" pillar |
| Telemetry | per-module | ✓ | Dev-only | Dev-only (AdminConsole) | ✓ snapshot | No | N/A | ✓ | |
| HistoryLog (persistent player history) | #208 | ✓ | ✓ (wired #208) | ✓ **HistoryScreen** from in-game menu | ✓ snapshot (v3→v4 migration) | No | ✓ | ✓ (HistoryLog + HistoryScreen.reachability) | Durable log of deals/exceptions/shocks/tier-ups; survives daily floorEvents reset |
| KPIDashboard (logic + standalone UI) | spec, #179 | ✓ | ✓ **now mounted on-demand** | ✓ in-game menu route + MonthClose | ✓ snapshot | No | Partial | ✓ smoke | Market-state KPIs (#179) still open |
| DemandShaper (demand "weather" + targeting) | #197/#198 | ✓ | ✓ (wired) | ✓ **DemandReadout** (observed mix + targeting levers + coverage gap) | ✓ snapshot | No | ✓ | ✓ (DemandShaper + DemandReadout.smoke) | Readout + influence levers surfaced; #197 umbrella PRD still open |
| DayLoopController / FloorSim (core loop) | #99/#107 records | ✓ | ✓ core loop | ✓ FloorDashboard + speed/pause | Mid-day checkpoint (replay), not worldSnapshot | No | ✓ | ✓ many | Real-time day; deterministic replay; **hours-of-op now feeds day length (#207)** |
| SalesProcess (gate evaluation) | sales-process slice | ✓ | ✓ | ✓ hand-play gates | Stateless | No | ✓ walk/close | ✓ many | |
| EndCard / EndCardManager | spec | ✓ | ✓ game_over | ✓ EndCard | N/A | No | ✓ | ✓ smoke | |

## Player-facing UI systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| MainMenu (New/Continue/Load/Delete + Settings + LegacyWall) | save-load mem | ✓ | ✓ boot | ✓ | ✓ slots | No | Partial | **None** | Start screen; now routes to Settings + LegacyWall; no dedicated test |
| CharacterCreation | spec | ✓ | ✓ | ✓ | persists profile/seed | No | Partial | **None** | No test |
| DayLoopShell + HUD | #107 record | ✓ | ✓ | ✓ | N/A | No | ✓ | via FloorDashboard.smoke | **Outgrowing its layout — see #215** (recap/readout/levers all appended into one body) |
| FloorDashboard (HUD/status) | #116/#117 | ✓ | ✓ | ✓ stat grid, staff strip (+morale), events, regulatory gauge | N/A | No | ✓ | ✓ smoke | |
| DayRecap | #119/#199 | ✓ | ✓ | ✓ + **match-payoff line (#199)** | N/A | No | ✓ | ✓ smoke | "X of Y sales were strong matches — you had what they wanted" |
| HandPlayModal (sales workspace) | #118 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke + FloorSim.handplay | |
| OwnershipLevers (pre-open levers) | #120 | ✓ | ✓ | ✓ in DayLoopShell | N/A | persists hoursOfOp | No | Partial | ✓ smoke | Hours-of-op lever now **effective** (feeds FloorSim, #207) |
| DemandReadout | #198 | ✓ | ✓ | ✓ in DayLoopShell | reads DemandShaper | No | ✓ | ✓ smoke | Observed persona mix + "Who You're Targeting" levers + coverage gap |
| AuctionMenu | #164 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| PricingScreen | #175 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| PersonnelScreen (hiring) | #120 | ✓ | ✓ | ✓ multi-role options | N/A | No | Partial | **None** | No dedicated test; role options tier-gated |
| DepartmentScreen (generic queue) | #76 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| BottomNav | #76 | ✓ | ✓ | ✓ badges | N/A | No | ✓ | ✓ smoke | |
| MonthCloseInterstitial | #123 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | Hosts KPI snapshot |
| NarrativeBeat / ChapterCard | spec, #127 | ✓ | ✓ tier-up | ✓ | N/A | No | ✓ | ✓ smoke | |
| HistoryScreen | #208 | ✓ | ✓ in-game menu | ✓ | reads historyLog | No | ✓ | ✓ reachability | |
| SettingsScreen (rollback) | spec persistence | ✓ | ✓ **now mounted** (MainMenu + in-game menu) | ✓ | reads snapshots | No | Partial | via composition | Player path to weekly rolling snapshots now reachable |
| LegacyWallView (completed careers) | spec ("legacy wall") | ✓ + LegacyStore | ✓ **now mounted** (MainMenu route) | ✓ | LegacyStore ✓ | No | Partial | ✓ reachability | |
| TradeEscalationModal | #170/#201 | ✓ | ✓ **now mounted** (overlay on `trade:escalated`) | ✓ | transient | No | ✓ | via composition | Player-adjudication branch reachable; #201 open for enhancements |
| DiscountEscalationModal | — | ✓ | ✓ overlay | ✓ | transient | No | ✓ | ✓ smoke | |
| Navigator (routing) | per-module | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | |
| CustomerCard | — | ✓ | **Dev-only** (AdminConsole) | Dev-only | N/A | No | N/A | ✓ smoke | Not in normal flow |
| AdminConsole | — | ✓ | **Dev-only** (`__DEV__`) | Dev-only | uses saveStore | No | N/A | None | Dev tooling |

## Cross-cutting / "obvious" systems

| System | Defined | Status | Notes |
|---|---|---|---|
| Core loop | #99/#107 | ✓ | DayLoopController/FloorSim real-time day, MANAGERIAL↔FLOOR_OPEN |
| Menus | save-load mem | ✓ | Start menu ✓; **Settings menu now reachable**; in-game menu routes to History/KPI/Settings |
| Save/load | spec, #186 | ✓ multi-slot | 17 modules persisted (now incl. historyLog, demandShaper); CustomerPool & per-day funnels excluded by design |
| HUD/status display | #116/#117 | ✓ | FloorDashboard (+morale, +regulatory gauge) |
| NPC systems & skills | ADR-0001 | ✓ | Skills exist; morale now visible; **multi-role hiring now surfaced** (fire still not) |
| Dialogue/event/history log | #117/#127/#208 | ✓ | **Persistent HistoryLog + HistoryScreen now landed (#208)**; chapter cards + recap remain |
| Progression systems | spec | ✓ | TierManager + backstory |
| Failure/recovery | spec | Partial | Terminal failure→EndCard ✓; tier-2/3 recovery under-surfaced |
| Settings/accessibility | spec | Partial | SettingsScreen reachable (rollback); `accessibilityLabel`s present; **no dedicated a11y options screen** |
| Tutorial/onboarding | #213 | **Missing** | No tutorial, coachmarks, first-run, or help anywhere |
| Feedback/notifications | #117 | ✓ | Badges, floor events, exception alerts, recap, month-close, match-payoff line |
| Managerial UI information architecture | #215 | **Partial/at-capacity** | Surfaces appended into one `DayLoopShell` body; pushing core action path below the fold — no scroll/nav/layout strategy |

---

## Key Observations

- **The "dark code" backlog is essentially cleared.** Every UI component flagged dark in the
  2026-06-05 audit is now imported and reachable: `LegacyWallView` (MainMenu route),
  `SettingsScreen`/rollback (MainMenu + in-game menu), `TradeEscalationModal` (overlay on
  `trade:escalated`), and the standalone `KPIDashboard` (on-demand in-game menu). No built
  screen/view/modal under `src/ui` is currently mounted nowhere.
- **Every "invisible-but-running" system now has a readout.** `StaffMorale` shows as a per-staff
  MORALE chip; regulatory pressure shows as a `RegulatoryGauge` in the HUD; demand "weather"
  shows in `DemandReadout` with a "Who You're Targeting" lever list; and a matched sale now
  produces an explicit payoff line in `DayRecap` (#199).
- **The central "match" skill is now playable on both ends.** The demand mix is readable
  (DemandReadout), the player can influence it (targeting levers), and a strong match is
  acknowledged in recap. This was the prior audit's #1 most-damaging omission; it is now
  surfaced. (#197 remains open as the umbrella PRD, but its readout/influence/payoff
  deliverables are in code.)
- **The F&I-upside lever is reachable.** Multi-role hiring is implemented; `f&i-manager`
  (tier `manager`, `hireTier: 2`) appears in hiring options at Tier 2+. F&I remains
  auto-resolved by design.
- **The hours-of-op lever is no longer inert** — it feeds FloorSim day length (#207) and
  persists per slot.
- **A persistent player-facing history log now exists** (#208): `HistoryLog` subscribes to
  deals/exceptions/market-shocks/tier-ups, is persisted (snapshot v3→v4 migration), and is
  surfaced in `HistoryScreen`.
- **The largest remaining loop gap is the unbuilt news/adverse-events engine (#176–#179)** —
  the Dope-Wars "bust" pillar. With demand-read/influence/payoff now landed, the world still
  throws no random market/news *shocks* for the player to ride out.
- **No tutorial/onboarding exists at all (#213).** The match skill is now visible but still
  taught nowhere.
- **The managerial UI shell is at capacity (#215).** Surfaces were added by appending into
  one `DayLoopShell` body; there is no scroll/navigation/layout strategy, so the core action
  path can fall below the fold. This is an information-architecture problem, not a missing
  feature — and it is the most decision-relevant finding for the upcoming UI-mapping pass.
- **Test coverage now includes reachability tests** (LegacyWall, ConditionIndicators,
  HistoryScreen) alongside logic + smoke. UI components with **no dedicated test** remain:
  `MainMenu`, `CharacterCreation`, `PersonnelScreen`, `DayLoopShell`, `AdminConsole`.

---

## Where Actual Structure Diverges From Intended Design

1. **Multi-slot save vs. spec out-of-scope (doc drift, #209).** `docs/spec-condensed.md` still
   lists "single career save" and "multi-save slots" as **out of scope for v1**, but the
   codebase ships `MultiSlotSaveStore` with a New/Continue/Load/Delete start menu. The doc is
   stale, not the code wrong — they contradict.
2. **Surfacing outran information architecture (#215).** The repo has, over recent slices,
   correctly closed almost every "mechanic exists but isn't surfaced" gap — but it did so by
   stacking each new surface (recap, demand readout, ownership levers, indicators) into the
   same `DayLoopShell` body. The result is broad reachability with no layout strategy: the
   managerial day-close screen is a vertical pile that can push the core action below the fold.
   **This is the structural shape the upcoming final-look UI must resolve** — the mechanics are
   present and surfaced; what's missing is a deliberate home for each.
3. **DealEngine F&I is auto-resolved *by design* — not a gap.** Per the corrected design intent
   (Dope Wars × Lemonade Stand; managerial-watch loop), the player is *not* meant to perform
   F&I/loan steps. The previously-flagged "unreachable f&i-manager hire" is now resolved
   (multi-role hiring landed). The residual is the engine's outcomes feeding the (now-present)
   match-payoff surface — also landed (#199).
4. **The Dope-Wars "adverse-events" pillar is unbuilt (#176–#179).** With the Lemonade-Stand
   "recipe vs. weather" side now surfaced end-to-end, the missing half is the random market/news
   shocks the player rides out. The world currently has weather to read but few weather *changes*
   to react to.
5. **Tier-2/3 recovery is under-surfaced.** Tier-1 terminal failure → EndCard is clear; the
   non-terminal Tier-2 contraction and Tier-3 consent-decree recovery paths aren't clearly
   distinguished from "game over" in the UI.

---

## Session Handoff Summary

**Current state of the repo:** `main` @ `5c46b52`, clean tree. The core managerial day-loop is
complete, reachable, and well-covered. Since the 2026-06-05 audit, five landings closed the bulk
of the prior gap list: persistent history log (#208), hours-of-op → FloorSim (#207), morale +
regulatory indicators (#2c2cbce), ServiceDispatch wiring (#206), and mounting the legacy wall
(#647b671) — on top of earlier landings that mounted Settings/rollback, TradeEscalationModal,
on-demand KPIDashboard, the DemandReadout + targeting levers, the #199 match-payoff line, and
multi-role hiring. **Net: no UI component is dark; no running system is invisible; the central
match skill is playable and rewarded.**

**Most important gaps now (highest leverage first):**
1. **News / random adverse-events engine (#176–#179)** — the unbuilt Dope-Wars "bust" pillar;
   now the top loop gap.
2. **Managerial UI information architecture (#215)** — surfaces outgrew the shell; the day-close
   screen has no layout/nav strategy. Most relevant to the planned final-look UI.
3. **No onboarding/tutorial (#213)** — the (now visible) match skill is taught nowhere.
4. **Tier-2/3 recovery surfacing** and **poaching dormant at starting reputation (#187)**.
5. **Doc drift (#209)** — `spec-condensed.md` still lists multi-slot save as out-of-scope.
6. Open follow-ons: market-state KPI visibility (#179), F&I attach/credit-trait modifiers
   (#151–#153), calibration verification (#180/#181), first-playtest checkpoint (#74).

**What the next session should do:** This audit is the inventory feed for a UI-mapping pass
against an agreed final-look. The right next step is **not** more wiring — it's (a) the #215
information-architecture decision (how the now-numerous surfaces are organized in the final
look), and (b) the news/adverse-events engine (#176–#179) as the last missing loop pillar. Fold
the doc-drift reconcile (#209) in opportunistically.

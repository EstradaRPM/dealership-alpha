# Game Coverage Matrix — Current-State Audit

> **Scope:** State map only. No fixes proposed, no scope broadened beyond what the
> repo's docs/issues already agree on. Generated 2026-06-05 against `main` @ `e9169f4`.
>
> **Sources of truth used:** `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002,
> the composition root (`src/createWorld.ts`), the live UI tree (`App.tsx`), the
> save/load seam (`src/worldSnapshot.ts`), the `tests/` inventory, and the open
> GitHub issue queue.

> **Design intent (re-anchored 2026-06-05):** the felt loop is **Dope Wars × Lemonade
> Stand** — buy low / sell high, ride out random adverse events, and *match an inventory
> "recipe" to the incoming buyer demand "weather,"* then watch customers stop or walk.
> F&I/loan is **auto-resolved by design** (managerial-watch loop); the player is *not* meant
> to perform F&I steps. Any older issue-history language to the contrary is superseded. See
> divergences #6–#7 and `docs/audits/game-gap-summary.md`.

**Legend:** ✓ = present/complete · **Partial** = partially wired/surfaced · **Dark** = exists in code but unreachable in play · **Dev-only** = reachable only under `__DEV__` · **No / Missing** = absent · **N/A** = not applicable (infra)

Columns: 1 System · 2 Defined in docs · 3 In code · 4 Reachable in play · 5 Surfaced in UI · 6 Save/load · 7 Onboarding · 8 Feedback/error states · 9 Tests · 10 Status notes

## Game-logic systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GameClock (day/overnight) | spec, CLAUDE.md | `GameClock` ✓ | ✓ | ✓ day counter/HUD | ✓ snapshot | No | ✓ recap | ✓ | Overnight resolution sequence wired via DayLoopController |
| CustomerPool + state machine | spec, ADR-0001 | `CustomerPool` ✓ | ✓ (FloorSim spawns) | Partial — state visible only through HandPlay gates | **No** (not in worldSnapshot) | No | ✓ via hand-play | ✓ many | In-flight customer state not persisted; day-boundary autosave + mid-day checkpoint cover it by design |
| DepartmentQueue | spec | ✓ | ✓ BottomNav | ✓ badges + DepartmentScreen | ✓ snapshot | No | ✓ badges | ✓ | |
| StaffOrg (hire/fire/skills/exception threshold) | spec | ✓ | Partial | Partial — only salesperson hire surfaced; **fire & multi-role not surfaced** | ✓ snapshot | No | ✓ candidate cards | ✓ | `HIRING_ROLE_ID='salesperson'` hard-coded in App |
| Inventory (recon/auction/aging/carry) | spec | ✓ | ✓ AuctionMenu | ✓ lot stats, Auction, Pricing | ✓ snapshot | No | ✓ inspection cost/aging warns | ✓ many | |
| DealEngine (pricing/F&I/loan/gross) | spec | ✓ | ✓ (auto-close + hand-play) | **Partial** — no SalesWorkspace; F&I/loan computed, not player-driven; only gross shown | Stateless (no snapshot) | No | Partial | ✓ many | F&I product selection / loan structuring has no player UI |
| Economy (cash/payroll/rent/P&L) | spec | ✓ | ✓ | ✓ cash HUD + MonthClose | ✓ snapshot | No | ✓ | ✓ | |
| Reputation + RegulatoryMeter | spec | ✓ | ✓ | Partial — reviewScore shown; regulatory pressure not surfaced | ✓ snapshot | No | Partial | ✓ | |
| CompetitorMarket (drift/poach) | spec, ADR-0002 | ✓ | ✓ (newly wired #183) | Partial — comps in PricingScreen only | ✓ snapshot | No | No | ✓ many | **Poaching dormant at starting reputation (#187 open)** |
| CareerProgression / TierManager | spec | ✓ | ✓ | ✓ tier HUD, ChapterCard, EndCard | ✓ snapshot | No | ✓ | ✓ | Backstory Day-1 mods + tier-up wired |
| Failure/recovery paths (tier-aware) | spec §failure | `Bankruptcy/Indictment/CareerEndings` monitors ✓ | ✓ terminal → EndCard | Partial — Tier-1 terminal shown; Tier-2 contraction / Tier-3 consent-decree recovery not clearly surfaced | via tierManager | No | ✓ EndCard | Partial | Recovery (non-terminal contraction) under-surfaced |
| SaveStore (SQLite, multi-slot, snapshots) | spec, CLAUDE.md | ✓ | ✓ MainMenu + autosave | ✓ slot picker | ✓ (is persistence) | No | Partial | ✓ many | Weekly rolling snapshots built+tested but **rollback UI dark** |
| EventBus | spec | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | Sole cross-module channel |
| CapacityManager (demand vs capacity) | spec | ✓ | ✓ | ✓ funnel/recap leakCause | Per-day, not persisted | No | ✓ leak cause | ✓ | |
| FollowUpPool / BDC | per-module | ✓ | ✓ | ✓ BDC dept queue | ✓ snapshot | No | ✓ | ✓ | Morning callback wired |
| NPC (traits/archetypes) | ADR-0001 | ✓ | ✓ | ✓ via customers/staff/competitors | Seed-derived | No | N/A | ✓ many | |
| ServiceQueue | per-module | ✓ | Tier-2 gated | ✓ Service dept queue (Tier 2+) | ✓ snapshot | No | Partial | ✓ | Silent at Tier 1 by design |
| **ServiceDispatch** | per-module CLAUDE.md | ✓ | **Dark — not wired in createWorld** | No | No | No | No | **None** | Confirmed orphan; service items resolve via generic DepartmentScreen tap instead |
| StaffDispatch (floor drain) | per-module | ✓ | ✓ (floorSeams) | ✓ auto-resolve + escalation | Stateless per-day | No | ✓ exceptions | ✓ (FloorSim.drain/exception) | |
| StaffMorale | per-module | ✓ | ✓ | **No — morale not shown anywhere** | ✓ snapshot | No | No | None standalone | Feeds dispatch multiplier; invisible to player |
| MarketEconomy (anchor/drift/pricing) | market-economy lock | ✓ | ✓ | ✓ PricingScreen/valuations | ✓ snapshot | No | ✓ price position | ✓ many | |
| — News engine / ticker / weekly report | market-economy lock | **Missing** | No | No | No | No | No | No | #176–#179 open, not built |
| Telemetry | per-module | ✓ | Dev-only | Dev-only (AdminConsole) | ✓ snapshot | No | N/A | ✓ | |
| KPIDashboard (logic) | spec | ✓ | ✓ | Partial — only via MonthClose | ✓ snapshot | No | Partial | ✓ | Market-state KPIs (#179) open |
| DayLoopController / FloorSim (core loop) | #99/#107 records | ✓ | ✓ core loop | ✓ FloorDashboard + speed/pause | Mid-day checkpoint (replay), not worldSnapshot | No | ✓ | ✓ many | Real-time day; deterministic replay |
| SalesProcess (gate evaluation) | sales-process slice | ✓ | ✓ | ✓ hand-play gates | Stateless | No | ✓ walk/close | ✓ many | |
| EndCard / EndCardManager | spec | ✓ | ✓ game_over | ✓ EndCard | N/A | No | ✓ | ✓ smoke | |

## Player-facing UI systems

| System | Docs | Code | Reachable | UI surfaced | Save/load | Onboard | Feedback | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| MainMenu (New/Continue/Load/Delete) | save-load mem | ✓ | ✓ boot | ✓ | ✓ slots | No | Partial | **None** | Start screen; no test |
| CharacterCreation | spec | ✓ | ✓ | ✓ | persists profile/seed | No | Partial | **None** | No test |
| DayLoopShell + HUD | #107 record | ✓ | ✓ | ✓ | N/A | No | ✓ | via FloorDashboard.smoke | |
| FloorDashboard (HUD/status) | #116/#117 | ✓ | ✓ | ✓ stat grid, staff strip, events | N/A | No | ✓ | ✓ smoke | |
| DayRecap | #119 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| HandPlayModal (sales workspace) | #118 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke + FloorSim.handplay | |
| OwnershipLevers (pre-open levers) | #120 | ✓ | ✓ | ✓ in DayLoopShell | N/A | No | Partial | ✓ smoke | Hours-of-op lever "wired only" (not fed to FloorSim) |
| AuctionMenu | #164 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| PricingScreen | #175 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| PersonnelScreen (hiring) | #120 | ✓ | ✓ | ✓ | N/A | No | Partial | **None** | No test |
| DepartmentScreen (generic queue) | #76 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | |
| BottomNav | #76 | ✓ | ✓ | ✓ badges | N/A | No | ✓ | ✓ smoke | |
| MonthCloseInterstitial | #123 | ✓ | ✓ | ✓ | N/A | No | ✓ | ✓ smoke | Hosts KPI snapshot |
| NarrativeBeat / ChapterCard | spec, #127 | ✓ | ✓ tier-up | ✓ | N/A | No | ✓ | ✓ smoke | |
| Navigator (routing) | per-module | ✓ | N/A infra | N/A | N/A | N/A | N/A | ✓ | |
| **TradeEscalationModal** | #170 | ✓ | **Dark — not imported in App** | No | N/A | No | No | ✓ smoke | createWorld computes approver→player overlay, but no overlay mounted |
| **SettingsScreen (rollback)** | spec persistence | ✓ | **Dark** | No | reads snapshots | No | No | **None** | Only player path to rolling snapshots; not mounted |
| **LegacyWall (completed careers)** | spec ("legacy wall") | ✓ + LegacyStore | **Dark** | No | LegacyStore ✓ | No | No | LegacyStore tested; UI **none** | PRD feature; UI unreachable |
| **KPIDashboard (standalone UI)** | spec | ✓ | **Dark** | No (KPIs only via MonthClose) | N/A | No | No | ✓ smoke | #179 (market visibility) open |
| CustomerCard | — | ✓ | **Dev-only** (AdminConsole) | Dev-only | N/A | No | N/A | ✓ smoke | Not in normal flow |
| AdminConsole | — | ✓ | **Dev-only** (`__DEV__`) | Dev-only | uses saveStore | No | N/A | None | Dev tooling |

## Cross-cutting / "obvious" systems

| System | Defined | Status | Notes |
|---|---|---|---|
| Core loop | #99/#107 | ✓ | DayLoopController/FloorSim real-time day, MANAGERIAL↔FLOOR_OPEN |
| Menus | save-load mem | Partial | Start menu ✓; **Settings menu dark** |
| Save/load | spec, #186 | ✓ multi-slot | 14 modules persisted; **CustomerPool & per-day funnels not in snapshot** (by design) |
| HUD/status display | #116/#117 | ✓ | FloorDashboard |
| NPC systems & skills | ADR-0001 | Partial | Skills exist; **morale invisible**, multi-role hiring not surfaced |
| Dialogue/event/history log | #117/#127 | **Partial** | Per-day transient `floorEvents` + chapter cards only; **no persistent history/event log** |
| Progression systems | spec | ✓ | TierManager + backstory |
| Failure/recovery | spec | Partial | Terminal failure→EndCard ✓; tier-2/3 recovery under-surfaced |
| Settings/accessibility | spec | **Partial/Dark** | `accessibilityLabel`s present on controls; **no settings/a11y screen reachable** |
| Tutorial/onboarding | — | **Missing** | No tutorial, coachmarks, first-run, or help anywhere |
| Feedback/notifications | #117 | ✓ | Badges, floor events, exception alerts, recap, month-close |

---

## Key Observations

- **The happy-path loop is fully reachable and well-tested.** Boot → MainMenu → CharacterCreation/Continue → real-time day (FloorDashboard + hand-play + speed controls) → DayRecap → MonthClose → tier-up ChapterCard → EndCard, with autosave + mid-day checkpoint resume. This spine is solid.
- **Four substantial UI components are built, tested, but dark (unreachable in play):** `TradeEscalationModal`, `SettingsScreen` (snapshot rollback), `LegacyWall` (completed-careers wall), and the standalone `KPIDashboard`. Each is imported nowhere in the live `App.tsx` tree.
- **`ServiceDispatch` is a confirmed composition orphan** — fully implemented module with a CLAUDE.md, never wired into `createWorld`, no tests. Service items currently resolve only via generic `DepartmentScreen` taps.
- **`StaffMorale` runs but is invisible** — wired into createWorld and persisted, feeds the dispatch multiplier, but surfaced in no UI.
- **Trade-escalation has a logic-to-UI gap:** `createWorld` resolves an approver (GM>UCM>player) and falls through to "player overlay" when none is hired, but the overlay (`TradeEscalationModal`) isn't mounted — so the player-adjudication branch of trades is dark.
- **Save/load is broad but deliberately partial:** 14 modules persist via `worldSnapshot`; `CustomerPool` in-flight state and per-day funnels are intentionally excluded (covered by day-boundary autosave + FloorSim mid-day checkpoint replay).
- **DealEngine has no player-facing workspace.** F&I product selection and loan structuring are computed by the engine and auto-resolved; the player sees only resulting gross. There is no `SalesWorkspace` screen.
- **No tutorial/onboarding exists at all**, and accessibility is limited to `accessibilityLabel` strings on controls (no settings screen, no a11y options).
- **Several agreed systems are still open issues, not yet in code:** News engine/ticker/weekly report (#176–#179), market-state KPI visibility (#179), poaching activation (#187).
- **No persistent player-facing history/event log** — `floorEvents` is reset every day; `Telemetry` is dev-only.
- **Test coverage skews to game logic + UI smoke.** Notable UI components with **no test**: `MainMenu`, `CharacterCreation`, `PersonnelScreen`, `SettingsScreen`, `LegacyWall`, `DayLoopShell`, `AdminConsole`.

---

## Where Actual Structure Diverges From Intended Design

1. **Multi-slot save vs. spec out-of-scope.** `docs/spec-condensed.md` explicitly lists "single career save" and "multi-save slots" as **out of scope for v1**, but the codebase ships `MultiSlotSaveStore` with a New/Continue/Load/Delete start menu (#186/#194/#195). The actual direction (per memory `save-load-foundation`) has overtaken the condensed spec — **the doc is stale**, not the code wrong, but they contradict.
2. **"Legacy wall of completed careers" is specced and storage-backed but has no reachable UI.** `LegacyStore` is implemented and tested; `LegacyWallView` exists but is mounted nowhere.
3. **Weekly rolling snapshots (4–6 weeks) are built and tested, but the player rollback path (`SettingsScreen`) is dark.** The persistence capability exists with no way for the player to use it.
4. **`ServiceDispatch` (auto-resolution by service advisors) is designed and coded but unwired** — diverges from the "hired staff auto-resolve routine queue items in their domain" model for the Service department specifically. Open issues #184 (orphan audit) and #185 (composition-completeness guard) already acknowledge this class of gap.
5. **Hours-of-op lever is "wired only."** The UI lever selects an id and the composition root holds a scaled `ticksPerDay`, but per the App comment it is not fed into FloorSim — a surfaced control with no gameplay effect yet.
6. **DealEngine F&I is auto-resolved *by design* — the gap is upstream.** Per the corrected design intent (Dope Wars × Lemonade Stand; managerial-watch loop), the player is *not* meant to perform F&I/loan steps — auto-resolution is correct, not a missing workspace. F&I profit is built as a **staffing-gated lever**: `data/staff-roles.json` defines `f&i-manager` (`hireTier: 2`), F&I products carry a `requiredRole`, and `DealEngine.computeAutoFni(skill, unlockedRoles, rng)` only attaches role-unlocked products. The real divergence is that this lever is **unreachable** — `HIRING_ROLE_ID='salesperson'` is hard-coded and multi-role hiring isn't surfaced, so the player can't hire the f&i-manager that turns F&I profit on. See divergence #7.
7. **The core "match" skill is invisible on both ends.** The intended loop rewards stocking inventory that matches the incoming *buyer demand mix* (the Lemonade "recipe vs. weather"). The demand context exists in the backend (economy demand-context seam) but there is **no player-facing demand-mix readout** to stock against, and **no match-payoff acknowledgement** when stocked inventory matches a buyer — so the central skill is neither a visible choice nor a felt reward.

---

## Session Handoff Summary

**Current state of the repo:** `main` @ `e9169f4`, clean tree. The core managerial day-loop is complete, reachable, and well-covered by tests — boot → start menu → character creation → real-time floor (HUD, hand-play, speed/pause) → day recap → month close → tier-up → end card, with multi-slot save/load, day-boundary autosave, and deterministic mid-day checkpoint resume. Save/load persists 14 modules via `worldSnapshot`. Most recent work wired CompetitorMarket into `createWorld` (#183) and finished the save/load foundation (#186 family).

**Most important gaps (highest leverage first):**
1. **Composition orphans / dark code paths:** `ServiceDispatch` is unwired (no tests); `TradeEscalationModal`, `SettingsScreen` (rollback), `LegacyWall`, and standalone `KPIDashboard` are built+tested but mounted nowhere. These are finished features the player cannot reach.
2. **Invisible-but-running systems:** `StaffMorale` and regulatory pressure affect simulation outcomes with zero UI surface.
3. **Loop-critical surfacing:** the buyer demand-mix the player should stock against is invisible, and a matched sale produces no payoff feedback — so the central "match inventory to demand" skill is unplayable as a deliberate choice. (Note: DealEngine F&I auto-resolution is *by design*, not a gap; the F&I lever's real problem is the unreachable f&i-manager hire under multi-role hiring.) The player-adjudicated trade-escalation branch also has no mounted screen.
4. **Not-yet-built agreed systems:** News engine/ticker/weekly report and market-state KPI visibility (#176–#179); poaching is dormant at starting reputation (#187).
5. **Doc drift:** `docs/spec-condensed.md` still lists multi-slot saves as out-of-scope, contradicting shipped behavior.
6. **Zero onboarding/tutorial; accessibility limited to control labels.**

**What the next session should do:** This was a mapping pass only — no fixes were made. The natural next step is to convert the dark-code and orphan findings into the existing audit issues (#184 orphan audit, #185 composition-completeness guard) and decide, per the chronological-issue rule, whether wiring the dark UI components (Settings/rollback, LegacyWall, TradeEscalationModal, KPIDashboard) or the `ServiceDispatch` orphan slots in before the open MarketEconomy news slices (#176–#179). Before any of that, reconcile `spec-condensed.md` with the shipped multi-slot reality so the source-of-truth doc stops contradicting the code.

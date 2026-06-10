# Game Gap Summary — Design vs. Repository

> **Scope:** Gap identification only. No fixes proposed, no new mechanics introduced.
> Derived from `docs/audits/game-coverage-matrix.md` (accepted as ground truth),
> anchored to `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002, and the open issue queue.
> Generated 2026-06-09 against `main` @ `5c46b52` (clean tree).

> **Why this run (framing, not a gap):** this summary is the design-intent checklist for an
> upcoming **UI-mapping pass** — agree a final-look UI (as images), then assign every existing
> mechanic a home in that look. The headline since the last audit is that the repo has closed
> almost all of its *surfacing* gaps: the dark components are mounted, the invisible systems
> have readouts, and the central match skill is playable and rewarded. The remaining gaps are
> therefore of two kinds: (1) **genuinely unbuilt mechanics** (news/adverse-events, onboarding),
> and (2) **an information-architecture gap** (#215) — too many surfaces, no layout. For the
> mapping pass, (2) is the live one: the final-look UI exists precisely to give the
> now-numerous surfaces a coherent home.

Focus is **player-complete coverage**, not backend existence. A system "exists" here
only if the player can reach, see, understand, and get feedback from it.

---

## Design intent this audit is measured against

The felt loop is **Dope Wars × Lemonade Stand**, mapped onto a car dealership — *not*
a click-through-every-F&I-step simulator. Any older issue-history language implying the
player should manually perform F&I/loan steps is **superseded** by this.

- **Dope Wars side:** buy low / sell high, plus *random adverse events* (the "drug bust /
  police" beat → regulatory pressure + market/news shocks) that the player rides out.
- **Lemonade Stand side:** set the **"recipe"** (the *inventory mix* you acquire, plus
  recon/staffing quality) and set the **price**, then *watch customers stop or walk past*
  based on conditions vs. your offering.
- **The core skill is the match.** Stock inventory that matches the *incoming buyer demand
  mix*; a good match clears faster and richer (and opens F&I upside *if an f&i-manager is
  hired*). A mismatch means walk-bys and price pressure.
- **The payoff is a dopamine beat:** an acknowledgement when inventory matched a buyer.
- **F&I profit is a staffing-gated, auto-resolved lever**, not a workflow.

**What has changed since the 2026-06-05 draft:** the loop-critical surfacing gaps that
dominated that file are **now closed in code**. The demand "weather" is readable
(`DemandReadout`), the player can influence it (targeting levers), a strong match is
acknowledged in `DayRecap` (#199), the f&i-manager hire is reachable (multi-role hiring), and
every previously-dark component is mounted. The prior #1 most-damaging omission (demand
invisible + match silent) is **retired as resolved**. What rises in its place: the *adverse-
events* half of the loop is still unbuilt, and the proliferation of surfaces now needs an
information architecture.

---

## Prioritized Gap List (highest leverage first)

1. **Random adverse events / news engine missing (#176–#179).** The Dope-Wars "bust" pillar —
   market/news shocks the player rides out — is agreed but unbuilt. With the Lemonade side now
   surfaced end-to-end, this is the largest remaining hole in the intended loop: the world has
   weather to *read* but few weather *changes* to *react to*.
2. **Managerial UI information architecture at capacity (#215).** Surfaces (recap, demand
   readout, ownership levers, indicators) are appended into one `DayLoopShell` body with no
   scroll/nav/layout strategy; the core action path can fall below the fold. Not a missing
   feature — a structural gap. **This is the gap the planned final-look UI pass exists to
   resolve.**
3. **No tutorial/onboarding anywhere (#213).** The match skill is now *visible* but still
   *taught* nowhere; its subtlety means discoverability is still poor.
4. **Tier-2/3 recovery under-surfaced.** Non-terminal contraction (Tier-2) and consent-decree
   recovery (Tier-3) aren't clearly distinguished from "game over" in the UI.
5. **Poaching dormant at starting reputation (#187).** CompetitorMarket is wired but its poach
   mechanic doesn't fire at the player's starting strength (scale mismatch).
6. **Market-state KPI visibility (#179).** Market-facing KPIs specced; the standalone
   KPIDashboard is now reachable but the *market-state* slice isn't surfaced.
7. **Fire / full roster management unsurfaced.** Multi-role *hiring* now exists; firing and
   broader roster actions are not exposed.
8. **F&I follow-ons (#151–#153).** Per-segment/brand reputation surface, attach-rates scaling
   with loan size, cash-buyer/must-finance trait modifiers — agreed follow-ons, not built.
9. **No dedicated accessibility options screen.** `accessibilityLabel`s exist; there is no a11y
   settings surface.
10. **Doc drift (#209).** `spec-condensed.md` lists multi-slot save as out-of-scope, contradicting
    shipped behavior.

---

## Loop-critical Gaps (break the Dope Wars × Lemonade Stand feel)

**Random adverse events / news engine (#176–#179)**
- *Why a gap:* The Dope-Wars "police/bust" pillar — random market/news shocks the player rides
  out — is part of the locked MarketEconomy design but unbuilt. It is now the *only* loop pillar
  still missing in code.
- *Missing surface:* News reel/ticker + the events themselves landing as player-felt shocks.
- *Type:* Code (not yet implemented).
- *Severity:* **Top** — a whole pillar of the inspiration is absent; the world has weather to
  read but no weather *changes* to react to.

**Demand read / influence / match-payoff — RESOLVED (no longer a loop gap)**
- The prior audit's top two loop-critical gaps. Now in code: `DemandReadout` surfaces the
  observed persona mix and a "Who You're Targeting" lever list (influence); `DayRecap` shows the
  #199 match-payoff line ("X of Y sales were strong matches — you had what they wanted").
- *Status:* Surfaced and playable. #197 remains open as the umbrella PRD, but its
  readout/influence/payoff deliverables are present. Verify completeness against #197's full
  scope before closing it.

**F&I-upside lever — RESOLVED**
- Multi-role hiring is implemented; `f&i-manager` (`hireTier: 2`) is selectable at Tier 2+ via
  `buildHiringRoleOptions`. The lever that switches on gated F&I profit is now reachable.

---

## Dark Systems (built + tested, unreachable in play)

**None.** Every screen/view/modal under `src/ui` is now imported and mounted in `App.tsx`.
The four components flagged dark on 2026-06-05 are all reachable:

- **SettingsScreen (snapshot rollback)** — mounted from MainMenu and the in-game menu.
- **TradeEscalationModal** — mounted as an overlay, latched on `trade:escalated`.
- **LegacyWallView** — mounted as a MainMenu route.
- **Standalone KPIDashboard** — mounted on-demand via the in-game menu (plus MonthClose).

**CustomerCard / AdminConsole** remain reachable only under `__DEV__` — intentional dev tooling,
not a player gap.

---

## Missing Systems (agreed in design, absent from code)

**News engine / ticker / weekly report (#176–#179)** — covered above as the random-events
pillar and the agreed market dopamine/feedback layer. *Severity:* **Top** (now the headline
missing system).

**First-run onboarding / tutorial (#213)** — no tutorial, coachmarks, first-run flow, or help
anywhere. *Type:* Code + UI. *Severity:* **High for player completeness** (subtle core skill,
taught nowhere).

**Market-state KPI visibility (#179)** — market-facing KPIs specced; the dashboard exists but
the market-state slice isn't surfaced. *Type:* Code + UI. *Severity:* **Medium**.

---

## Partial Systems (present, minimally wired or incomplete)

**Managerial UI shell (#215)** — every surface is reachable, but they are stacked into one
`DayLoopShell` body with no layout/nav strategy. *Type:* UI / information architecture.
*Severity:* **High** (and the explicit subject of the upcoming final-look UI work).

**Failure/recovery paths** — Tier-1 terminal → EndCard works; Tier-2 contraction and Tier-3
consent-decree *recovery* (non-terminal) aren't clearly surfaced as distinct from "game over."
*Type:* UI / feedback. *Severity:* **Medium**.

**StaffOrg (fire / full roster management)** — multi-role *hiring* now surfaced (incl.
f&i-manager); *firing* and broader roster actions are not exposed. *Type:* UI / code.
*Severity:* **Medium**.

**CompetitorMarket / poaching** — wired (#183), comps appear in PricingScreen, but poaching is
dormant at starting reputation (#187). *Type:* UI + code. *Severity:* **Medium**.

**DemandShaper / #197 umbrella** — readout + targeting levers + match-payoff are in code; the
#197 PRD remains open. Confirm the shipped surfaces cover its full scope (demand-shaping depth)
before closing. *Type:* tracking. *Severity:* **Low-Medium**.

**DealEngine (F&I / loan) — *not a gap.*** Pricing, F&I, and loan are computed, tested, and
auto-resolved by design; the f&i-manager hire (was the residual gap) is now reachable, and
outcomes feed the match-payoff surface. The engine is not under-built. *Severity:* **N/A**.

---

## UI Surfacing Gaps (logic present, under-represented in UI)

- **Market-state KPIs (#179):** dashboard reachable, but the market-state slice isn't surfaced.
- **Tier-2/3 recovery states:** logic present; not visually distinguished from terminal failure.
- **Fire / roster actions:** hiring surfaced; firing not.
- *Note — the broad picture has inverted since 2026-06-05.* The prior audit's UI-surfacing
  section was long (demand, morale, regulatory, KPIs all unsurfaced). Those are now surfaced.
  The residual surfacing gaps are narrow; the dominant UI issue is now *organization of existing
  surfaces* (#215), not absence of them.

---

## Persistence Gaps

- No unintended persistence holes. `worldSnapshot` now persists 17 modules (added `historyLog`
  with a v3→v4 migration, and `demandShaper`). `CustomerPool` in-flight state and per-day funnels
  remain intentionally excluded (covered by day-boundary autosave + FloorSim mid-day checkpoint
  replay). `DealEngine`, `SalesProcess`, `StaffDispatch`, `CapacityManager`, `ServiceDispatch`
  are stateless per-day by design.
- The prior caveat (rollback path dark) is **resolved** — `SettingsScreen` is mounted, so the
  weekly rolling snapshots are now player-invokable.

---

## Onboarding Gaps

- **No tutorial, coachmarks, first-run flow, or help — anywhere (#213).** Under the corrected
  lens this remains serious: the central skill (match inventory to demand) is *subtle*, and
  although its inputs are now visible (DemandReadout) and its payoff acknowledged (#199 recap
  line), nothing *teaches* the player to read the weather and stock against it.
- *Type:* Missing entirely. *Severity:* **High for player completeness**.
- **Accessibility:** limited to `accessibilityLabel` strings; no dedicated a11y options screen
  (SettingsScreen currently hosts rollback, not a11y).

---

## Feedback Gaps

- **Match-payoff acknowledgement — RESOLVED** (#199 DayRecap line).
- **StaffMorale / regulatory pressure — RESOLVED** (per-staff morale chip + RegulatoryGauge).
- **Persistent history — RESOLVED** (#208 HistoryLog + HistoryScreen).
- **Remaining:** CompetitorMarket drift/poach events still have no player-facing notification;
  Tier-2/3 recovery isn't distinguished from terminal failure in feedback.
- *Severity:* **Low-Medium** collectively — the previously-silent systems now report; the
  residue is competitor events and recovery-state framing.

---

## Most Damaging Omissions

1. **No random adverse events yet (#176–#179).** The Dope-Wars "bust" pillar is unbuilt. With
   the Lemonade-Stand side (read/influence/match-payoff) now surfaced end-to-end, this is the
   single largest remaining gap between the intended loop and player-complete reality — the
   world never throws weather *changes* for the player to ride out.
2. **The managerial UI has no information architecture (#215).** Surfacing succeeded so well
   that the day-close screen is now an un-laid-out pile; the core action can fall below the fold.
   This is the gap the planned final-look UI pass is meant to close, and it gates how legible the
   (now numerous) mechanics feel.
3. **Zero onboarding for a subtle skill (#213).** The match loop is now visible and rewarded but
   still undiscoverable — nothing teaches reading the weather and stocking to match.
4. **Tier-2/3 recovery reads as game-over.** A specced progression *reward* (surviving lower-tier
   failure) isn't visually distinct from terminal failure.

> **Retired from prior drafts:** *"DealEngine has no player workspace"* (auto-resolved F&I is by
> design); *"demand invisible / match silent"* (now surfaced via DemandReadout + #199);
> *"f&i-manager hire unreachable"* (multi-role hiring landed); *"SettingsScreen / TradeEscalationModal
> / LegacyWall / KPIDashboard dark"* (all now mounted); *"morale / regulatory invisible"* (now
> surfaced). These were the spine of the 2026-06-05 summary and are resolved.

---

*Gap identification only — no fixes proposed. The one doc-vs-code conflict
(`spec-condensed.md` listing multi-slot save as out-of-scope, #209) is a stale **doc**, not wrong
code.*

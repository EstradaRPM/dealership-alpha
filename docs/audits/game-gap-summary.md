# Game Gap Summary — Design vs. Repository

> **Scope:** Gap identification only. No fixes proposed, no new mechanics introduced.
> Derived from `docs/audits/game-coverage-matrix.md` (accepted as ground truth),
> anchored to `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002, and the open issue queue.
> Generated 2026-06-13 against `main` @ `deabef0` (clean tree).

> **This run reconciles every gap against the live open-issue queue** (`gh issue list --state
> open`): each gap is tagged **filed (#N)** or **UNFILED GAP**, and an explicit **Unfiled Gaps**
> roll-up closes the doc so nothing load-bearing is invisible. Every gap is classified **ENGINE**
> (mechanic/design work) or **UI** (renders existing state) — UI must trail locked mechanics.

Focus is **player-complete coverage**, not backend existence. A system "exists" here
only if the player can reach, see, understand, and get feedback from it.

---

## Design intent this audit is measured against

The felt loop is **Dope Wars × Lemonade Stand**, mapped onto a car dealership — *not*
a click-through-every-F&I-step simulator.

- **Dope Wars side:** buy low / sell high, plus *random adverse events* (regulatory pressure +
  market/news shocks) the player rides out.
- **Lemonade Stand side:** set the **recipe** (inventory mix + recon/staffing) and the **price**,
  then watch customers stop or walk.
- **The core skill is the match.** Stock to the incoming buyer demand mix; a good match clears
  faster and richer (and opens F&I upside *if an f&i-manager is hired*).
- **F&I profit is a staffing-gated, auto-resolved lever**, not a workflow.
- **Progression is the spine that times the game:** tunable gate thresholds pace the runway between
  tiers (gravel yard → paved lot → showroom → franchise → group).

**What changed since 2026-06-09:** the managerial-UI information-architecture gap is **resolved**
(the 5-tab `AppShell` replaced the overstuffed `DayLoopShell`); a **monthly tier-gate engine
(#232) + Home gate strip (#233)** landed with externalized, tunable thresholds; and
**CompetitorMarket is confirmed wired**. What rises in their place: three of the four dashboards
are placeholders, tier advancement isn't yet unified onto the new gate, and the adverse-events
pillar is still unbuilt.

---

## Prioritized Gap List (highest leverage first)

1. **Random adverse events / news engine missing** `[ENGINE]` — **filed #176–#179.** The
   Dope-Wars "bust" pillar (market/news shocks the player rides out) is agreed but unbuilt. With
   the Lemonade side surfaced end-to-end, this is the largest remaining hole in the intended loop.
2. **Tier advancement not unified onto the gate** `[ENGINE]` — **filed #250.** The data-driven
   monthly `TierGate` is built and surfaced, but promotion still runs on TierManager's standalone
   AND-threshold. The pacing spine exists; it just isn't yet the thing that promotes you.
3. **Three of four dashboards are placeholders** `[UI]` — **UNFILED GAP.** People (staff), Finance
   (analytics.png landing), and the Growth home render `StrategicTab` "coming in a later slice."
   Inventory is partial. Upstream design exists (`second-level-ia.md`); the surface slices are not
   filed. (Staff-teeth *design input* is filed #249, but that's the mechanic, not the People UI.)
4. **No tutorial/onboarding anywhere** `[ENGINE+UI]` — **filed #213.** The match skill is visible
   but taught nowhere; its subtlety makes discoverability poor.
5. **Service engine is customer-blind** `[ENGINE]` — **UNFILED GAP.** ServiceQueue/ServiceDispatch
   run at T2+, but intake is procedural (seed×day), not generated from the NPC/customer base — no
   service customers as NPCs.
6. **T4–T7 progression + OEM engine unbuilt** `[ENGINE]` — **filed #223** (design-record, parked).
   Correctly capture-not-build and T4-gated; flagged so the runway's upper half isn't mistaken for
   built.
7. **Poaching dormant at starting reputation** `[ENGINE]` — **filed #187.** CompetitorMarket is
   wired but its poach mechanic doesn't fire at the player's starting strength (scale mismatch).
8. **Late-game BDC (appointments/booking, `bdc-rep` role)** `[ENGINE]` — **UNFILED GAP.** Morning
   callbacks exist; the appointments fork (ui-mapping #4) is captured in docs but not filed.
9. **Department decomposition is a half-resolved design fork** `[ENGINE/design]` — **UNFILED GAP.**
   5 dept keys exist; office/lot/bdc lack roles and their *meaning* is parked to a dept-mechanics
   pass.
10. **Market-state KPI visibility** `[UI]` — **filed #179.** Dashboard reachable; market-state slice
    not surfaced.
11. **Fire / full roster management unsurfaced** `[UI]` — **UNFILED GAP.** Hiring exists; firing and
    broader roster actions are not exposed.
12. **Tier-2/3 recovery under-surfaced** `[UI]` — **UNFILED GAP.** Non-terminal contraction (T2) and
    consent-decree recovery (T3) aren't distinguished from "game over."
13. **F&I follow-ons** `[ENGINE]` — **filed #151–#153.** Per-segment/brand reputation surface,
    attach-rate scaling, cash-buyer/must-finance trait modifiers.
14. **Ship-blocker: real vehicle brands in `data/`** `[data]` — **filed #246.** Hard release gate.
15. **Doc drift** `[doc]` — **filed #209.** `spec-condensed.md` lists multi-slot save as
    out-of-scope, contradicting shipped behavior.

---

## Loop-critical Gaps (break the Dope Wars × Lemonade Stand feel)

**Random adverse events / news engine — `[ENGINE]`, filed #176–#179**
- *Why a gap:* the "police/bust" pillar (random market/news shocks) is in the locked MarketEconomy
  design but unbuilt. It is now the *only* loop pillar still missing in code.
- *Missing surface:* news reel/ticker + the events landing as player-felt shocks.
- *Severity:* **Top** — a whole pillar of the inspiration is absent.

**Tier advancement onto the gate — `[ENGINE]`, filed #250**
- *Why a gap:* the runway is the spine that times the whole game. The pacing thresholds are now
  externalized and a monthly gate judges them, but promotion still bypasses the gate. The
  dopamine of "the gate ticked over and promoted me" isn't wired.
- *Severity:* **High** — progression is the macro-loop's heartbeat.

**Demand read / influence / match-payoff — RESOLVED (no longer a loop gap)**
- `DemandReadout` surfaces the observed persona mix + targeting levers (influence via inventory /
  reputation / advertising producers); `DayRecap` shows the #199 match-payoff line. Tracking issues
  #197/#211/#212 are closed.

**F&I-upside lever — RESOLVED**
- Multi-role hiring landed; `f&i-manager` (`hireTier: 2`) is selectable at T2+.

---

## Dark Systems (built + tested, unreachable in play)

**None at the engine level.** Every screen/view/modal under `src/ui` that backs a finished
mechanic is mounted. `CustomerCard` / `AdminConsole` remain `__DEV__`-only by intent.

**Dark *surfaces* (built nav slot, empty room) — `[UI]`, UNFILED:** the People, Finance, and Growth
tabs are mounted but render `StrategicTab` placeholders. These are intentional scaffolding (the nav
is fixed and never tier-gated), not orphaned code — but for the player they are dark.

---

## Missing Systems (agreed in design, absent from code)

- **News engine / ticker / weekly report** `[ENGINE]` — **filed #176–#179.** Headline missing
  system; the random-events pillar. *Severity:* **Top**.
- **OEM Relationship engine (allocation/floorplan/incentives)** `[ENGINE]` — **filed #223**
  (design-record, parked). T4-gated; *correctly* absent. *Severity:* **N/A for v1** (flagged so the
  upper runway isn't read as built).
- **Bodyshop engine** `[ENGINE]` — **UNFILED** (only the spec out-of-scope line). v2-deferred;
  absent by design. *Severity:* **N/A for v1**.
- **First-run onboarding / tutorial** `[ENGINE+UI]` — **filed #213.** *Severity:* **High for player
  completeness**.
- **Service customers in the NPC base** `[ENGINE]` — **UNFILED GAP.** The engine exists; the
  customer wiring doesn't. *Severity:* **Medium**.
- **Late-game BDC appointments/booking + `bdc-rep` role** `[ENGINE]` — **UNFILED GAP.** *Severity:*
  **Medium**.

---

## Partial Systems (present, minimally wired or incomplete)

- **Tier progression** `[ENGINE]` — TierManager + TierGate both built, thresholds externalized to
  `data/`; **not unified** (promotion bypasses the gate, **#250**), and **T4–T7 unbuilt** (#223).
  *Severity:* **High**.
- **Inventory dashboard** `[UI]` — lot stats + Pricing + Auction exist; the full inventory.png
  Operations surface is not built. **UNFILED.** *Severity:* **Medium**.
- **Growth dashboard** `[UI]` — gate progress surfaces on Home (#233), but the Growth tab itself
  (demand console + gate board + courtship/portfolio) is placeholder. **UNFILED.** *Severity:*
  **Medium**.
- **CompetitorMarket / poaching** `[ENGINE]` — wired (`createWorld.ts:395–404`), comps in
  PricingScreen, persisted; poaching dormant at starting reputation (**#187**); drift/poach has no
  player notification (**UNFILED**, `[UI]`). *Severity:* **Medium**.
- **Service engine** `[ENGINE]` — wired + tested at T2+, but customer-blind (**UNFILED**).
  *Severity:* **Medium**.
- **Department decomposition** `[ENGINE/design]` — 5 keys in code; office/lot/bdc meaning + bodyshop
  inclusion is a **parked, unfiled design fork**. *Severity:* **Medium**.
- **Failure/recovery paths** `[UI]` — T1 terminal → EndCard works; T2/T3 recovery not distinguished
  from game-over. **UNFILED.** *Severity:* **Medium**.
- **StaffOrg (fire / roster)** `[UI]` — hiring surfaced; firing not. **UNFILED.** *Severity:*
  **Medium**.
- **DealEngine (F&I / loan) — *not a gap.*** Computed, tested, auto-resolved by design; the
  f&i-manager hire is reachable; outcomes feed the match-payoff surface. *Severity:* **N/A**.

---

## UI Surfacing Gaps (logic present, under-represented in UI)

- **People / Finance(analytics) / Growth dashboards** — three placeholder rooms. **UNFILED** `[UI]`.
- **Inventory surface** — partial; full surface unbuilt. **UNFILED** `[UI]`.
- **Market-state KPIs (#179)** — dashboard reachable, market-state slice not surfaced. Filed `[UI]`.
- **Tier-2/3 recovery states** — logic present; not visually distinct from terminal failure.
  **UNFILED** `[UI]`.
- **Fire / roster actions** — hiring surfaced; firing not. **UNFILED** `[UI]`.
- **CompetitorMarket events** — drift/poach has no player notification. **UNFILED** `[UI]`.
- *Note:* the dominant UI question has shifted from "is the mechanic surfaced at all" (mostly solved)
  to "which of the now-mounted *rooms* are still empty" — and three of four dashboards are.

---

## Persistence Gaps

- **No unintended holes.** Snapshot **v5** persists ~18 modules including `tierGate` (migration 4),
  `demandShaper` (migration 1), `competitorMarket`, and `historyLog`. `CustomerPool` in-flight state
  and per-day funnels remain intentionally excluded (day-boundary autosave + FloorSim mid-day
  checkpoint replay). `DealEngine`, `SalesProcess`, `StaffDispatch`, `CapacityManager`,
  `ServiceDispatch` are stateless per-day by design.
- **Doc pending, not a hole:** the save-migration recipe doc is filed `[#245]`.

---

## Onboarding Gaps

- **No tutorial, coachmarks, first-run flow, or help — anywhere** `[ENGINE+UI]`, **filed #213.**
  The central skill (match inventory to demand) is *subtle*; its inputs are visible (DemandReadout)
  and its payoff acknowledged (#199), but nothing *teaches* reading the weather and stocking to it.
  *Severity:* **High for player completeness.**
- **Accessibility:** limited to `accessibilityLabel` strings; no dedicated a11y options screen.
  **UNFILED** `[UI]`.

---

## Feedback Gaps

- **Match-payoff / morale / regulatory / persistent history — RESOLVED** (prior audit).
- **Remaining:** CompetitorMarket drift/poach still has no player-facing notification `[UI]`;
  Tier-2/3 recovery isn't distinguished from terminal failure `[UI]`; the gate verdict is shown
  (GateStrip) but doesn't yet *drive* promotion, so the "I advanced" beat is muted `[ENGINE][#250]`.
- *Severity:* **Low-Medium** collectively.

---

## Most Damaging Omissions

1. **No random adverse events yet (#176–#179)** `[ENGINE]`. The Dope-Wars "bust" pillar is unbuilt;
   the world never throws weather *changes* to ride out.
2. **Progression is built but not load-bearing (#250)** `[ENGINE]`. The spine that times the whole
   game judges the player monthly yet still promotes on a parallel threshold — the macro-loop's
   payoff beat is muted.
3. **Three of four dashboards are empty rooms** `[UI]`, **UNFILED**. The shell is solved; People,
   Finance/analytics, and Growth are placeholders.
4. **Zero onboarding for a subtle skill (#213)** `[ENGINE+UI]`.
5. **Service runs without customers** `[ENGINE]`, **UNFILED**. A whole department's demand is
   synthetic.

> **Retired from prior drafts:** *"managerial UI shell at capacity (#215)"* (resolved by the 5-tab
> AppShell); *"CompetitorMarket may be unwired"* (confirmed wired — the
> `competitormarket-not-wired` memory is now stale); *"DealEngine has no player workspace"* /
> *"demand invisible / match silent"* / *"morale / regulatory invisible"* / *"SettingsScreen /
> TradeEscalationModal / LegacyWall / KPIDashboard dark"* (all resolved in earlier landings).

---

## Unfiled Gaps (no open issue exists — surface so nothing load-bearing is invisible)

These are the dark/partial findings above that are **NOT** represented in the open issue queue.
Everything else is captured (#176–#179, #187, #209, #213, #223, #245, #246, #247, #248, #249, #250,
#151–#153, #179).

1. **Strategic dashboard surfaces — People / Finance(analytics) / Growth home** `[UI]`. Three
   mounted tabs render placeholders. Upstream design in `second-level-ia.md`; no surface slices
   filed. (Finance/analytics also needs a chart-primitives kit slice.)
2. **Inventory rebrand surface (Operations sub-surface)** `[UI]`. inventory.png mapping resolved in
   docs; slice not filed.
3. **Service ↔ customer-base / NPC wiring** `[ENGINE]`. Service intake is procedural, not bound to
   real customers; no service NPCs generated.
4. **Late-game BDC: appointments/booking + `bdc-rep` role** `[ENGINE]`. Appointments fork captured
   (ui-mapping #4) but unfiled.
5. **Department decomposition design fork** `[ENGINE/design]`. office/lot/bdc dept *meaning*,
   BDC-at-T1, follow-up-verb home, and bodyshop inclusion are parked to a dept-mechanics pass — no
   issue.
6. **CompetitorMarket drift/poach player notification** `[UI]`. Events fire; nothing tells the
   player.
7. **Tier-2/3 recovery surfacing** `[UI]`. Non-terminal contraction / consent-decree recovery not
   visually distinct from game-over.
8. **Fire / full roster management** `[UI]`. Hiring surfaced; firing not.
9. **Dedicated accessibility options screen** `[UI]`. Only `accessibilityLabel` strings exist.
10. **Bodyshop design-record** `[ENGINE]`. Absent by v2-scope, but unlike OEM (#223) it has no
    design-record issue — only the spec line. File if/when it enters scope.

> Of these, the **`[ENGINE]` unfiled gaps (#3, #4, #5, #10)** are the load-bearing ones — they are
> mechanic/design holes, not just unrendered state. The **`[UI]` unfiled gaps** trail those and the
> per-surface rebrand cadence.

---

*Gap identification only — no fixes proposed. The one doc-vs-code conflict
(`spec-condensed.md` listing multi-slot save as out-of-scope, #209) is a stale **doc**, not wrong
code. The `competitormarket-not-wired` memory is stale and should be updated to reflect the wired
state.*

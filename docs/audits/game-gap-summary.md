# Game Gap Summary — Design vs. Repository

> **Scope:** Gap identification only. No fixes proposed, no new mechanics introduced.
> Derived from `docs/audits/game-coverage-matrix.md` (accepted as ground truth),
> anchored to `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002, and the open issue queue.
> Generated 2026-06-05 against `main` @ `e9169f4`. **Re-anchored 2026-06-05** to the
> corrected design intent below.
> ServiceDispatch gap updated 2026-06-08 for #206.

Focus is **player-complete coverage**, not backend existence. A system "exists" here
only if the player can reach, see, understand, and get feedback from it.

---

## Design intent this audit is measured against

The felt loop is **Dope Wars × Lemonade Stand**, mapped onto a car dealership — *not*
a click-through-every-F&I-step simulator. Any older issue-history language implying the
player should manually perform F&I/loan steps is **superseded** by this.

- **Dope Wars side:** buy low / sell high, plus *random adverse events* (the "drug bust /
  police" beat → regulatory pressure + market/news shocks) that the player rides out.
- **Lemonade Stand side:** set the **"recipe"** (here: the *inventory mix* you acquire,
  plus recon/staffing quality) and set the **price**, then *watch customers stop or walk
  past* based on conditions vs. your offering.
- **The core skill is the match.** Stock inventory that matches the *incoming buyer demand
  mix*. When buyers skew (e.g.) subcompact-economy and you stocked that, those units sell
  *more easily* and tolerate a *higher list* — and open more **F&I upside** *if an
  f&i-manager is hired*. It never means "above sticker"; it means a good match clears
  faster and richer. A mismatch means walk-bys and price pressure.
- **The payoff is a dopamine beat:** an acknowledgement to the player when their inventory
  matched a buyer ("easy sale — you had what they wanted").
- **F&I profit is a staffing-gated, auto-resolved lever**, not a workflow. Confirmed in
  code: `data/staff-roles.json` defines `f&i-manager` (`hireTier: 2`); F&I products carry
  a `requiredRole`; `DealEngine.computeAutoFni(skill, unlockedRoles, rng)` only attaches
  products whose role is unlocked. With no f&i-manager, gated F&I profit does not accrue —
  which is correct.

**What this re-anchoring changes vs. the prior draft of this file:** the old #1 "most
damaging omission" — *"DealEngine has no SalesWorkspace; the player never touches F&I"* —
is **retired**. Auto-resolved F&I is by design. What rises instead: the player can't *read
the demand "weather"* they're supposed to stock against, gets *no match-payoff feedback*,
faces *no random adverse events yet*, and *can't hire the f&i-manager* that turns on F&I
upside.

---

## Prioritized Gap List (highest leverage first)

1. **Buyer demand-mix is not readable ("the weather").** The central skill — stock to
   match incoming buyer types — is unplayable as a deliberate choice because the player
   can't see which buyer types are coming or trending. Backend demand context exists
   (economy demand-context seam); no player-facing readout.
2. **No inventory↔buyer match payoff feedback.** The "you had what they wanted — easy sale"
   acknowledgement (the loop's dopamine beat) has no surface. Matches resolve silently
   inside auto-close.
3. **Random adverse events / news engine missing (#176–#179).** The Dope-Wars "bust" pillar
   — market/news shocks the player rides out — is agreed but unbuilt.
4. **F&I-upside lever unreachable.** F&I profit is correctly gated on hiring an
   `f&i-manager`, but hiring is hard-coded to `salesperson` and multi-role hiring isn't
   surfaced — so the lever that unlocks F&I profit can't be pulled.
5. **Invisible market conditions (StaffMorale, regulatory pressure).** More of the "board
   you price against" the player can't read; both change outcomes silently.
6. **SettingsScreen / snapshot rollback — dark** (only player path to weekly rolling
   snapshots; mounted nowhere).
7. **TradeEscalationModal — dark** (player-adjudication branch of trades unreachable).
8. **LegacyWall — dark** (specced PRD feature, storage-backed and tested, UI unreachable).
9. **Standalone KPIDashboard — dark** (KPIs reachable only via MonthClose interstitial).
10. **Hours-of-op "recipe" lever surfaced but inert** (selects an id; not fed to FloorSim).
11. **No persistent history/event log** (`floorEvents` resets daily; Telemetry dev-only).
12. **No tutorial/onboarding anywhere** — the match skill is subtle and taught nowhere.
13. **Poaching dormant at starting reputation** (#187 open).
14. **Doc drift** — `spec-condensed.md` lists multi-slot save as out-of-scope, contradicting
    shipped behavior.

---

## Loop-critical Gaps (break the Dope Wars × Lemonade Stand feel)

These are the gaps that directly degrade the intended loop, in order.

**Demand-mix readout — the "weather" the player stocks against**
- *Why a gap:* The skill the whole loop rewards is matching inventory to the incoming buyer
  mix. The demand context exists in the backend (per the economy demand-context seam) but
  the player has no readout of *who is coming* or *what's trending*, so the match becomes
  invisible luck instead of a played decision.
- *Missing surface:* A buyer-demand / market-conditions readout the player can consult
  before acquiring inventory and setting price (the Lemonade "weather forecast").
- *Type:* UI / state flow (logic largely present, unsurfaced).
- *Severity:* **Top** — without it, the central mechanic isn't playable as a choice.

**Inventory↔buyer match payoff feedback**
- *Why a gap:* When stocked inventory matches a buyer, the design calls for an
  acknowledgement ("easy sale — you had what they wanted") — the loop's primary dopamine
  beat. The audit shows no match-specific feedback surface; matches resolve silently in
  auto-close, indistinguishable from any other sale.
- *Missing surface:* A match acknowledgement on the floor / in recap that names the win.
- *Type:* UI / feedback.
- *Severity:* **Top** — the payoff that makes the match skill *feel* like a skill is absent.

**Random adverse events / news engine (#176–#179)**
- *Why a gap:* The Dope-Wars "police/bust" pillar — random market/news shocks the player
  rides out — is part of the locked MarketEconomy design but unbuilt.
- *Missing surface:* News reel/ticker + the events themselves landing as player-felt shocks.
- *Type:* Code (not yet implemented).
- *Severity:* **High** — a whole pillar of the inspiration is absent; today the world has no
  weather *changes* to react to.

**F&I-upside lever unreachable (multi-role hiring)**
- *Why a gap:* F&I profit is correctly designed as auto-resolved *and* gated on hiring an
  `f&i-manager` (role exists, `hireTier: 2`; F&I products gate on `requiredRole`). But
  `HIRING_ROLE_ID='salesperson'` is hard-coded and multi-role hiring isn't surfaced, so the
  player can never hire the role that switches on F&I profit. The lever exists in logic and
  data; it's unreachable in play.
- *Missing surface:* Multi-role hiring (at minimum f&i-manager; also fire / other managers).
- *Type:* UI / code (hard-coded role).
- *Severity:* **High** — a stocked-match's F&I upside, the richer half of the payoff, can't
  be turned on.

**Invisible conditions: StaffMorale + regulatory pressure**
- *Why a gap:* Both feed outcomes (morale → dispatch multiplier; regulatory → consequences
  and the Tier-3 consent-decree path) with no readout. Same failure mode as the demand
  readout: the player can't read the board they're managing against.
- *Missing surface:* A morale indicator and a regulatory-pressure indicator.
- *Type:* UI.
- *Severity:* **Medium-High**.

---

## Dark Systems (built + tested, unreachable in play)

These are finished or near-finished features mounted nowhere — highest leverage-to-effort,
since the work exists and only wiring/mounting is missing.

**SettingsScreen (snapshot rollback)** — the only player path to the weekly rolling
snapshots; imported nowhere in `App.tsx`. A built+tested persistence capability with no way
to invoke it. *Type:* UI / state flow. *Severity:* **High**.

**TradeEscalationModal** — `createWorld` resolves a trade approver (GM > UCM > player) and
falls through to a player overlay when none is hired, but the overlay isn't mounted, so the
player-adjudicated (negative-equity / approver-absent) branch of trades silently never
fires. *Type:* UI / state flow. *Severity:* **High**.

**LegacyWall (completed careers)** — PRD feature; `LegacyStore` implemented and tested;
`LegacyWallView` mounted nowhere. *Type:* UI. *Severity:* **Medium** (meta-progression
payoff specced but unseen).

**Standalone KPIDashboard** — built + smoke-tested, but KPIs surface only via the MonthClose
interstitial (once a month, not on demand). *Type:* UI / state flow. *Severity:* **Medium**.

**CustomerCard / AdminConsole** — reachable only under `__DEV__`. Intentional dev tooling,
not a player gap. *Severity:* **Low**.

---

## Missing Systems (agreed in design, absent from code)

**News engine / ticker / weekly report (#176–#179)** — covered above as the random-events
pillar; also the agreed dopamine/feedback layer for the market. *Severity:* **High** under
the corrected lens (was Medium).

**Market-state KPI visibility (#179)** — market-facing KPIs specced, not surfaced. *Type:*
Code + UI. *Severity:* **Medium**.

---

## Partial Systems (present, minimally wired or incomplete)

**DealEngine (F&I / loan) — *reframed, not a workspace gap.*** Pricing, F&I, and loan
mechanics are computed, tested, and **auto-resolved by design** (managerial-watch loop). The
player is *not* meant to perform F&I steps. The only residual gaps are upstream of the
engine: (a) the f&i-manager hire that unlocks gated F&I products is unreachable (see
loop-critical gaps), and (b) deal *outcomes* feed no match-payoff feedback. The engine
itself is not under-built. *Severity:* **N/A as a workspace gap**; folded into hiring +
feedback gaps.

**StaffOrg (hire/fire/multi-role)** — only `salesperson` hire is surfaced
(`HIRING_ROLE_ID='salesperson'` hard-coded). Fire and every manager role — including the
loop-relevant `f&i-manager` and `used-car-manager` — are not exposed. *Type:* UI / code.
*Severity:* **High** (carries the F&I lever; see above).

**Failure/recovery paths** — Tier-1 terminal failure → EndCard works; Tier-2 contraction and
Tier-3 consent-decree *recovery* (non-terminal) aren't clearly surfaced as distinct from
"game over." *Type:* UI / feedback. *Severity:* **Medium**.

**Hours-of-op "recipe" lever** — UI lever selects an id; composition root holds a scaled
`ticksPerDay` but (per App comment) it isn't fed into FloorSim. A surfaced control with no
consequence. *Type:* State flow. *Severity:* **Medium**.

**CompetitorMarket / poaching** — newly wired (#183), but comps appear only in PricingScreen
and poaching is dormant at starting reputation (#187). *Type:* UI + code. *Severity:*
**Medium**.

---

## UI Surfacing Gaps (logic present, under-represented in UI)

- **Demand-mix / market conditions:** the loop's most important readout, unsurfaced (above).
- **StaffMorale, RegulatoryMeter:** simulation inputs with no readout (above).
- **KPIDashboard:** logic complete, exposed only via MonthClose.
- **CapacityManager / leak cause:** surfaced in funnel/recap — the *positive* baseline for
  what "surfaced" should look like; the demand readout should aim for this bar.

---

## Persistence Gaps

- No unintended persistence holes. `CustomerPool` in-flight state and per-day funnels are
  intentionally excluded from `worldSnapshot` and covered by day-boundary autosave +
  FloorSim mid-day checkpoint replay. `DealEngine`, `SalesProcess`, `StaffDispatch`,
  `CapacityManager` are stateless per-day by design.
- The one caveat is the **rollback *path*** (SettingsScreen) being dark — the snapshots are
  maintained but the player can't invoke them (see Dark Systems).

---

## Onboarding Gaps

- **No tutorial, coachmarks, first-run flow, or help — anywhere.** Under the corrected lens
  this is worse than it looks: the central skill (match inventory to demand) is *subtle* and
  taught nowhere, and the demand "weather" it depends on isn't even visible.
- *Type:* Missing entirely. *Severity:* **High for player completeness**.
- **Accessibility:** limited to `accessibilityLabel` strings; no settings/a11y screen
  reachable.

---

## Feedback Gaps

- **No match-payoff acknowledgement** — the loop's primary dopamine beat (above).
- **StaffMorale / regulatory pressure** — change outcomes with no feedback state.
- **CompetitorMarket** — drift/poach events have no player-facing notification.
- **No persistent history/event log** — `floorEvents` resets daily; chapter cards + recap
  are the only retrospective surfaces; Telemetry is dev-only.
- **Hours-of-op lever** — no feedback because it has no effect.
- *Severity:* **High** collectively — several systems change the world silently, and the
  one that *should* feel best (a matched sale) is the quietest.

---

## Most Damaging Omissions

1. **The player can't read the demand "weather," and gets no payoff when they match it.**
   The whole loop is "stock to match the incoming buyers, then enjoy the easy sale." Today
   the incoming-buyer mix is invisible *and* a matched sale is silent — so the central skill
   is neither a visible choice nor a felt reward. This is the single largest gap between the
   intended Dope-Wars × Lemonade-Stand loop and player-complete reality.

2. **No random adverse events yet.** The Dope-Wars "bust" pillar (#176–#179) is unbuilt, so
   the world never throws weather *changes* at the player to ride out — half the tension is
   missing.

3. **The F&I-upside lever can't be pulled.** F&I profit is correctly built as a
   staffing-gated, auto-resolved reward, but the f&i-manager hire that switches it on is
   unreachable (multi-role hiring unsurfaced). The richer half of a good match never lands.

4. **Four finished, tested UI features are dark** (SettingsScreen/rollback,
   TradeEscalationModal, LegacyWall, standalone KPIDashboard). Built and unreachable —
   highest leverage-to-effort; only wiring/mounting is missing.

5. **Zero onboarding for a subtle skill.** The match loop is learnable but undiscoverable;
   nothing teaches it and its key input isn't shown.

> **Retired from the prior draft:** *"DealEngine has no player workspace / the player never
> touches F&I."* Auto-resolved F&I is by design (managerial-watch loop); the real F&I gap is
> the unreachable f&i-manager hire (#3 above), not a missing deal-builder screen.

---

*Gap identification only — no fixes proposed. The one doc-vs-code conflict
(`spec-condensed.md` listing multi-slot save as out-of-scope) is a stale **doc**, not wrong
code.*

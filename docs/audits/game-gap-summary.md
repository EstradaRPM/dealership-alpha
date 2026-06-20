# Game Gap Summary — Design vs. Repository

> **Scope:** Gap identification only. No fixes proposed, no new mechanics introduced.
> Derived from `docs/audits/game-coverage-matrix.md` (accepted as ground truth),
> anchored to `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002, the **locked tier CSV**
> (`docs/planning/Gameplay Loops and Dealership progression tiers.csv`) + the channel-desk
> manager model (`docs/planning/manager-roles-channel-desk.md`), and the open issue queue.
> Generated 2026-06-17 against `main` @ `e2729e6` **(working tree dirty** — reflects the
> in-session tier-canon edits, not a clean commit).

> **Rubric correction this run:** a system is graded on whether a **real player-felt loop** runs
> through it, not on backend existence. Synthetic-intake systems (procedural `seed × day`, not
> NPC-bound) are **stubs**, ranked with absent systems — not "Partial / Medium" footnotes. This
> elevates the **Service profit center** from the prior run's near-built framing to a **top-tier
> gap** sitting beside the absent Body Shop. The **Profit-Center Reality Check** in the matrix is
> the headline both docs now lead from.

> **This run measures gaps against the locked tier progression:** tier-gated
> profit centers (T1 sales-only → T2 service → T3 body shop + F&I + UCM → T4 new-car/OEM + NCM
> → T5 BDC → T6 GM → T7 sandbox) and the manager model (UCM + NCM + GM; **Sales Manager dead**).
> Each gap is tagged **filed (#N)** or **UNFILED GAP**; an explicit **Unfiled Gaps** roll-up
> closes the doc. Every gap is classified **ENGINE** (mechanic/design) or **UI** (renders state).

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
  tiers (gravel yard → paved lot → showroom → franchise → group). **Profit centers and staff roles
  unlock by tier per the CSV** — and **each unlocked profit center must actually *run* for the
  player**, not merely exist in code. That last clause is what this run enforces.

**What this run re-frames (the load-bearing change):** the previous audit graded the **Service
engine** `✓ Code · ✓ Reachable · ✓ UI surfaced · ✓ Tests`, hiding the fatal fact — **intake is
synthetic (`seed × day`), never drawn from the NPC/customer base** — as a `[UNFILED]` footnote. Under
the player-felt-loop rubric, Service is a **stub**: a T2 profit center that does not run for the
player. It now sits in the **same red bucket as the absent T3 Body Shop**. **Half the T1→T3
profit centers the player should feel — Service and Body Shop — are not playable.**

---

## Prioritized Gap List (highest leverage first)

1. **Service is a customer-blind stub, not a T2 profit center** `[ENGINE]` — **UNFILED GAP** (the
   *customer-wiring*; the engine exists). The CSV makes Service a profit center at T2. The engine
   (`ServiceQueue` + `ServiceDispatch`) is coded, wired, and tested — **but intake is procedural
   (`seed × day`), not bound to CustomerPool/NPC.** The player sees a queue fed by demand they cannot
   influence or grow. As a *played* profit center it does not exist. **This was buried as "Medium /
   Partial" before; it is a load-bearing hole.**
2. **T3 body shop engine + `body-shop-advisor` role missing** `[ENGINE]` — **filed #269.** The CSV makes
   the body shop a **Tier-3 profit center** (collision mirror of the service engine) with its own staff
   role. Neither exists in code or `data/staff-roles.json`. The second non-running profit center.
3. **Random adverse events / news engine missing** `[ENGINE]` — **filed #176–#179.** The Dope-Wars
   "bust" pillar (market/news shocks the player rides out). With pricing/demand, match-payoff, and
   progression all landed, this is the largest unbuilt *loop* pillar.
4. **Staff-teeth mechanic unbuilt** `[ENGINE]` — **#249 data anchor landed; grill + build pending.** Salary
   drain / talent-scaled hire cost / scarcity / poaching — the one risk/reward hole the T1 playtest exposed.
   It's the active line and the upstream for the People dashboard.
5. **Three of four dashboards are placeholders** `[UI]` — **UNFILED GAP.** People (staff), Finance
   (analytics.png), and the Growth home render `StrategicTab` "coming in a later slice." (Roster hire/fire is
   reachable via Operations→Personnel; the dedicated *dashboards* are the gap.)
6. **Pricing/Demand calibration pass** `[ENGINE]` — **filed #286.** Every channel-desk gate threshold, drift
   magnitude, skill-growth rate, and pricing/demand value is currently a **placeholder**; the game's
   balance is uncalibrated until this single tuning campaign runs (after the salary drain is real).
7. **No tutorial/onboarding anywhere** `[ENGINE+UI]` — **filed #213.** The match skill is visible but taught
   nowhere; its subtlety makes discoverability poor.
8. **T4–T7 progression + OEM/NCM engine unbuilt** `[ENGINE]` — **filed #223** (design-record, parked).
   Correctly capture-not-build and T4-gated; flagged so the runway's upper half isn't mistaken for built.
9. **Poaching dormant at starting reputation** `[ENGINE]` — **filed #187.**
10. **Late-game BDC (appointments/booking, `bdc-manager` role)** `[ENGINE]` — **UNFILED GAP.** T5 canon;
    morning callbacks exist, the appointments system + role don't.
11. **Department decomposition is a half-resolved design fork** `[ENGINE/design]` — **UNFILED GAP.** 5 dept
    keys; bodyshop excluded; office/lot/bdc lack roles + parked meaning.
12. **Market-state KPI visibility** `[UI]` — **filed #179.**
13. **Tier-2/3 recovery under-surfaced** `[UI]` — **UNFILED GAP.** Non-terminal contraction / consent-decree
    recovery not distinguished from "game over."
14. **CompetitorMarket drift/poach has no player notification** `[UI]` — **filed #267.**
15. **F&I follow-ons** `[ENGINE]` — **filed #151–#153.**
16. **Dedicated accessibility options screen** `[UI]` — **filed #268.**
17. **Ship-blocker: real vehicle brands in `data/`** `[data]` — **filed #246.** Hard release gate.
18. **Doc drift** `[doc]` — **filed #209.**

---

## Profit-Center Reality Check (the headline — carried from the matrix)

Does a real, player-felt loop run through each CSV profit center today? **`Stub` and `Absent` are both red.**

| Profit center | Tier | Real loop? | Why |
|---|---|---|---|
| Sales (used) | T1 | ✅ **Yes** | NPC customers vs inventory+price; match payoff; the live game |
| **Service** | T2 | 🔴 **Stub** | Coded + wired + tested, **but synthetic `seed × day` intake** — no NPC demand; player can't feel it |
| **Body Shop** | T3 | 🔴 **Absent** | Zero code; no `body-shop-advisor` role; `[#269]` |
| F&I | T3 | ✅ **Yes** | Auto-resolved by design; `f&i-manager` hire reachable; gross feeds match payoff |
| New-car / OEM | T4 | 🔴 **Absent** (correct) | Parked `[#223]`; higher tier |
| BDC / marketing | T5 | 🔴 **Absent** (late) | Morning callback only; appointments + `bdc-manager` unbuilt; higher tier |

**Inside the T1→T3 frontier: Sales and F&I run; Service is a stub and Body Shop is absent. Two of the
four profit centers do not run for the player.**

---

## Loop-critical Gaps (break the Dope Wars × Lemonade Stand feel)

**Service profit center is a stub — `[ENGINE]`, UNFILED (customer-wiring)**
- *Why a gap:* the CSV makes Service the first *passive* profit engine (T2) that broadens the loop past pure
  sales. The engine runs, but on **synthetic demand** — the player can't influence, grow, or read it, so there
  is no felt loop. A whole profit center is effectively absent.
- *Missing surface:* service customers generated from the NPC base (so demand responds to reputation/marketing
  like sales does), and a service-demand readout the player can act on.
- *Severity:* **Top** — a profit center the player cannot feel.

**T3 body shop profit center — `[ENGINE]`, filed #269**
- *Why a gap:* the tier CSV makes the body shop the second passive profit engine (collision mirror of service)
  that defines T3's faster-paced loop. Zero code. Without it, T3 is "T2 + F&I + UCM," not the CSV's T3.
- *Severity:* **High** — an absent profit center on the current ceiling tier.

**Random adverse events / news engine — `[ENGINE]`, filed #176–#179**
- *Why a gap:* the "police/bust" pillar (random market/news shocks) is in the locked MarketEconomy design
  but unbuilt. It is the *only* loop pillar still missing in code.
- *Missing surface:* news reel/ticker + the events landing as player-felt shocks.
- *Severity:* **High** — a whole pillar of the inspiration is absent.

**Tier advancement onto the gate — RESOLVED (no longer a loop gap)**
- `TierManager` now advances **solely** by consuming `tierGate:month_verdict` streaks (#250); the standalone
  `triggerThreshold` is retired.

**Pricing / demand / match-payoff — RESOLVED (loop wiring), calibration pending**
- `askingPrice` is the close anchor (#273); demand is a player-influenceable vehicle-type heat map (#278);
  one elasticity curve feeds both days-to-sell and arrivals (#276/#277); match-payoff line on DayRecap (#199).
  **Magnitudes are placeholders → #286.** (Note: this seam drives **sales** demand only — service is off it.)

**F&I-upside lever — RESOLVED**
- Multi-role hiring landed; `f&i-manager` (`hireTier 3`, = CSV T3) is selectable at T3+ and the loop runs.

---

## Dark Systems (built + tested, unreachable / inert in play)

**Service engine is the load-bearing one.** It is built and tested, but its **demand is synthetic**, so the
player-facing loop is inert — a coded profit center the player cannot feel. Not "dark code" in the orphaned
sense (it is wired and renders a queue), but **player-inert**: the thing that matters about it never reaches
the player. Treated here as a stub, ranked with missing systems, per the corrected rubric.

**No orphaned engine-level dark code otherwise.** Every screen/view/modal under `src/ui` that backs a finished
mechanic is mounted (App.tsx → `src/app/` → RouteContent + AppOverlays). The three career-ending monitors that
were orphaned in earlier audits are now wired (#270–#272). `CustomerCard` / `AdminConsole` remain `__DEV__`-only
by intent.

**Dark *surfaces* (built nav slot, empty room) — `[UI]`, UNFILED:** the People, Finance, and Growth tabs are
mounted but render `StrategicTab` placeholders. Intentional scaffolding (nav is fixed, never tier-gated), not
orphaned code — but for the player they are dark.

---

## Missing Systems (agreed in design, absent from code)

- **T3 body shop engine + `body-shop-advisor` role** `[ENGINE]` — **filed #269.** CSV-canon T3 profit center;
  no engine, no role in `data/staff-roles.json`. *Severity:* **High** (absent profit center).
- **Service customers in the NPC base** `[ENGINE]` — **UNFILED GAP.** The engine exists; the **customer
  wiring** doesn't — and without it the T2 profit center does not run. *Severity:* **Top** (this is what makes
  Service a stub).
- **News engine / ticker / weekly report** `[ENGINE]` — **filed #176–#179.** The random-events pillar.
  *Severity:* **High**.
- **OEM Relationship engine + NCM role (allocation/floorplan/incentives)** `[ENGINE]` — **filed #223**
  (design-record, parked). T4-gated; *correctly* absent. *Severity:* **N/A (higher tier)**.
- **Late-game BDC appointments/booking + `bdc-manager` role** `[ENGINE]` — **UNFILED GAP.** T5 canon.
  *Severity:* **Medium** (later tier, but role is canon).
- **First-run onboarding / tutorial** `[ENGINE+UI]` — **filed #213.** *Severity:* **High for player
  completeness**.
- **Staff-teeth (salary drain / scaled hire cost / scarcity)** `[ENGINE]` — **#249 data landed, build
  pending.** *Severity:* **High** (active line).

---

## Partial Systems (present, minimally wired or incomplete)

- **Service engine (T2 profit center)** `[ENGINE]` — engine wired + tested, **but customer-blind (synthetic
  intake), so player-inert.** Classified a **stub** and ranked with missing systems (above), not a comfortable
  "Partial." **UNFILED** (customer-wiring). *Severity:* **Top**.
- **Tier progression** `[ENGINE]` — advancement **now unified onto the gate** (#250); thresholds externalized
  + balance harness built (#247/#248). **T1→T3 modeled; T2 service stub; T3 body shop missing (#269); T4–T7
  unbuilt (#223).** *Severity:* **High**.
- **Channel-desk manager model** `[ENGINE]` — built (#288–#294), but all gate thresholds + drift magnitudes
  + skill-growth rates are **placeholders pending #286**; no manager-status UI surface (gates act invisibly).
  *Severity:* **Medium** (functions; needs calibration + a surface).
- **Inventory dashboard** `[UI]` — lot stats + Pricing + Auction exist; the full inventory.png Operations
  surface is not built. **UNFILED.** *Severity:* **Medium**.
- **Growth dashboard** `[UI]` — gate progress + demand readout surface **on Home**; the Growth tab itself
  (demand console + gate board + courtship/portfolio) is placeholder. **UNFILED.** *Severity:* **Medium**.
- **CompetitorMarket / poaching** `[ENGINE]` — wired, comps in PricingScreen, persisted; poaching dormant at
  starting reputation (**#187**); drift/poach has no player notification (**#267**). *Severity:* **Medium**.
- **Department decomposition** `[ENGINE/design]` — 5 keys; office/lot/bdc meaning + bodyshop inclusion +
  `service-manager`-vs-"Bodyshop & Service Manager" naming is a **parked, unfiled design fork**.
  *Severity:* **Medium**.
- **Failure/recovery paths** `[UI]` — all three monitors wired → EndCard; T2/T3 recovery not distinguished
  from game-over. **UNFILED.** *Severity:* **Medium**.
- **DealEngine (F&I / loan) — *not a gap.*** Computed, tested, auto-resolved by design; f&i-manager hire
  reachable; outcomes feed the match-payoff surface; the loop runs. *Severity:* **N/A**.

---

## UI Surfacing Gaps (logic present, under-represented in UI)

- **People / Finance(analytics) / Growth dashboards** — three placeholder rooms. **UNFILED** `[UI]`.
- **Manager channel-desk status** — the UCM's four automations act invisibly; no surface tells the player
  what the manager is now doing for them. **UNFILED** `[UI]`.
- **Service-demand readout** — even once service is NPC-bound, there is no player-facing service-demand surface
  to act on (parallel to the sales DemandReadout). **UNFILED** `[UI]` (downstream of the customer-wiring gap).
- **Inventory surface** — partial; full inventory.png surface unbuilt. **UNFILED** `[UI]`.
- **Market-state KPIs (#179)** — dashboard reachable, market-state slice not surfaced. Filed `[UI]`.
- **Tier-2/3 recovery states** — logic present; not visually distinct from terminal failure. **UNFILED** `[UI]`.
- **CompetitorMarket events** — drift/poach has no player notification. **Filed #267** `[UI]`.
- *Note:* firing **is** now surfaced (PersonnelScreen Fire button → `staffOrg.fire`, reachable via
  Operations) — **#266 appears already satisfied**; verify before closing.

---

## Persistence Gaps

- **No unintended holes.** **Snapshot v8** persists 22 modules including `tierGate`, `demandShaper`,
  `competitorMarket`, `historyLog`, and the three career-ending monitors (added via v5→v6→v7→v8 envelope
  migrations; `tierManager` bumped its own schema 1→2 for the #250 streak/dossier fields). `CustomerPool`
  in-flight state and per-day funnels remain intentionally excluded (day-boundary autosave + FloorSim mid-day
  checkpoint replay). `DealEngine`, `SalesProcess`, `StaffDispatch`, `CapacityManager`, `ServiceDispatch` are
  stateless per-day by design.
- **Migration recipe doc landed (#245)** — no longer pending.

---

## Onboarding Gaps

- **No tutorial, coachmarks, first-run flow, or help — anywhere** `[ENGINE+UI]`, **filed #213.** The central
  skill (match inventory to demand) is *subtle*; its inputs are visible (DemandReadout heat console) and its
  payoff acknowledged (#199), but nothing *teaches* reading the weather and stocking to it. With the
  channel-desk automations acting silently, the "what is my manager doing" question compounds the teaching gap.
  *Severity:* **High for player completeness.**
- **Accessibility:** limited to `accessibilityLabel` strings; no dedicated a11y options screen. **Filed #268** `[UI]`.

---

## Feedback Gaps

- **Match-payoff / morale / regulatory / persistent history / tier-verdict-drives-promotion — RESOLVED.**
- **Service has no player-felt feedback at all** — synthetic intake means there is nothing for the player to
  read or react to; this is the feedback face of the Service-stub gap `[ENGINE][UNFILED]`.
- **Remaining:** CompetitorMarket drift/poach still has no player-facing notification `[UI][#267]`; Tier-2/3
  recovery isn't distinguished from terminal failure `[UI]`; the channel-desk automations act with no
  player-facing acknowledgement of what the manager took over `[UI][UNFILED]`.
- *Severity:* **Low-Medium** collectively (excluding the Service-stub feedback face, which is Top).

---

## Most Damaging Omissions

1. **Service runs without customers (a profit center that doesn't run)** `[ENGINE]`, **UNFILED**. The T2
   profit center's demand is synthetic — the engine exists but the player never feels a service loop.
2. **T3 body shop absent (#269)** `[ENGINE]`. The other profit center that doesn't run — zero code.
3. **No random adverse events yet (#176–#179)** `[ENGINE]`. The Dope-Wars "bust" pillar is unbuilt; the world
   never throws weather *changes* to ride out.
4. **Staff has no risk/reward teeth yet** `[ENGINE]`. Hiring is free of meaningful drain/scarcity until the
   staff-teeth build lands (#249 data anchor in place).
5. **Three of four dashboards are empty rooms** `[UI]`, **UNFILED**. People, Finance/analytics, and Growth
   are placeholders.
6. **Everything is uncalibrated (#286)** `[ENGINE]`. The manager-gate / pricing / demand / skill-growth
   numbers are placeholders; balance is unverified until the tuning campaign runs.

> **Retired from prior drafts:** *"Service exists / is built (✓✓✓)"* — **corrected this run** to **stub**
> (synthetic intake; no player loop). *"dual tier-advancement logic (#250)"* (rewired — gate streaks now
> promote); *"no balance harness / no Tier-N fixtures"* (built, #247/#248); *"career-ending monitors dark"*
> (wired, #270–#272); *"App.tsx 1991-line composition risk"* (decomposed, #242); *"askingPrice is cosmetic"*
> (it is the close anchor, #273); *"f&i-manager hire unreachable"* (reachable, T3); *"fire unsurfaced"*
> (surfaced — #266 looks already satisfied); *"CompetitorMarket unwired"* (wired). The
> `competitormarket-not-wired` memory is stale.

---

## Unfiled Gaps (no open issue exists — surface so nothing load-bearing is invisible)

Everything else is captured (#176–#179, #187, #209, #213, #223, #246, #249, #250, #266, #267, #268, #269,
#286, #151–#153, #179).

1. **Service ↔ customer-base / NPC wiring** `[ENGINE]`. Service intake is procedural, not bound to real
   customers; no service NPCs generated. **Load-bearing — this is what makes Service a stub. Top unfiled gap.**
2. **Service-demand readout** `[UI]`. Downstream of #1: once service is NPC-bound, the player needs a
   service-demand surface to act on (parallel to sales DemandReadout). No issue.
3. **Late-game BDC: appointments/booking + `bdc-manager` role** `[ENGINE]`. T5 canon; appointments fork
   captured (ui-mapping #4) but unfiled.
4. **Department decomposition design fork** `[ENGINE/design]`. office/lot/bdc dept *meaning*, BDC-at-T1,
   follow-up-verb home, bodyshop inclusion, and `service-manager`-vs-"Bodyshop & Service Manager" naming are
   parked to a dept-mechanics pass — no issue.
5. **Strategic dashboard surfaces — People / Finance(analytics) / Growth home** `[UI]`. Three mounted tabs
   render placeholders; surface slices not filed. (Finance/analytics also needs a chart-primitives kit slice.)
6. **Manager channel-desk status surface** `[UI]`. The UCM's four automations act invisibly; no surface tells
   the player what their manager now handles.
7. **Inventory rebrand surface (Operations sub-surface)** `[UI]`. inventory.png mapping resolved in docs;
   slice not filed.
8. **Tier-2/3 recovery surfacing** `[UI]`. Non-terminal contraction / consent-decree recovery not visually
   distinct from game-over.
9. **IndictmentMonitor producers** `[ENGINE]`. Only `regulatory:lemon_law_incident` is a live producer;
   `audit_failure` / `deal:fraud_flag` are unwired follow-ons.
10. **OperationsTab / AppOverlays composition tests** `[test]`. The Operations tab composition and the overlay
    channel as a unit are untested (children are smoke-tested individually).

> Of these, the **`[ENGINE]` unfiled gaps (#1, #3, #4, #9)** are the load-bearing ones — mechanic/design
> holes, not just unrendered state. **#1 (Service customer-wiring) is the single highest-leverage unfiled gap**
> — it is the difference between Service being a played profit center and a stub. The **`[UI]` unfiled gaps**
> trail those and the per-surface rebrand cadence.

---

*Gap identification only — no fixes proposed. The one doc-vs-code conflict (`spec-condensed.md` listing
multi-slot save as excluded, #209) is a stale **doc**, not wrong code. **#266 (fire surfacing) appears
already satisfied in code** despite being open — verify and close. The `competitormarket-not-wired` memory is
stale and should be updated to reflect the wired state. **The headline of this run: under a player-felt-loop
rubric, Service is a stub and Body Shop is absent — two of the four profit centers do not run for the
player. The prior audit's ✓✓✓ on Service obscured exactly this.***
</content>

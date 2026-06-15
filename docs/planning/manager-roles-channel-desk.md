# Manager Roles — Channel-Desk Model

**Status:** Design locked, 2026-06-15 (grill). Calibration *numbers* (thresholds, drift magnitudes, growth curve, per-hire caps) deliberately deferred to a balance pass.
**Supersedes:** the Sales-Manager-owns-discount wiring (S9/#222/#281). Reframes S12 (#284 intel) and S13 (#285 auto-pricing) onto the per-skill gate model below.
**Captured-not-built here:** NCM internals (build with the parked OEMRelationship engine) and GM (build with the parked franchise/multi-store layer #223).

---

## 0. Why this exists

The manager roster had overlapping/incoherent wiring: discount escalation gated on a **Sales Manager**, trade approval + pricing on the **UCM**, so the SM looked like a one-trick hire and the role logic didn't track. This locks a coherent **channel-desk** model: each sales channel has one desk manager who owns its full economic loop, leveled by skill.

## 1. The two channel desks

- **UCM (Used Car Manager)** — owns the **used** channel: sourcing, used pricing/auto-pricing, trade appraisal, used-deal discount + trade negotiation/escalation. Available early (the core manager).
- **NCM (New Car Manager)** — owns the **new** channel: OEM allocation/floorplan/incentives, new pricing, new-deal discount + escalation, new-deal trade negotiation. **OEM-gated**, and **required** to run the new channel once OEM is on. Mirrors the UCM's leveling. *Internals deferred to the OEM grill.*
- **GM** — empire layer (#223). **Requires UCM (and NCM once OEM active) as hard prerequisites** — never a GM without them. Automates the **owner's own** remaining strategic choices so the player expands to additional stores and multiplies growth. Not a desk role; sits above fully-staffed desks. *Grilled with the empire system, not here.*
- **Sales Manager — DROPPED.** Its `t_o_closing` (turn-over closing / desking) skill folds onto the UCM.

## 2. Leveling = Model B (derived skill growth)

A manager's effective skill is **derived, never mutated**: `effective = base (rolled at hire, bounded by a per-hire cap) + growth(counters), clamped to cap`. Growth is driven by the (currently dormant) `counters` (`deals_closed` → desking/negotiation skills, `days_employed` → general read) at each skill's `growth_rate`.

- **Recomputed overnight** → effective skill is **constant within each open day** (same discipline as the hours-of-op lever) ⇒ no mid-day capability flips ⇒ replay-safe (#122).
- Persistence is **free** — counters already serialize on `Staff`; no migration.
- **Per-hire cap** preserves the hiring decision: a cheap green hire plateaus below the top capabilities; to break the ceiling you keep them ("good enough") or replace with a higher-cap pro. You get *both* "grow your people" and "can you afford a sharper manager."

## 3. Capability gating — per-skill (ii), hard thresholds (b)

Each capability gates on **its own skill axis**, with a discrete unlock threshold (hard, not rate-scaled):

| Skill axis | Advise (free on hire, sharpens with skill) | Act (earned behind a skill threshold) |
|---|---|---|
| `pricing` | intel precision (S12/#284) | auto-pricing standing policy (S13/#285) |
| `condition_reading` | trade appraisal tightness (#163) | trade auto-approve · sourcing auto-fill |
| `t_o_closing` | — | discount + trade desking |

**Governing rule: Advise = free on hire & sharpens with skill; Act = earned behind a threshold.** Intel/appraisal *advise* you the moment you hire (low stakes, always welcome). Acting *for* you (pricing, desking, approving, buying) is earned.

**Below the gate** (no manager, or manager under the threshold) = today's understaffed path: discounts → only a rare rate-gated slice reaches you, the rest walk; trades → escalate to you. **At/above** the gate → the manager handles **all** cases of that type. The cliff (0%→100% at threshold) is the earned-stripes beat, by design.

## 4. Execution fidelity (the refinement above the gate)

**Skill = fidelity to your setpoint + success.** Above a gate the manager *always aims at your intent* (sourcing lean, pricing posture, escalation policy); skill governs the gap between aim and result. A worse manager **drifts toward worse outcomes** — off-lean vehicle buys, thinner spreads, looser trade allowances, mis-priced units, weaker counters; a better one holds tight to your dials and executes well. The deficit is **always drift toward worse outcomes, never ignoring you.** Deterministic in (skill, seed); skill constant within a day ⇒ replay-safe.

- **Trade margin is monotonic in skill, with the no-UCM path as the floor:** no UCM → most generous allowances (thinnest profit); UCM tightens with `condition_reading`; reasonable-but-noticeable gap. (Magnitude = calibration; ordering + floor = locked.)

## 5. Cross-cutting invariant — always override

The player can always override regardless of gate state: **per-unit price** (`setAskingPrice`, always live even with auto-pricing on) and **desk override** (the "always escalate to me above $X / on condition Y" control forces auto-handled cases back to the player). Delegation = permission, not amputation.

## 6. Trades — kept thin

No valuation/negotiation split (it was over-engineering): appraisal confidence = **best `condition_reading` on staff** (#163), so "valuation = UCM" is emergent, zero cross-channel plumbing. Trades stay "automated except escalation"; the only model change is swapping the escalation's presence-gate for the `condition_reading` threshold. NCM later just joins as another approver for new-deal trades; appraisal still from the best condition reader.

## 7. Sourcing — posture, not quotas

UCM sourcing policy = a **preference-lean across three axes — margin / condition / vehicle-type(demand-fit)** — not numeric par-levels. You set where the dial sits (fat-spread buys / clean low-recon metal / what's hot on the heat map, or a blend); the UCM scores the daily board against that lean and auto-buys to it, with execution-fidelity drift by skill. One feel-first control; UI form (blend swatch / dial / sliders) decided in the mockup pass. Strategy stays yours (re-tune the lean as heat shifts); the daily scanning grind goes to the UCM. Manual buy always live.

## 8. Drop-SM cleanup

- `data/staff-roles.json`: remove `sales-manager`; `salesperson.promotes_to` → `["used-car-manager", "f&i-manager"]`; UCM `grants_skills` → `["condition_reading", "pricing", "t_o_closing"]`.
- `data/staff-archetypes.json`: remap `poached_sales_manager` → a poached **used-car-manager** (keeps the dormant #187 poaching whole).
- `data/fixtures/tier-2.json`: fix to the remapped role.
- `StaffDispatch.ts`: discount auto-adjudication role `sales-manager` → `used-car-manager`.
- Saves: regenerated, not migrated (no live users).
- Open issues referencing `sales-manager`/staff: audit + correct (separate pass).

## 9. Build order (verifiable commits — NOT shipping stages)

Per-skill gates against **static** hire-time skill first (corrects the role conflict immediately, isolates the replay-sensitive growth engine), then the growth engine. Every slice is the complete real mechanic; the work is done when all are in.

1. **M1** — Drop SM; UCM owns the used desk (roles/data/fixture + discount gate → UCM).
2. **M2** — Auto-pricing gate: UCM presence → `pricing` threshold (reframe #285).
3. **M3** — Discount desking gate on `t_o_closing` threshold (below = understaffed, above = handle-all).
4. **M4** — Trade auto-approve gate on `condition_reading` threshold + trade-margin monotonic (no-UCM floor).
5. **M5** — Execution-fidelity: skill-scaled deterministic drift across UCM acting-capabilities.
6. **M6** — UCM sourcing posture-lean policy (margin/condition/type) + auto-fill, with fidelity drift.
7. **M7** — Manager skill-growth engine (Model B): experience accrual + overnight derived-skill recompute toward per-hire cap, replay-safe.

Captured-not-filed: **NCM** (build with parked OEMRelationship engine) · **GM** (build with parked franchise layer #223).

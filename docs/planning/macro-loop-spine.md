# Macro-Loop & Progression Spine

**Status:** Design locked (structure), 2026-06-09. Gate *numbers* deliberately un-tuned.
**Supersedes:** `docs/planning/Gameplay Loops and Dealership progression tiers.csv` (kept for reference only).
**Feeds:** the UI-mapping pipeline and the eventual PRD. The Home-screen nav/goals forks were drafted against the *old* progression assumption and must be revisited against this doc.

This doc defines the **macro loop** — what carries the player across weeks, months, and the whole game. The **micro loop (one day)** is already settled and validated (read demand → stock/price → START DAY → watch the floor resolve → recap) and is not re-litigated here.

---

## 1. The core thesis

**One loop, repeated self-similarly at three zoom levels:**

> configure → release → **watch it resolve** → reap → reinvest

The "watch it resolve" beat is the *reward*, not idle time — it's what makes the configuring feel good (RollerCoaster Tycoon's "watch the park print money" is the model, and it's the same beat as the micro day-loop). The **unit of configuration grows** as you climb:

| Zoom | Unit you configure | Reward beat |
|---|---|---|
| T1 | a **car** (source it, price it) | watch the day |
| T2–T5 | a **department / store** (build it out, set its policy) | watch the month |
| T6–T7 | a **franchise / store** (acquire it, install a GM, set its strategy) | watch the quarter |

**Validated:** even in a throwaway-UI T1 build, a ~40-minute / 32-day playtest produced the intended pull — the player kept *wanting* to restock after good days, got real dopamine off trades popping in and off finding good auction buys. **T1's loop is the proven asset to protect, not "tedium" to sand down.**

## 2. Delegation = permission, not amputation

You climb by **hiring people to do your old job**, which frees your attention for a new, higher-altitude job. But delegation must never *amputate* the fun:

- A hire **executes the *mandate / strategy you set***, never replaces your judgment. (The UCM sources to *your* budget / target-segment / risk posture; you shed the forty individual lane decisions, keep the strategic call.)
- Configuration **rises in altitude** rather than disappearing: price each car → set pricing *policy* → set portfolio *posture*. Granularity-shed-per-tier is a tunable.
- The player keeps a **home base**: one job they can do hands-on *forever* because it's fun, while everything else delegates around it. (RCT never makes you stop hand-building coasters.)

## 3. Two acts

- **Act 1 — the used-car flipper (T1–T3).** No franchise, no brand identity; you sell what you source. Depth = sourcing skill, pricing, and standing up the service/body/F&I profit engines. This act **bootstraps the capital + track record** to buy your way in. The used operation **persists as a department** through Act 2 — it must not become wallpaper.
- **Act 2 — the franchise empire (T4–T7).** From T4 you acquire *brands*; a brand is a distinct economic archetype. The empire game is assembling and balancing a **portfolio** of them.

## 4. The tier ladder — "your job now"

The spine is a single column: at each tier a specific hire absorbs a specific layer of *your* job, freeing your attention onto exactly one new thing. (Per §2, the real per-tier focus is "your *newest* job **plus** the craft you've chosen to keep hands-on.")

| Tier | Dealer style | Who absorbed your old job | **Your new job** |
|---|---|---|---|
| **T1** | Micro used lot | nobody | Source + price every car, watch the floor for escalations. You do everything. (Proven *fun*, not tedium.) |
| **T2** | Small independent used | 2nd salesperson; service advisor | Set the **service profit dials** (upcharge vs. fair, price gates). First policy-you-set vs. work-you-do. Still pricing by hand. |
| **T3** | CPO / large independent | **UCM** absorbs sourcing | **Sourcing becomes strategy** — you set the mandate, the UCM hunts. Run a widening bank of profit dials at scale (service **+ body shop + F&I**). Train your people. Body/F&I are *more dials*, not new verbs. |
| **T4** | Single franchise | **SM** absorbs pricing-within-policy + 2nd escalation | Run the **OEM relationship** — allocation, incentives, gross-vs-volume. Your first **brand-archetype** decision. You stop touching individual cars. |
| **T5** | High-volume franchise | **BDC** absorbs lead-gen | Run **demand** — campaigns, reading market/competitor signals. Graduate from managing supply to steering demand. (Industrial version of the demand levers that exist from T1.) |
| **T6** | Multi-franchise group | **GM** absorbs the entire single store | Become a **CEO**: pick/develop/place GMs, set each store's posture, choose the next acquisition. |
| **T7** | Dealer group (summit) | GMs run every store | **Pure portfolio** + the prestige/synergy endgame. |

## 5. Staff / operators — the engine of the whole arc

Built with the same philosophy as the brands (multi-axis, no single "best"):

- **Multi-axis archetypes** — a UCM who reads trucks but not exotics; a GM who drives volume but bleeds gross.
- **Fixed talent *ceiling* that experience + training fill toward** (Football-Manager style) — so scouting raw talent is a real decision.
- **Scarce + poachable labor market**; retention costs money.
- **Every profit dial is modulated by the operator running it** — F&I mgr → F&I dials, service advisor → service dials, UCM → sourcing, SM → pricing, GM → whole store. Not a flat number; the person multiplies through the engine.
- **Act-2 master puzzle:** match operator archetype → brand archetype → market.

**Known build gap (surfaced by playtest):** the current staff system has **zero risk/reward** — all hires cost the same with no ongoing cost, so "insta-hire the best" is free and trivial. The teeth that make hiring a *decision*, and which this spine requires:
- **talent-scaled hire cost**,
- a **recurring salary drain** (a star is an ongoing liability you must keep fed with volume, not a one-time upgrade),
- **scarcity** (can't just buy five A-players),
- **poaching / retention** risk.

**Calibration anchor:** the real-industry per-salesperson performance ladder (5 grades, units/PVR/close-rate bands) lives in [`staff-performance-ladder.md`](./staff-performance-ladder.md). Staff "grades" must never be called "tiers" (dealership tiers own the word).

## 6. Act 2 engine — the multi-axis brand portfolio

Brands are **economic archetypes on independent axes**, so there is **no single best buy** and a real balancing game emerges. Prestige is an *emergent reading* of the axes, never the axis itself.

**Strategic axes (the levers you balance):**
- **Front gross × volume** — the core tradeoff (economy = thin gross, high volume, many competitors; exotic = otherworldly gross, low volume, few competitors).
- **Service / fixed-ops annuity** — the cash-flow *stabilizer*. A "boring" high-volume brand prints service & parts money for a decade off its installed base and can *fund the trophy store*; an exotic has huge front gross but little annuity.
- **Cyclicality** — the *hedge*. Trucks swing with fuel/construction, luxury with the stock market, economy is countercyclical. A portfolio can survive downturns a single-brand dealer can't.

**Riders (color an archetype, not their own dial):** OEM stair-step **goal pressure** (volume brands push you toward volume-over-gross), **F&I / credit profile** (economy → more subprime → fatter reserve but chargeback risk; luxury → captive-leased → thin F&I).

**Gates, not strategy:** franchise cost + facility/image requirements are the *price of admission* to an archetype.

**Possible per-store modifier (not a gate):** market fit — a brand thrives or struggles by location/demographics.

## 7. Franchise acquisition = courtship, not purchase

You don't buy franchise rights off a shelf — **the OEM picks you.**

- You **court** a brand; it evaluates your **track record** before granting rights. A prestige brand **rejects an unproven dealer**, so you land an entry brand first and *earn the right to apply* for better ones. The prestige climb is therefore organic, and reputation is the **key that unlocks brand archetypes**.
- **Track record = a multi-signal split** (not one fuzzy number): **Financial strength** (monthly averages, capital, net value incl. owned inventory) + **Sales record** (volume + consistency) + **CSI**. Prestige brands weight CSI + financial strength brutally; volume brands mostly want metal moved. → "Which brands will even talk to me" is a *legible readout of operational weakness*.
- Once granted, you inherit **OEM obligations** (volume goals, allocation you don't fully control, facility image standards) — this is what gives T4's job real teeth, and it generalizes to every later acquisition.

## 8. The multi-store summit (T6–T7)

**The GM isn't how you retire from a store — it's how you earn the right to build the next one.** Installing a GM is the *prerequisite* that unlocks opening a new franchise.

- The **new store becomes your "active" store** — played hands-on, the full T1-style loop, with a fresh brand and market.
- The old store drops into the **background**, simming under its GM, **surfacing income/expense reports**. You can **drop back in or switch which store is "active" whenever** you want.
- The empire = a **stack of background income engines that fund and contextualize your next hands-on build.** This is **serial entrepreneurship** — RCT's "finish this park, unlock the next," except the old parks keep printing and you can always revisit them.

Owner's oversight surface over a GM-run store: **set its mandate**, get a **digest**, **real problems escalate**, and you can **drop in hands-on** at will (home-base at store scale).

**T7 earns its separateness** from T6 (it isn't "T6 with a bigger number") via genuinely new verbs: the **prestige-brand endgame** (ultra-lux / exotic franchise rights) + **cross-store synergy** (centralized BDC feeding all stores, shared inventory between locations).

## 9. Home base

Resolved as **emergent, no dedicated UI**: the manual surface simply **never gets locked away**. The clearest instance is **auction cherry-picking** — the UCM grinds volume sourcing, but you can always pull up the auction listings yourself, and you naturally drift to doing it *only for the great find*, keeping the dopamine and shedding the grind. The active-store mechanic in §8 is the same principle at whole-store scale.

## 10. Intra-tier pacing

A tier does **not** need its own mid-point milestone mechanic. The **multi-dimensional gate is the internal arc**: you grow units, capital, *and* CSI/track-record at the same time, and they climb at different rates, so there's always a **binding constraint** in front of you ("cash is fine but CSI's too low → go fix service"; "rep's fine but I'm short on volume → push marketing"). The compounding daily loop drives all three; the gate makes you feel which one lags. (RCT's "park rating vs. guest count vs. cash.")

## 11. Demand timing

Player-influenceable demand is a headline spine (see the #197 work) and exists **from T1** (lot mix, pricing, cheap local ads). **BDC at T5 is the industrial lead-gen amplifier**, not demand's first appearance.

## 12. Tier gates — structure LOCKED (2026-06-11 grill)

The gate-numbers open item is resolved at the structural level. Decision record (do not re-grill):

1. **Mechanism — verdict streaks.** Advancement = consecutive TierGate month-verdict "meet"-or-better months on every face active at the tier. `tier-progression.json`'s instantaneous `triggerThreshold` is **retired**; `tier-gate.json` is the single rulebook; the Home gate strip is literally the gate.
2. **Campaign budget.** ~30 real hours for a competent player to *reach* T7 (T7 itself is the open-ended sandbox summit). Real dwell ≈ T1 1h → T2 2h → T3 4h → T4 6h → T5 8h → T6 10h (each ≈1.5× the last). With per-tier real-time compression (delegation + batch-sim), that's ≈ 8–9 in-game years total — intended fiction.
3. **Streak rule.** *To leave tier N, post N consecutive meet-or-better months.* Strict-consecutive; a missed month resets the streak. Perfect-play floor = 21 game-months to T7. Streaks are structural and locked; **thresholds are the tuned part** (#247 harness).
4. **Face activation ladder.** T1: units + cash. T2: + gross (first profit dials). T3: + csi + facility (price of admission to courtship). T4+: all five. No staff-roster face — gates measure outcomes, not shopping lists.
5. **Act 2 gate kind.** From T3→T4 onward the streak is the **prerequisite/dossier** (verdict history *is* the track record OEMs read), and advancement is **player-initiated**: apply to a specific brand, pass its weighting over your dossier, pay the franchise fee. Act 1 (T1→T3) auto-advances on streak completion. Brand weighting tables = parked OEM engine (#223).
6. **Ascent only.** Verdicts never demote; streak reset is the only verdict punishment. Descent remains the narrative failure paths (terminal / contraction / consent decree), unchanged.
7. **Skill spread (harness assertions, `data/tier-pacing-targets.json`).** Competent: median dwell within ±30% of the curve. Optimal: 25–30% faster (floored by the 21-month minimum). Naive: reaches T3 at ≤2× competent time but **must not pass T3→T4 within 5 game-years** — Act 2 is the skill wall, and the courtship fiction explains it.
8. **Tuning sequence.** Build the #247 harness now; run the threshold-tuning campaign **after** the staff-teeth pass (§5) lands — salary drain + talent-scaled hire cost move the cash/gross faces directly. Staff calibration ladder: issue #249.

---

## Open / deliberately un-tuned

- **Gate numbers** — structure LOCKED 2026-06-11, see §12. Numeric thresholds are tuned by the #247 balance harness against `data/tier-pacing-targets.json`, **after** the staff-teeth pass.
- **Staff risk/reward teeth** (§5) — identified; needs its own design/build pass to set cost curves, scarcity, salary drain, poaching. Real-industry salesperson calibration ladder captured in [`staff-performance-ladder.md`](./staff-performance-ladder.md) (was issue #249); resolve the staff-"grade" naming collision there (dealership tiers own the word).
- **Monetization model — PARKED, own axis.** On-record positioning is *premium, niche*. An F2P "IAP to grant a franchise license" was floated and flagged as the **pay-to-skip trap** (it monetizes the courtship's core tension and cuts against premium positioning). If ever F2P, monetize cosmetics/convenience that don't touch the progression spine — never the gate.

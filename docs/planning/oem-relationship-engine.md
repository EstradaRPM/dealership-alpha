# OEM Relationship Engine — Design Record

**Status:** Design **locked**, 2026-06-10 (grill complete). **Capture-not-build.**
**Build timing:** built when player progression reaches **T4** (chronological build order — this is *not* a shipping tier; the full mechanic below is what gets built, in order, when it first becomes reachable).
**Reads from:** `macro-loop-spine.md` (§3 two acts, §4 tier ladder, §5 staff, §6 brand archetypes, §7 courtship, §8 multi-store, §9 home base), `goals-targets-design.md` (decision 4 OEM stair-step, decision 5 multi-store mandate).
**Feeds:** the eventual PRD/issues for the T4 franchise slice.

This is T4's named verb — "run the OEM relationship: allocation, incentives, gross-vs-volume" (spine §4). New-car supply is its own engine, fundamentally unlike the used UCM/auction side.

---

## 1. Module shape — per-store, two-fidelity

`OEMRelationship` is its own deep module (`src/game/OEMRelationship/`, barrel `index.ts`, `data/`-driven). It is **instantiable per (store, brand)** — the empire holds a collection, one per store-brand pairing. It has **two drive modes, both complete mechanics:**

- **Full resolution** (the store you're actively running): allocation materializes real `isNew` `LotVehicle`s into *that store's* Inventory (same pattern trades use), per-unit floorplan accrues, mandate-driven auto-pricing runs with per-unit override.
- **Aggregate resolution** (a store under a GM): `stepAggregate(mandate, brand, financials) → {unitsMoved, newGross, floorplanCost, stairstepResult, allocationDelta, oemStandingDelta}` — same engine, honest numbers, **no unit materialization**. Feeds the store's income/expense card + mandate verdict.

Which mode runs depends only on whether you're standing in the store or a GM runs it — delegation philosophy (spine §2) applied to the OEM relationship itself.

## 2. Allocation / turn-and-earn (core texture)

- **Monthly grant**, on the same beat as the stair-step — one loud OEM heartbeat (goals decision 4).
- **Per-model pools** on a hot↔slow spectrum; hot models rationed, slow-movers pushed.
- **Turn drives earn:** per-model sell-through velocity sets next month's allotment of that model. Move them fast → bigger allotment; let them age → allotment shrinks and you get loaded with slow-movers.
- **Your lever is a preference order, not a pick:** you request a mix; the OEM fills it *partially*, modulated by earn rate + a seeded regional-scarcity draw. Partial control = the "allocation you don't fully control" franchise texture.
- **Tie-in / forced balance (IN):** the OEM makes you take N slow-movers to unlock each hot unit ("take 3 sedans to get a truck"). The juiciest recurring decision — eat the dogs (which age and bleed floorplan) to keep the hot pipeline.
- **The vise:** under-order → safe from carry but hurts standing + risks the stair-step; over-order → chase the bonus but every floored unit drains cash. This *is* the gross×volume axis (spine §6) on your own floor — you structurally can't climb on OEM volume alone (goals decision 4).
- **Per-brand modulation:** the `oem_goal_pressure` archetype rider tunes how brutal turn-and-earn + scarcity + tie-in are.

## 3. Floorplan line

- **Separate accrual from used carry, OEM-owned.** New finances on **invoice (amount financed)**; used carries on **book**. `isNew` units are **skipped by Inventory's carry pass**; OEMRelationship owns their floorplan and posts via the shared `economy:carrying_cost_posted` channel so the financial-strength face aggregates all flooring.
- **Daily interest:** `invoice × floorplanApr / 365`.
- **Curtailments = discrete cash events:** at tunable age milestones (e.g. 90/120/180d, per brand/tier) the lender forces a cash principal paydown on the aged unit. The "this dog is now eating cash — move it" pressure.
- **Credit-line ceiling = f(financial strength / net worth / standing)**, tunable. Total floored invoice can't exceed it — a hard coupling (an earned hot allocation you *can't take* because you're floored out).
- **APR scales with standing/tier** — better track record → cheaper money (mirrors `floorplanAprForTier`).

## 4. Holdback / incentives / co-op

- **Holdback = modeled-but-invisible** (position B; see [[sim-depth-not-surface-complexity]]). A fixed % of MSRP sits between invoice and *true* cost, so near-invoice sales still profit (volume + back end carry thin front gross). Credited at sale into the deal's true gross. **Never a player-facing label or dial** — honest under the hood, ambient in the UI.
- **Dealer cash lands on the forced dogs:** OEM spiffs on slow-movers partially compensate the tie-in — forced inventory becomes a manage-the-spiff decision, not dead weight. Player-facing.
- **Customer rebates vs dealer cash kept distinct** (rebates lower customer price / juice volume; dealer cash fattens targeted gross). Not flattened ([[feedback-no-half-assed-solutions]]).
- **Co-op ad money feeds the demand levers** ([[demand-influence-mechanic]] / #197): OEM matches a capped fraction of brand-specific marketing spend → cheaper brand advertising, a multiplier on existing demand-shaping. Mostly ambient; the marketing spend is the player decision.
- **Stair-step:** OEMRelationship *computes* the retroactive volume bonus + repeated-miss allocation-tightening; the goals surface *reports* it (goals decision 4).

## 5. Pricing & sourcing — automate-by-default, override-by-exception, revert-at-will

Uniform across new + used pricing **and** sourcing (corrects an earlier asymmetry; truer reading of spine §9 — the manual surface is *available*, never *mandatory*). Three layers:

1. **Mandate / posture** (per store, per department) — *push volume / balanced / protect gross / recover CSI*. Defines what "automated" *means*; required, not flavor. **Same object** drives the active store's SM auto-pricing (new + used) *and* background GM-run stores (goals decision 5) — one concept, both fidelities.
2. **Automation** — SM/UCM execute the mandate per-unit. Quality scales with operator archetype (spine §5): a weak SM auto-prices worse, which makes you *want* to override or upgrade. Override frequency becomes an emergent "is this manager good enough" signal.
3. **Per-unit override** — each unit is `auto` or `manual(price)` (extends the existing `setAskingPrice` lever + an auto/manual flag). Manual overrides the SM until you revert; revert → manager discretion.
   - A manually-priced unit is **excluded from SM auto-markdown/aging** until reverted (you took the wheel, you own the consequence). Ambient "aged + manually held" nudge so a forgotten price doesn't silently rot.

**Sourcing:** UCM grinds volume by default; the player can always snipe auction listings. At multi-store scale the player is the **group-wide auction sniper** — snipe any great find, assign each buy to a destination store (its lot + floorplan line). Home base (spine §9) generalized store → group.

## 6. Brand entity & archetype axes

One canonical **fictional Brand entity** in `data/`, keyed by an **opaque id** (never a display string / trademark — see [[fictional-brands-shipblocker]]). Everything joins to it by id: vehicle catalog, market share, brand-tiers, OEM terms, archetype, qualification. The Brand entity carries the §6 archetype axes, which *drive* the engine (no dedicated screens):

- `front_gross_vs_volume` → new-car gross thickness + stair-step/allocation volume push
- `service_annuity` → fixed-ops revenue off the installed base (cash-flow stabilizer)
- `cyclicality` → **couples to the existing MarketEconomy shock/segment-heat system** (reuse, not new machinery)
- riders: `oem_goal_pressure` (allocation brutality) + `fni_credit_profile` (couples to SalesProcess F&I attach + credit-tier distribution)

Prestige stays *emergent* from these axes, never its own number (spine §6).

## 7. Courtship / qualification (locked in spine §7; engine hook only)

You don't buy rights off a shelf — the OEM picks you. Track record = multi-signal split (financial strength + sales record + CSI); prestige brands weight CSI + financial strength brutally, volume brands want metal moved. The **engine exposes**: each Brand entity carries per-signal qualification thresholds + weights, and a read — "which brands will talk to me, and what's the gap" — the courtship surface renders.

**Franchise buy-in:** qualification is the **hard gate** (no cash buys past a CSI wall). Once qualified, the buy-in is **down payment + an OEM-held note** (not a lump sum) — a capital-structure decision whose ongoing note service drains the financial-strength face alongside floorplan. Affordability is necessary, never sufficient.

## 8. Player-facing vs ambient (the lens, applied)

| Mechanic | Surface |
|---|---|
| Allocation order / preference mix | Player-facing (decision) |
| Tie-in (take dogs to get hot) | Player-facing (the juicy decision) |
| Dealer-cash spiffs on the dogs | Player-facing (changes move-it call) |
| Stair-step monthly target | Player-facing (the loud heartbeat) |
| Mandate / posture | Player-facing (sets automation objective) |
| Per-unit price override + group sniper | Player-facing (home-base, at discretion) |
| Marketing spend (co-op makes it cheaper) | Player-facing spend; co-op match ambient |
| Floorplan ceiling | Felt as a *constraint*; formula ambient |
| Curtailment | Felt as an *event/alert*; not an accounting screen |
| Holdback, co-op reimbursement math, rebate setting | Ambient — honest under the hood, unsurfaced |

Default = model honest; promote only fun decisions (see [[sim-depth-not-surface-complexity]]).

## 9. Events & boundaries

- **Emits:** `oem:allocation_offered` · `inventory:vehicle_acquired_via_allocation` · `economy:carrying_cost_posted` (new floorplan) · `oem:curtailment_due` · `oem:stairstep_resolved` · holdback credit + co-op accrual (ambient).
- **Consumes:** month-boundary clock (allocation grant, stair-step deadline, curtailment sweep) · `inventory:vehicle_sold` (isNew → turn/earn, holdback, stair-step count) · marketing-spend (co-op match) · mandate change (SM objective).
- **Reads (deps):** Brand entity data · financial-strength/net-worth (ceiling + qualification) · CareerProgression tier (APR, ceiling, courtship eligibility) · masterSeed (deterministic allocation fill, scarcity, tie-in draws).
- **Determinism:** all draws via `rng.seedNamespace(...)`, per-slot masterSeed (consistent with [[market-economy-design-lock]] / [[replay-determinism-constraint]]).
- **Posts money only through Economy; emits new units into Inventory** (mirrors the trade-acquisition flow). Inventory stays the single lot-of-record.

## 10. Data files (sketch)

- Brand entity (`data/brands.json` unified + extended): archetype axes, riders, qualification thresholds/weights, OEM terms (allocation behavior, floorplan APR/ceiling/curtailment schedule, holdback %, incentive/co-op tables). Keyed by opaque id.
- `data/tunables.json#oem`: cross-brand defaults (curtailment milestones, scarcity stdev, tie-in ratios, stair-step tiers, co-op match cap).

## 11. Build-order note

Captured now in full; **built when the player's progression first reaches T4** (chronological order — [[feedback-chronological-issue-order]]). The other modules it leans on already exist (Inventory, Economy, MarketEconomy, CareerProgression, SalesProcess F&I, the demand levers). No part of this is a lesser/temporary version — the design above is the engine that gets built.

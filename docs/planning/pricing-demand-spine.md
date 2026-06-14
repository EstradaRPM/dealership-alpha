# Pricing ↔ Demand Spine

**Status:** Design locked, 2026-06-14. Calibration *numbers* deliberately un-tuned.
**Supersedes / reopens:** the persona-mix framing of `DemandShaper`, the volume framing of locked **DemandContext #125**, and the FloorSim **#99/#103** macro boundary ("marketing/pricing/strategy never enter FloorSim directly"). Those records are being reopened deliberately — see §7. Also resolves the long-standing demand-influence mechanic and the "pricing is cosmetic" gap.
**Feeds:** the micro day-loop ("read demand → stock/price → START DAY → watch the floor resolve → recap") in `macro-loop-spine.md`, which already assumes player demand levers exist from T1 and pricing rising in altitude per tier. This doc is the concrete mechanic.

---

## 0. Why this exists

The player-facing pricing surface (`OwnershipLevers` Next-Day-Prep pricing card + the per-vehicle `PricingScreen` with the book↔market slider, "predicted days to sell", "projected gross", strategy toggle, competitor comps) is **fully built and fully cosmetic**. Audited 2026-06-14:

- **Price → close: not wired.** Deals close at the engine's `marketPrice = book × markup` (`MarketEconomy/providers.ts`, `SalesProcess/close.ts`). The player's `askingPrice` (persisted on `LotVehicle`, `Inventory/types.ts`) is never read by the close path. Aggressively-priced and wishfully-priced cars transact at the *same* engine number.
- **Price → demand: not wired.** Arrivals (`FloorSim.ts`) come from reputation × market-share × season × inventory depth/quality. Price is not a term. "PREDICTED DAYS TO SELL" reacts to the ask but is a standalone display formula (`MarketEconomy/daysToSell.ts`) that drives **zero** actual arrivals — a number that lies.
- The strategy toggle, `suggestListPrice`, and `classifyPricePosition` are all UI-only.

Pricing is the player's **primary** lever and it has been inert. This redesign makes it the load-bearing spine.

---

## 1. The five pillars (locked)

### Pillar 1 — Demand is a vehicle-type heat map, not a buyer-type mix
Demand is expressed as **per-segment heat** ("what's hot on the lot right now"): e.g. compact-SUV 1.4 (hot), sedan 0.7 (cold), truck 1.1 (warm). This is the Dope-Wars × Lemonade felt loop: read the heat → stock to it → price to it.

Buyer **personas do not vanish** — they **demote to per-customer negotiation traits** (price sensitivity, trade behavior, stubbornness in the discount event). They stop being the *demand driver*; vehicle-type heat takes that job. Each up that walks in is still an individual with traits, but *which segment is in demand* is the heat map, not a persona distribution.

### Pillar 2 — `askingPrice` is the transaction anchor
The close reads the **player's asking price**, not `book × markup`. The engine's market number **demotes to a competitor benchmark** — used for "below/above market" labeling, competitor comps, and the elasticity curve, but it **never sets what customers pay**.

`realizedPrice = askingPrice − requiredDiscount`, where `requiredDiscount` is the gap between the ask and the customer's **reservation price** (their max willingness-to-pay, derived from segment book value + their wealth/sensitivity + value built during the visit), clamped to `[marginFloor, askingPrice + overage]`.

### Pillar 3 — One demand model, two consumers (kill the lying number)
The pricing screen's prediction and FloorSim's actual arrivals must read the **same** price-elastic demand model. The screen *predicts* days-to-sell / gross from it; FloorSim *draws* arrivals from it. "PREDICTED DAYS TO SELL" becomes a real promise, not a disconnected heuristic.

### Pillar 4 — Elasticity is conditional on heat (the replayability engine)
There is **no static optimal price** to memorize — the best price moves every playthrough with the heat map.
- **Hot segment:** demand supports price. Hold at/above market and metal still moves. *Underpricing a hot car = sells fast but thin → gross left on the table* (Lemonade-Stand tension on margin).
- **Cold segment:** brutal above market — it sits, carrying cost bleeds — so you *must* price below market to move it.
- Baseline shape: **bites hard above market, gentle below**, with the bite-point sliding as a function of segment heat.

Granularity: **segment heat × your per-segment price posture → traffic & turn for that segment.** Individual unit price then decides which car *within* an in-demand segment gets worked first — so dropping the price on one stale unit still moves that unit.

### Pillar 5 — Pricing intel + automation scale with staff / tier
The "Hire a Used-Car Manager for a sharper read" line in the mockup becomes real mechanics (maps to the T3 **UCM** in `macro-loop-spine.md §4`):
- **Early (T1, no UCM):** coarse intel. Heat map shows hot/warm/cold bands, not numbers. Strategy toggle gives a wide, low-confidence suggestion band. You price by gut — that *is* the early-game skill.
- **Later (UCM hired / dept built, T3):** the toggle graduates into a real **standing auto-pricing policy** — incoming inventory auto-prices to your book↔market target; the UCM hands you a pinpoint best-price-for-profit range with tight confidence; you override per-unit at will. Delegation = permission, not amputation (`macro-loop-spine.md §2`): you keep the override, shed the grind.

---

## 2. The two sales-exception events (the original ask)

Both events anchor on `askingPrice` (Pillar 2) and resolve to a clear **buy or walk**.

- **Discount event** — fires when the customer's reservation price < `askingPrice` and no sales-manager is on roster to auto-adjudicate. Player sees: starting ask (= our list price), customer's target, the **salesperson's failed counter** (between those two, tighter the higher the salesperson's skill), and accept-ask / counter / propose / decline. Customer response on a player counter rolls on the gap × their price-sensitivity ("some come down to reality, some won't").
- **Trade event** — fires when a trade-in is unusual (gap, low confidence, big overhang, or ask over the override threshold). Negative equity **stays** (it's a real, locked mechanic) but the payoff-vs-book spread becomes a **controlled distribution** (LTV at origination × loan age × depreciation): mild majority, occasional steep, deeply-underwater is the rare tail — and it is **shown honestly** (book vs. payoff vs. lien) so a high ask reads as logical, never silly. No absurd "$5,200 car, $35,455 demand" without a visible $34k lien behind it.

**Frequency:** ship at the rare end, rate exposed as a tunable for calibration.

**Delete the dead 3rd event.** The legacy `floor:exception_raised` → **HandPlayModal** path (GREET/QUALIFY/DEMO/NEGOTIATE gate walkthrough, "Build rapport / Direct pitch / Apply pressure" buttons) burns day-ticks and prints "Deal closed." but posts no revenue, closes no deal, touches no inventory/economy. Remove it and its 5 dramatic-case flags (VIP / high-dollar / irate / lemon-law / audit) unless a flag is needed elsewhere.

---

## 3. Module impact map

| Module | Change |
|---|---|
| **MarketEconomy** | `marketPriceFn` demotes from transaction price to **competitor benchmark**. `daysToSell` / `suggestListPrice` / `classifyPricePosition` become real consumers of the unified demand model and get a **confidence/precision tier** gated by staff (UCM). New: segment **heat map** producer. |
| **DemandShaper** | Reframe from persona-mix producer to **segment-heat** producer; add the `pricing` producer (the empty socket). Output = per-segment demand vector, not a persona distribution. |
| **DemandContext (#125)** | Volume projection becomes **price-elastic per segment** (heat × posture). This is the locked-record reopen. |
| **FloorSim (#99/#103)** | Arrival draw consumes price-elastic per-segment volume. Macro boundary rewritten to *admit* pricing/strategy as demand inputs. Floor match weights unit price-vs-market. |
| **SalesProcess/close** | `closeAndPrice` anchors on `askingPrice`; `requiredDiscount` = ask vs. reservation price; benchmark used only for labeling/comps. |
| **Inventory** | `askingPrice` gains real consumers. Auto-pricing policy stamps `askingPrice` on intake (Pillar 5). |
| **StaffDispatch** | Discount/trade resolvers anchor on `askingPrice`; salesperson failed-counter sits between ask and customer target by skill. UCM gates pricing-intel precision. |
| **CustomerPool / NPC** | Personas demote to negotiation traits; segment *demand* no longer sourced from persona distribution. Trade payoff generation reshaped to the controlled LTV×age distribution. |
| **UI** (`OwnershipLevers`, `PricingScreen`, the event modals, FloorDashboard) | Heat map surface; predicted days-to-sell now honest; strategy toggle = policy at T3; remove HandPlayModal; clean buy/walk recap on both events. |

---

## 4. Data / tunables (no magic numbers)
- Segment-heat generation table (which segments run hot/cold, drift over time, fuel inputs).
- Price-elasticity curve params (bite-point vs. heat, above/below-market asymmetry).
- Auto-pricing policy targets per strategy (Aggressive/Market/Value) — already partly in `data/pricing-strategies.json`.
- Intel-precision-by-staff table (T1 coarse → UCM sharp).
- Trade negative-equity distribution (LTV-at-origination × loan-age).
- Event frequency rate (rare default).

---

## 5. Slice plan (tracer-first, thin — see §6 for sign-off)
Sequencing respects dependencies; each slice lands verifiable.

1. **`askingPrice` → close anchor** (Pillar 2). Smallest real change; makes events honest. Tracer: a priced car transacts at its ask (minus earned discount).
2. **Delete dead HandPlay event** (low-risk cleanup).
3. **Unified demand model — read side** (Pillar 3): one elasticity model behind `daysToSell`; screen stops lying (still no arrival effect yet).
4. **Price → arrivals** (Pillars 1+4, the boundary reopen): segment heat × posture drives FloorSim volume.
5. **Vehicle-type heat map** producer + surface (Pillar 1): personas demote to negotiation traits.
6. **Discount event rework** on `askingPrice` (clean buy/walk).
7. **Trade event** negative-equity distribution + honest presentation.
8. **Intel/automation tiering** (Pillar 5): coarse T1 → UCM-sharp + auto-pricing policy at T3.
9. **Calibration pass** (frequency, elasticity, heat drift).

---

## 6. Open calibration knobs (deferred to balance, not design)
Elasticity steepness, heat volatility/drift rate, event frequency, negative-equity tail weight, intel-precision deltas per staff level, auto-pricing policy aggressiveness.

## 7. Reopened locked-record boundaries (the §0 "pricing never touched arrivals" reversal)

Three locked records stated that pricing/marketing/strategy never reach the arrival path. The spine reverses that — pricing is the **primary** demand lever — but **without widening any locked interface**. Pricing enters as a *demand input*, never as a new term in FloorSim or a new field on `DemandContext`.

**Seam of record:** price posture rides the existing locked #125 `pricing.trafficMultiplier` composite (the dual-path pricing field that was always reserved for exactly this), composed in the composition root alongside the inventory-depth `demandFactor` (#128a) and the weather rider (#231 S3). `DayLoopController.project()` forwards the single composite to FloorSim's one `demandFactor` scalar (#99 §`DayContext`) — FloorSim's contract is byte-unchanged.

- **FloorSim #99/#103 "macro boundary":** reworded — marketing/pricing/strategy still never enter FloorSim *directly*; they enter only as the projected `demandFactor`. Updated in `FloorSim/CLAUDE.md`.
- **DemandContext #125:** the *shape* is untouched; the *semantics* of `pricing.trafficMultiplier` reopen from flat-stub to real price-elastic input. Updated in `DayLoopController/CLAUDE.md`.
- **DemandShaper persona-mix scope:** gains a `pricing` producer (the empty socket) so price posture can later skew *which segment* walks in (the heat map), distinct from the volume seam above. Updated in `DemandShaper/CLAUDE.md`.

**Ship discipline (S5, #277):** the seam is wired at **identity** — `computePricingTrafficMultiplier` returns 1 while `demandModel.pricingTrafficWeight = 0`, and `buildPricingInfluence` returns null. Zero behavior change; existing arrival draws stay byte-identical. The calibration slice raises the weight and routes the per-vehicle response through MarketEconomy's shared `demandMultiplier` (#276 / Pillar 3 — one model, two consumers), so the screen's predicted days-to-sell and the floor's actual arrivals read the same curve.

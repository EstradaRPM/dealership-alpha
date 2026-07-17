# Customer-poaching cut (design decision, 2026-07-16)

**Decision:** The customer-poaching mechanic is **cut** from the design. Resolves #187.

Not deferred — removed. It is redundant with systems that already exist and with
one (BDC) that will own its intent properly. Nothing on the T1–T7 ladder needs it
as a distinct mechanic.

## What poaching was

When a customer with the shop-around trait was being worked, a hidden per-day dice
roll (`PoachEngine.checkPoach`, scaled by how much the best-matching competitor
out-scored the player) could hand that customer to a rival and fire `customer:poached`,
removing them from the pool mid-pipeline. It was an early idea that predates the locked
engagement spine.

## Why it was cut

1. **Zero agency at the moment.** The player watched a customer vanish on invisible
   dice — pure subtractive negative feedback, the least-fun kind, with no in-the-moment
   lesson or counter.
2. **Redundant.** "You lose business when your offering/rep is weak" is already expressed
   three ways: the **walk** outcome (SalesProcess), **reputation → customer volume**, and
   **competitive pressure** (competitors drift prices and bend the demand heat map). Poaching
   was a fourth, less-legible restatement of the same idea.
3. **Fought the locked loop.** The engagement spine is the *Reveal* — read demand, match
   inventory, get a scoreline (Dope Wars × Lemonade Stand: you vs. the market, not you vs.
   a rival reaching into your showroom to snatch a specific up).
4. **Subsumed forward.** New-car/OEM competition (T4) resolves as walk / softer segment
   demand. **BDC (T5)** is the machine for chasing leads that went cold or leaned to a
   competitor and winning them back — "customer leaned toward a rival" is BDC's natural raw
   material, the opposite end of a poach event. Building `PoachEngine` now would model the
   same thing BDC will own, twice.
5. **Structurally dead anyway** at a fresh game's starting reputation (the finding that
   opened #187): player strength `reviewScore/100 = 0.60` vs. competitor attractiveness
   capping ~0.53 → poach pressure clamped to 0 for every customer until reputation fell
   below ~53.

Per [[sim-depth-not-surface-complexity]]: promote to a surface only what's a *fun decision*.
Poaching was a surfaced event with **no decision**.

## Where competitive loss lives now

- **Walk** (SalesProcess outcome) — you didn't win them.
- **Reputation → volume** — a weak dealer draws fewer / softer ups.
- **CompetitorMarket = the ambient market force** — `competitor:price_changed` feeds
  MarketEconomy's demand fuel; `market:competitive_pressure` is a daily rival-roster
  heartbeat for KPI/market-visibility surfaces. (Kept — untouched by this cut.)
- **BDC (T5)** — will own follow-up / win-back of leads that leaned elsewhere.

If the *flavor* ("Rival X got them") is ever wanted, it's a one-line narrative label on a
walk — not an engine.

## What was removed (code)

- Deleted: `src/game/CustomerPool/PoachEngine.ts`, `poachData.ts`,
  `data/poach-config.json`, `tests/CustomerPool.Poach.test.ts`.
- `CustomerPool`: dropped the `brands` / `getPlayerStrength` / `poachConfig` deps, the
  `market:competitive_pressure` subscription, and `runPoachChecks`.
- `createWorld`: dropped the poach wiring passed to `createCustomerPool`.
- `EventBus/events.ts`: removed the `customer:poached` event.
- `Telemetry`: dropped `customer:poached` from `TRACKED_EVENTS`.
- `Composition.competitor.test.ts`: removed the poach reachability test (CompetitorMarket
  wiring + determinism tests retained).

## Not touched (distinct concepts that share the word "poach")

- **Staff-poaching** — `poached_used_car_manager` etc. in `data/staff-archetypes.json` =
  hiring a *rival's manager*. A live, unrelated concept.
- **`DemandContext.outOfMarketReach`** (#125, LOCKED) — a marketing demand-inflow stream
  ("poaching factor reaching out-of-market buyers"), not the customer-snatch. Untouched.

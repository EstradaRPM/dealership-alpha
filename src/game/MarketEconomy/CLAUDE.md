# MarketEconomy

Peer to `Economy/` (a money ledger). MarketEconomy owns the *valuation* surface
— anchor, comps, personality, shocks, providers, news. v1 slices #155/#156/#157
ship the skeleton + closed-form anchor + per-save personality + comp-history
rolling window. Subsequent slices (#158–#181) bolt onto the same factory.

Design record: issue **#182** (locked). Read that before working any slice.

## Public API (`index.ts`)

- `createMarketEconomy(deps?)` → `MarketEconomy`. Extends `LiveProviders` +
  exposes `personality`, `compHistory` (snapshot/restore/segmentDrift),
  `shocks`, a bundled `snapshot/restore` (#191), and `dispose()`. Pass `bus` +
  `getCurrentDay` to wire the comp-history subscriptions (#157); omit both for
  the pure-engine path used by the #94 calibration test and fixtures.
- `marketEconomy.snapshot()` → `MarketEconomySnapshot = { schemaVersion,
  compHistory, shocks }` (#191). Bundles the two emergent accumulators for the
  #186 world seam; `personality` is seed-derived so it's deliberately not
  persisted (a same-seed restore reproduces it). `restore` fans both back out.
- `createProviders(deps?)` → `LiveProviders` = `{ bookValueFn, marketPriceFn, vehicleCostFn }`.
  These match SalesProcess seam shapes (`BookValueFn`, `MarketPriceFn`,
  `VehicleCostFn`) and slot into `StaffDispatch.salesProcessDeps` /
  `CloseDeps` / `PickVehicleDeps`. Accepts an optional `segmentHeatFn`
  override — the MarketEconomy factory passes the live composer (#157).
- `marketEconomy.predictDaysToSell(vehicle, askingPrice)` → `{ expectedDays, confidence }`
  (slice #174). Resolves marketPrice + segment heat + live comp count from
  current state, then delegates to the pure `predictDaysToSell` engine. Reads
  optional `vehicle.daysOnLot`. Deterministic. The real-time pricing screen
  (#175) consumes it.
- `computeAnchor(vehicle, deps?)` — pure, deterministic, no RNG.
- `demandMultiplier(input, deps?)` — **the ONE price-elasticity demand model**
  (slice #276, Pricing/Demand spine S4). Pure, deterministic. Given an ask vs.
  the competitor benchmark + segment heat → a relative demand multiplier
  (`1` = at-benchmark neutral-heat baseline, `<1` above market, `>1` below /
  hot). `demandMultiplier = exp(-priceSensitivity[above|below] × pricePosition)
  × exp(heatSensitivity × heat)` — strictly positive, monotonic, asymmetric
  above/below. This is the **shared read-side model** (`pricing-demand-spine.md`
  Pillar 3): `predictDaysToSell` reads it now; FloorSim arrivals (S5/S7) will
  draw from the same function — no duplicate curve. Config:
  `data/demand-elasticity.json`.
- `predictDaysToSell(input, deps?)` — pure engine for the above (slice #174,
  reworked #276). `expectedDays = baseline(segment) / demandMultiplier ×
  agingMult`, clamped; the price/heat response is no longer local — it delegates
  to the shared `demandMultiplier`. Tuned so at-market → baseline, +20% → ~4×,
  −10% → 0.5×. Confidence falls with extrapolation distance (above-market
  weighted heavier) and rises with live comp count. Configs:
  `data/days-to-sell-curves.json` (baselines/aging/bounds/confidence) +
  `data/demand-elasticity.json` (the shared elasticity curve).
- Pricing-suggestion engine (#154, folded into #175) — pure, deterministic,
  no live state:
  - `suggestListPrice({ bookValue, marketPrice, strategy }, deps?)` →
    `{ suggestedPrice, floor, marketTarget, floored }`. The strategy's market
    posture (`market × marketAggression`) sets the target; the gross floor
    (`book × (1 + targetMarkupPct)`) is the minimum, so even a Value posture
    never lists below cost-plus-target. Unknown strategy id falls back to the
    config default.
  - `classifyPricePosition(ask, marketPrice, deps?)` → `PricePosition`
    (`fire-sale | below-market | at-market | above-market | wishful`) via the
    configured ask/market ratio bands.
  - `deriveCompetitorComps(marketPrice, competitors, deps?)` → comparable
    asking prices, mapping each competitor's `[0,1]` pricing lean onto a
    `±competitorSpread` band around market. Takes a narrow structural
    competitor input so MarketEconomy stays decoupled from CompetitorMarket.
  - Config: `data/pricing-strategies.json` (`loadPricingStrategiesConfig`).
- `createCompHistory(deps?)` — rolling-window comp store with snapshot/restore.
- `createSegmentHeat(deps)` — composer for `personality + drift + shock`.
- Five typed loaders + Zod schemas under `./schemas.ts`.

## Engine (slices #155, #156)

```
anchor(v)      = baseAnchor(template OR (category × brandTier) fallback)
                 × yearCurve(yearAge, curveType)
                 × mileageCurve(mileage, curveType)    -- #156
                 × conditionMod(condition)

bookValue(v)   = anchor(v) × (1 + segmentHeat(v))
marketPrice(v) = round(bookValue(v) × markup(category, brandTier))
vehicleCost(v) = v.purchasePrice + v.reconCost          -- design-locked unchanged
```

`segmentHeat(v) = personalityBias(category) + segmentDrift(category, currentDay) + activeShockMod(...)`.
Slice #156 lit up the personality term, #157 the comp-history drift term, #159
the shock term via `shocks.ts` (active only when both `bus` and `masterSeed`
are wired). Drift is the damped
weighted mean of stored deltas `(realizedPrice / referenceValue) - 1` —
wholesale comps use `anchor(v)` as reference, retail comps use `anchor(v) ×
markup`. Cold start (empty window) → drift=0, the engine reduces to the
slice-#156 personality world. Omitting `masterSeed` *and* `bus` from
`createMarketEconomy` produces the fully-neutral world (segmentHeat=0) — the
path used by the #94 calibration test and the static-stub fixtures.

## Provider input contract

The seam signatures live in `SalesProcess/seams.ts` and declare
`PricedVehicleInput` (purchasePrice + reconCost). The *live* providers read a
richer shape — `MarketVehicleInput` = `PricedVehicleInput & AnchorVehicleInput`
(adds templateId, make, year, category, condition).

**Runtime contract:** the composition root only wires the live providers
where a richer vehicle is guaranteed (currently `StaffFloorDrain`, where the
input is always a `LotVehicle`). Call sites that only carry the narrow
`PricedVehicleInput` (e.g. `CustomerPool`'s `STUB_PRICED_VEHICLE`, the #94
calibration test) route through the static stubs in `SalesProcess/seams.ts`
— do not point them at the live providers. Static stubs remain as the test /
fallback path per slice #155 AC.

## Events

- **Consumes** (slice #157): `inventory:vehicle_purchased` → wholesale comp;
  `inventory:vehicle_sold` → retail comp. Both events carry a vehicle
  snapshot (templateId/make/year/mileage/condition/category) so MarketEconomy
  re-computes the anchor without depending on Inventory internals.
- **Consumes** (slice #158): `competitor:price_changed` → one synthetic comp
  per segment with non-zero brand affinity. Delta = `(newPricing − oldPricing)
  × marketEconomy.competitorInfluence`; entry weight scales by affinity
  (high-affinity segments carry more weight in the drift mean).
- **Consumes** (slice #159): `clock:day_started` → shock scheduler tick
  (resolve expired, then maybe activate a new shock via a single
  arrival-prob roll seeded by `(masterSeed, day)`).
- **Emits** (slice #159): `market:shock_started` on activation,
  `market:shock_resolved` on expiration. Both carry `instanceId =
  ${shockId}@${startDay}` so multiple activations of the same catalog shock
  are disambiguable. `#176` will land `market:news_published`.

## Data files

- `data/market-anchor.json` — per-template hand-tuned anchors.
- `data/market-segment-fallback.json` — `(category × brandTier) → fallback` for
  templates not in the per-template table.
- `data/market-depreciation-curves.json` — per-`curveType` year + mileage
  curve shapes (linear with floor for both axes; richer shapes possible
  later). `referenceMileage` is the mileage-curve break point — at or below
  it the multiplier is 1.
- `data/market-condition-mods.json` — `condition → multiplier`.
- `data/market-markup.json` — `(category × brandTier) → retail markup`.
- `data/market-personality-distribution.json` — per-segment bias bounds the
  per-save personality vector samples from (#156).
- `data/mileage-distribution.json` — year-conditioned mileage distribution
  consumed by the auction generator (#156).
- `data/market-shocks.json` — stochastic shock catalog (#159). Each shock
  carries per-segment signed magnitude bands + a duration band + a rarity
  weight used by the scheduler's weighted pick.
- `data/auction-sources.json` — auction source catalog (#160). Each save
  rolls a hidden reliability per source from the catalog band via
  `rollAuctionSourceReliability(masterSeed)`; the auction generator picks a
  source per listing and draws the motivated-seller multiplier with stdev
  lerped from `stdevHonest` (most reliable) to `stdevUnreliable`, then clipped
  to `[floor, ceiling]`. Tunables live under `marketEconomy.motivatedSeller`.

- `data/recon-variance.json` — tail-shape parameters for the hidden-lemon
  variance roll (#162). Bucket probabilities (within/minor/major/catastrophic)
  reshape by `condition × source-reliability-band × mileage-extreme`; the
  realized recon cost is `estimate × bucketMultiplier`. The catalog also
  carries `surpriseThreshold` (when sunk recon trips this multiple of estimate,
  a surprise event fires) and `reconDaysByCondition` (how the daily-spend
  cadence amortizes the realized total).
- `data/recon-surprise-events.json` — surprise event templates keyed by tail
  bucket (#162). The sampler picks one when a tail-bucket vehicle crosses the
  surprise threshold mid-recon.
- `data/days-to-sell-curves.json` — per-segment baseline days + aging shape +
  bounds + confidence params for the #174 predictor. The price/heat response
  moved to `data/demand-elasticity.json` (#276) so the days-to-sell consumer and
  the FloorSim-arrival consumer share one curve.
- `data/demand-elasticity.json` — the shared price-elasticity curve (#276):
  `priceSensitivity.above`/`below` (kept separate so #180 can tune the
  above-market bite vs below-market lift asymmetry) + `heatSensitivity`.
- `data/pricing-strategies.json` — list-price strategy postures
  (`marketAggression` + `targetMarkupPct` per strategy), the default strategy,
  the position-indicator ratio bands, and the competitor-comparable spread for
  the #154/#175 pricing screen.

Tuning of all five is deliberately neutral so the static-stub midpoint
(`(purchase + recon) × 1.25`) and the live providers produce comparable
outputs at the population midpoint — the slice #155 AC is the `#94`
calibration test passing unchanged. Hard calibration is slice #180.

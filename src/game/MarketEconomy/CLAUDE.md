# MarketEconomy

Peer to `Economy/` (a money ledger). MarketEconomy owns the *valuation* surface
— anchor, comps, personality, shocks, providers, news. v1 slice #155 is the
skeleton: closed-form anchor + three live providers + segmentHeat=0
placeholder. Subsequent slices (#157–#181) bolt onto the same factory.

Design record: issue **#182** (locked). Read that before working any slice.

## Public API (`index.ts`)

- `createMarketEconomy(deps?)` → `MarketEconomy`. Currently extends
  `LiveProviders` (the three composed seam fns); future slices add the news
  subscription + segment-heat read.
- `createProviders(deps?)` → `LiveProviders` = `{ bookValueFn, marketPriceFn, vehicleCostFn }`.
  These match SalesProcess seam shapes (`BookValueFn`, `MarketPriceFn`,
  `VehicleCostFn`) and slot into `StaffDispatch.salesProcessDeps` /
  `CloseDeps` / `PickVehicleDeps`.
- `computeAnchor(vehicle, deps?)` — pure, deterministic, no RNG.
- Five typed loaders + Zod schemas under `./schemas.ts`.

## Engine (slice #155)

```
anchor(v)      = baseAnchor(template OR (category × brandTier) fallback)
                 × yearCurve(yearAge, curveType)
                 × conditionMod(condition)

bookValue(v)   = anchor(v) × (1 + segmentHeat(...))    -- heat=0 in #155, live in #157
marketPrice(v) = round(bookValue(v) × markup(category, brandTier))
vehicleCost(v) = v.purchasePrice + v.reconCost          -- design-locked unchanged
```

Mileage is reserved for slice #156 (it enters the anchor formula then).
Segment heat is a `0` placeholder; the comp-history + shock-scheduler
composer lands in #157–#159.

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

None (slice #155). #176 lands the news engine + `market:news_published`,
#157 lands `market:shock_started/resolved` via `shocks.ts`.

## Data files

- `data/market-anchor.json` — per-template hand-tuned anchors.
- `data/market-segment-fallback.json` — `(category × brandTier) → fallback` for
  templates not in the per-template table.
- `data/market-depreciation-curves.json` — year-age curve shape per
  `curveType` (linear with floor in #155; richer shapes possible later).
- `data/market-condition-mods.json` — `condition → multiplier`.
- `data/market-markup.json` — `(category × brandTier) → retail markup`.

Tuning of all five is deliberately neutral so the static-stub midpoint
(`(purchase + recon) × 1.25`) and the live providers produce comparable
outputs at the population midpoint — the slice #155 AC is the `#94`
calibration test passing unchanged. Hard calibration is slice #180.

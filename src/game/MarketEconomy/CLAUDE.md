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

`segmentHeat(v)` returns the per-save personality bias for `v.category` (slice
#156). The comp-history + shock-scheduler terms layer on top in #157–#159.
Omitting `masterSeed` from `createMarketEconomy` produces the neutral world
(personality vector = empty, segmentHeat = 0) — the path used by the #94
calibration test and the static-stub fixtures.

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

Tuning of all five is deliberately neutral so the static-stub midpoint
(`(purchase + recon) × 1.25`) and the live providers produce comparable
outputs at the population midpoint — the slice #155 AC is the `#94`
calibration test passing unchanged. Hard calibration is slice #180.

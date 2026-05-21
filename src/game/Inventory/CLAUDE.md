# Inventory

Lot vehicles + the auction generator that supplies them. Owns purchase/sale of vehicles and posts the money flows through `Economy` via events.

## Public API (`index.ts`)
- `createInventory()` → `Inventory`.
- `loadVehicleData` — reads `data/vehicles.json`.
- Types: `Inventory`, `InventoryDeps`, `AuctionListing`, `LotVehicle`, `VehicleCondition`, `VehicleCategory`.

## Events
- **Emits:** `inventory:vehicle_purchased`, `inventory:vehicle_sold`.
- **Consumes:**
  - `clock:managerial_prep` (#136) — night-before signal for the upcoming
    day. The auction board for Day N is generated here so the player browses
    the day they're about to play; cars bought during this prep window are
    tagged `arrivalDay = N` and are on the lot when Day N opens.
  - `clock:day_started` — morning-of safety net (idempotent vs. the prep
    pass via an internal `lastPreparedDay` guard), kept so bare GameClock
    harnesses + tests still see listings appear.

## Data
- `data/vehicles.json` — base catalog (model definitions, MSRP, segment).
- `data/brands.json`, `data/brand-market-share.json` — used by the auction generator for realistic spread.

## Pricing (#120)
- Every `LotVehicle` carries `suggestedRetail` + `askingPrice`. v1 has no
  market engine, so `suggestedRetail` is a flat cost-basis placeholder
  (`purchasePrice + reconCost`) and `askingPrice` defaults to it.
- `setAskingPrice(vehicleId, price)` is the MANAGERIAL Pricing-lever sink
  (clamps `<0`→0, rounds, unknown id = no-op).
- Deep DealEngine consumption of `askingPrice` is a downstream slice; the
  future simulated retail-value engine replaces the `suggestedRetail`
  expression only — no consumer or lever changes.

## Auction volume (#129)
- `auctionConfig.minListings`/`maxListings` = steady-state daily board size.
- Optional `auctionConfig.earlyGame { throughDay, minListings, maxListings }`
  overrides volume while `day <= throughDay` so opening days present a
  viable bootstrap board instead of an RNG-gated trickle. Omit the block
  for flat volume.

## Auction price formula (#160)
- `listingPrice = computeAnchor(vehicle) × motivatedSellerMultiplier`. The
  multiplier is drawn per-listing seeded by `(masterSeed, day, index)`; its
  stdev is determined by the per-save reliability of the listing's source
  (honest sources cluster tightly around book, fringe lanes throw wide tails).
- `AuctionListing.sourceId` carries the source for that listing. Sources
  live in `data/auction-sources.json`; per-save reliability is rolled from
  `masterSeed` and never persisted (the seed + catalog are the canonical
  artifact, same pattern as the #156 personality vector).
- The legacy `conditionTier.priceMultiplier` in `data/vehicles.json` is no
  longer used by the price chain — the condition adjustment lives inside
  `computeAnchor` via `data/market-condition-mods.json`. The field stays in
  the schema because `conditionTier.reconCost` is still load-bearing.

## Recon process (#162)
- Vehicles enter `reconStatus='in_progress'` on purchase. The auction-listed
  recon estimate is preserved as `reconEstimate`; the realized cost is rolled
  via `MarketEconomy.rollRecon` at acquisition (deterministic from
  `(masterSeed, vehicleId)`) and stored as `reconRealizedCost` (hidden by
  convention).
- `reconCost` on `LotVehicle` is the *running sunk cost* (starts at 0, grows
  daily during recon; final on `complete`; frozen on `abandoned`). DealEngine's
  `frontGross = agreedPrice − purchasePrice − reconCost` consumes the sunk
  total.
- `clock:day_started` / `clock:managerial_prep` advance recon: each tick
  spends `realizedCost / reconDaysTotal` (rounded). When sunk crosses
  `reconEstimate × surpriseThreshold` for tail-bucket vehicles, recon pauses
  (`paused_for_decision`) and `inventory:recon_surprise` fires with a reason
  picked from `data/recon-surprise-events.json` keyed by bucket.
- Player API: `authorizeReconSpend(vehicleId)` resumes recon;
  `abandonRecon(vehicleId)` wholesale-dumps the unit at
  `bookValueFn(v) − reconCost` (the AC's "current book − reconCostToDate"),
  posts revenue, and emits `inventory:vehicle_sold`.
- `bookValueFn` is an optional dep; the default mirror is
  `purchasePrice + reconCost` (the static stub shape).

## Notes
- The auction generator is intentionally simple in v1 (random draw weighted by brand share). It is exposed via interface so a v2 replacement drops in cleanly.

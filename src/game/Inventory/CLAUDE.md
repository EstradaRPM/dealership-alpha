# Inventory

Lot vehicles + the auction generator that supplies them. Owns purchase/sale of vehicles and posts the money flows through `Economy` via events.

## Public API (`index.ts`)
- `createInventory()` → `Inventory`.
- `loadVehicleData` — reads `data/vehicles.json`.
- Types: `Inventory`, `InventoryDeps`, `AuctionListing`, `LotVehicle`, `VehicleCondition`, `VehicleCategory`.

## Events
- **Emits:** `inventory:vehicle_purchased`, `inventory:vehicle_sold`.
- **Consumes:** `clock:overnight_inventory_arrival` (resolve pending auction wins onto the lot).

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

## Notes
- The auction generator is intentionally simple in v1 (random draw weighted by brand share). It is exposed via interface so a v2 replacement drops in cleanly.

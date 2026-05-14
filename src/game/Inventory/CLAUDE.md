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

## Notes
- The auction generator is intentionally simple in v1 (random draw weighted by brand share). It is exposed via interface so a v2 replacement drops in cleanly.

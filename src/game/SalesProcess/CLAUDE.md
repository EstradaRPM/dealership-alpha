# SalesProcess

Pure evaluator deep module for skill-driven customer resolution (PRD #85). **No EventBus participation** (mirrors `NPC` — a pure library). Not implemented yet.

## Status

Slices #86–#87 landed. #86: versioned tunable data files + typed schemas/loaders. #87: the pure `vehicleSpaced` accessor. Still **inert** — no EventBus, no runtime consumers. The evaluator, seam interfaces, and `CustomerPool` rewiring land in later #85 slices.

## Public API (`index.ts`)

Data loaders + schemas only (this slice):

- `loadSalesProcessConfig` — `data/sales-process.json` (gate list, RNG band, walk floors, quadrant-close thresholds, price-formation weights, calibration bands). Type `SalesProcessConfig`.
- `loadVehicleSpacedConfig` — `data/vehicle-spaced.json` (SPACED category base vectors + per-template modifier overrides). Type `VehicleSpacedConfig`.
- `loadBrandTiersConfig` — `data/brand-tiers.json` (make → tier; tier → SPACED modifier delta). Type `BrandTiersConfig`.
- `loadCustomerNonnegotiablesConfig` — `data/customer-nonnegotiables.json` (1–2 nonnegotiable count distribution + want/pass split for remaining SPACED axes; per-visit-archetype bias). Type `CustomerNonnegotiablesConfig`.
- Matching `*Schema` Zod exports for each.

All loaders use the shared `parseData` typed-schema pattern; no `JSON.parse + as` shortcuts.

Accessor (#87):

- `vehicleSpaced(vehicle, deps?)` → `SpacedVector`. Pure. Resolves SPACED in four layers: category base → per-template override (replace named axes; unknown template inherits the base) → brand-tier additive modifier (make → tier; unknown make = no modifier) → deterministic bounded year modifier (`(year − referenceYear)` × per-axis delta, each clamped to ±`maxAbs`), then every axis clamped to [0,1]. `deps` lets tests inject configs; defaults to the bundled loaders. Input is the narrow structural `SpacedVehicleInput` (`category/templateId/make/year`) — Inventory's `LotVehicle`/`AuctionListing` satisfy it without a module dependency.

## Data

- `data/sales-process.json`, `data/vehicle-spaced.json`, `data/brand-tiers.json`, `data/customer-nonnegotiables.json`.
- `customer-nonnegotiables.json` is an additive sidecar extending person/visit archetype shape (SPACED.md line 24) without mutating NPC's existing strict archetype schemas.
- Values transcribed from the design-locked #85 PRD; unspecified weights are neutral calibration starting points (tuning, not design — see PRD user story 19).

## Events

None (pure module).

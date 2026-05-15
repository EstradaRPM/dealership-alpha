# SalesProcess

Pure evaluator deep module for skill-driven customer resolution (PRD #85). **No EventBus participation** (mirrors `NPC` — a pure library). Not implemented yet.

## Status

Slice #86 only: the versioned tunable data files + typed schemas/loaders. **Inert** — files load and validate; no runtime consumers. The evaluator, seam interfaces, and `CustomerPool` rewiring land in later #85 slices.

## Public API (`index.ts`)

Data loaders + schemas only (this slice):

- `loadSalesProcessConfig` — `data/sales-process.json` (gate list, RNG band, walk floors, quadrant-close thresholds, price-formation weights, calibration bands). Type `SalesProcessConfig`.
- `loadVehicleSpacedConfig` — `data/vehicle-spaced.json` (SPACED category base vectors + per-template modifier overrides). Type `VehicleSpacedConfig`.
- `loadBrandTiersConfig` — `data/brand-tiers.json` (make → tier; tier → SPACED modifier delta). Type `BrandTiersConfig`.
- `loadCustomerNonnegotiablesConfig` — `data/customer-nonnegotiables.json` (1–2 nonnegotiable count distribution + want/pass split for remaining SPACED axes; per-visit-archetype bias). Type `CustomerNonnegotiablesConfig`.
- Matching `*Schema` Zod exports for each.

All loaders use the shared `parseData` typed-schema pattern; no `JSON.parse + as` shortcuts.

## Data

- `data/sales-process.json`, `data/vehicle-spaced.json`, `data/brand-tiers.json`, `data/customer-nonnegotiables.json`.
- `customer-nonnegotiables.json` is an additive sidecar extending person/visit archetype shape (SPACED.md line 24) without mutating NPC's existing strict archetype schemas.
- Values transcribed from the design-locked #85 PRD; unspecified weights are neutral calibration starting points (tuning, not design — see PRD user story 19).

## Events

None (pure module).

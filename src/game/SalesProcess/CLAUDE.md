# SalesProcess

Pure evaluator deep module for skill-driven customer resolution (PRD #85). **No EventBus participation** (mirrors `NPC` — a pure library).

## Status

Slices #86–#88 landed. #86: versioned tunable data files + typed schemas/loaders. #87: the pure `vehicleSpaced` accessor. #88: the seeded gate-quality engine, two-meter roll-up, and the four injected seam interfaces with v1 stubs. Still **inert** — no EventBus, no runtime consumers. Nonnegotiable gating (#89), quadrant close + price formation (#90), and `CustomerPool` rewiring (#91) extend this spine in later slices.

## Public API (`index.ts`)

Data loaders + schemas only (this slice):

- `loadSalesProcessConfig` — `data/sales-process.json` (gate list, RNG band, walk floors, quadrant-close thresholds, price-formation weights, calibration bands). Type `SalesProcessConfig`.
- `loadVehicleSpacedConfig` — `data/vehicle-spaced.json` (SPACED category base vectors + per-template modifier overrides). Type `VehicleSpacedConfig`.
- `loadBrandTiersConfig` — `data/brand-tiers.json` (make → tier; tier → SPACED modifier delta). Type `BrandTiersConfig`.
- `loadCustomerNonnegotiablesConfig` — `data/customer-nonnegotiables.json` (1–2 nonnegotiable count distribution + want/pass split for remaining SPACED axes; per-visit-archetype bias). Type `CustomerNonnegotiablesConfig`.
- Matching `*Schema` Zod exports for each.

All loaders use the shared `parseData` typed-schema pattern; no `JSON.parse + as` shortcuts.

Seams (#88) — four injected interfaces, v1 static stubs (PRD decisions 2, 7, 8):

- `SalespersonSkill.skillFor(gate) → GateSkill {effectiveness, trustworthiness}`. Ships `GREEN_SALESPERSON` (hardcoded green profile) + `makeSalespersonProfile(overrides, base?)` (admin-console override path; unit-clamped). StaffOrg wiring is a follow-on.
- `vehicleSpaced` (#87) is the 2nd seam.
- `staticMarketPrice` / `staticVehicleCost` (`MarketPriceFn`/`VehicleCostFn` over `PricedVehicleInput`) — trivial cost-plus stubs; the dynamic economy is a follow-on.

Evaluator (#88) — pure, input-source-agnostic:

- `evaluateGate(input, deps?) → GateEvaluation` — per-gate `q = clamp(deterministicCore(effectiveness, fit, difficulty) + boundedJitter)`. Jitter from a per-`(customerId, gate, day)` seed under `rng.seedNamespace`; deterministic for a fixed seed.
- `accumulateMeters(evaluations, deps?) → MeterState` — Trust/Integrity + Value weighted-mean roll-up (`data/sales-process.json` `meters` block). Trust additionally scaled by rep trustworthiness. Order-independent, both meters ∈ [0,1].
- `evaluateSalesProcess(input, deps?) → SalesProcessResult` — runs every configured gate + rolls up meters. No walk model / close / price (later slices).
- `deps.config` injects a `SalesProcessConfig` for tests; defaults to the bundled loader.

Accessor (#87):

- `vehicleSpaced(vehicle, deps?)` → `SpacedVector`. Pure. Resolves SPACED in four layers: category base → per-template override (replace named axes; unknown template inherits the base) → brand-tier additive modifier (make → tier; unknown make = no modifier) → deterministic bounded year modifier (`(year − referenceYear)` × per-axis delta, each clamped to ±`maxAbs`), then every axis clamped to [0,1]. `deps` lets tests inject configs; defaults to the bundled loaders. Input is the narrow structural `SpacedVehicleInput` (`category/templateId/make/year`) — Inventory's `LotVehicle`/`AuctionListing` satisfy it without a module dependency.

## Data

- `data/sales-process.json`, `data/vehicle-spaced.json`, `data/brand-tiers.json`, `data/customer-nonnegotiables.json`.
- `customer-nonnegotiables.json` is an additive sidecar extending person/visit archetype shape (SPACED.md line 24) without mutating NPC's existing strict archetype schemas.
- Values transcribed from the design-locked #85 PRD; unspecified weights are neutral calibration starting points (tuning, not design — see PRD user story 19).

## Events

None (pure module).

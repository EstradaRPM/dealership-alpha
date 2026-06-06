# SalesProcess

Pure evaluator deep module for skill-driven customer resolution (PRD #85). **No EventBus participation** (mirrors `NPC` — a pure library).

## Status

Slices #86–#94 landed. #86: versioned tunable data files + typed schemas/loaders. #87: the pure `vehicleSpaced` accessor. #88: the seeded gate-quality engine, two-meter roll-up, and the four injected seam interfaces with v1 stubs. #89: nonnegotiable gating — seeded axis classification, skill-gated QUALIFY reveal, and the named walk model (patience-drain / trust-collapse / DEMO hard-fail). #90: quadrant close model + price formation (`closeAndPrice`). **#91 landed** — `CustomerPool` now drives resolution through `resolveSalesProcess` + `closeAndPrice`. **#94 landed** — HITL calibration distribution test (`tests/SalesProcess.calibration.test.ts`): 600 seeded NPC-archetype customers through the full S1→S6 chain under a competent (0.75/0.75) staff profile, asserting the PRD bands (≥85% positive / 10–12% apathetic / 3–5% negative-but-deal / warm-walk-dominant). Realized: 85.5% / 11.0% / 3.5% / 100% warm. Calibration was pure `data/sales-process.json` tuning (jitterBand, core weights, walk.patienceFloor, close thresholds) — no code change. Still no EventBus participation from SalesProcess itself (pure library).

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

Nonnegotiable gating (#89) — pure, deterministic:

- `classifyAxes(input, deps?) → CustomerAxisProfile` — seeded (`customer_pool.nonnegotiables` / `customerId`) split of the six SPACED axes into 1–2 `nonnegotiable` + `want`/`pass`, honoring `data/customer-nonnegotiables.json` count weights and per-visit-archetype bias (PRD decision 4).
- `revealsNonnegotiables(qualifyQ, deps?) → boolean` — skill-gated reveal; `qualifyQ ≥ nonnegotiables.qualifyRevealThreshold` (PRD decision 5). Weak QUALIFY ⇒ blind DEMO.
- `wantAxisFit` / `nonnegotiablesSatisfied` — graded want-axis Value fit; nonnegotiable satisfied within `nonnegotiables.tolerance` below the customer's required level.
- `resolveSalesProcess(input, deps?) → SalesProcessResolution` — runs gates in order, drains patience `(1−q)×archetypeImpatience`, rolls running meters, and applies the named walk model in priority order: DEMO nonneg miss (hard, regardless of charisma) → trust-collapse (meter `< walk.trustCollapseFloor`) → patience-drain (`≤ walk.patienceFloor`). Surviving all gates ⇒ `reached_close` (the close/price decision is #90). Reuses `evaluateGate`/`accumulateMeters`.
- New config block `nonnegotiables { qualifyRevealThreshold, tolerance }` in `data/sales-process.json`.

Quadrant close + price formation (#90):

- `closeAndPrice(input, deps?) → CloseResult` — pure, deterministic (no RNG). Takes `MeterState`, `SalespersonSkill`, `priceSensitivity` (unit-scaled), `vehicle: PricedVehicleInput`, and optional `marketPriceFn`/`vehicleCostFn` seam overrides (defaults to `staticMarketPrice`/`staticVehicleCost`). Computes price formation first, then `objectiveDeal`, then applies the quadrant close rule.
  - **Price formation (PRD decision 12):** `requiredDiscount = base + (1−Value)·valueGapWeight + sensitivity·sensitivityWeight − closingSkill·skillHoldWeight − trust·trustHoldWeight`. `marginFloorPrice = vehicleCost + minGross`. `realizedPrice = clamp(rawPrice, marginFloorPrice, marketPrice + overageAllowed)`. `closeable = rawPrice ≥ marginFloorPrice`. `frontGross = realizedPrice − vehicleCost`.
  - **objectiveDeal (PRD decision 11):** `clamp(Value × (1 − sensitivity × (1 − discountFraction)), 0, 1)` where `discountFraction = clamp((marketPrice − realizedPrice) / marketPrice, 0, 1)`.
  - **Quadrant close rule:** `objectiveDeal ≥ buyThreshold` → buy (trust irrelevant); `objectiveDeal ≥ softThreshold AND trust ≥ trustFloor` → soft buy; otherwise no_close. `closeable=false` blocks all closes.
  - **Low-trust forced close:** `outcome=buy AND unconditional AND trust < trustFloor` → `badReview=true + highFiResistance=true` (signals downstream).
  - `closingComposite` = `skill.skillFor('NEGOTIATE')` — the NEGOTIATE gate skill drives price hold.

Customer→vehicle match-payoff (#199) — `pickVehicleForMatch(customer, lot, deps?) → { vehicleId, matchQuality } | null`. Same argmax pipeline as `pickVehicleFor`; additionally returns the winner's want-axis `fit` ∈ [0,1] as `matchQuality` — the loop's match-payoff signal ("you had what they wanted"), distinct from the composite `score` (which folds price + reputation). `pickVehicleFor` is now a thin id-only wrapper over it. StaffDispatch carries `matchQuality` onto `staff:auto_resolved` (closed); the floor toast + DayRecap tally threshold it (`data/tunables.json` `matchPayoff.strongMatchThreshold`).

Customer→vehicle matcher (#145) — `pickVehicleFor(customer, lot, deps?) → vehicleId | null`. Filters the lot by `isEligible` then `nonnegotiablesSatisfied`, argmax-scores survivors as `wantAxisFit·WANT_WEIGHT − pricePenalty·priceSensitivity + reputationBonus(make)`. Reputation hook is a stub (`() => 0`); real surface is a follow-on. Headroom: cash = `wealth × cashSpendFraction`, finance = `annualIncome`. Pure, deterministic — ties break by ascending `vehicleId` (no RNG). `MatchableVehicle` is `SpacedVehicleInput & PricedVehicleInput & { id }` (Inventory's `LotVehicle` satisfies it structurally); `MatchCustomer` accepts an optional pre-classified `axisProfile` to skip the seeded `classifyAxes` call.

Affordability eligibility (#144) — pure, deterministic helpers for whether a deal can structure:

- `cashEligible(customer, vehicle, marketPriceFn?)` → list price ≤ `wealth × cashSpendFraction`.
- `financeEligible(customer, vehicle, tier, marketPriceFn?, bookValueFn?)` → checks down-gap → PTI → LTV in order; `failReason` ∈ `'down' | 'pti' | 'ltv'` names the FIRST failure. PTI uses `computeMonthlyPayment` from DealEngine against `tier.maxTerm/apr`; LTV compares `loanAmount` to `bookValue × tier.ltvCeiling`.
- `isEligible(customer, vehicle, deps?)` → dispatches on `paymentMethod`; finance requires `deps.tier`.
- Narrow inputs: `AffordabilityCustomer { wealth, annualIncome, paymentMethod, cashSpendFraction?, downPaymentBehavior? }`, `CreditTierPolicy { apr, maxTerm, ptiCap, ltvCeiling }`. Caller assembles from Person/Visit + DealEngine tier.

Accessor (#87):

- `vehicleSpaced(vehicle, deps?)` → `SpacedVector`. Pure. Resolves SPACED in four layers: category base → per-template override (replace named axes; unknown template inherits the base) → brand-tier additive modifier (make → tier; unknown make = no modifier) → deterministic bounded year modifier (`(year − referenceYear)` × per-axis delta, each clamped to ±`maxAbs`), then every axis clamped to [0,1]. `deps` lets tests inject configs; defaults to the bundled loaders. Input is the narrow structural `SpacedVehicleInput` (`category/templateId/make/year`) — Inventory's `LotVehicle`/`AuctionListing` satisfy it without a module dependency.

## Data

- `data/sales-process.json`, `data/vehicle-spaced.json`, `data/brand-tiers.json`, `data/customer-nonnegotiables.json`.
- `customer-nonnegotiables.json` is an additive sidecar extending person/visit archetype shape (SPACED.md line 24) without mutating NPC's existing strict archetype schemas.
- Values transcribed from the design-locked #85 PRD; unspecified weights are neutral calibration starting points (tuning, not design — see PRD user story 19).

## Events

None (pure module).

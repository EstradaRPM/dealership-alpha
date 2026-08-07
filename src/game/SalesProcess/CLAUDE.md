# SalesProcess

Pure evaluator deep module for skill-driven customer resolution (PRD #85). **No EventBus participation** (mirrors `NPC` — a pure library).

## Status

Slices #86–#94 landed. #86: versioned tunable data files + typed schemas/loaders. #87: the pure `vehicleSpaced` accessor. #88: the seeded gate-quality engine, two-meter roll-up, and the four injected seam interfaces with static stubs. #89: nonnegotiable gating — seeded axis classification, skill-gated QUALIFY reveal, and the named walk model (patience-drain / trust-collapse / DEMO hard-fail). #90: quadrant close model + price formation (`closeAndPrice`). **#91 landed** — `CustomerPool` now drives resolution through `resolveSalesProcess` + `closeAndPrice`. **#94 landed** — HITL calibration distribution test (`tests/SalesProcess.calibration.test.ts`): 600 seeded NPC-archetype customers through the full S1→S6 chain under a competent (0.75/0.75) staff profile, asserting the PRD bands (≥85% positive / 10–12% apathetic / 3–5% negative-but-deal / warm-walk-dominant). Calibration was pure `data/sales-process.json` tuning (jitterBand, core weights, walk.patienceFloor, close thresholds) — no code change. **#273/#274 landed** — the Pricing/Demand spine made `askingPrice` the transaction anchor (#273) and replaced the price-formation discount formula with an explicit per-customer reservation-price model (#274, see below); the calibration was re-tuned for the new model (`price.reservationBase`/`valueLift`/`sensitivityDrag` + `close.trustFloor`), realizing 85.7% positive / 10.2% apathetic / 4.2% negative-deal / 100% warm. Still no EventBus participation from SalesProcess itself (pure library).

## Public API (`index.ts`)

Data loaders + schemas only (this slice):

- `loadSalesProcessConfig` — `data/sales-process.json` (gate list, RNG band, walk floors, quadrant-close thresholds, price-formation weights, calibration bands). Type `SalesProcessConfig`.
- `loadVehicleSpacedConfig` — `data/vehicle-spaced.json` (SPACED category base vectors + per-template modifier overrides). Type `VehicleSpacedConfig`.
- `loadBrandTiersConfig` — `data/brand-tiers.json` (opaque brand id → tier via the `brands` map; tier → SPACED modifier delta). Type `BrandTiersConfig`. Vehicles join by their canonical `brand` id, never a make display string (#224).
- `loadCustomerNonnegotiablesConfig` — `data/customer-nonnegotiables.json` (1–2 nonnegotiable count distribution + want/pass split for remaining SPACED axes; per-visit-archetype bias). Type `CustomerNonnegotiablesConfig`.
- Matching `*Schema` Zod exports for each.

All loaders use the shared `parseData` typed-schema pattern; no `JSON.parse + as` shortcuts.

Seams (#88) — four injected interfaces, static stubs (PRD decisions 2, 7, 8):

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
  - **Transaction anchor (#273):** the close forms off the player-set
    `vehicle.askingPrice` (Pricing/Demand spine, Pillar 2). `CloseVehicleInput =
    PricedVehicleInput & { askingPrice? }` — Inventory's `LotVehicle` (required
    ask) satisfies it; narrow seam-stub / #94-calibration callers omit it and
    fall back to the market benchmark, preserving the legacy `book × markup`
    math. `marketPriceFn` is **demoted to a competitor benchmark** (below/above-
    market labeling + comps), surfaced as `priceFormation.marketPrice` — it no
    longer sets what the customer pays. `priceFormation.askingPrice` is the
    resolved anchor.
  - **Reservation-price model (#274, Pricing/Demand spine S2):** the customer's
    max willingness-to-pay is an explicit, deterministic per-customer value:
    `reservationPrice = marketPrice × max(0, reservationBase + Value·valueLift −
    priceSensitivity·sensitivityDrag)` — anchored on the market benchmark (segment
    retail reference), lifted by value built during the visit, dragged down by
    price sensitivity (the wealth proxy). Skill/trust no longer move the price here
    — the salesperson's price work lives in the discount-escalation branch.
    Surfaced as `priceFormation.reservationPrice`.
  - **Price formation (PRD decision 12; reservation model #274):** `requiredDiscount = max(0, askingPrice − reservationPrice)` — never negative (a customer never volunteers above their max). `marginFloorPrice = vehicleCost + minGross`. `rawPrice = askingPrice − requiredDiscount` (= `min(ask, reservation)`). `realizedPrice = clamp(rawPrice, marginFloorPrice, askingPrice + overageAllowed)`. `closeable = rawPrice ≥ marginFloorPrice`. `frontGross = realizedPrice − vehicleCost`. **ask ≤ reservation ⇒ requiredDiscount 0, buys at ask; ask > reservation ⇒ discounts toward the reservation, or (reservation < floor) not closeable ⇒ the discount-escalation branch (#222).**
  - **objectiveDeal (PRD decision 11):** `clamp((1−sensitivity)·Value + sensitivity·priceSatisfaction + framingBoost, 0, 1)` where `priceSatisfaction` = consumer surplus = `clamp((reservationPrice − realizedPrice) / (reservationPrice − marginFloorPrice), 0, 1)` (paying at reservation scores 0, at the floor scores 1) and `framingBoost = closingEffectiveness · sensitivity · framingWeight`.
  - **Quadrant close rule:** `objectiveDeal ≥ buyThreshold` → buy (trust irrelevant); `objectiveDeal ≥ softThreshold AND trust ≥ trustFloor` → soft buy; otherwise no_close. `closeable=false` blocks all closes.
  - **Low-trust forced close:** `outcome=buy AND unconditional AND trust < trustFloor` → `badReview=true + highFiResistance=true` (signals downstream).
  - `closingComposite` = `skill.skillFor('NEGOTIATE')` — the NEGOTIATE gate skill drives price hold.

Residual heat (#180) — `residualHeat({ resolution, bought? }, deps?) → number` ∈ [0,1].
How warm a customer left: how far through the gates they got (a walk stops at its
gate; a customer who reached the close scores a full 1), blended with the two
meters. Weights live in `data/sales-process.json` `heat` and must sum to 1. A
`bought: true` returns 0 — not because the visit went badly, but because there is
nothing left to follow up on. Pure, no RNG.
**This is the ONE definition of the quantity.** It was hand-copied between
`CustomerPool` and the #94 calibration harness before #180 needed a third copy for
the live path; `FollowUpPool` consumes it as "who is worth calling back" and the
live-engine calibration reads it as the warm-walk band. Do not re-derive it at a
call site.

Wanted-category classifier (#321, engagement-spine walk-off reactions) —
`wantedVehicleCategory(customerSpaced, deps?) → 'sedan' | 'truck' | 'suv'`.
Pure/deterministic: nearest `data/vehicle-spaced.json` `categoryBase` vector to
the customer's want-vector by squared Euclidean distance (ties → declaration
order `sedan, truck, suv`). Independent of any matched vehicle — usable on a
`no_sale` where nothing was ever picked (unlike `vehicleCategory`, which names
what a *closed* deal's matched unit was). `deps.vehicleSpacedConfig` overrides
the loader for tests, same pattern as `vehicleSpaced`.

Customer→vehicle match-payoff (#199) — `pickVehicleForMatch(customer, lot, deps?) → { vehicleId, matchQuality } | null`. Same argmax pipeline as `pickVehicleFor`; additionally returns the winner's want-axis `fit` ∈ [0,1] as `matchQuality` — the loop's match-payoff signal ("you had what they wanted"), distinct from the composite `score` (which folds price + reputation). `pickVehicleFor` is now a thin id-only wrapper over it. StaffDispatch carries `matchQuality` onto `staff:auto_resolved` (closed); the floor toast + DayRecap tally threshold it (`data/tunables.json` `matchPayoff.strongMatchThreshold`).

Customer→vehicle matcher (#145) — `pickVehicleFor(customer, lot, deps?) → vehicleId | null`. Filters the lot by `isEligible` then `nonnegotiablesSatisfied`, argmax-scores survivors as `wantAxisFit·WANT_WEIGHT − pricePenalty·priceSensitivity + reputationBonus(make)`. Reputation hook is a stub (`() => 0`); real surface is a follow-on. Headroom: cash = `wealth × cashSpendFraction`, finance = `annualIncome`. Pure, deterministic — ties break by ascending `vehicleId` (no RNG). `MatchableVehicle` is `SpacedVehicleInput & PricedVehicleInput & { id }` (Inventory's `LotVehicle` satisfies it structurally); `MatchCustomer` accepts an optional pre-classified `axisProfile` to skip the seeded `classifyAxes` call.

Affordability eligibility (#144) — pure, deterministic helpers for whether a deal can structure:

- `cashEligible(customer, vehicle, marketPriceFn?)` → list price ≤ `wealth × cashSpendFraction`.
- `financeEligible(customer, vehicle, tier, marketPriceFn?, bookValueFn?)` → checks down-gap → PTI → LTV in order; `failReason` ∈ `'down' | 'pti' | 'ltv'` names the FIRST failure. PTI uses `computeMonthlyPayment` from DealEngine against `tier.maxTerm/apr`; LTV compares `loanAmount` to `bookValue × tier.ltvCeiling`.
- `isEligible(customer, vehicle, deps?)` → dispatches on `paymentMethod`; finance requires `deps.tier`.
- Narrow inputs: `AffordabilityCustomer { wealth, annualIncome, paymentMethod, cashSpendFraction?, downPaymentBehavior? }`, `CreditTierPolicy { apr, maxTerm, ptiCap, ltvCeiling }`. Caller assembles from Person/Visit + DealEngine tier.

Vehicle-attribute accessor + weather tilt (#231 S4):

- `vehicleAttributes(vehicle, deps?) → AttributeVector` — resolves the vehicle's
  attribute axes (`winterCapability` / `openAir` / `fuelEfficiency`) from
  `data/vehicle-spaced.json` `attributeBase` (per category) + `attributeOverrides`
  (per template), clamped to [0,1]. Same `categoryBase`+override pattern as
  `vehicleSpaced`; no brand/year layers (attributes are physical, not perception/
  age). Throws on a category with no attribute base. These are *vehicle* traits,
  distinct from the persona-SPACED axes; weather (not personality) creates the
  demand for them.
- `weatherAttributeBonus(lean, attrs) → number` — `Σ_axis lean[axis]·(attr − 0.5)`.
  Exactly 0 for an empty lean. `pickVehicleForMatch` adds this to the argmax
  `score` (via the optional `PickVehicleDeps.attributeLean`, wired from
  `Weather.attributeLeanForDay`), tilting toward weather-aligned units while
  leaving `matchQuality` (want-axis fit) untouched. `ATTRIBUTE_AXES` /
  `ATTRIBUTE_NEUTRAL` exported for callers. Current inventory carries no convertibles,
  so `openAir` is inert until such a template exists.

Accessor (#87):

- `vehicleSpaced(vehicle, deps?)` → `SpacedVector`. Pure. Resolves SPACED in four layers: category base → per-template override (replace named axes; unknown template inherits the base) → brand-tier additive modifier (brand id → tier; unknown brand = no modifier) → deterministic bounded year modifier (`(year − referenceYear)` × per-axis delta, each clamped to ±`maxAbs`), then every axis clamped to [0,1]. `deps` lets tests inject configs; defaults to the bundled loaders. Input is the narrow structural `SpacedVehicleInput` (`category/templateId/brand/year`) — Inventory's `LotVehicle`/`AuctionListing` satisfy it without a module dependency.

## Data

- `data/sales-process.json`, `data/vehicle-spaced.json`, `data/brand-tiers.json`, `data/customer-nonnegotiables.json`.
- `customer-nonnegotiables.json` is an additive sidecar extending person/visit archetype shape (SPACED.md line 24) without mutating NPC's existing strict archetype schemas.
- Values transcribed from the design-locked #85 PRD; unspecified weights are neutral calibration starting points (tuning, not design — see PRD user story 19).

## Events

None (pure module).

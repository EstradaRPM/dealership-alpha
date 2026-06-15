# Inventory

Lot vehicles + the auction generator that supplies them. Owns purchase/sale of vehicles and posts the money flows through `Economy` via events.

## Public API (`index.ts`)
- `createInventory()` → `Inventory`.
- `loadVehicleData` — reads `data/vehicles.json`.
- Types: `Inventory`, `InventoryDeps`, `AuctionListing`, `LotVehicle`, `VehicleCondition`, `VehicleCategory`.

## Events
- **Emits:** `inventory:vehicle_purchased`, `inventory:vehicle_sold`,
  `inventory:vehicle_acquired_via_trade` (#171),
  `economy:carrying_cost_posted` (#173).
- **Consumes:**
  - `trade:resolved` (#171) — an accepted/countered customer trade materializes
    onto the lot via `acquireFromTrade` (only `accept`/`counter` emit the event;
    declines/abandons never do).
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

## Pricing (#120, #273)
- Every `LotVehicle` carries `suggestedRetail` + `askingPrice`.
- **#273:** `askingPrice` is now the close's transaction anchor
  (`SalesProcess.closeAndPrice` forms `realizedPrice` off it). Intake stamps the
  default `suggestedRetail` (and thus `askingPrice`) from the optional
  `marketPriceFn` dep — the live MarketEconomy market suggestion — so the
  default ask sits at market, not cost. Omit the dep (test harnesses without a
  market engine) to fall back to the cost-basis placeholder
  (`purchasePrice + reconEstimate`). The composition root wires
  `marketEconomy.marketPriceFn`.
- `setAskingPrice(vehicleId, price)` is the MANAGERIAL Pricing-lever sink
  (clamps `<0`→0, rounds, unknown id = no-op).
- **#285 (spine S13) → #289 (channel-desk M2):** the optional `pricingPolicyFn`
  dep is the standing auto-pricing policy — it returns the default `askingPrice`
  an incoming unit is stamped with. The composition root encapsulates the
  strategy posture AND the automation gate. The gate is the top UCM's `pricing`
  skill clearing `tunables.managerGates.actThresholds.pricing` (M2 reframed
  #285's mere UCM-*presence* gate onto the skill threshold via
  `MarketEconomy.isAutoPricingUnlocked`): unlocked ⇒ the strategy's book↔market
  target (`MarketEconomy.resolveIntakeAsk`); locked (no UCM, or pricing below the
  gate) ⇒ the honest market suggestion (`suggestedRetail`). Omit the dep ⇒
  `askingPrice = suggestedRetail` (the pre-S13 default). `setAskingPrice` still
  overrides any unit per the player.

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

## Trade acquisition (#171)
- `acquireFromTrade(acquisition) → LotVehicle` materializes a customer's
  accepted trade-in onto the lot. Driven by the `trade:resolved` subscription;
  exposed for direct/test use. Cost basis = `agreedAllowance`, **non-cash** — no
  Economy expense is posted (the allowance is offset against deal cash in the
  close structure, #169). Emits `inventory:vehicle_acquired_via_trade`; the unit
  is on the lot immediately and then flows through the normal recon →
  carrying-cost → listing → sale path.
- Recon estimate = the condition-tier baseline (`conditionTiers[condition].reconCost`,
  the same budget an auction unit of that condition shows); `conditionReport`
  reuses the same tier's `report`; `trim` is `''` (CurrentVehicle carries none).
- The realized recon is rolled via the shared `buildAcquiredVehicle` helper
  (same machinery as `buyFromAuction`), with the staff condition-read
  **confidence standing in for source reliability** — a confident UCM read
  clusters realized recon near the estimate; an unread trade (no UCM, confidence
  0) throws the same wide lemon tails as a fringe auction lane. So a trade can
  hide a lemon exactly like an auction buy.

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

## Paid inspection (#164)
- `requestInspection(listingId)` pays `tunables.inventory.inspection.cost`
  via Economy, marks the listing `inspectionStatus='pending'`, and stashes it
  in a private `pendingInspections` map so the daily auction-board regen
  doesn't blow it away. `inspectionAvailableDay = currentDay + daysToComplete`.
- `buyFromAuction` throws while the listing is `pending`; once `completed`,
  the unit can be purchased through the same code path as a fresh listing.
- On `clock:managerial_prep` / `clock:day_started` the inspection advances:
  `pending → completed` (rolls the realized recon via `rollRecon` with the
  same `deriveReconSeed(masterSeed, listingId)` namespace `buyFromAuction`
  uses, then publishes a band of `realized ± realized × halfWidthFraction`).
  `completed` listings expire one day later if not purchased.
- `getAuctionListings()` returns the daily board merged with any pending
  inspections so the UI sees one combined view.

## Carrying cost (#173)
- On the daily lot pass (`prepareDay` → `accrueDay`, after each unit's recon
  advances) every lot vehicle accrues one day of floorplan + carrying cost. The
  per-vehicle burn is summed and posted as a single aggregate Economy expense
  via `forceDebit` (NOT `postExpense`) — carrying cost is a non-discretionary
  accrual that legitimately pushes cash negative, which is exactly what
  BankruptcyMonitor watches. `economy:carrying_cost_posted` then fires for
  KPI/UI (fires with 0/0 on an empty-lot day; no expense is posted then).
- Per-vehicle daily burn = `bookValue × apr / 365` (floorplan interest) + flat
  `insurancePerDay` + flat `overheadPerDay` + `reconFadePerDay` (only once recon
  is complete). Pure + rounded in `computeDailyCarryingCost` (exported for
  tests); `bookValue` comes from the same `bookValueFn` the recon-abandon path
  uses.
- Floorplan `apr` is resolved per dealership tier via `floorplanAprForTier`
  (`carrying.aprByTier[tier] ?? baselineApr`) — better tier → cheaper money, a
  diegetic progression reward. The live tier is read through the optional
  `getTier` dep (defaults to tier 1); the composition root passes
  `() => tierManager.currentTier`.
- Each `LotVehicle` carries running `carryingCostToDate`, the latest
  `dailyCarryingCost`, and an `aged` flag (`daysInInventory >
  carrying.agedThresholdDays`) — the lot view (`OwnershipLevers` Pricing card)
  reads all three. Tunables live in `data/tunables.json#inventory.carrying`.

## Persistence (#189)
- `snapshot()/restore()` (barrel-exported `InventorySnapshot`) capture the full
  mutable lot state for save/load: lot vehicles (with their aging clocks +
  accrued `carryingCostToDate`), the live auction board, held (paid) inspection
  listings, and the `currentDay`/`lastPreparedDay` regen guard. Maps are
  flattened to arrays; `LotVehicle`/`AuctionListing` are plain data.
- The per-save auction-source reliability is NOT persisted — it is rolled
  deterministically from `masterSeed`, so the seed + catalog stay the canonical
  artifact (same pattern as the #156 personality vector). Restore rehydrates
  onto a fresh same-seed module without recomputing aging/carrying.
- Wired into `snapshotWorld`/`restoreWorld` under the `inventory` key.

## Notes
- The auction generator is intentionally simple in v1 (random draw weighted by brand share). It is exposed via interface so a v2 replacement drops in cleanly.

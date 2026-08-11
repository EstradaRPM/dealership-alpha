# Inventory

Lot vehicles + the auction generator that supplies them. Owns purchase/sale of vehicles and posts the money flows through `Economy` via events.

## Public API (`index.ts`)
- `createInventory()` → `Inventory`.
- `loadVehicleData` — reads `data/vehicles.json`.
- Types: `Inventory`, `InventoryDeps`, `AuctionListing`, `LotVehicle`, `LotOccupancy`, `WholesaleQuote`, `VehicleCondition`, `VehicleCategory`.

## Events
- **Emits:** `inventory:vehicle_purchased`, `inventory:vehicle_sold`,
  `inventory:vehicle_wholesaled` (#362),
  `inventory:vehicle_acquired_via_trade` (#171),
  `economy:carrying_cost_posted` (#173).
  - `inventory:vehicle_sold` means **a person bought this car**. A wholesale-out
    is not that and does not use it: MarketEconomy records `vehicle_sold` as a
    retail comp and InstalledBase stages it as a future owner's vehicle, and a
    dump at a haircut is neither evidence that retail prices fell nor a customer
    who comes back for service.
  - `inventory:vehicle_sold` carries `powertrain` (#298) — the join seam
    InstalledBase reads. The catalog is ICE-only today, so the sell + recon-
    abandon emits stamp the `DEFAULT_POWERTRAIN` (`'ice'`) constant; EV/hybrid
    templates flow through unchanged when the powertrain axis is modeled.
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

## UCM sourcing auto-fill (#293, channel-desk M6)
- Optional `autoSourceFn(listings) → readonly string[]` dep. Called inside
  `prepareDay` **after** the board is generated + the lot pass, so auto-bought
  units land on the lot for the upcoming day (`arrivalDay = that day`, like a
  manual prep-window buy) and start carrying the next day. It receives the fresh
  board (NOT the paid-inspection holds — those are the player's deliberate picks,
  never auto-bought) and returns the listing ids to buy; Inventory buys each via
  the shared `buyFromAuctionImpl`.
- The **whole decision lives at the composition root** so Inventory stays
  decoupled from StaffOrg/MarketEconomy/DemandShaper: the act gate (top UCM
  `condition_reading` clearing `managerGates.actThresholds.condition_reading`,
  shared with the M4 trade-approve gate), the player's sourcing lean
  (margin/condition/demand-fit), each candidate's book value + demand-fit + cost,
  the cash check, and the M5 off-lean drift. The pure scoring/selection engine is
  `MarketEconomy.selectAutoBuys` / `isSourcingUnlocked`.
- Omit the dep (test harnesses, no UCM) ⇒ no auto-fill; the player buys the board
  by hand. Manual `buyFromAuction` + per-unit `setAskingPrice` always live
  (Pillar 5: delegation is permission, not amputation).

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
  exposed for direct/test use. Cost basis = `agreedAllowance`, and **Inventory
  posts nothing** — `DealEngine.closeDeal` pays for the car, as
  `CloseDealParams.tradeAllowance` (#379). The close is the one place that sees
  both halves of the settlement (the equity credited against the purchase and
  the lien payoff wired out), so a second debit here could only disagree with
  it. **This line used to claim the allowance was "offset against deal cash in
  the close structure (#169)". It was not — that offset did not exist**, so the
  store banked the full selling price and got the trade unit for free on 42% of
  its deals; the wrong sentence is what made the defect invisible. The debit is
  categorized `inventoryAcquisition`, so it moves cash without touching the
  accrual P&L and comes back as the cost-of-sale relief when this unit resells,
  exactly like an auction buy. Emits `inventory:vehicle_acquired_via_trade`; the unit
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

## The lot cap on buying (#361, A2 R2)

- **One number: `getLotOccupancy()` → "31 of 35 spaces."** Every owned
  `LotVehicle` takes one space, **prep included**. There is no off-lot state in
  the model and none was invented: recon is a cost, not a place, and the #295
  frontline hold only governs whether walk-ins can be *shown* the car. A car in
  prep sits on your lot costing you money either way.
- Built spaces come from the optional `getBuiltLotSpaces: () => number` dep,
  wired at the composition root to `facility.getBuilt().lotSpaces` — the same
  one-capacity-truth the department lines take their bay count from. It is read
  **live**, so a finished construction job reopens buying by itself with no
  further player action. Omit the dep (test harnesses without a Facility) ⇒ an
  uncapped lot, the pre-#361 behavior.
- **Checked at the bid**, so units already won count: `buyFromAuction` throws
  when there is no space, and a refusal changes nothing (no cash moves, the
  listing stays on the board). The UCM's `autoSourceFn` pass **stops** at the
  cap instead of throwing — a full lot is a normal morning, not a programming
  error — which is what makes "you cannot win six cars into four spaces" true
  for the desk as well as the player.
- **A trade always lands.** `acquireFromTrade` never checks the cap: it is part
  of a sale already made, and refusing it would unwind a closed deal. It may put
  the lot at 36 of 35; buying is then frozen until occupancy is back **under**
  the cap (at 35 of 35 it is still frozen). Self-correcting by construction —
  the deal that brings a trade in also takes a car out.
- Five alternatives were considered and rejected in A2 R2 and must not be
  reopened: forced wholesale on overrun, an overflow lot, refusing the trade at
  the cap, a soft cap with an overflow fee, and prep-as-its-own-capacity.
- Surfaces: `src/ui/LotRoom` (`lot-occupancy`) and `src/ui/AuctionMenu`
  (`auction-lot-occupancy`, plus the `auction-bidding-closed` banner and a
  disabled "No Spaces Open" buy button). Both take the number straight off
  `getLotOccupancy()` and never count their own list.

## The wholesale release valve (#362, A2 R2)

- **`getWholesaleQuote(id)` → `{ bookValue, proceeds, costBasis, gain }`, and
  `wholesaleVehicle(id)` commits it.** One rule for the price:
  `proceeds = bookValueFn(v) × (1 − wholesale.haircutPct)`, rounded, floored at
  0. Off **book**, never off `askingPrice` — the ask is what you hope a retail
  customer pays; a wholesale buyer is buying to resell and prices off book,
  which is exactly why the valve realizes a loss instead of being a free undo.
- **Available for ANY owned unit.** No gate on `reconStatus` and none on the
  #295 frontline hold: those describe a car that is already sitting on your lot
  burning money, and the units you most want to dump are the ones you regret.
  One rule, no second ceiling to learn.
- **`getWholesaleQuote` is a pure read** — nothing leaves the lot and no money
  moves until `wholesaleVehicle`. That is what lets the Lot room state the
  proceeds and the loss *before* the player commits. Unknown id: `undefined`
  from the quote, throws from the commit (the surface only passes ids it just
  read off `getLotVehicles`).
- **Both wholesale-outs leave by the same door.** The private `wholesaleOut`
  helper posts the revenue, removes the unit and publishes
  `inventory:vehicle_wholesaled` — for this valve (`reason: 'released'`) and for
  the #162 recon abandon (`reason: 'recon_abandoned'`) alike, so the event means
  one thing regardless of which function called it. They differ only in what the
  buyer pays: the abandon path keeps #162's `book − reconSpentToDate` (a car
  with its guts on the floor is worth less than a finished one).
- The freed space reopens buying by itself — `buyFromAuction` reads occupancy
  live, so nothing else has to happen.
- Config: `data/tunables.json#inventory.wholesale.haircutPct` (magnitude is a
  C2/#286 calibration placeholder). Surface: `src/ui/LotRoom` — the per-unit
  `Wholesale $N` button and the `lot-wholesale-confirm` sheet. Read side:
  `HistoryLog` records the dump, naming the car and the loss.

## Cost of sale — relieving stock (#374)

- **A unit's acquisition price is relieved out of stock on the day it leaves the lot**, via
  the private `relieveCostOfSale` → `economy.postCostOfSale(v.purchasePrice, 'Cost of
  Vehicles Sold')`. Called from the only two doors a car leaves by — `sellVehicle` (retail)
  and `wholesaleOut` (both wholesale reasons) — so the P&L charges each unit exactly once.
  Economy's side of the contract is in its own `CLAUDE.md`.
- **Every Inventory post is tagged `profitCenter: 'sales'` (#375)** — the relief, wholesale
  proceeds, the auction buy, recon, inspection and carrying. The lot is the Sales department's
  cost of doing business; an untagged post would land in store overhead and understate what
  the metal actually cost to sell.
- **`purchasePrice` only, never `costBasisOf`.** Recon, inspection and carrying are already
  expensed as operating spend on the days they were incurred (#255's category boundary);
  relieving the full basis would charge recon twice. `frontGross` has always said the same.
- **The label is one constant, deliberately.** The Finance expense breakdown groups by label,
  so a per-vehicle label would shatter the single biggest line on a dealership's statement
  into slivers that all fold into "Other".
- **A trade-in and a #296 seed unit are relieved too**, even though their `purchasePrice`
  never cost cash (the allowance settles inside the deal structure; opening stock is
  contributed capital). What a sold car cost the store is what the store gave up to have it,
  bank account or not.

## Frontline-hold on acquired units (#295)
- Every `LotVehicle` carries `frontlineDay` — the first day it is offered to the
  auto-sim walk-in pool. `buildAcquiredVehicle` (shared by `buyFromAuction` and
  `acquireFromTrade`) stamps `arrivalDay + frontlineHoldDays`
  (`tunables.json#inventory.frontlineHoldDays`, default 2), so **auction buys and
  customer trades behave identically** — both are held off walk-ins for a short
  frontline-prep window so the player gets an interaction window before a simmed
  customer can buy a just-acquired unit.
- The hold is enforced **only** at the StaffDispatch match seam
  (`v.frontlineDay <= day`), NOT in `getLotVehicles()`: held units still appear
  in the lot view and still accrue carrying cost during the hold — only walk-in
  matching is blocked.
- Auction's only differentiator is the pre-buy paid inspection (below): pay a day
  + the fee to reveal a pinpointed recon band and avoid the hidden-lemon surprise;
  a trade can't be pre-inspected. Both then carry the same post-buy frontline-hold.
- Seed inventory (#296) is exempt (`frontlineDay = arrivalDay`, sellable at open).
- Persistence: `frontlineDay` rides the `LotVehicle` spread in `snapshot()`.
  `restore()` migrates pre-#295 saves by defaulting a missing `frontlineDay` to
  `arrivalDay` (those units were already sellable — never a retroactive hold).

## Day-one frontline seed (#296)
- New saves otherwise start with an **empty lot** and bootstrap entirely from the
  auction board, so nothing is frontline-ready at open. The optional
  `startingInventory: () => readonly StartingInventorySpec[]` dep seeds a small,
  fair, frontline-ready opening lot at construction: **three fixed body-type slots
  — 1 SUV / 1 truck / 1 sedan** — one unit on each axis of the demand heat-map, so
  the player can match *some* walk-in from minute one.
- Seed units are **already-owned opening stock**: inserted straight into
  `lotVehicles` with **no cash debit and no `inventory:vehicle_purchased` emit**
  (which would record a bogus wholesale comp / cash delta). `buildSeedVehicle`
  builds them **recon-complete** (`reconStatus='complete'`, `reconCost =
  reconEstimate`, `reconBucket='within'` — no hidden-lemon tail in the starter
  set) and **frontline-ready** (`arrivalDay = frontlineDay = 0`, exempt from the
  #295 acquired-unit hold so they're sellable at open). Default ask = the live
  market retail (suggestion-only — no UCM on staff at game start).
- The generation is pure + deterministic (`generateStartingInventory`,
  `startingInventory.ts`): per slot it draws `candidateTrials` value-banded
  candidates seeded from `masterSeed` and takes the first whose **live retail**
  lands in the slot's band (`targetRetail ± tolerancePct`, closest-to-target if
  none do), capping condition to `clean`/`average`. So total starting equity
  barely moves between saves (no beater/jackpot trio); only make/year/mileage vary
  for flavor. Cost basis = the live **book** value; the composition root adapts
  MarketEconomy's `bookValueFn`/`marketPriceFn` at the boundary, so Inventory stays
  MarketEconomy-decoupled. Config: `data/starting-inventory.json`.
- Persistence: the seed units ride the `LotVehicle` spread in `snapshot()` like
  any unit. On a **restore** the World is built (and seeded) first, then
  `restore()` clears + reloads the persisted lot — the construction seed is
  harmless there and the persisted units (the same seed) take over. Omit the dep
  (test harnesses) ⇒ an empty opening lot.
- NOTE: the cold-start `clock:managerial_prep` for Day 1 (DayLoopController) runs
  the daily lot pass at world construction, so seed units show `daysInInventory=1`
  and accrue one prep-day of floorplan carry before Day 1 is played — a
  consequence of the spec's `arrivalDay=0`, not an acquisition debit.

## Recon process (#162)
- **The recon BUDGET is a fraction of the unit's value, not a dollar figure**
  (#286). `data/vehicles.json` `conditionTiers[*].reconPct` (0.04 clean / 0.09
  average / 0.16 rough); the one rule lives in `reconEstimateFor(value,
  reconPct)` and all three acquisition lanes state it through that helper,
  differing only in which value they hold at the point of acquisition — the
  auction has the anchor that priced the listing, the seed has the chosen unit's
  book, and a trade has the allowance just agreed to. A flat dollar budget
  cannot be right across a catalog spanning a $3.5k beater and a $40k luxury
  car: at tier 1 the old flat $2,800 rough budget ate half the car's value while
  the anchor's condition discount only takes 12% off it, so a rough unit was
  always value-destroying. Proportional makes the condition *discount* and the
  condition *recon* two halves of one statement, which turns "buy the cheap
  rough one" into a decision (a little cheaper, a little more work, a fatter
  lemon tail) instead of a trap.
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
  posts revenue, and emits **`inventory:vehicle_wholesaled`** with
  `reason: 'recon_abandoned'` (#362 — it publishes `vehicle_sold` no longer; it
  never was a retail sale, and MarketEconomy was booking the dump as a retail
  comp).
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
- The auction generator is intentionally simple for now (random draw weighted by brand share). It is exposed via interface so a richer replacement drops in cleanly.

# MarketEconomy

Peer to `Economy/` (a money ledger). MarketEconomy owns the *valuation* surface
— anchor, comps, personality, shocks, providers, news. Slices #155/#156/#157
ship the skeleton + closed-form anchor + per-save personality + comp-history
rolling window. Subsequent slices (#158–#181) bolt onto the same factory.

Design record: issue **#182** (locked). Read that before working any slice.

## Public API (`index.ts`)

- `createMarketEconomy(deps?)` → `MarketEconomy`. Extends `LiveProviders` +
  exposes `personality`, `compHistory` (snapshot/restore/segmentDrift),
  `shocks`, a bundled `snapshot/restore` (#191), and `dispose()`. Pass `bus` +
  `getCurrentDay` to wire the comp-history subscriptions (#157); omit both for
  the pure-engine path used by the #94 calibration test and fixtures.
- `marketEconomy.snapshot()` → `MarketEconomySnapshot = { schemaVersion,
  compHistory, shocks }` (#191). Bundles the two emergent accumulators for the
  #186 world seam; `personality` is seed-derived so it's deliberately not
  persisted (a same-seed restore reproduces it). `restore` fans both back out.
- `createProviders(deps?)` → `LiveProviders` = `{ bookValueFn, marketPriceFn, vehicleCostFn }`.
  These match SalesProcess seam shapes (`BookValueFn`, `MarketPriceFn`,
  `VehicleCostFn`) and slot into `StaffDispatch.salesProcessDeps` /
  `CloseDeps` / `PickVehicleDeps`. Accepts an optional `segmentHeatFn`
  override — the MarketEconomy factory passes the live composer (#157).
- `marketEconomy.predictDaysToSell(vehicle, askingPrice)` → `{ expectedDays, confidence }`
  (slice #174). Resolves marketPrice + segment heat + live comp count from
  current state, then delegates to the pure `predictDaysToSell` engine. Reads
  optional `vehicle.daysOnLot`. Deterministic. The real-time pricing screen
  (#175) consumes it.
- `computeAnchor(vehicle, deps?)` — pure, deterministic, no RNG.
- `demandMultiplier(input, deps?)` — **the ONE price-elasticity demand model**
  (slice #276, Pricing/Demand spine S4). Pure, deterministic. Given an ask vs.
  the competitor benchmark + segment heat → a relative demand multiplier
  (`1` = at-benchmark neutral-heat baseline, `<1` above market, `>1` below /
  hot). `demandMultiplier = exp(-priceSensitivity[above|below] × pricePosition)
  × exp(heatSensitivity × heat)` — strictly positive, monotonic, asymmetric
  above/below. This is the **shared read-side model** (`pricing-demand-spine.md`
  Pillar 3): `predictDaysToSell` reads it; FloorSim arrivals draw from the same
  function via `demandMultiplierFor` (S7) — no duplicate curve. Config:
  `data/demand-elasticity.json`.
- `marketEconomy.demandMultiplierFor(vehicle, askingPrice)` → relative demand
  multiplier (slice #279, Pricing/Demand spine S7). Resolves the competitor
  benchmark + segment heat from live state — the SAME read backing
  `predictDaysToSell` — and delegates to the shared `demandMultiplier`. The
  composition root injects it as the per-vehicle `vehicleResponse` of
  `computePricingTrafficMultiplier`, so the floor's realized arrivals and the
  pricing screen's days-to-sell read one curve (Pillar 3). Pure, deterministic.
- `predictDaysToSell(input, deps?)` — pure engine for the above (slice #174,
  reworked #276). `expectedDays = baseline(segment) / demandMultiplier ×
  agingMult`, clamped; the price/heat response is no longer local — it delegates
  to the shared `demandMultiplier`. Tuned so at-market → baseline, +20% → ~4×,
  −10% → 0.5×. Confidence falls with extrapolation distance (above-market
  weighted heavier) and rises with live comp count. Configs:
  `data/days-to-sell-curves.json` (baselines/aging/bounds/confidence) +
  `data/demand-elasticity.json` (the shared elasticity curve).
- Pricing-suggestion engine (#154, folded into #175) — pure, deterministic,
  no live state:
  - `suggestListPrice({ bookValue, marketPrice, strategy }, deps?)` →
    `{ suggestedPrice, floor, marketTarget, floored }`. The strategy's market
    posture (`market × marketAggression`) sets the target; the gross floor
    (`book × (1 + targetMarkupPct)`) is the minimum, so even a Value posture
    never lists below cost-plus-target. Unknown strategy id falls back to the
    config default.
  - `resolveIntakeAsk({ bookValue, marketPrice, strategy, automationUnlocked,
    drift? }, deps?)` → the default `askingPrice` stamped at intake (#285, spine
    S13). `automationUnlocked` (a UCM on staff) ⇒ `suggestListPrice(...).suggestedPrice`
    (the strategy's book↔market target); locked ⇒ `round(marketPrice)`
    (suggestion-only — the toggle doesn't move the default ask). Pure. The
    composition root resolves the inputs (live providers + roster gate) and wires
    it through `Inventory.pricingPolicyFn`.
    - **Execution drift (channel-desk M5, #292):** when unlocked and `drift`
      (`IntakeAskDrift = { ucmPricingSkill, seed, config }`) is supplied, the
      realized ask scatters off the suggested target by `NPC.signedSkillDrift`
      (two-sided mis-price — too high sits, too low leaves money), clamped at the
      gross floor (a sloppy desk still won't list under cost-plus-target). A green
      UCM mis-prices, a sharp one (≥ `skillReference`) nails the target. Omit
      `drift` ⇒ exactly the target (legacy/tests). The composition root seeds it
      per-(vehicle, day) ⇒ replay-safe. `config` = `managerGates.executionDrift.pricing`.
      This is the *act*-side precision sibling to the *advise*-side
      `resolveIntelPrecision` (S12) — both read the top UCM `pricing` skill.
  - `isAutoPricingUnlocked(ucmPricingSkill, threshold)` → boolean (#289,
    channel-desk M2). Whether the standing policy's `automationUnlocked` is on:
    `ucmPricingSkill != null && ucmPricingSkill >= threshold`. Reframes #285's
    UCM-*presence* gate onto the UCM's `pricing` skill — *acting* (auto-pricing)
    is earned, while *advising* (intel precision, `resolveIntelPrecision`) stays
    free on presence. Pure; the composition root supplies the top UCM pricing
    skill (roster) + threshold (`tunables.managerGates.actThresholds.pricing`).
  - `classifyPricePosition(ask, marketPrice, deps?)` → `PricePosition`
    (`fire-sale | below-market | at-market | above-market | wishful`) via the
    configured ask/market ratio bands.
  - `deriveCompetitorComps(marketPrice, competitors, deps?)` → comparable
    asking prices, mapping each competitor's `[0,1]` pricing lean onto a
    `±competitorSpread` band around market. Takes a narrow structural
    competitor input so MarketEconomy stays decoupled from CompetitorMarket.
  - Config: `data/pricing-strategies.json` (`loadPricingStrategiesConfig`).
- Sourcing posture-lean engine (#293, channel-desk M6) — pure, deterministic,
  no live state (`sourcing.ts`):
  - `isSourcingUnlocked(ucmConditionReadingSkill, threshold)` → boolean. The act
    gate for UCM auto-fill, on the **same `condition_reading` axis** that gates
    M4 trade auto-approve (manager-roles-channel-desk.md §3) — acting (buying for
    you) is earned, the appraisal *advice* (#163) stays free on hire.
  - `selectAutoBuys({ candidates, lean, segmentCount, cashOnHand, drift? }, deps?)`
    → the listing ids the UCM auto-buys. Scores each `SourcingCandidate`
    (`{ listingId, cost, book, condition, demandShare }`) against the normalized
    lean across three axes — margin (book-relative gross vs `marginReference`),
    condition (`conditionScores`), and demand-fit (the category's DemandShaper
    share vs the uniform baseline, `demandFitGain`) — then greedily buys in
    descending fit while the score clears `buyThreshold` and cumulative cost
    stays within `cashOnHand − cashReserve`. **M5 drift (#292):** `drift`
    (`SourcingDrift = { conditionReadingSkill, seed, config }`) adds a two-sided
    `signedSkillDrift` mis-perception to each candidate's *perceived* fit — a
    green UCM both over-buys poor fits and skips good ones (off-lean buys, both
    worse than lean-optimal), a sharp one (≥ `skillReference`) holds the lean
    exactly. Deterministic in `(skill, seed)`; the root seeds it per-day. Omit
    `drift` ⇒ exact lean-optimal picks.
  - `scoreCandidate(candidate, lean, segmentCount, deps?)` / `normalizeLean(lean)`
    — the pure axis-blend + weight normalization, exported for tests.
  - The composition root owns the inputs: book via `bookValueFn`, demand share
    via `DemandShaper.getMix()`, cost = `askingPrice + reconCost`, the gate from
    the roster's top UCM `condition_reading`. Wired through `Inventory.autoSourceFn`.
  - Config: `data/sourcing.json` (`loadSourcingConfig`). All numbers are
    placeholders pending the S14 calibration pass (#286).
- `resolveIntelPrecision(read, deps?)` → `IntelPrecision` (slice #284, Pricing/
  Demand spine S12). Pure, deterministic. Maps a narrow `PricingStaffRead`
  (`{ ucmPricingSkill: number | null }`) to the precision profile the pricing
  surfaces read: `heatGranularity` (`coarse` 3-band vs `fine` 5-band + numeric
  index), `suggestionBandPct`, `daysRangePct`, `confidenceScale`. No UCM ⇒ the
  flat `coarse` profile; a UCM on staff ⇒ `sharp` granularity, with the numeric
  knobs lerped from coarse toward sharp as the UCM's `pricing` skill rises to
  `skillReference` (a green hire ≈ gut, a seasoned one pinpoint). The
  composition root distills the roster (`buildPricingStaffRead`) and feeds one
  profile to BOTH the Demand Heat console band resolution and the pricing
  screen's days-range/confidence/suggestion-band, so the whole read sharpens
  together. MarketEconomy stays decoupled from StaffOrg — it only ever sees the
  pricing skill. Config: `data/intel-precision.json`.
- `createCompHistory(deps?)` — rolling-window comp store with snapshot/restore.
- `createSegmentHeat(deps)` — composer for `personality + drift + shock`.
- Five typed loaders + Zod schemas under `./schemas.ts`.

## Engine (slices #155, #156)

```
anchor(v)      = baseAnchor(template OR (category × brandTier) fallback)
                 × yearCurve(yearAge, curveType)
                 × mileageCurve(mileage, curveType)    -- #156
                 × conditionMod(condition)

bookValue(v)   = anchor(v) × (1 + segmentHeat(v))
marketPrice(v) = round(bookValue(v) × markup(category, brandTier))
vehicleCost(v) = v.purchasePrice + v.reconCost          -- design-locked unchanged
```

`segmentHeat(v) = personalityBias(category) + segmentDrift(category, currentDay) + activeShockMod(...)`.
Slice #156 lit up the personality term, #157 the comp-history drift term, #159
the shock term via `shocks.ts` (active only when both `bus` and `masterSeed`
are wired). Drift is the damped
weighted mean of stored deltas `(realizedPrice / referenceValue) - 1` —
wholesale comps use `anchor(v)` as reference, retail comps use `anchor(v) ×
markup`. Cold start (empty window) → drift=0, the engine reduces to the
slice-#156 personality world. Omitting `masterSeed` *and* `bus` from
`createMarketEconomy` produces the fully-neutral world (segmentHeat=0) — the
path used by the #94 calibration test and the static-stub fixtures.

## Provider input contract

The seam signatures live in `SalesProcess/seams.ts` and declare
`PricedVehicleInput` (purchasePrice + reconCost). The *live* providers read a
richer shape — `MarketVehicleInput` = `PricedVehicleInput & AnchorVehicleInput`
(adds templateId, make, year, category, condition).

**Runtime contract:** the composition root only wires the live providers
where a richer vehicle is guaranteed (currently `StaffFloorDrain`, where the
input is always a `LotVehicle`). Call sites that only carry the narrow
`PricedVehicleInput` (e.g. `CustomerPool`'s `STUB_PRICED_VEHICLE`, the #94
calibration test) route through the static stubs in `SalesProcess/seams.ts`
— do not point them at the live providers. Static stubs remain as the test /
fallback path per slice #155 AC.

## Events

- **Consumes** (slice #157): `inventory:vehicle_purchased` → wholesale comp;
  `inventory:vehicle_sold` → retail comp. Both events carry a vehicle
  snapshot (templateId/make/year/mileage/condition/category) so MarketEconomy
  re-computes the anchor without depending on Inventory internals.
- **Consumes** (slice #158): `competitor:price_changed` → one synthetic comp
  per segment with non-zero brand affinity. Delta = `(newPricing − oldPricing)
  × marketEconomy.competitorInfluence`; entry weight scales by affinity
  (high-affinity segments carry more weight in the drift mean).
- **Consumes** (slice #159): `clock:day_started` → shock scheduler tick
  (resolve expired, then maybe activate a new shock via a single
  arrival-prob roll seeded by `(masterSeed, day)`).
- **Emits** (slice #159): `market:shock_started` on activation,
  `market:shock_resolved` on expiration. Both carry `instanceId =
  ${shockId}@${startDay}` so multiple activations of the same catalog shock
  are disambiguable.
- **Emits** (slice #177): `market:weekly_report_published` when the weekly
  column publishes (once per week, on `marketEconomy.weeklyReport.
  publishDayOfWeek`, inside the same day tick as the wire and after it). The
  payload is the summary line only — consumers needing the moves/calls read
  `marketEconomy.weeklyReport.getActive()`.
- **Emits** (slice #176): `market:segment_heat_updated` when a segment's
  composite heat has moved at least `marketEconomy.heatMonitor.deltaThreshold`
  **since it was last reported** — deliberately not a daily heartbeat (the #267
  lesson). `news:headline_published` for each industry-wire headline.
- **Day tick ordering (#176):** the module has ONE `clock:day_started`
  subscription that runs, in order, `shockScheduler.step` → `heatMonitor.step`
  → `news.step` → `weeklyReport.step`. Shocks must land (and emit) before the
  monitor reads the composite they modulate, both must have spoken before the
  wire's day step spends the remaining headline budget, and the wire must have
  spoken before the column sums it up. The order is a property of the module,
  not of bus registration order.

## Sub-systems (#176)

- **`shocks.previewArrival(day)`** — pure lookahead over the arrival/pick/param
  rolls for any future day. No state read or written; deliberately *not* gated
  on `maxConcurrent` or the duplicate guard, so a previewed shock may never
  land. That is the honest shape for a rumor. `step` and `previewArrival` share
  one `rollArrival` helper so they cannot drift on the seed stream.
- **`heatMonitor`** (`heatMonitor.ts`) — watches `segmentHeat` per segment once
  a day and reports only threshold-clearing moves. Baseline is captured
  silently on the first tick (a fresh save's personality bias is the world the
  player starts in, not a change in it). Deltas are measured against the last
  *reported* heat, so slow persistent drift eventually reports once instead of
  never. Persisted as `MarketEconomySnapshot.heat`.
- **`news`** (`news.ts`) — the industry wire. Three reliability tiers:
  `direct` (already happened: block report, shock landing/lifting, a rival
  repricing), `leading` (the analyst desk's forward call, fired ahead of a shock
  via `previewArrival` and fallible by design — `rumorHitProb` decides whether a
  real setup gets called, `falseAlarmProbPerDay` fires calls when nothing is
  coming), and `lagging` (confirming a heat move the player's own numbers
  already showed). Every roll derives from `(masterSeed, day, slot)`.
  `maxHeadlinesPerDay` is a hard gate spent in arrival order. Inventory comps
  reach the wire through `news.recordComp`, called by the facade's existing
  comp handlers — re-deriving the delta-vs-anchor here would duplicate the
  anchor math. The block report aggregates a day's comps and publishes on the
  *next* day's tick (an auction recap is next-morning news). Persisted as
  `MarketEconomySnapshot.news` (ring buffer + day budget + un-reported comps +
  live shock tags). Exposed read-only as `marketEconomy.news.getHeadlines()`,
  newest first — what the Home-screen Industry Wire panel renders.
- **`weeklyReport`** (`weeklyReport.ts`, #177) — the trade pub's longer-form
  column. A *card*, not a headline: it never spends the wire's daily budget,
  never enters the ring buffer, and stands until the next one replaces it.
  Publishes inside the module's one day tick on `publishDayOfWeek` (0 = Monday),
  covering the days played since the last column. Aggregates three things that
  are already true in the engine: the week's per-segment heat move (against a
  baseline the column captured when the week opened — so the number is the week,
  not the career), a tally of the week's wire by trust tier plus per-segment
  mention counts (accumulated off `news:headline_published`), and up to
  `maxForwardCalls` forward calls. Calls are deterministic from current state
  and deliberately fallible: a `shock` call reads `shocks.previewArrival` across
  `lookaheadDays` and only fires `callHitProb` of the time; a `drift` call is
  momentum extrapolation off the week's own move, skipped when the shock call
  already named that segment. Exposed as `marketEconomy.weeklyReport.getActive()`
  — what the Home-screen card renders. Persisted as
  `MarketEconomySnapshot.weekly` (the standing column + the in-progress week's
  baseline/mentions/tally, so a mid-week reload keeps the week).
- `MarketEconomySnapshot.schemaVersion` is **3** as of #177 (world envelope 19).

## Data files

- `data/market-anchor.json` — per-template hand-tuned anchors.
- `data/market-segment-fallback.json` — `(category × brandTier) → fallback` for
  templates not in the per-template table.
- `data/market-depreciation-curves.json` — per-`curveType` year + mileage
  curve shapes (linear with floor for both axes; richer shapes possible
  later). `referenceMileage` is the mileage-curve break point — at or below
  it the multiplier is 1.
- `data/market-condition-mods.json` — `condition → multiplier`.
- `data/market-markup.json` — `(category × brandTier) → retail markup`.
- `data/market-personality-distribution.json` — per-segment bias bounds the
  per-save personality vector samples from (#156).
- `data/mileage-distribution.json` — year-conditioned mileage distribution
  consumed by the auction generator (#156).
- `data/news-templates.json` — industry-wire headline catalog (#176). Templates
  keyed by structural trigger, each carrying its own source ("who is talking")
  and reliability tier; slots `{segment}` `{pct}` `{label}` `{brand}` `{days}`
  are filled at fire time. Also holds ALL player-facing wire copy — source
  labels, the trust badges (Confirmed / Rumor / Recap) and their plain-language
  explanations — so wording retunes in one data file. #177 added three voices
  (`trade_press` — a fictional pub, mostly forward calls + lagging texture;
  `oem_bulletin` — direct, and only for the shocks the factory actually causes;
  `competitor_watch` — direct, the tracked-with-numbers sibling of vague lot
  talk), the `shockSources` map (shockId → the voice that announces it; unmapped
  shocks draw from the whole pool, and a filter matching nothing falls back to
  the full pool so a copy gap never swallows a real headline), and the
  `weeklyReport` copy block (title/subtitle/headings, summaries keyed by week
  shape, forward-call lines keyed by basis × direction, the tally sentence).
- `data/market-shocks.json` — stochastic shock catalog (#159). Each shock
  carries per-segment signed magnitude bands + a duration band + a rarity
  weight used by the scheduler's weighted pick. #177 added `oem_incentive_push`
  and `model_year_changeover` — the two factory-caused stories the OEM-bulletin
  voice needed in order to speak about something that genuinely moves values,
  rather than narrating an event the engine doesn't have. Which voice announces
  a given shock is in `news-templates.json`, not here: that's wire copy, not
  shock physics.
- `data/auction-sources.json` — auction source catalog (#160). Each save
  rolls a hidden reliability per source from the catalog band via
  `rollAuctionSourceReliability(masterSeed)`; the auction generator picks a
  source per listing and draws the motivated-seller multiplier with stdev
  lerped from `stdevHonest` (most reliable) to `stdevUnreliable`, then clipped
  to `[floor, ceiling]`. Tunables live under `marketEconomy.motivatedSeller`.

- `data/recon-variance.json` — tail-shape parameters for the hidden-lemon
  variance roll (#162). Bucket probabilities (within/minor/major/catastrophic)
  reshape by `condition × source-reliability-band × mileage-extreme`; the
  realized recon cost is `estimate × bucketMultiplier`. The catalog also
  carries `surpriseThreshold` (when sunk recon trips this multiple of estimate,
  a surprise event fires) and `reconDaysByCondition` (how the daily-spend
  cadence amortizes the realized total).
- `data/recon-surprise-events.json` — surprise event templates keyed by tail
  bucket (#162). The sampler picks one when a tail-bucket vehicle crosses the
  surprise threshold mid-recon.
- `data/days-to-sell-curves.json` — per-segment baseline days + aging shape +
  bounds + confidence params for the #174 predictor. The price/heat response
  moved to `data/demand-elasticity.json` (#276) so the days-to-sell consumer and
  the FloorSim-arrival consumer share one curve.
- `data/demand-elasticity.json` — the shared price-elasticity curve (#276):
  `priceSensitivity.above`/`below` (kept separate so #180 can tune the
  above-market bite vs below-market lift asymmetry) + `heatSensitivity`.
- `data/intel-precision.json` — the coarse (no-UCM) and sharp (UCM) precision
  profiles for `resolveIntelPrecision` (#284): per-level `heatGranularity` +
  `suggestionBandPct` + `daysRangePct` + `confidenceScale`, plus the sharp
  level's `skillReference` (the UCM `pricing` skill at which the read is fully
  sharp). Precision-delta calibration is deferred to the S14 balance pass.
- `data/sourcing.json` — UCM sourcing auto-fill tunables (#293): `defaultLean`
  (the balanced margin/condition/demand-fit blend before the player tunes the
  dial), per-condition `conditionScores`, `marginReference` (book-relative gross
  scoring 1.0), `demandFitGain`, `buyThreshold`, and the `cashReserve` floor. All
  placeholders pending the S14 calibration pass (#286).
- `data/pricing-strategies.json` — list-price strategy postures
  (`marketAggression` + `targetMarkupPct` per strategy), the default strategy,
  the position-indicator ratio bands, and the competitor-comparable spread for
  the #154/#175 pricing screen.

Tuning of all five is deliberately neutral so the static-stub midpoint
(`(purchase + recon) × 1.25`) and the live providers produce comparable
outputs at the population midpoint — the slice #155 AC is the `#94`
calibration test passing unchanged. Hard calibration is slice #180.

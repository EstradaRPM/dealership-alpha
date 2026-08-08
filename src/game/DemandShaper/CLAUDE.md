# DemandShaper

Owns the per-day **segment heat map** — a weight vector over the vehicle-type
segments (sedan / truck / suv) — and turns it into a deterministic weighted
spawn draw. Records realized arrivals into a trailing window so the MANAGERIAL
screen can show "what's hot on the lot" with rising/steady/falling trend arrows.
Introduced in #198 (parent #197) as a persona-mix; **re-keyed to vehicle-type
segments in #278 (Pricing/Demand spine S6)** — segment heat is now the demand
driver and buyer personas demote to per-customer negotiation flavor.

## Public API (`index.ts`)
- `createDemandShaper({ segments, config, initialMix? })` → `DemandShaper`.
  - `segments` — the segment ids to distribute over (the composition root passes
    `data/tunables.json` → `demandShaper.segments`, the `VehicleCategory`
    universe, so this module stays free of an Inventory/CustomerPool dep).
  - `personArchetypes?` — the person-archetype id universe an influence input may
    skew (#372). Passed in off `SALES_ARCHETYPES` by the composition root for the
    same reason `segments` is passed in. Omitted ⇒ the lane is closed and any
    person weight is refused by key.
  - `config: DemandShaperConfig` — `{ windowSize, trendEpsilon }` from
    `data/tunables.json` → `demandShaper`.
  - `initialMix?` — raw baseline weights. Omitted ⇒ uniform; `createWorld`
    passes a seeded location-profile baseline from `data/tunables.json`
    for new worlds (#211).
- `DemandShaper`:
  - `getMix()` — current heat map, normalized to sum 1.
  - `setMix(weights)` — replace the raw baseline heat map.
  - `setInfluenceInputs(inputs)` / `upsertInfluenceInput(input)` /
    `removeInfluenceInput(id)` — active typed influence producers. Each input
    declares target additive segment deltas (`baseline ± deltas`) plus
    `lagDays`/`decayDays`; `advanceInfluenceDay()` ramps current effective
    weights toward the target over whole days. `getMix()` normalizes
    `baselineMix + currentInfluenceDeltas`, clamping any over-subtracted
    segment to zero, and the MANAGERIAL readout uses `getInfluenceInputs()` for
    per-lever attribution.
    #211 wires inventory composition and live reputation here; #212 adds the
    advertising producer. #277 added the `pricing` producer to the union as an
    **empty socket** (`buildPricingInfluence` in `createWorld`, wired as
    `pricing-posture`, returns `null` ⇒ identity); per the Pricing/Demand spine
    that producer is where price posture will skew *which segment walks in*,
    filled by the calibration slice. The separate price → arrival *volume* seam
    lives in `computePricingTrafficMultiplier` (#125 `pricing.trafficMultiplier`
    composite), NOT here.
    **#372 gave every input a SECOND lane, `personWeights`** — additive deltas
    over the person-archetype universe, saying *who* walks in rather than *what
    kind of car* they want. Both lanes ride ONE lag/decay clock on one input:
    a campaign's two halves are one lever, and separate clocks would let a push
    arrive as one crowd and settle as another. Only `advertising` fills it today.
  - `getPersonSkew()` — the summed effective person deltas across live inputs.
    These are ADDITIVE SKEWS on the within-segment archetype weights, not a
    distribution: DemandShaper does not own that table. The skew is applied in
    exactly one place, `CustomerPool.skewSegmentArchetypes`, which both the
    spawn draw and the #371 finance-mix projection read — so the crowd the wire
    promises is the crowd that walks in.
  - `drawSegment(rng)` — deterministic weighted segment draw. **Pure function of
    the injected RNG** — the root feeds the existing seeded per-spawn stream so
    replays (#122) reproduce the segment sequence. The within-segment visit
    archetype (the negotiation flavor personas demote to) is a *second*
    independent seeded roll in `createWorld` against `segmentArchetypes`.
  - `recordArrival(segment)` — append a realized arrival to the trailing window.
  - `getObservedMix()` — per-segment `{ count, share, trend }` over the window.
  - `snapshot()/restore()` (barrel-exported `DemandShaperSnapshot`) persist
    `{ baselineMix, activeInputs, observedHistory }`. `activeInputs` are lag
    states: current weights, target weights, current/target person weights
    (#372 — both **optional on the wire**, so a pre-#372 schema-3 blob restores
    as "this lever skews nobody", which is exactly what it meant; the snapshot
    schema did NOT need a version bump), lag/decay days, elapsed days,
    producer id, removal state. The snapshot is **schema 3** (segment-keyed);
    restore of legacy persona-keyed schemas 1|2 migrates to the behavior-neutral
    uniform segment baseline (they cannot be re-keyed cleanly).

## Events
None — a library/factory module. The composition root drives it from inside the
`customerSource.spawn` seam (draw + record), refreshes influence inputs from
Inventory/Reputation events, advances lag on `clock:day_started`, owns the
advertising control, and reads `getObservedMix()` + `getInfluenceInputs()` to
assemble the MANAGERIAL readout model.

## Data
- `data/tunables.json` → `demandShaper`: `{ windowSize, trendEpsilon, segments,
  segmentArchetypes, locationProfiles, inventoryInfluence, reputationInfluence,
  advertisingInfluence }`. `segments` is the ordered heat-map dimension;
  `segmentArchetypes` (segment → persona weights) is the within-segment visit
  archetype roll used by `createWorld` to mint customers. An
  `advertisingInfluence` campaign declares `weights` (vehicle-type),
  `personWeights` (#372) or both — the schema **refuses** a campaign declaring
  neither, since a lever the player pays for daily that moves nothing is a chip
  with nothing behind it.

## Scope notes
- Segment heat only. **Does NOT** touch the locked #125 `DemandContext` (the
  volume projection FloorSim consumes) — body-style match stays emergent via
  archetype preference → `pickVehicleFor` → segment taxonomy. The heat map
  decides *which segment* is in demand; the matcher decides *which unit*.
- Personas no longer drive demand: `createWorld` draws the segment from the heat
  map, then rolls a `segmentArchetypes` visit archetype within it — that roll
  carries the negotiation flavor (price sensitivity, trade behavior) the
  discount/trade-event slices consume.
- Persisted through `worldSnapshot` (#210). The pre-DemandShaper envelope
  migration materializes the behavior-neutral uniform segment baseline.

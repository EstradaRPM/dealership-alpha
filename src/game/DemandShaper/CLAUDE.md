# DemandShaper

Owns the per-day **persona-mix** weight vector over the 5 sales personas
(Young Family / Enthusiast / Commuter / Retiree / Tradesperson) and turns it
into a deterministic weighted spawn draw. Records realized arrivals into a
trailing window so the MANAGERIAL screen can show "who's been walking in" with
rising/steady/falling trend arrows. Introduced in #198 (parent #197, the
player-influenceable demand-shaping loop).

## Public API (`index.ts`)
- `createDemandShaper({ personas, config, initialMix? })` → `DemandShaper`.
  - `personas` — the persona ids to distribute over (the composition root
    passes `SALES_ARCHETYPES.map(a => a.personId)` so this module stays free of
    a CustomerPool/NPC dep).
  - `config: DemandShaperConfig` — `{ windowSize, trendEpsilon }` from
    `data/tunables.json` → `demandShaper`.
  - `initialMix?` — raw baseline weights. Omitted ⇒ uniform; `createWorld`
    now passes a seeded location-profile baseline from `data/tunables.json`
    for new worlds (#211).
- `DemandShaper`:
  - `getMix()` — current mix, normalized to sum 1.
  - `setMix(weights)` — replace the raw baseline mix.
  - `setInfluenceInputs(inputs)` / `upsertInfluenceInput(input)` /
    `removeInfluenceInput(id)` — active typed influence producers. Each input
    declares target additive persona deltas (`baseline ± deltas`) plus
    `lagDays`/`decayDays`; `advanceInfluenceDay()` ramps current effective
    weights toward the target over whole days. `getMix()` normalizes
    `baselineMix + currentInfluenceDeltas`, clamping any over-subtracted
    persona to zero, and the MANAGERIAL readout uses `getInfluenceInputs()` for
    per-lever attribution.
    #211 wires inventory composition and live reputation here; #212 adds the
    reserved advertising producer without changing spawn or UI contracts.
  - `drawPersona(rng)` — deterministic weighted persona draw. **Pure function of
    the injected RNG** — the root feeds the existing seeded per-spawn stream so
    replays (#122) reproduce the persona sequence.
  - `recordArrival(persona)` — append a realized arrival to the trailing window.
  - `getObservedMix()` — per-persona `{ count, share, trend }` over the window.
  - `snapshot()/restore()` (barrel-exported `DemandShaperSnapshot`) persist
    `{ baselineMix, activeInputs, observedHistory }`. `activeInputs` are schema
    v2 lag states: current weights, target weights, lag/decay days, elapsed
    days, producer id, and removal state. Restore still accepts v1 effective
    additive inputs.

## Events
None — a library/factory module. The composition root drives it from inside the
`customerSource.spawn` seam (draw + record), refreshes influence inputs from
Inventory/Reputation events, advances lag on `clock:day_started`, owns the
reserved advertising control, and reads `getObservedMix()` +
`getInfluenceInputs()` to assemble the MANAGERIAL readout model.

## Data
- `data/tunables.json` → `demandShaper`: `{ windowSize, trendEpsilon,
  locationProfiles, inventoryInfluence, reputationInfluence,
  advertisingInfluence, coverageCategoryByPersona }`.

## Scope notes
- Persona-mix only. **Does NOT** touch the locked #125 `DemandContext` (the
  volume projection FloorSim consumes) — segment/body-style demand stays
  emergent via persona → preference → `pickVehicleFor` → segment taxonomy.
- Persisted through `worldSnapshot` v2 (#210). The v1→v2 migration materializes
  a behavior-neutral uniform baseline, empty active inputs, and empty observed
  history for pre-#210 saves.

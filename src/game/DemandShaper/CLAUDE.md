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
  - `initialMix?` — raw weights; omitted ⇒ **uniform** (behavior-neutral
    baseline, so #198 doesn't regress day-loop/replay behavior).
- `DemandShaper`:
  - `getMix()` — current mix, normalized to sum 1.
  - `setMix(weights)` — replace the mix (raw weights, re-normalized on read).
    The seam levers wire into (#211 targeting, #212 marketing).
  - `drawPersona(rng)` — deterministic weighted persona draw. **Pure function of
    the injected RNG** — the root feeds the existing seeded per-spawn stream so
    replays (#122) reproduce the persona sequence.
  - `recordArrival(persona)` — append a realized arrival to the trailing window.
  - `getObservedMix()` — per-persona `{ count, share, trend }` over the window.
  - `snapshot()/restore()` (barrel-exported `DemandShaperSnapshot`) persist
    `{ baselineMix, activeInputs, observedHistory }`. `activeInputs` is the
    reserved attributed-lever seam for the targeting slices; it is empty in the
    #198 behavior-neutral baseline.

## Events
None — a library/factory module. The composition root drives it from inside the
`customerSource.spawn` seam (draw + record) and reads `getObservedMix()` to
assemble the MANAGERIAL readout model.

## Data
- `data/tunables.json` → `demandShaper`: `{ windowSize, trendEpsilon }`.

## Scope notes
- Persona-mix only. **Does NOT** touch the locked #125 `DemandContext` (the
  volume projection FloorSim consumes) — segment/body-style demand stays
  emergent via persona → preference → `pickVehicleFor` → segment taxonomy.
- Persisted through `worldSnapshot` v2 (#210). The v1→v2 migration materializes
  a behavior-neutral uniform baseline, empty active inputs, and empty observed
  history for pre-#210 saves.

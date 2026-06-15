# Demand-Shaping Recipe

Purpose: this is the durable context packet for #197 descendants. Read this before
touching demand-shaping issues so each agent does not rediscover the same wiring.

## Source Of Truth

- Parent PRD: GitHub issue #197.
- Current dependent slices: #211 and #212.
- Module doc: `src/game/DemandShaper/CLAUDE.md`.
- Spec guardrails: `docs/spec-condensed.md`.
- Handoff rules: `docs/agent-handoff.md`.

If an issue contradicts this file, verify the issue history and update this file
in the same slice. Do not leave the correction in private chat.

## Startup Protocol

For any #197 descendant:

1. Read the issue body and blocker chain.
2. Read this file.
3. Read `src/game/DemandShaper/CLAUDE.md`.
4. Read only the target test/component/module needed for the acceptance criteria.
5. Use `rg` for symbols, then ranged reads. Do not cold-read broad source files.

Default setup budget: issue body + this recipe + module doc + one target test.
If more context is needed, ask an Explore subagent to map the exact seam and
return conclusions with `file:line` pointers.

## Current Mechanic Shape

`DemandShaper` owns the per-segment **heat map** weight vector (sedan / truck /
suv). The heat map controls which *segment* is drawn for customer spawning;
buyer personas demote to a within-segment archetype roll (negotiation flavor).
Observed arrivals are recorded into a trailing window so the MANAGERIAL readout
can show "what's hot on the lot." Re-keyed from persona-mix to segments in #278.

Canonical model:

```text
current heat = normalized(baseline segment weights + active influence inputs)
spawn segment = weighted draw from current heat on injected seeded RNG
spawn archetype = within-segment roll over segmentArchetypes (a 2nd seeded RNG)
observed readout = trailing window of realized segment arrivals
targeting readout = active influence inputs with per-lever attribution
```

Body-style match stays emergent through the archetype -> preference -> vehicle
match chain. The heat map decides *which segment* is in demand; the matcher
decides *which unit*. Do not introduce a second segment-demand distribution.

## Main Seams

- Logic module: `src/game/DemandShaper/`
  - Public surface through `src/game/DemandShaper/index.ts`.
  - `createDemandShaper({ segments, config, initialMix? })`.
  - `getMix()`, `setMix()`, `setInfluenceInputs()`, `upsertInfluenceInput()`,
    `removeInfluenceInput()`, `advanceInfluenceDay()`, `getInfluenceInputs()`.
  - `drawSegment(rng)` must stay deterministic from the injected RNG.
  - `recordArrival(segment)`, `getObservedMix()`.
  - `snapshot()` / `restore()` persist baseline, lagged active input state,
    observed history (schema 3, segment-keyed).

- Composition root: `src/createWorld.ts`
  - Builds `DemandShaper` from `data/tunables.json` -> `demandShaper.segments`.
  - Loads `data/tunables.json` -> `demandShaper`.
  - Builds location baseline for new worlds.
  - Syncs inventory/reputation influence inputs from live game state.
  - Owns the advertising control (`world.demandControls`) and stores that
    lever's target/current lag state inside DemandShaper.
  - Advances influence lag/decay on `clock:day_started`.
  - Draws the segment inside the customer spawn seam, records the arrival, then
    rolls a `segmentArchetypes` visit archetype within the segment to mint the
    customer (the negotiation flavor).

- UI readout: `src/ui/DemandReadout/`
  - Renders observed mix, targeting levers, and lot-coverage gap.
  - UI receives a model. It does not reach into game logic internals.

- Live reachability: `App.tsx` + `DayLoopShell`
  - App assembles the demand readout model from the live world.
  - `DayLoopShell` receives `demandReadout`.
  - Anti-orphan tests must assert live flow reachability, not only isolated render.

- Persistence: `src/worldSnapshot.ts`
  - `snapshotWorld()` includes `world.demandShaper.snapshot()`.
  - `restoreWorld()` restores onto a fresh same-seed world.
  - Snapshot migrations add default DemandShaper state for older saves.

## Influence Inputs

Current input shape is typed target deltas with attribution and lag:

```text
DemandInfluenceInput = {
  id: string
  label: string
  producer: 'inventory' | 'reputation' | 'advertising' | 'pricing' | 'test'
  weights: Partial<Record<segmentId, number>> // target deltas, +/- allowed
  lagDays: number
  decayDays?: number
}
```

`getInfluenceInputs()` returns lag state for readout/persistence: current
effective `weights`, `targetWeights`, `lagDays`, `decayDays`, `elapsedDays`,
`producer`, and `removing`. `getMix()` normalizes
`baselineMix + current effective deltas`; over-subtracted segment weights clamp
to zero, but the all-zero heat map still throws.

Preserve the readout contract: every active lever must remain attributable in
"Who You're Targeting." Advertising/marketing should attach as another producer
against the same seam, not by special-casing spawn or UI.

## Tunables

Demand-shaping tunables live in `data/tunables.json` under `demandShaper` and
load through `src/game/data/tunables.ts`.

Known groups:

- `windowSize`
- `trendEpsilon`
- `segments`
- `segmentArchetypes`
- `locationProfiles`
- `inventoryInfluence`
- `reputationInfluence`
- `advertisingInfluence`

Add new values here when they are balance/content knobs. Do not bury balance
numbers in code.

## Tests To Start From

- Logic behavior: `tests/DemandShaper.test.ts`
- Live reachability / anti-orphan: `tests/DemandShaper.reachability.test.tsx`
- UI smoke/readout: `tests/DemandReadout.smoke.test.tsx`
- Save/load: `tests/worldSnapshot.test.ts`
- Type contract: `npm run typecheck`
- Full safety net: `npm test`

For issue work, run focused tests first, then typecheck/full tests before closeout
when feasible.

## Non-Negotiable Guardrails

- No forward oracle. The readout shows observed history plus targeting levers.
- No direct UI access to game-logic internals. App composes a model.
- No bypass of seeded RNG. `drawSegment(rng)` consumes the injected stream.
- No second demand taxonomy. The segment heat map remains canonical; personas
  are negotiation flavor only.
- No EventBus use unless a true cross-module event is needed.
- No dark mechanics. Every player-facing slice needs a live reachability test.
- No SaveStore edits for module state. Persist through `worldSnapshot`.

## Files Usually Needed

Read these only when the acceptance criteria touches them:

- DemandShaper interface/behavior: `src/game/DemandShaper/DemandShaper.ts`
- Public exports: `src/game/DemandShaper/index.ts`
- Composition and influence producers: `src/createWorld.ts`
- Readout model/UI: `src/ui/DemandReadout/DemandReadout.tsx`
- Live mount: `App.tsx`, `src/ui/DayLoopShell/DayLoopShell.tsx`
- Persistence: `src/worldSnapshot.ts`
- Tunables: `data/tunables.json`, `src/game/data/tunables.ts`

Do not read unrelated modules to learn where these live. Use `rg` for exact
symbols such as `createDemandShaper`, `setInfluenceInputs`, `getObservedMix`,
`buildTargetingLevers`, `coverageGap`, `snapshotWorld`, and `restoreWorld`.

## Closeout Update

Every #197 descendant must update this file if it changes:

- the DemandShaper public interface
- influence input shape
- UI readout model shape
- persistence shape or snapshot version
- required tests or live reachability path
- tunables under `demandShaper`

Closeout issue comment should include:

```text
Context packet updated: yes/no
Changed seams:
Tests:
Follow-ups:
```

If the packet was not updated, say why. This keeps cross-agent context in the
repo instead of private session memory.

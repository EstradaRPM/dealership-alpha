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

`DemandShaper` owns the sales persona-mix weight vector. The mix controls which
persona is drawn for customer spawning. Observed arrivals are recorded into a
trailing window so the MANAGERIAL readout can show "who has been walking in."

Canonical model:

```text
current mix = normalized(baseline persona weights + active influence inputs)
spawn persona = weighted draw from current mix on injected seeded RNG
observed readout = trailing window of realized arrivals
targeting readout = active influence inputs with per-lever attribution
```

Segment/body-style demand is emergent through the existing persona -> preference
-> vehicle match chain. Do not introduce a second segment-demand distribution.

## Main Seams

- Logic module: `src/game/DemandShaper/`
  - Public surface through `src/game/DemandShaper/index.ts`.
  - `createDemandShaper({ personas, config, initialMix? })`.
  - `getMix()`, `setMix()`, `setInfluenceInputs()`, `getInfluenceInputs()`.
  - `drawPersona(rng)` must stay deterministic from the injected RNG.
  - `recordArrival(persona)`, `getObservedMix()`.
  - `snapshot()` / `restore()` persist baseline, active inputs, observed history.

- Composition root: `src/createWorld.ts`
  - Builds `DemandShaper` from `SALES_ARCHETYPES.map(a => a.personId)`.
  - Loads `data/tunables.json` -> `demandShaper`.
  - Builds location baseline for new worlds.
  - Syncs influence inputs from live game state.
  - Draws persona inside the customer spawn seam and records the arrival.

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

Current input shape is additive persona weights with attribution:

```text
DemandInfluenceInput = {
  id: string
  label: string
  weights: Partial<Record<personaId, number>>
}
```

Expected evolution for #212:

```text
baseline +/- attributed lever deltas, with lag/decay state
```

Preserve the readout contract: every active lever must remain attributable in
"Who You're Targeting." Advertising/marketing should attach as another producer
against the same seam, not by special-casing spawn or UI.

## Tunables

Demand-shaping tunables live in `data/tunables.json` under `demandShaper` and
load through `src/game/data/tunables.ts`.

Known groups:

- `windowSize`
- `trendEpsilon`
- `locationProfiles`
- `inventoryInfluence`
- `reputationInfluence`
- `coverageCategoryByPersona`

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
- No bypass of seeded RNG. `drawPersona(rng)` consumes the injected stream.
- No second demand taxonomy. Persona mix remains canonical.
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

# EndCard

Terminal run-summary. Listens for the six career-ending events, settles a
single immutable `EndCardData`, and re-broadcasts `career:game_over` so the UI
can render the end screen. "Who you were when the run ended."

## Public API (`index.ts`)
- `createEndCardManager(deps)` → `EndCardManager`.
  - `deps`: `bus` (EventBus), `characterProfile` (CareerProgression), `tierManager`.
- `EndCardManager`: read-only `data` getter, plus `getSerializableState()` /
  `restoreState()` for save/load.
- `getFlavorText(reason, backstoryId)` — pure copy lookup (also used in tests).
- `END_CARD_OUTCOME` — `Record<EndCardReason, 'failure' | 'success'>`.
- Types: `EndCardManager`, `EndCardManagerDeps`, `EndCardData`,
  `EndCardManagerState`, `EndCardReason`, `EndCardOutcome`.

## Behavior
- `settle(day, reason)` is **idempotent**: once `data` is set the first terminal
  event wins and all later ones are ignored (a run ends exactly once).
- Captures `playerName` + `backstoryId` from the profile, the `careerYear`
  derived from `day` via `DAYS_PER_YEAR` (`GameClock`), `tierReached` off
  `tierManager.currentTier`, and the resolved `flavorText`.

## Events
- **Consumes (each → `settle`):** `career:bankruptcy_terminal` (bankruptcy),
  `regulatory:ag_complaint_terminal` (ag_complaint),
  `career:indictment_terminal` (indictment), `career:retired` (retire),
  `career:pe_sellout` (sellout), `career:family_handoff` (family_handoff).
- **Emits:** `career:game_over` (`{ day, data }`).

## Data
- `flavorData.ts` — per-`(reason, backstoryId)` end-of-run copy. No JSON tunable
  file; the flavor table is code-local.

## Persistence
- `getSerializableState()/restoreState()` round-trip the settled `data` (or
  `null` for a live run) through the world snapshot.

## Collaborators
- `CareerProgression` supplies `CharacterProfile` + `TierManager` and emits most
  of the terminal events; the regulatory meter emits the AG-complaint terminal.

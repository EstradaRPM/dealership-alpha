# CloseEarly

Player action: end the current day early. Unresolved workspace/callback customers walk, triggering a reputation hit proportional to the count.

## Public API (`index.ts`)
- `createCloseEarly({ bus, queue, clock })` → `CloseEarly`
- Types: `CloseEarly`, `CloseEarlyCost`

### `CloseEarly`
- `previewCost()` → `{ walkCount, reputationHit }` — call before showing the confirmation dialog; reads queue state without mutating.
- `execute()` — drains queues, publishes `customer:resolved` (walk) for each workspace/callback customer, publishes `reputation:satisfaction_hit`, publishes `player:close_early`, then calls `clock.advanceDay()`.

## Events emitted (in order)
1. `customer:resolved` (outcome: `'walk'`) — one per walk customer
2. `reputation:satisfaction_hit` — omitted when walkCount is 0
3. `player:close_early` — always emitted; carries `{ day, walkCount, reputationHit }`
4. Full overnight sequence via `clock.advanceDay()`

## Data
- `data/close-early.json` — `reputationHitPerWalk` tunable (default 5).

## Notes
- Only `workspace` and `callback` items with a `customerId` are treated as walks. `routine` and `missed_opportunity` items are silently cleared.

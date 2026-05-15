# Telemetry

Optional, dev-only session recorder. Subscribes to `EventBus` events when enabled, buffers them in memory with the in-game day and a wall-clock offset, and produces a serializable session log + derived metrics for spreadsheet analysis.

## Public API (`index.ts`)
- `createTelemetry({ bus })` → `Telemetry`
- Types: `Telemetry`, `StoredEvent`, `SessionMetrics`, `SessionLog`, per-row types.

### `Telemetry`
- `setEnabled(on)` — attaches/detaches subscriptions. Off by default; off = zero subscription overhead.
- `isEnabled()` — current state.
- `clear()` — empties the buffer and resets the session start time.
- `getEventCount()` — buffered event count (for admin console display).
- `getRawEvents()` — read-only view of the buffer.
- `getMetrics()` — derived metrics computed at call time (not stored).
- `exportSessionLog()` — JSON string of `{ schemaVersion, exportedAt, sessionStartedAt, metrics, events }`.

## Derived metrics
- `dealsPerDay` — count + avg gross/front/back per day from `deal:closed`.
- `closeRateByArchetype` — joins `customer:arrived` (carries archetype label) and `customer:resolved` (carries outcome) by customerId.
- `fniAttachRate` — % of closed deals where `backGross > 0`. A v2 telemetry pass can break this down by product once F&I product detail is published on a dedicated event.
- `cashCurve` — daily revenue/expense/net from `economy:revenue_posted` / `economy:expense_posted`, plus cumulative net.
- `queueProxy` — per-day inflow (admitted/missed) and outflow (resolved closed/walk). True queue-depth snapshots aren't published by `DepartmentQueue` today; this is the available proxy.
- `moraleTrajectory` — per-day `staff:quit` count + cumulative. Per-day staff morale values aren't published; revisit when StaffMorale emits periodic snapshots.

## Data
- `data/telemetry.json` — `cashCurveBucketDays` (reserved; v1 always uses 1), `maxBufferedEvents` (hard cap to bound memory in long sessions).

## Notes
- Subscribes only to a fixed list of existing events (see `TRACKED_EVENTS` in `Telemetry.ts`). Does **not** add new event types.
- When disabled, no subscriptions exist on the bus — no overhead.
- Pure module: no native deps, no file I/O. The admin console handles share/export of the returned string.

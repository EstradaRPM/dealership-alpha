# HistoryLog

Durable, **player-facing** history of notable world events (#208). Fills the gap
left by the App's `floorEvents` buffer (reset every morning), the chapter
cards / day recap (one-shot, not browsable), and Telemetry (dev-only): systems
changed the world with no record a player could review across days.

## Public API (`index.ts`)
- `createHistoryLog({ bus })` → `HistoryLog`
- `createDefaultHistoryLogSnapshot()` — behavior-neutral empty log, used by the
  world-snapshot migration that materializes the key for pre-#208 saves.
- Types: `HistoryLog`, `HistoryEntry`, `HistoryEntryKind`, `HistoryLogSnapshot`,
  `HistoryLogConfig`.

### `HistoryLog`
- `getEntries()` — retained entries, **newest first** (no re-sort needed by UI).
- `getEntryCount()` — retained count.
- `snapshot()/restore()` — persistence (see below).

## What it records
A read-side projection of events other modules already publish — it owns no
game state. Subscribes to a fixed list and distils each into a one-line,
day-stamped entry:

| Event | kind | entry |
| --- | --- | --- |
| `deal:closed` | `sale` | "Sold a unit (cash/financed) — $N gross." |
| `market:shock_started` | `market` | "Market shift: …" |
| `market:shock_resolved` | `market` | "Market settled — … passed." |
| `competitor:price_changed` | `market` | "Rival … raised/cut prices." |
| `career:tier_up` | `tier` | "Promoted to Tier N." |

The daily `market:competitive_pressure` heartbeat is intentionally **not** logged
— it republishes the whole roster every day and would flood the capped log; that
continuous ambient state is a KPI/market-visibility surface, not a discrete entry.

`clock:day_started` keeps a `currentDay` cursor for the one payload
(`deal:closed`) that doesn't carry its own day.

## Data
- `data/historyLog.json` — `maxEntries` (hard cap; oldest entries dropped past
  it to bound memory/snapshot size over long careers).

## Persistence (#208 / #188 contract)
- `snapshot()/restore()` persist the entries, the monotonic `nextId`, and the
  day cursor. Wired into `snapshotWorld`/`restoreWorld` under the `historyLog`
  key; world-snapshot envelope bumped to v4 with a migration that fills an empty
  log for older saves.

## UI
- Surfaced by `src/ui/HistoryScreen`, reachable from the in-game menu
  ("History"). The screen renders `getEntries()` directly.

## Notes
- Subscribes only to existing events — adds no new event types.
- Entries are immutable plain data; no functions, no class instances.

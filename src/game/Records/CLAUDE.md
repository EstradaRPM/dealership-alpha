# Records

The game's durable **high-water marks** (#329, B1 slice 2 of the Reveal spine).
Six personal bests that survive the whole career, plus a `records:broken`
announcement the moment one is beaten. Slice 3 (#330) crowns those on the
Reveal feed and folds `recordBroken` into the drama ranking — see
`src/ui/Reveal/buildReveal.ts` (`isCrownworthyRecord` / `crownReactionText`).

Records is a **scoreboard, not a rule** — nothing in the sim branches on a mark.

## Public API (`index.ts`)
- `createRecords({ bus, config? })` → `Records`
- `createDefaultRecordsSnapshot()` — behavior-neutral empty marks, used by the
  world-snapshot migration that materializes the key for pre-#329 saves.
- `RECORD_KINDS` — the six kinds, iteration order.
- Types: `Records`, `RecordsDeps`, `RecordsConfig`, `RecordsSnapshot`,
  `RecordKind`, `RecordMark`, `RecordMarks`.

### `Records`
- `getMark(kind)` / `getMarks()` — standing marks (`null` = never set).
- `currentStreak` — live run of consecutive selling days (the *best* run is the
  `bestStreak` mark).
- `getDayTotals()` — the in-progress day's `{ gross, units }`. Records is the
  **game-side source of truth** for these; before it, day gross existed only as
  an unpersisted React ref in `useDayLoop`.
- `snapshot()/restore()` — persistence (see below).

## The six marks

| Kind | Measures | Settles on |
| --- | --- | --- |
| `bestDayGross` | highest single-day total gross | `floor:day_complete` |
| `bestMonthGross` | highest month total gross | `clock:month_ended` |
| `bestPvr` | best day gross ÷ units | `floor:day_complete` |
| `bestStreak` | longest run of consecutive selling days | `floor:day_complete` |
| `bestSingleDeal` | fattest individual deal, on **front** gross | `deal:closed` |
| `mostUnitsInDay` | highest unit count closed in a day | `floor:day_complete` |

Definitions held deliberately:
- **Gross = `frontGross + backGross`, units = one per `deal:closed`** — TierGate's
  exact formula, so a crowned "best month" agrees with the number the tier gate
  graded that month.
- **`bestSingleDeal` is front-only** — the desk's win on the car itself, not the
  F&I box that rode behind it.
- **A selling day = ≥ 1 unit closed.** The streak tracks floor momentum;
  whether the day was profitable is the separate `bestDayGross` axis, so
  neither mark shadows the other.
- **Strictly greater breaks a record.** Matching it does not. A non-positive
  value never crowns — an empty day is not an achievement.
- **A first-ever mark still fires**, with `previousValue: null`. The engine
  reports the truth (this IS your best day); the *presentation* decides whether
  a first-ever mark earns a crown on the feed. **#330 decided: it does not** —
  a crown means you beat yourself, and a career's first day sets four or five
  marks at once. The mark stands in the scoreboard from the moment it's set;
  only the celebration waits for a beat.

Deliberately not tracked (decided at slice time, #329): best-week (redundant
between day and month — it earns its crown when B4 lands the week bite),
best-quarter/year (T7 group altitude, lands with B5), reputation/CSI marks
(ambient state, not a bet-reveal moment).

## Events
- **Emits:** `records:broken` — `{ day, kind, value, previousValue, vehicleId?,
  customerId?, month? }`. `vehicleId`/`customerId` ride `bestSingleDeal` only;
  `month` rides `bestMonthGross` only.
- **Consumes:** `deal:closed` (per-deal front gross + day/month accumulation),
  `floor:day_complete` (day settle), `clock:month_ended` (month settle),
  `clock:day_started` (day cursor — `deal:closed` carries no day of its own,
  same problem HistoryLog solves the same way).

### Ordering
The day settles on `floor:day_complete`. Records is wired in `createWorld`, so
its subscription runs **before** the app's day-close handler that builds the
Reveal — every `records:broken` for the just-closed day has already fired by the
time the feed is assembled. `tests/Records.test.ts` guards this at the bus
level. `clock:month_ended` fires later in the overnight sequence, so the day is
always settled before the month is.

## Data
`data/tunables.json` → `records`:
- `pvrMinUnits` — minimum units in a day before its PVR can crown. A one-unit
  day's PVR is just that deal's gross (already `bestSingleDeal`), so PVR earns
  its own crown only once it means what it means in the business: volume held
  at gross.

## Persistence (#188 contract)
`snapshot()/restore()` carry the marks, the day cursor, the in-progress day and
month accumulators, the running month index, and the live streak — so a mid-day
reload keeps the day's haul and a mid-month reload keeps the month's. World seam
key `records`; envelope bumped to v17 with a migration that materializes
`createDefaultRecordsSnapshot()` for older saves (an old save simply crowns its
first marks on the next qualifying day).

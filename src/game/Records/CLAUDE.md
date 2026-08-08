# Records

The game's durable **high-water marks** (#329, B1 slice 2 of the Reveal spine).
Seven personal bests that survive the whole career, plus a `records:broken`
announcement the moment one is beaten. Slice 3 (#330) crowns those on the
Reveal feed and folds `recordBroken` into the drama ranking — see
`src/ui/Reveal/buildReveal.ts` (`isCrownworthyRecord` / `crownReactionText`).

Records is a **scoreboard, not a rule** — nothing in the sim branches on a mark.

## Public API (`index.ts`)
- `createRecords({ bus, config? })` → `Records`
- `createDefaultRecordsSnapshot()` — behavior-neutral empty marks, used by the
  world-snapshot migration that materializes the key for pre-#329 saves.
- `RECORD_KINDS` — the seven kinds, iteration order.
- Types: `Records`, `RecordsDeps`, `RecordsConfig`, `RecordsSnapshot`,
  `RecordsSnapshotV1`, `AnyRecordsSnapshot`, `RecordKind`, `RecordMark`,
  `RecordMarks`.

### `Records`
- `getMark(kind)` / `getMarks()` — standing marks (`null` = never set).
- `currentStreak` — live run of consecutive selling days (the *best* run is the
  `bestStreak` mark).
- `getDayTotals()` — the `{ gross, units }` of the day the clock is sitting on.
  Records is the **game-side source of truth** for these, and since #331 the
  only one: the FLOOR-OPEN HUD's running gross, the day-close recap's `gross`,
  and the Reveal's gross argument all read it (before #331 the app kept a
  parallel unpersisted tally in `useDayLoop`, which reset to $0 on a mid-day
  reload while this one did not). The accumulators clear on
  `clock:day_started` — **not** at day-complete — so the closed day's final
  figure is still standing when the day-close consumers read it.
- `snapshot()/restore()` — persistence (see below).

## The seven marks

| Kind | Measures | Settles on |
| --- | --- | --- |
| `bestDayGross` | highest single-day total gross | `floor:day_complete` |
| `bestMonthGross` | highest month total gross | `clock:month_ended` |
| `bestPvr` | best day gross ÷ units | `floor:day_complete` |
| `bestFniPvr` | best month **back** gross ÷ retail units | `clock:month_ended` |
| `bestStreak` | longest run of consecutive selling days | `floor:day_complete` |
| `bestSingleDeal` | fattest individual deal, on **front** gross | `deal:closed` |
| `mostUnitsInDay` | highest unit count closed in a day | `floor:day_complete` |

Definitions held deliberately:
- **Gross = `frontGross + backGross`, units = one per `deal:closed`** — TierGate's
  exact formula, so a crowned "best month" agrees with the number the tier gate
  graded that month.
- **`bestSingleDeal` is front-only** — the desk's win on the car itself, not the
  F&I box that rode behind it.
- **`bestFniPvr` is a MONTH mark, not a day one** (#373). It is the mark the F&I
  posture dial is chased on, and the dial is a *standing* bet (#366) — a single
  day's back end is noise against which two or three customers happened to walk
  in. It is `backGross ÷ units` over the month, the whole back end (products +
  reserve), counted on its own accumulators rather than derived from
  `bestMonthGross`: what the finance office made per car is a different question
  from what the store made per day. A month that retailed nothing crowns
  nothing, and neither does a month that made no back end at all — `tryBreak`
  refuses a non-positive value, so an all-cash month leaves the mark standing
  where it was rather than setting it to zero. There is deliberately **no
  `pvrMinUnits`-style volume floor on it**: unlike `bestPvr` (which a one-unit
  day would make a duplicate of `bestSingleDeal`), nothing else measures the
  back end, so a thin month's F&I average is still the only reading of it.
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
  `month` rides the two month marks (`bestMonthGross`, `bestFniPvr`).
- **Consumes:** `deal:closed` (per-deal front gross + day/month accumulation),
  `floor:day_complete` (day settle), `clock:month_ended` (month settle),
  `clock:day_started` (day cursor — `deal:closed` carries no day of its own,
  same problem HistoryLog solves the same way — **and** the day-accumulator
  reset, per `getDayTotals()` above).

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

**#373 took the blob's own `schemaVersion` 1 → 2** (the `bestFniPvr` mark plus
`monthBackGross`/`monthUnits`) and **did not move the envelope** — the `modules`
key set is unchanged, which per `docs/save-migration-recipe.md` makes it this
module's problem, not the envelope's (the #359 Facility call, same shape).
`restore` takes the `AnyRecordsSnapshot` union: a v1 blob's missing seventh mark
materializes as `null` (**not** as a `{}` mark the feed would then try to crown)
and the month back-end tally restarts from the reload rather than being
reconstructed from a figure the save never kept. `data/fixtures/tier-2.json` was
deliberately **not** re-stamped and still carries a v1 records blob — it loads
through the real path, which is what the web drive on #373 confirmed.

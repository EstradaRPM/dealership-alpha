# GameClock

Day-cycle driver. Owns the current day index, season, and the overnight sequence that fans out to every overnight-listener module.

## Public API (`index.ts`)
- `createGameClock()` → `GameClock` (methods include `advanceDay()`, current-day accessors).
- Types: `GameClock`, `Season`.
- Constants: `DAYS_PER_WEEK`, `DAYS_PER_SEASON`, `DAYS_PER_YEAR`.

## Events emitted (in order, every `advanceDay()`)
1. `clock:day_ended`
2. `clock:overnight_payroll`
3. `clock:overnight_inventory_arrival`
4. `clock:overnight_reputation_drift`
5. `clock:overnight_followup_decay`
6. `clock:day_started`
7. `clock:week_ended` *(only when `endingDay % 7 === 0`; payload `{ day: endingDay }`)*
8. `clock:month_ended` *(only when `endingDay % clock.daysPerMonth === 0`; payload `{ day: endingDay }`; slotted after `week_ended` so week-close consumers settle first)*

Other modules hook into this sequence — order matters. If you add a new overnight step, slot it deliberately and update `events.ts` + this doc.

## Data
`data/tunables.json` → `clock.daysPerMonth` (~30-day month-close cadence), loaded via `loadTunables()`. All other durations are constants exported from `GameClock.ts`.

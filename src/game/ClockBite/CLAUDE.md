# ClockBite

The **bite** lifecycle — one altitude above `DayLoopController`'s day lifecycle.
The player chooses how big a bite of the calendar to run before they look again
(a day, a week, a month), and the size of the bite is itself a bet: a bigger
bite wagers that your standing policy and your staff carry the store without
your judgment.

Introduced by **#381** (phase 11, B4 drive-the-clock, tracer).

## The rule (ruled 2026-08-11 — do not re-open)

**You can skip ahead exactly as far as your people can cover for you.** One
rule, one sentence, and it is also the reason the mechanic works: a day can only
run headless when nothing escalates to the player, and what stops things
escalating is a desk that is staffed and at threshold. The door and the
capability are the same fact, so the player never learns a second rule.

| Bite | Door |
|---|---|
| Run the Day | always open |
| Run the Week (7 days) | the used desk covers **both** discount desking and trade approval |
| Run the Month (30 days) | a **general manager** (`gm`) is staffed |

Rejected doors, recorded in `data/clock-bites.json` so they are not re-proposed:
a bare tier number (opens the door while the desks are empty, so the bite would
promise a week and halt on day 1), and an earned clean-day streak (a new
persisted counter, and the player has to infer why the button came and went).

## Public API (the `index.ts` barrel is the whole surface)

- `availableBites(coverage, config?) → readonly BiteOption[]` — every bite,
  always all three; a locked one carries its `lockedReason` sentence rather than
  being dropped.
- `runBite(biteId, { advanceOneDay, checkHalt }, config?) → BiteRun` — runs the
  bite headless and synchronously.
- `haltReason(id, config?) → HaltReason` — the plain-language sentence for a
  halt, off the catalog.
- `loadClockBites()` / `ClockBitesConfigSchema` + the id unions and their
  `as const` arrays.

## Hard rules

- **No sibling imports.** ClockBite never sees `StaffOrg`, `DayLoopController`
  or `FloorSim`. The composition root resolves coverage from the live roster
  (`resolveBiteCoverage`, `src/app/config.ts`) with the **existing** act-gate
  predicates — the same three reads `buildManagerStatus` makes — and injects both
  closures. A predicate re-derived here is how the button and the desk start
  disagreeing.
- **The doors live in `data/clock-bites.json`, the predicates in code.** Naming
  the required coverage in the file is what keeps the two from drifting: #371
  had to delete a `hasDeskManager` boolean that lived in code precisely because
  it satisfied every staff door at once.
- **`runBite` does not check the door.** `availableBites` is the door and the
  picker obeys it. Keeping the runner a pure "run N days, stop when asked"
  primitive is what lets a test drive it with no roster at all.
- **A halted bite leaves no remainder and never auto-resumes.** The module holds
  no state between calls, by construction. A run that silently continued past
  the thing that interrupted it would be the bite making the player's decision
  for them.
- **The halting day still counts.** `checkHalt` is asked *after* the day ran —
  the day happened, and `daysRun` includes it.
- **The day bite is the LIVE floor, not a headless run.** The runner is what a
  bite *above* the day uses. `Run the Day` routes to the existing
  `handleNextDay` so the intra-day pause/speed control still drives it; running
  the day headless would delete the floor view, which is the opposite of the
  design. `runBite('day', …)` still works and is unit-tested — the app simply
  does not take that path.
- **Nothing here is persisted.** The picker's default is the day, every time. A
  remembered bite is a standing instruction to skip, which is the opposite of a
  bet you place each time. The world-snapshot envelope is untouched by this
  module and there is no migration to look for.

## Halts

A bite stops at the first moment the store needs a human. The composition root
latches the three signals on the EventBus and clears them at the start of each
run:

| id | latched on |
|---|---|
| `escalation` | `trade:escalated` / `discount:escalated` |
| `insolvent` | `career:bankruptcy_terminal` / `career:bankruptcy_contraction` |
| `gate_verdict` | `tierGate:month_verdict` |

`tierGate:month_verdict` fires unconditionally on every `clock:month_ended`
(`TierGate.ts`), so **a bite that crosses a month boundary always halts there**.
That is the design, not an oversight: the month's grade is the moment you must
look, and it is what syncs the month bite to the calendar after its first run.

## Events

ClockBite emits nothing and subscribes to nothing — it takes no `EventBus`. The
halt signals are observed by the composition root, which is the only thing that
knows what a "moment the player is needed" looks like in this app.

## Data

`data/clock-bites.json` — `coverage[]` (the facts and their missing-sentences),
`bites[]` (`{ id, label, days, requires }`) and `halts[]` (`{ id, sentence }`).
Loaded through `parseData` + `ClockBitesConfigSchema`. Every nested object is
`.strict()`; the top level is not, so the file's `_doc` annotations survive
review and are stripped at load.

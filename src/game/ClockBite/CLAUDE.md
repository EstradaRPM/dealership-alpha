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
- `coverageAcrossStores(covers) → readonly CoverageFactId[]` (#385) — the cover
  the ladder gates on across a **set** of `StoreCover`s: a fact holds only if
  every store holds it, and an **empty** set covers nothing (deliberately not
  the `every`-over-nothing answer, which would read "every store is covered"
  and quietly open the month).
- `runBite(biteId, { advanceOneDay, checkHalt }, config?) → BiteRun` — runs the
  bite headless and synchronously. `checkHalt` returns a `BiteHalt`
  (`{ id, subject? }`) — **one seam for every class of halt** (#384).
- `haltReason(id, config?, subject?) → HaltReason` — the plain-language sentence
  for a halt, off the catalog, with `{subject}` filled when the reason names
  one.
- `biteStarBudget(biteId, config?) → number` (#382) — how many individual
  reactions the Reveal covering this bite may surface. Read by
  `src/ui/Reveal/buildReveal.ts` at **both** grains: the day bite's budget is
  the day Reveal's, so the day has no constant of its own.
- `loadClockBites()` / `ClockBitesConfigSchema` + the id unions and their
  `as const` arrays.

`BiteOption.stakes` (#383) is what picking this bite **wagers**, stated verbatim
by the picker before the player commits — a bet you cannot read before placing is
not a decision. `null` only for the day, which is watched as it happens; the
schema **refuses** any bite above the day that omits it, so a fourth rung cannot
ship blind.

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
| `owner_interrupt` | the overnight channel — `src/app/ownerInterrupts.ts` (#384) |
| `desk_order` | a standing order no desk can carry out — `src/app/deskOrders.ts` (#385) |

`tierGate:month_verdict` fires unconditionally on every `clock:month_ended`
(`TierGate.ts`), so **a bite that crosses a month boundary always halts there**.
That is the design, not an oversight: the month's grade is the moment you must
look, and it is what syncs the month bite to the calendar after its first run.

## The overnight interrupt channel (#384)

The three halts above stop a run on things that happen **on the floor**. The
game's other class of "a moment you play" fires **between** days, in the
overnight managerial window: somebody asks for a raise, a rival makes one of
your people an offer. Inside a run every one of those would be raised and
cleared with nobody there to answer — the store auto-answering by silence.

- **One channel, not a second list.** `createOwnerInterruptChannel`
  (`src/app/ownerInterrupts.ts`) latches into the **same** `biteHaltRef` the
  floor signals do, so "the first signal of a run is the one that stopped the
  clock" is one rule over both classes. `owner_interrupt` is the single halt id;
  which moment it was is carried by the `{subject}` slot.
- **Registration, not enumeration.** A moment is declared once, with the event
  that raises it and the read that names who needs the owner. The runner learns
  no event names, and `useDayLoop` learns only "the channel raised something".
- **The test is a DECISION, not notability.** A finished construction job and a
  published headline are deliberately **not** declared: they ride the Reveal
  like any other beat. Halting on everything notable turns a week into seven
  days with extra steps.
- **The bite ends after the day the moment was raised on**, exactly like a floor
  halt. `clock:day_started` fires inside `nextDay()`, so the store plays that
  day and then stops — which is what keeps a run ending MANAGERIAL with one
  closing write. Stopping with a day open and un-played is a state the save
  layer has no shape for, and the deadline on a rival's offer is days out, so
  nothing is lost by playing the day.
- **Nothing is presented twice.** The channel answers nothing and publishes
  nothing; the raise stays outstanding on `StaffOrg` and the People surface
  presents it exactly as it does in day-by-day play.

## Events

ClockBite emits nothing and subscribes to nothing — it takes no `EventBus`. The
halt signals are observed by the composition root, which is the only thing that
knows what a "moment the player is needed" looks like in this app.

## The star budget (#382)

`starBudget` rides the bite, beside its day count, because it is a property of
the **window the feed covers** — not of the drama ranking, which is why
`tunables.reveal.drama.starBudget` was deleted rather than left beside it. A
week runs seven days through the same pool, so a day's budget would throw away
roughly seven times as much and throw it away silently. It grows **sub-linearly**
(5 / 9 / 14 against 1 / 7 / 30 days): seven days of reactions at seven times the
stars is a scroll, not a beat. The schema refuses a longer bite carrying a
smaller budget. What the budget cut is stated by the Reveal as one line, and a
crowned record is admitted before the budget is spent.

## The bet, settled (#383)

The bite is a bet, and the Reveal covering it **settles** the bet:
`biteBetVerdictScoreline` (`src/ui/Reveal/buildReveal.ts`) scores the lean the
run started with against the days that actually ran. The bet is the **first**
day's captured `PrepBet` — the per-day capture keeps running inside the bite
(that is what feeds each day's own beat into the pooled feed), and the bite's own
bet is the one standing when the run began. It is **read back off
`BiteDayBeats[0]`, never copied into a second slot**, so nothing can disagree
about what was wagered, and nothing new is persisted. A halted bite is scored on
the days it ran; a run whose days named no favorite is not scored at all.

## The month rung (#385, closing #124)

The top rung is **the same runner**, asked for thirty days instead of seven.
There is no batch mode and there must not be one — a second code path is how the
month grain starts behaving differently from the week for a reason nobody can
find later. `tests/ClockBite.month.test.ts` pins thirty runner-driven days
against thirty hand-driven ones, surface for surface.

- **The GM is the door; the DESKS earn the silence.** A GM cannot be staffed
  without the used desk beneath it, so reading the GM in `resolveBiteCoverage`
  is reading the *implication*. What actually makes the floor drain return
  `escalated: 0` is the at-threshold UCM (`t_o_closing` for discounts,
  `condition_reading` for trades). A GM standing beside a green desk suppresses
  nothing and the month still halts on the escalation — demonstrated, not
  asserted, in `tests/ClockBite.month.test.ts`.
- **The gate is written over a SET of stores.** `resolveStoreCovers`
  (`src/app/config.ts`) returns one `StoreCover` per store and
  `coverageAcrossStores` trips if **any** store lacks the cover. One store today
  ⇒ the same answer as reading it directly; the T6 dealer-group layer (phase 16)
  adds members to that list and the rule is unchanged rather than rewritten.
  `DEALERSHIP_ID` (DayLoopController barrel) is the one definition of the
  reserved `dealershipId` — the ladder and the demand slip must not identify the
  same store by two different strings.

## Standing desk orders (#385)

`data/desk-orders.json` + `src/app/deskOrders.ts` — #124's **second** must-handle
class, beside the floor halts and the overnight channel.

A bite runs the store on the player's standing orders; that is literally what
the stakes copy wagers. So an order that **no desk can carry out** is the run
proceeding on a policy that is not actually in force, silently, for up to thirty
days. That is a decision the owner has to make — put the dial back, or hire/grow
the desk — and a decision is what stops a run.

- **An order only counts once the dial is off its DEFAULT.** The default *is*
  "no instruction": market pricing is the honest suggestion the store already
  stamps on an intake, a flat lean expresses no preference, and the default F&I
  posture makes no bet on the payment mix. A player who never touched a dial is
  never halted by this, which is what keeps it a consequence of a choice rather
  than a tax on the ladder.
- **Only levers a NAMED DESK performs are declared.** Three of the five per-slot
  levers qualify: `pricingStrategy` (UCM `pricing` act gate), `sourcingLean`
  (UCM `condition_reading` act gate) and `fniPosture` (an `f&i-manager` presence
  test, not a threshold). Hours-of-op is the owner's own; the **trade policy** is
  a multiplier inside the appraisal math and is in force whoever is standing at
  the desk, so there is no state in which it goes uncarried-out. Not declaring
  those two is the answer, the same way #384 does not declare a moment that only
  reports.
- **Registration, not enumeration**, exactly like the overnight channel. A
  fourth standing lever needs a declaration and a line of copy — no new halt id,
  no runner edit.
- **The executability read comes from `buildManagerStatus`**, the same act-gate
  reads the engine gates on and the same source `resolveBiteCoverage` derives
  from. A second read here is how the halt and the desk start disagreeing about
  what the desk is doing (#371's deleted `hasDeskManager` boolean).
- **It is a READ, not a latch, and the latch is asked FIRST.** A thing that
  happened today outranks a standing condition that was already true when the
  run began. Being a read is also what makes a manager poached away mid-month
  stop the run on the day their orders went dead.
- **ONE dead order is stated, in declaration order.** A run stops at one thing
  and states one sentence; listing the rest would be a report. Fix that one, run
  again, and the next surfaces.

## Data

`data/clock-bites.json` — `coverage[]` (the facts and their missing-sentences),
`bites[]` (`{ id, label, days, starBudget, stakes?, requires }`) and `halts[]`
(`{ id, sentence }`). `data/owner-interrupts.json` carries the per-moment
`subject` copy that fills the `owner_interrupt` halt's `{subject}` slot, and
`data/desk-orders.json` does the same for `desk_order` (#385) — the halt's
cadence is written once here, who or what needed you once beside the thing that
raised it.
Loaded through `parseData` + `ClockBitesConfigSchema`. Every nested object is
`.strict()`; the top level is not, so the file's `_doc` annotations survive
review and are stripped at load.

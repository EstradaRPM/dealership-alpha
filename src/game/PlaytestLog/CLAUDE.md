# PlaytestLog

Dev instrumentation for the #74 playtest gate (#332, #333). Records what the
player observes during a playtest round, **walks them through the round's
script**, and exports the lot as one paste-ready markdown blob. In the
`Telemetry` mold: **nothing in the sim reads it and nothing branches on it.**

## Why it exists

Three frictions were stalling round 1, all structural:

1. **In-the-moment reactions are perishable.** Recording one meant leaving the
   game surface mid-day on a phone — which corrupts the very reading the
   observation sheet's Q1 takes (felt day length). A flag has to cost one tap.
2. **The finance mix was unobservable.** Two of #74's acceptance criteria are
   about payment method / down payment / credit tier, and no screen shows any of
   it, so the script asked the player to hand-copy `deal:closed` payloads out of
   the DEV event log. The bus already carries the whole structure.
3. **The script itself lived on a second screen** (#333). A round-1 doc open in
   a browser tab beside Expo Go is a handoff you have to remember to consult; by
   day 3 nobody does, and the round's instructions — *hire a second salesperson
   before opening*, *cut one ask and raise another* — are exactly the ones that
   make the measurement work. The script is now presented at the two boundaries
   where its instructions are actionable.

## Public API (`index.ts`)

- `createPlaytestLog(driver, options?)` → `PlaytestLog`
  - `hydrate()` — load the persisted blob. Corrupt or absent ⇒ empty log, never a throw.
  - `flag(note, ctx)` — manual entry; `note` may be empty (a bare flag is valid).
  - `recordDeal(deal)` / `recordWalk(walk)` — the auto-capture entrypoints.
  - `recordStep(step)` / `recordAnswer(answer)` — the guided-script entrypoints
    (#333). Both are append-only with **last write per id winning**, so a
    mis-tap is corrected by tapping again rather than by mutating history.
  - `entries()` / `count()` / `counts()` — read model.
  - `flush()` — resolves once every append so far has reached the driver.
  - `clear()` — empty the log and the driver cell.
  - Options: `now` (test clock), `maxEntries` (default 2000, oldest dropped).
- `attachPlaytestCapture(bus, log, getDay)` → detach function.
- `exportMarkdown(entries, meta, script?)` / `computeFinanceMix(deals)` — pure
  formatters. The script argument exists so tests can inject a fixture;
  production always takes the loaded one.
- `loadPlaytestScript()` / `deriveGuideState(script, entries)` /
  `pendingProbes(state, when)` / `DAY_DONE_STEP_ID` — the guided read model.
- Types: `PlaytestLog`, `PlaytestContext`, `PlaytestEntry` (+ the five variants),
  `PlaytestEntryCounts`, `PlaytestExportMeta`, `FinanceMix`, `PlaytestScript`,
  `PlaytestScriptDay`, `PlaytestScriptStep`, `PlaytestProbe`,
  `PlaytestGuideState`, `ProbeWhen`.

## The guided script (#333)

`data/playtest-script.json` is the round-1 script in the shape the phone
renders; `docs/planning/playtest-round-1.md` stays the human-readable source of
truth. Sessions flatten into **one linear list of day nodes**, each with a
brief, a step checklist, and watch-probes tagged `day_open` or `day_close`.

**The cursor is the log.** `deriveGuideState` returns the first day node not
marked done — there is no second cursor to persist, and nothing to keep in sync.
That is what makes it survive the things a playtest actually does to it: a Reset
Save, a whole second career for session B, an extra unscripted day played for
the feel of it. Ticking individual steps is *evidence*; the reserved
`DAY_DONE_STEP_ID` marker is what advances the cursor.

An unticked step is signal — it usually means the instruction couldn't be
followed — so the export renders the full script with its checkboxes rather than
only the entries that exist.

The observation sheet stays a keyboard exercise (see the note at the
bottom). Probes are the short, in-the-moment half; the sheet is the reflective
half, and typing that many paragraphs on a phone is its own friction.

## Events

Publishes none. **Consumes** exactly two, via `attachPlaytestCapture`:

- `deal:closed` — the full finance structure. Carries no day (DealEngine has no
  clock), so the day comes from the injected `getDay` cursor at capture time —
  the same seam HistoryLog and Records use.
- `staff:auto_resolved` with `outcome: 'no_sale'` — the *named* walk reason,
  which the on-screen walk-off line flattens into one sentence. The `closed`
  half is ignored: `deal:closed` already carries it with more detail.

Capture stays attached for the whole session while a world exists — unlike the
admin console's opt-in bus log. The finance mix is a **rate** question, so a
partial sample answers it wrongly.

## Persistence

Its own `StorageDriver` cell (`driverFactory('playtest-log')`, wired in
`src/app/services.ts`), deliberately **outside the world save envelope**. Three
consequences that are the point rather than a side effect:

- no save-version bump and no migration for a dev tool;
- the log survives the admin console's **Reset Save**;
- it spans a whole multi-day round rather than one career.

Writes are write-behind through a single serialized promise chain, so an append
never makes the UI wait. A failed write is swallowed, never retried, and never
rejects the chain — a rejected chain would silently stop all *later* appends.
Dropping one write is self-healing: every append rewrites the whole blob.

## Surfaces

- `src/ui/PlaytestFlag/` — the always-on-screen flag FAB + note sheet. Pure
  presentation; it never touches the log, the world or the bus. Context is
  stamped by the parent on `onOpen` (FAB tap), not on `onSave`.
- `src/ui/PlaytestGuide/` — the guided card: brief, step checklist, probes,
  known-dark list, "Day done →". Also pure presentation. `AppOverlays` presents
  it on `clock:managerial_prep` and `floor:day_complete` — bus-driven, because a
  phase change doesn't reliably re-render the overlay channel — and **queues it
  behind** the recap, month close, chapter card, recovery beat, end card and the
  two escalation modals. A due boundary waits rather than stacking on a beat the
  player is already reading. A day-close boundary with every probe answered is
  dropped instead of interrupting for an empty card.
- `AdminConsole` → **PLAYTEST LOG** section — per-kind counts, Export (share
  sheet), Clear (confirmed).

All three are `__DEV__`-gated at the `AppOverlays` composition site.

## Note

The observation sheet stays in
`docs/planning/playtest-round-1.md` — it is post-session reflection answered at
a keyboard. This log is the *evidence* that makes answering it recall rather
than reconstruction.

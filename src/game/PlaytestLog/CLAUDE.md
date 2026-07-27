# PlaytestLog

Dev instrumentation for the #74 playtest gate (#332). Records what the player
observes during a playtest round and exports it as one paste-ready markdown
blob. In the `Telemetry` mold: **nothing in the sim reads it and nothing
branches on it.**

## Why it exists

Two frictions were stalling round 1, both structural:

1. **In-the-moment reactions are perishable.** Recording one meant leaving the
   game surface mid-day on a phone — which corrupts the very reading the
   observation sheet's Q1 takes (felt day length). A flag has to cost one tap.
2. **The finance mix was unobservable.** Two of #74's acceptance criteria are
   about payment method / down payment / credit tier, and no screen shows any of
   it, so the script asked the player to hand-copy `deal:closed` payloads out of
   the DEV event log. The bus already carries the whole structure.

## Public API (`index.ts`)

- `createPlaytestLog(driver, options?)` → `PlaytestLog`
  - `hydrate()` — load the persisted blob. Corrupt or absent ⇒ empty log, never a throw.
  - `flag(note, ctx)` — manual entry; `note` may be empty (a bare flag is valid).
  - `recordDeal(deal)` / `recordWalk(walk)` — the auto-capture entrypoints.
  - `entries()` / `count()` / `counts()` — read model.
  - `flush()` — resolves once every append so far has reached the driver.
  - `clear()` — empty the log and the driver cell.
  - Options: `now` (test clock), `maxEntries` (default 2000, oldest dropped).
- `attachPlaytestCapture(bus, log, getDay)` → detach function.
- `exportMarkdown(entries, meta)` / `computeFinanceMix(deals)` — pure formatters.
- Types: `PlaytestLog`, `PlaytestContext`, `PlaytestEntry` (+ the three variants),
  `PlaytestEntryCounts`, `PlaytestExportMeta`, `FinanceMix`.

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
- `AdminConsole` → **PLAYTEST LOG** section — per-kind counts, Export (share
  sheet), Clear (confirmed).

Both are `__DEV__`-gated at the `AppOverlays` composition site.

## Note

The 12-question observation sheet stays in
`docs/planning/playtest-round-1.md` — it is post-session reflection answered at
a keyboard. This log is the *evidence* that makes answering it recall rather
than reconstruction.

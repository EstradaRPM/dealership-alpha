# Manager Desk Shell Contract

> **Superseded by the UI rebrand (S2, #215).** `DayLoopShell` is retired. The
> MANAGERIAL phase now lives in the 5-tab `AppShell` (`src/ui/AppShell/`):
> `Today` + `Market` mount in the **Home** tab (`src/ui/HomeTab/`); `Prep` +
> the department dock mount in the **Operations** tab (`src/ui/OperationsTab/`);
> the day action is pinned in the shell footer; the live floor is a full-screen
> MODE, not a tab. The mount-point taxonomy below still describes *which surface
> goes where* — read tab names for the old region names.

Issue #215 originally moved the MANAGERIAL phase from an unbounded card stack
into the Manager Desk shell. New between-day UI must mount into one of the shell
regions (now tabs) or an existing route/overlay type rather than appending
another full-width card to a single scroll.

## Mount Points

- `Today`: just-ended-day recap, results, reputation deltas, and other "what
  happened today" summaries.
- `Market`: demand mix, market state, competitor context, pricing readouts, and
  other external conditions the player should plan around.
- `Prep`: next-day controls and ownership levers such as pricing, auction,
  hiring, hours, advertising, inventory prep, and trade policy.
- `Alerts`: non-blocking manager summaries that need attention but should not
  stop the player from opening the next day. Examples: office-needs-review,
  KPI/month-close follow-up, service backlog, trade escalation summaries, and
  department queues that deserve a manager glance.
- Department destinations: deeper work owned by Sales, Service, BDC, Office,
  or Lot belongs behind `BottomNav`/department routes, with Manager Desk rows
  linking or dispatching to those surfaces when needed.
- Blocking overlays: must-answer interrupts only. Month-close interstitials,
  chapter/rebrand beats, hand-play modals, terminal end cards, and future
  mandatory decisions stay as overlay components owned by the composition root.
- Start/meta destinations: main menu, character creation, save/load, settings,
  admin, rollback, and end-of-career flows remain Navigator destinations, not
  Manager Desk regions.

## Implementation Rule

`DayLoopShell` is a thin UI shell. The composition root builds read models and
passes callbacks; feature components do not reach into game-logic internals.
If a new managerial surface cannot be placed by the table above, update this
contract first and keep the shell mount explicit.

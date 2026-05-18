# DepartmentScreen

Generic resolve-list for one department (#76). Renders a `DepartmentQueue`
slice and dispatches a single `onResolve(id)` per tapped row. Pure view — no
EventBus, no game-logic access; the composition root owns the queue and the
badge decrement.

## Public API (`index.ts`)
- `DepartmentScreen` — the component.
- `DepartmentScreenProps` — `{ title, items, onResolve, onClose, renderItem?, background? }`.

## Scope
- Drives **Service / BDC / Office / Lot**. Sales is NOT a resolve-list — the
  Sales tab routes to the hand-play workspace, so this never mounts for sales.
- `renderItem` / `background` are unused in v1. They exist so art (vehicle
  models, lot/shop backdrops, customer icons) and richer rows layer on later
  without touching resolve logic — do not delete them as "dead".

## Notes
- Empty queue renders an empty-state, not a disabled screen (see #71 — every
  tab must respond, badge count is visual only).

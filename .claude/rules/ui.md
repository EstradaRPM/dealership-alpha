---
paths: ["src/ui/**", "App.tsx"]
---

# UI — `src/ui/**`

**Game logic is fully separable from UI.** A screen renders state and dispatches actions.
It never reaches into game-logic internals, never imports past a module's `index.ts` barrel,
and never re-implements a rule the engine already owns. If a surface needs a number the
engine doesn't expose, that is a change to the engine's public surface, not a computation in
the component.

## Styling

**Read `src/ui/kit/CLAUDE.md` before restyling any surface** — it holds the theme + kit
contract and the icon mapping, and it is the one place that pattern is written down.

The load-bearing half: every color, spacing, radius, typography and elevation value comes
from a **semantic theme role** via `useTheme()`. Raw `#hex` / `rgb()` literals and magic px
belong only in `src/ui/theme/` (the role→value map); in `src/ui/kit/` they are forbidden and
`tests/kit.noleak.test.ts` fails the build over them. A new visual language is a new `Theme`
object, not edits across surfaces.

## Player-facing copy

Labels must be plain language a layperson reads correctly on the first pass
(`docs/planning/engagement-spine-brief.md`). **Name the axis** the value moves along —
"rigid ↔ flexible", "slow ↔ quick" — never a temperature word. "Warm", "hot", "cool" are
fine as an internal heat-map model and are never acceptable as a label the player sees.

## Navigation

The nav is a **fixed 5 tabs**. Tabs never appear, disappear, or tier-gate — this is locked in
`docs/planning/second-level-ia.md`, which also holds each tab's charter and the sorting rules
that decide where a new surface lands.

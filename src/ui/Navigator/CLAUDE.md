# Navigator

In-house screen navigator. Replaces the ad-hoc `AppScreen` union/switch that
lived in `App.tsx`. No React Navigation dependency — a typed stack machine plus
a thin React binding.

## Public API (`index.ts`)
- `createNavigator(initial)` → `Navigator` — pure, framework-free core (the
  isolation-test surface).
- `useNavigator(initial)` → `Navigator` — React binding; one stable instance per
  host, re-renders on stack change via `useSyncExternalStore`.
- Types: `Navigator`, `Route`, `RouteEntry`, `RouteParamMap`.

`Navigator` is the narrow interface: `current`, `canGoBack`, `navigate(...)`,
`back()`, `reset(...)`, `subscribe()`.

## navigate vs. reset (do not mix these up)
- **`navigate(route)`** — *push* a pop-up over the current screen. Pair it with
  `back()` to close. This is for modal-style screens (auction, personnel) that
  sit on top of the game and return to it.
- **`reset(route)`** — *replace the whole stack* with one screen. Use for flow
  transitions where the previous screen must be unreachable: app boot →
  character-creation → game, and clearing a save → character-creation. After a
  reset, `canGoBack` is false, so a stray `back()` (or future Android
  hardware-back) on the game screen can never resurrect the loading or
  character-creation screen.
- **`back()`** — pop the top screen; no-op at the root.

Rule of thumb: a screen you can *close back to where you were* uses
`navigate`/`back`. A screen that is *the new starting point* uses `reset`.

## Typed routes, no string keys
Routes and their params live in `RouteParamMap`. A route whose param type is
`undefined` is called as `navigate('game')`; a route with params would be
`navigate('foo', {...})` and the compiler enforces it. Adding a screen means
adding a key to `RouteParamMap` — there is no untyped/string-keyed path.

## When to reconsider React Navigation
This in-house module is deliberate for the current shallow, modal-style flow. Revisit
the build-vs-adopt decision only when **3 or more** of the following are true:

1. **Deep linking** — launching into a specific screen from a URL/notification.
2. **Hardware back semantics** — Android back button must integrate with a
   nav stack (predictive back, per-screen interception) beyond a single
   app-level handler.
3. **Deeply nested stacks** — tab/drawer navigators or 3+ nested stacks where
   hand-rolling the graph stops being trivial.
4. **Shared-element transitions** — animated element continuity between screens.

Below that threshold the dependency cost (native linking, upgrade churn,
API surface) outweighs the benefit. Document the trigger that pushed it over
when/if this is revisited.

# Navigator

In-house screen navigator. Replaces the ad-hoc `AppScreen` union/switch that
lived in `App.tsx`. No React Navigation dependency — a typed stack machine plus
a thin React binding.

## Public API (`index.ts`)
- `createNavigator(initial)` → `Navigator` — pure, framework-free core (the
  isolation-test surface).
- `useNavigator(initial)` → `Navigator` — React binding; one stable instance per
  host, re-renders on stack change via `useSyncExternalStore`.
- `createTabStacks(initialTab)` / `useTabStacks(initialTab)` → `TabStacks<TabKey>`
  — the same pair for the shell's per-tab stacks (#348).
- Types: `Navigator`, `TabStacks`, `Route`, `RootRoute`, `TabRoute`, `RouteEntry`,
  `TabStackEntry`, `RouteParamMap`, `RootRouteParamMap`, `TabRouteParamMap`.

`Navigator` is the narrow interface: `current`, `canGoBack`, `navigate(...)`,
`back()`, `reset(...)`, `subscribe()`.

## Two stacks, and the compiler keeps them apart
Routes split into two families and the type system enforces which machine each
one is pushed onto:

- **ROOT routes** (`RootRouteParamMap`) are whole-app flow states — boot, start
  menu, character creation, the game itself, the in-game menu / KPI / history
  overlays, the terminal end card. They own the whole screen and live on the
  **Navigator's** single stack.
- **TAB routes** (`TabRouteParamMap`) are sub-screens inside one tab of the
  5-tab shell — the Lot room, a department queue, the auction, a unit's pricing
  screen, the Service / Body Shop pages. They live on **`TabStacks`**, one stack
  per tab, and render inside the shell with the tab bar still up.

`nav.navigate('auction')` does not compile. That call is exactly what used to
unmount the shell (locked IA §3, `second-level-ia.md`), so the split is a
compile error rather than a convention someone has to remember.

`TabStacks` is generic over the tab key so this module stays independent of the
shell's tab taxonomy; the app parameterizes it with `ShellTabKey`. It owns the
**active tab as well as** each tab's stack — one owner for "which tab, and where
inside it". Pushes land on whichever tab is active, so no route→tab table
exists to drift. Its `useSyncExternalStore` snapshot is `version`, not the top
entry, because two different tabs at their roots both read `current ===
undefined`.

## navigate vs. reset (do not mix these up)
- **`navigate(route)`** — *push* a pop-up over the current screen. Pair it with
  `back()` to close. This is for screens that sit on top of the game and return
  to it (the in-game menu, settings, the KPI dashboard). The same push/`back()`
  pairing is how `TabStacks` works inside a tab.
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

**Count as of #348: 1 of 4.** The per-tab stacks are trigger 3's first half —
a root stack plus five sibling tab stacks, two levels, no drawer, deepest
observed path 2 (Lot room → pricing). `TabStacks.ts` is ~60 lines of logic and
isolation-tested without a renderer, so the graph is still trivial to hand-roll.
Re-open this if a third level appears or 1, 2 or 4 comes true.

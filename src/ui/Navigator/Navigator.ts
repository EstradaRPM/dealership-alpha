// In-house Navigator core (no React Navigation dependency).
//
// Pure, framework-free stack machine so it can be isolation-tested without a
// React renderer. The React binding lives in `useNavigator.ts`.

import type { DeptKey } from '../../game/DepartmentQueue';

// Routes come in two families, and the split is enforced by the compiler.
//
// ROOT routes (below) are whole-app flow states: the boot flow, the start menu,
// the global overlays reached from the in-game menu, the live game itself, the
// terminal end card. They live on the Navigator's single stack and each one owns
// the entire screen.
//
// TAB routes (`TabRouteParamMap`) are sub-screens that live INSIDE one tab of
// the 5-tab shell. Locked IA §3 rules that they render *inside* the shell with
// the tab bar visible, each tab owning its own stack — so they are pushed onto
// `TabStacks`, never onto this Navigator. `nav.navigate('auction')` no longer
// typechecks, because that call is exactly what used to unmount the shell.
//
// Every reachable screen has an entry; `undefined` means the route carries no
// params. Adding a screen = adding a key to one of the two maps, so there is no
// string-keyed navigation anywhere in the app.
export type RootRouteParamMap = {
  loading: undefined;
  // Start menu shown on app launch (#195): New Game / Continue / Load. The
  // root of the boot flow — character-creation and game are reached from here
  // via reset (so back() never resurrects the menu mid-game).
  'main-menu': undefined;
  // Settings / snapshot rollback is a closeable route: reachable from the
  // start menu and closed with back() to the prior screen.
  settings: undefined;
  // Completed-careers wall is a closeable route from the start menu. It is
  // backed by LegacyStore, which is independent of active save-slot clearing.
  'legacy-wall': undefined;
  // In-session pause/save/load surface. Pushed over the live game and closed
  // with back(); save/load side effects stay in the composition root.
  'in-game-menu': undefined;
  // NOTE: there is no `kpi-dashboard` or `history` root route. Both were
  // full-screen readouts behind the in-game menu, which is why nobody read
  // them; #351 re-homed the KPI block into the Finance dashboard and the
  // history log into a Finance tab route (locked IA §4 — Finance owns the
  // backward-looking judgment numbers). Reaching them no longer unmounts the
  // shell.
  'character-creation': undefined;
  game: undefined;
  // Terminal end-of-career screen (#84 / design record #127). Reached ONLY via
  // a Navigator reset on career:game_over — a new unreachable starting point
  // (canGoBack false). Non-terminal interrupt cards are NOT routes; they are a
  // separate composition-root overlay layered above the Navigator.
  'end-card': undefined;
};

// Sub-screens owned by a tab of the shell (#348, locked IA §3). Each renders in
// the shell's body with the tab bar still mounted, pushed onto the stack of
// whichever tab the player pushed it from — so the Lot room opened from
// Operations, and the pricing screen opened from inside it, are two entries deep
// in the Operations stack while People keeps its own position untouched.
export type TabRouteParamMap = {
  auction: undefined;
  // NOTE: there is no `personnel` route. Hiring and the roster are sections of
  // the People tab (#347, locked IA §4) and resolve in place — pushing a
  // full-screen route for them unmounted the tab bar, which IA §3 names as the
  // pattern to replace.
  // Per-vehicle real-time pricing screen (#175), pushed from the Lot room's
  // per-unit price row. Closed with back().
  pricing: { vehicleId: string };
  // A non-sales department resolve-list (#76). Sales is not here — the Sales
  // tab routes to the hand-play workspace, not a screen.
  department: { dept: DeptKey };
  // The Lot room (#346, locked IA §4): the whole stock pipeline as one room —
  // stock list, pricing strategy, per-unit pricing entry, and sourcing (the
  // auction). Pushed from the Operations dock's Lot tile; closed with back().
  // Replaces the generic `department` queue screen for the Lot.
  lot: undefined;
  // The Service department read-model page (#308): demand heat + stock coverage
  // + base health. Pushed from the Operations dock; closed with back().
  // Distinct from the `department` resolve-list — this is the department's
  // dashboard, not its work queue.
  service: undefined;
  // The Body Shop department read-model page (#315): demand heat + stock
  // coverage + conquest health. Pushed from the Operations dock (the entry
  // appears only at/after Tier 3); closed with back(). The Tier-3 mirror of the
  // `service` page — navigation itself is never tier-gated.
  bodyShop: undefined;
  // Deal history (#208, re-homed by #351): the durable player-facing record,
  // pushed from the Finance dashboard. Was a root route behind the in-game
  // menu; a record you consult while reading the month should not cost you the
  // console to open.
  dealHistory: undefined;
  // Month-close results (#351): every closed month's gate grade and the numbers
  // behind it, pushed from the Finance dashboard. The interstitial is a beat
  // that goes by once — this is the record you can go back to.
  monthResults: undefined;
};

export type RouteParamMap = RootRouteParamMap & TabRouteParamMap;

export type Route = keyof RouteParamMap;
export type RootRoute = keyof RootRouteParamMap;
export type TabRoute = keyof TabRouteParamMap;

export type RouteEntry<R extends Route = Route> = {
  readonly route: R;
  readonly params: RouteParamMap[R];
};

// When a route's params type is `undefined`, the params argument is omitted
// entirely; otherwise it is required. This is what makes navigation typed
// rather than string-keyed. Generic over the map so the root stack and the tab
// stacks share one call convention while accepting disjoint route sets.
export type NavigateArgs<M, R extends keyof M> = M[R] extends undefined
  ? [route: R]
  : [route: R, params: M[R]];

type RootNavigateArgs<R extends RootRoute> = NavigateArgs<RootRouteParamMap, R>;

export interface Navigator {
  /** Top of the stack — the screen currently shown. Stable reference until it changes. */
  readonly current: RouteEntry<RootRoute>;
  /** False when `current` is the root (back() is a no-op). */
  readonly canGoBack: boolean;
  /** Push a new screen onto the stack (a pop-up over the current one). */
  navigate<R extends RootRoute>(...args: RootNavigateArgs<R>): void;
  /** Pop the top screen. No-op at the root. */
  back(): void;
  /**
   * Replace the entire stack with a single screen. Use for flow transitions
   * (loading → character-creation → game) where the previous screen must NOT
   * be reachable via back(). After a reset, canGoBack is false.
   */
  reset<R extends RootRoute>(...args: RootNavigateArgs<R>): void;
  /** External-store subscription for the React binding. */
  subscribe(listener: () => void): () => void;
}

export function createNavigator(initial: RootRoute): Navigator {
  let stack: RouteEntry<RootRoute>[] = [{ route: initial, params: undefined }];
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const l of listeners) l();
  };

  return {
    get current() {
      return stack[stack.length - 1];
    },
    get canGoBack() {
      return stack.length > 1;
    },
    navigate<R extends RootRoute>(...args: RootNavigateArgs<R>) {
      const [route, params] = args as [R, RootRouteParamMap[R]];
      stack = [...stack, { route, params } as RouteEntry<RootRoute>];
      emit();
    },
    back() {
      if (stack.length <= 1) return;
      stack = stack.slice(0, -1);
      emit();
    },
    reset<R extends RootRoute>(...args: RootNavigateArgs<R>) {
      const [route, params] = args as [R, RootRouteParamMap[R]];
      stack = [{ route, params } as RouteEntry<RootRoute>];
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

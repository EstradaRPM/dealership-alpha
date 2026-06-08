// In-house Navigator core (no React Navigation dependency).
//
// Pure, framework-free stack machine so it can be isolation-tested without a
// React renderer. The React binding lives in `useNavigator.ts`.

import type { DeptKey } from '../../game/DepartmentQueue';

// Typed route → params map. Every reachable screen has an entry; `undefined`
// means the route carries no params. Adding a screen = adding a key here, so
// there is no string-keyed navigation anywhere in the app.
export type RouteParamMap = {
  loading: undefined;
  // Start menu shown on app launch (#195): New Game / Continue / Load. The
  // root of the boot flow — character-creation and game are reached from here
  // via reset (so back() never resurrects the menu mid-game).
  'main-menu': undefined;
  // Settings / snapshot rollback is a closeable route: reachable from the
  // start menu and closed with back() to the prior screen.
  settings: undefined;
  // In-session pause/save/load surface. Pushed over the live game and closed
  // with back(); save/load side effects stay in the composition root.
  'in-game-menu': undefined;
  'character-creation': undefined;
  game: undefined;
  auction: undefined;
  personnel: undefined;
  // Per-vehicle real-time pricing screen (#175), pushed over the game from the
  // pre-open ownership levers' Pricing card. Closed with back().
  pricing: { vehicleId: string };
  // A non-sales department resolve-list, pushed over the game (#76). Sales is
  // not here — the Sales tab routes to the hand-play workspace, not a screen.
  department: { dept: DeptKey };
  // Terminal end-of-career screen (#84 / design record #127). Reached ONLY via
  // a Navigator reset on career:game_over — a new unreachable starting point
  // (canGoBack false). Non-terminal interrupt cards are NOT routes; they are a
  // separate composition-root overlay layered above the Navigator.
  'end-card': undefined;
};

export type Route = keyof RouteParamMap;

export type RouteEntry<R extends Route = Route> = {
  readonly route: R;
  readonly params: RouteParamMap[R];
};

// When a route's params type is `undefined`, the params argument is omitted
// entirely; otherwise it is required. This is what makes navigation typed
// rather than string-keyed.
type NavigateArgs<R extends Route> = RouteParamMap[R] extends undefined
  ? [route: R]
  : [route: R, params: RouteParamMap[R]];

export interface Navigator {
  /** Top of the stack — the screen currently shown. Stable reference until it changes. */
  readonly current: RouteEntry;
  /** False when `current` is the root (back() is a no-op). */
  readonly canGoBack: boolean;
  /** Push a new screen onto the stack (a pop-up over the current one). */
  navigate<R extends Route>(...args: NavigateArgs<R>): void;
  /** Pop the top screen. No-op at the root. */
  back(): void;
  /**
   * Replace the entire stack with a single screen. Use for flow transitions
   * (loading → character-creation → game) where the previous screen must NOT
   * be reachable via back(). After a reset, canGoBack is false.
   */
  reset<R extends Route>(...args: NavigateArgs<R>): void;
  /** External-store subscription for the React binding. */
  subscribe(listener: () => void): () => void;
}

export function createNavigator(initial: Route): Navigator {
  let stack: RouteEntry[] = [{ route: initial, params: undefined }];
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
    navigate<R extends Route>(...args: NavigateArgs<R>) {
      const [route, params] = args as [R, RouteParamMap[R]];
      stack = [...stack, { route, params } as RouteEntry];
      emit();
    },
    back() {
      if (stack.length <= 1) return;
      stack = stack.slice(0, -1);
      emit();
    },
    reset<R extends Route>(...args: NavigateArgs<R>) {
      const [route, params] = args as [R, RouteParamMap[R]];
      stack = [{ route, params } as RouteEntry];
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

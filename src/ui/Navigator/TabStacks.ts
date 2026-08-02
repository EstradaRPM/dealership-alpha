// Per-tab navigation stacks (#348) — the second half of the Navigator module.
//
// The Navigator owns ONE stack of whole-app flow states. This owns one stack
// PER TAB of the shell, which is what locked IA §3 asks for: "sub-screens render
// inside the shell — the tab bar stays visible and each tab owns a navigation
// stack; switching tabs preserves position within each."
//
// It is the same pure, framework-free shape as the Navigator core so it can be
// isolation-tested without a renderer; `useTabStacks.ts` is the React binding.
// Generic over the tab key so this module stays independent of the shell's tab
// taxonomy — the app parameterizes it with `ShellTabKey`.

import type { RouteEntry, TabRoute, TabRouteParamMap, NavigateArgs } from './Navigator';

type TabNavigateArgs<R extends TabRoute> = NavigateArgs<TabRouteParamMap, R>;

/** A pushed sub-screen. `undefined` anywhere below means "at the tab's root". */
export type TabStackEntry = RouteEntry<TabRoute>;

export interface TabStacks<TabKey extends string> {
  /** The tab currently shown. Owned here, not by the shell — one owner for
   *  "which tab, and where inside it". */
  readonly activeTab: TabKey;
  /** Top of the ACTIVE tab's stack; `undefined` when that tab is at its root
   *  (the tab's own page renders). */
  readonly current: TabStackEntry | undefined;
  /** False at the tab's root, where back() is a no-op. */
  readonly canGoBack: boolean;
  /**
   * Monotonic change counter — the `useSyncExternalStore` snapshot. The
   * Navigator can use its top-of-stack entry because it always has one; here
   * the top is `undefined` at a tab root, so a version is what distinguishes
   * "root of Home" from "root of Operations".
   */
  readonly version: number;
  /** Top of ANY tab's stack. Position is preserved per tab across switches. */
  topOf(tab: TabKey): TabStackEntry | undefined;
  /** Switch tabs. Every tab's stack is left exactly where the player left it. */
  setActiveTab(tab: TabKey): void;
  /** Push a sub-screen onto the ACTIVE tab's stack. */
  navigate<R extends TabRoute>(...args: TabNavigateArgs<R>): void;
  /** Pop the active tab's top sub-screen. No-op at the tab's root. */
  back(): void;
  /** Clear every stack and return to the initial tab (session teardown). */
  reset(): void;
  /** External-store subscription for the React binding. */
  subscribe(listener: () => void): () => void;
}

export function createTabStacks<TabKey extends string>(
  initialTab: TabKey,
): TabStacks<TabKey> {
  const stacks = new Map<TabKey, readonly TabStackEntry[]>();
  let activeTab = initialTab;
  let version = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    version++;
    for (const l of listeners) l();
  };
  const stackFor = (tab: TabKey): readonly TabStackEntry[] =>
    stacks.get(tab) ?? [];
  const topFor = (tab: TabKey): TabStackEntry | undefined => {
    const s = stackFor(tab);
    return s[s.length - 1];
  };

  return {
    get activeTab() {
      return activeTab;
    },
    get current() {
      return topFor(activeTab);
    },
    get canGoBack() {
      return stackFor(activeTab).length > 0;
    },
    get version() {
      return version;
    },
    topOf(tab: TabKey) {
      return topFor(tab);
    },
    setActiveTab(tab: TabKey) {
      if (tab === activeTab) return;
      activeTab = tab;
      emit();
    },
    navigate<R extends TabRoute>(...args: TabNavigateArgs<R>) {
      const [route, params] = args as [R, TabRouteParamMap[R]];
      stacks.set(activeTab, [
        ...stackFor(activeTab),
        { route, params } as TabStackEntry,
      ]);
      emit();
    },
    back() {
      const s = stackFor(activeTab);
      if (s.length === 0) return;
      stacks.set(activeTab, s.slice(0, -1));
      emit();
    },
    reset() {
      stacks.clear();
      activeTab = initialTab;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

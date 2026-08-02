import { useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { createTabStacks, type TabStacks } from './TabStacks';

// React binding for the per-tab stacks (#348). Same shape as `useNavigator`:
// the core instance is created once and kept stable across renders, and
// `useSyncExternalStore` re-renders the host on every change. The snapshot is
// the change counter rather than the top entry — the top is `undefined` at a
// tab's root, so switching between two rooted tabs has to be visible somehow.
export function useTabStacks<TabKey extends string>(
  initialTab: TabKey,
): TabStacks<TabKey> {
  const ref = useRef<TabStacks<TabKey> | null>(null);
  if (ref.current === null) ref.current = createTabStacks(initialTab);
  const tabs = ref.current;
  useSyncExternalStore(
    tabs.subscribe,
    () => tabs.version,
    () => tabs.version,
  );
  return tabs;
}

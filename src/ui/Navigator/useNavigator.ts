import { useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { createNavigator, type Navigator, type RootRoute } from './Navigator';

// React binding for the Navigator core. The core instance is created once and
// kept stable across renders; `useSyncExternalStore` re-renders the host when
// the current entry changes (the snapshot is the stable top-of-stack ref).
export function useNavigator(initial: RootRoute): Navigator {
  const ref = useRef<Navigator | null>(null);
  if (ref.current === null) ref.current = createNavigator(initial);
  const nav = ref.current;
  useSyncExternalStore(
    nav.subscribe,
    () => nav.current,
    () => nav.current,
  );
  return nav;
}

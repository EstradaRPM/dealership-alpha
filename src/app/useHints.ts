import { useEffect, useRef, useState } from 'react';
import type { MultiSlotSaveStore } from '../game/SaveStore';
import { loadHints, type HintId, type HintsConfig } from './hints';

export interface HintsDeps {
  slotStore: MultiSlotSaveStore;
  /** Injectable catalog for tests; the app always reads `data/hints.json`. */
  config?: HintsConfig;
}

export interface Hints {
  /** The hint's copy while it is still owed, or null once it has retired. */
  hintFor: (id: HintId) => string | null;
  /** The player used the control this hint sits under — retire it, for good. */
  markUsed: (id: HintId) => void;
  /** "Show hints again": re-arm every hint for the active slot. */
  resetHints: () => void;
  /** Re-read the active slot's teaching cell (a slot was loaded or created). */
  refresh: () => void;
}

/**
 * The teaching cluster (#386). Owns one question — "has this player used that
 * control yet?" — read synchronously for render and written behind the tap.
 *
 * The write is fire-and-forget on purpose: a hint must retire the instant the
 * control is used, so the in-memory set moves first and storage catches up. A
 * hint that lingered until an await resolved would read as a control that
 * didn't register the tap.
 */
export function useHints({ slotStore, config = loadHints() }: HintsDeps): Hints {
  const [taught, setTaught] = useState<ReadonlySet<string>>(new Set());
  const taughtRef = useRef<ReadonlySet<string>>(taught);

  const apply = (next: ReadonlySet<string>) => {
    taughtRef.current = next;
    setTaught(next);
  };

  const refresh = () => {
    void (async () => {
      const store = await slotStore.teachingStore();
      // No slot selected ⇒ nothing is KNOWN to be taught, so every hint draws.
      // A hint the store cannot answer for is shown, never hidden.
      apply(new Set(store ? await store.listTaught() : []));
    })();
  };

  useEffect(() => {
    refresh();
    // Mount only: every later re-read is an explicit `refresh()` from the
    // composition root, at the two moments the active slot can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hintFor = (id: HintId): string | null => {
    if (taught.has(id)) return null;
    return config.hints.find((h) => h.id === id)?.text ?? null;
  };

  const markUsed = (id: HintId) => {
    if (taughtRef.current.has(id)) return;
    apply(new Set([...taughtRef.current, id]));
    void (async () => {
      const store = await slotStore.teachingStore();
      await store?.markTaught(id);
    })();
  };

  const resetHints = () => {
    apply(new Set());
    void (async () => {
      const store = await slotStore.teachingStore();
      await store?.resetAll();
    })();
  };

  return { hintFor, markUsed, resetHints, refresh };
}

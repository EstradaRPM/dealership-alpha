import type { Hints } from '../../src/app/useHints';

/**
 * A teaching cluster that has taught nothing and records nothing (#388).
 *
 * Containers take `Hints` as a REQUIRED dep rather than an optional one, so a
 * surface cannot be composed without someone deciding what it teaches. Tests
 * that are about the mechanic under the control — hiring, promotion, morale —
 * take this and stay about that mechanic. A test that is about the hints
 * themselves drives the real `useHints` against a slot store.
 */
export function stubHints(overrides: Partial<Hints> = {}): Hints {
  return {
    hintFor: () => null,
    markUsed: () => {},
    resetHints: () => {},
    refresh: () => {},
    ...overrides,
  };
}

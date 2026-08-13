/**
 * Player-facing copy that is DATA rather than a literal in a component (#389).
 *
 * Today that is the empty-state catalog: the sentence every list, panel and
 * chart draws when it has nothing to show. It lives beside the surfaces rather
 * than in `src/app/` because it is presentation copy with no player state in it
 * — the catalog is the same for every slot, tier and day, which is exactly why
 * it is a plain read and not a hook the way `useHints` has to be.
 */
export {
  EMPTY_STATE_IDS,
  EmptyStatesConfigSchema,
  loadEmptyStates,
  emptyState,
} from './emptyStates';
export type { EmptyStateId, EmptyStatesConfig } from './emptyStates';

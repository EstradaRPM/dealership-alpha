/**
 * Player-facing copy that is DATA rather than a literal in a component (#389).
 *
 * Two catalogs live here. The **empty states**: the sentence every list, panel
 * and chart draws when it has nothing to show. The **teaching beats** (#394):
 * the one-shot moments the game stops and states something the player has no
 * control to press and no other way to learn.
 *
 * Both live beside the surfaces rather than in `src/app/` because they are
 * presentation copy with no player state in them — the catalogs are the same
 * for every slot, tier and day, which is exactly why they are plain reads and
 * not hooks the way `useHints` has to be. What a beat *does* carry per-store is
 * its `{slot}` fills, resolved by the caller at the moment it fires.
 */
export {
  EMPTY_STATE_IDS,
  EmptyStatesConfigSchema,
  loadEmptyStates,
  emptyState,
} from './emptyStates';
export type { EmptyStateId, EmptyStatesConfig } from './emptyStates';
export {
  TEACHING_BEAT_IDS,
  TeachingBeatsConfigSchema,
  loadTeachingBeats,
  teachingBeat,
  fillSlots,
} from './teachingBeats';
export type {
  TeachingBeatId,
  TeachingBeatsConfig,
  TeachingBeatEntry,
} from './teachingBeats';

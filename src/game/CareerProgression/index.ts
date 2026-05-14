export { loadBackstories, getDay1Modifier, buildCharacterModifier } from './backstoryModifiers';
export type { BackstoryId, Day1Modifier, BackstoryEntry, CharacterProfile } from './types';

export { createTierManager } from './TierManager';
export type { TierManager, TierManagerDeps, TierManagerState } from './TierManager';

export { loadTierConfig } from './tierData';
export type { TierConfig, TierEntry, TierThreshold, AccentOption, FontOption } from './tierData';

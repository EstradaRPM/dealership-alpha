import type { EventBus } from '../EventBus';
import type { CharacterProfile } from '../CareerProgression';
import type { TierManager } from '../CareerProgression';
import { DAYS_PER_YEAR } from '../GameClock';
import { getFlavorText } from './flavorData';
import type { EndCardData, EndCardManagerState, EndCardReason } from './types';

export interface EndCardManagerDeps {
  bus: EventBus;
  characterProfile: CharacterProfile;
  tierManager: TierManager;
}

export interface EndCardManager {
  readonly data: EndCardData | null;
  getSerializableState(): EndCardManagerState;
  restoreState(state: EndCardManagerState): void;
}

function careerYearFromDay(day: number): number {
  return Math.floor((day - 1) / DAYS_PER_YEAR) + 1;
}

export function createEndCardManager(deps: EndCardManagerDeps): EndCardManager {
  const { bus, characterProfile, tierManager } = deps;

  let data: EndCardData | null = null;

  function settle(day: number, reason: EndCardReason): void {
    if (data !== null) return;
    data = {
      playerName: characterProfile.name,
      backstoryId: characterProfile.backstoryId,
      careerYear: careerYearFromDay(day),
      tierReached: tierManager.currentTier,
      reason,
      flavorText: getFlavorText(reason, characterProfile.backstoryId),
    };
    bus.publish('career:game_over', { day, data });
  }

  bus.subscribe('career:bankruptcy_terminal', ({ day }) => settle(day, 'bankruptcy'));
  bus.subscribe('regulatory:ag_complaint_terminal', ({ day }) => settle(day, 'ag_complaint'));
  bus.subscribe('career:indictment_terminal', ({ day }) => settle(day, 'indictment'));

  return {
    get data() { return data; },

    getSerializableState() {
      return { data };
    },

    restoreState(state: EndCardManagerState) {
      data = state.data;
    },
  };
}

import type { BackstoryId } from '../CareerProgression';

export type EndCardReason = 'bankruptcy' | 'ag_complaint' | 'indictment';

export interface EndCardData {
  playerName: string;
  backstoryId: BackstoryId;
  careerYear: number;
  tierReached: number;
  reason: EndCardReason;
  flavorText: string;
}

export interface EndCardManagerState {
  data: EndCardData | null;
}

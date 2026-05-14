import type { BackstoryId } from '../CareerProgression';

export type EndCardReason =
  | 'bankruptcy'
  | 'ag_complaint'
  | 'indictment'
  | 'retire'
  | 'sellout'
  | 'family_handoff';

export type EndCardOutcome = 'failure' | 'success';

export const END_CARD_OUTCOME: Record<EndCardReason, EndCardOutcome> = {
  bankruptcy: 'failure',
  ag_complaint: 'failure',
  indictment: 'failure',
  retire: 'success',
  sellout: 'success',
  family_handoff: 'success',
};

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

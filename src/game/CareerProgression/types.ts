export type BackstoryId = 'ex-mechanic' | 'ex-banker' | 'inheritor';

export interface Day1Modifier {
  backstoryId: BackstoryId;
  reconJudgmentBonus: number;
  startingCreditLine: number;
  startingCapitalBonus: number;
  grudgesFlag: boolean;
}

export interface BackstoryEntry {
  id: BackstoryId;
  label: string;
  flavor: string;
  /** Plain-language statement of what the pick does to the store (#390). */
  effect: string;
  modifier: Omit<Day1Modifier, 'backstoryId'>;
}

export interface CharacterProfile {
  name: string;
  backstoryId: BackstoryId;
  day1Modifier: Day1Modifier;
}

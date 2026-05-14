import rawConfig from '../../../data/tier-progression.json';

export interface TierThreshold {
  minCashOnHand: number;
  minCustomersServed: number;
  minReputationScore: number;
}

export interface TierEntry {
  tier: number;
  label: string;
  illustration: string;
  caption: string;
  triggerThreshold?: TierThreshold;
}

export interface AccentOption {
  id: string;
  label: string;
  color: string;
}

export interface FontOption {
  id: string;
  label: string;
}

export interface TierConfig {
  checkIntervalDays: number;
  tiers: TierEntry[];
  accentOptions: AccentOption[];
  fontOptions: FontOption[];
}

export function loadTierConfig(): TierConfig {
  return rawConfig as TierConfig;
}

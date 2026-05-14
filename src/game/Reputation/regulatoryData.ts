import rawConfig from '../../../data/failure-tunables.json';

export interface RegulatoryTunables {
  pressureMax: number;
  pressureThreshold: number;
  dailyDecay: number;
  walkPressure: number;
  missedOppPressure: number;
  angerPressure: number;
  tier2: {
    suspensionDays: number;
  };
  tier3Plus: {
    complianceCost: number;
    reputationHit: number;
  };
}

export function loadRegulatoryTunables(): RegulatoryTunables {
  return (rawConfig as { regulatory: RegulatoryTunables }).regulatory;
}

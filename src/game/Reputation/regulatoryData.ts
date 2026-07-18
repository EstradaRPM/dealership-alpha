import rawConfig from '../../../data/failure-tunables.json';

export interface RegulatoryTunables {
  pressureMax: number;
  pressureThreshold: number;
  /**
   * Compliance-audit-failure band floor (#327). Sustained pressure sitting in
   * `[auditThreshold, pressureThreshold)` fails a regulator audit, producing
   * indictment pressure — the escalating warning *below* the AG-complaint
   * outcome. Must be `< pressureThreshold`.
   */
  auditThreshold: number;
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

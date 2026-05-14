import rawConfig from '../../../data/failure-tunables.json';

export interface FailureTunables {
  cashFloor: number;
  consecutiveDaysToTrigger: number;
  tier2: {
    debtPrincipal: number;
    weeklyDebtPayment: number;
  };
  tier3Plus: {
    complianceCost: number;
    reputationHit: number;
  };
}

export function loadFailureTunables(): FailureTunables {
  return rawConfig as FailureTunables;
}

export interface IndictmentTunables {
  pressureMax: number;
  pressureThreshold: number;
  lemonLawPressure: number;
  auditFailurePressure: number;
  fraudFlagPressure: number;
  tier2: {
    stakePenalty: number;
  };
  tier3Plus: {
    legalDefenseCost: number;
    reputationHit: number;
  };
}

export function loadIndictmentTunables(): IndictmentTunables {
  return (rawConfig as { indictment: IndictmentTunables }).indictment;
}

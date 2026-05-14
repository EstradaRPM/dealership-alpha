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

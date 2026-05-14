import rawConfig from '../../../data/career-endings.json';

export interface EndingsTunables {
  retire: {
    minCashOnHand: number;
    minCareerYears: number;
  };
  sellout: {
    minTier: number;
    offerIntervalDays: number;
    baseValuation: number;
    valuationPerCustomer: number;
  };
  familyHandoff: {
    minCareerYears: number;
    minTier: number;
  };
}

export function loadEndingsTunables(): EndingsTunables {
  return rawConfig as EndingsTunables;
}

import { loadCreditTiers, classifyCredit } from './creditTier';
import { computeMonthlyPayment } from './loanMath';
import type { CreditTier, CreditTierCatalog, LoanParams, LoanResult } from './types';

export interface DealEngine {
  classifyCredit(score: number): CreditTier;
  structure(params: LoanParams): LoanResult;
}

export interface DealEngineDeps {
  catalog?: CreditTierCatalog;
}

export function createDealEngine(deps: DealEngineDeps = {}): DealEngine {
  const catalog = deps.catalog ?? loadCreditTiers();

  return {
    classifyCredit(score) {
      return classifyCredit(score, catalog);
    },
    structure(params) {
      const tierDef = catalog.tiers[params.tier];
      return computeMonthlyPayment(params, tierDef);
    },
  };
}

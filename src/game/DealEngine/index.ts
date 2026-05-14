export { createDealEngine } from './DealEngine';
export type { DealEngine, DealEngineDeps } from './DealEngine';
export type { CreditTier, CreditTierCatalog, TierDef, LoanParams, LoanResult, CloseDealParams, ClosedDealResult } from './types';
export { classifyCredit, loadCreditTiers } from './creditTier';
export { computeMonthlyPayment } from './loanMath';

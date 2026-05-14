export { createDealEngine } from './DealEngine';
export type { DealEngine, DealEngineDeps } from './DealEngine';
export type { CreditTier, CreditTierCatalog, TierDef, LoanParams, LoanResult, CloseDealParams, ClosedDealResult, FniProduct, FniProductCatalog, AttachedFniProduct } from './types';
export { classifyCredit, loadCreditTiers } from './creditTier';
export { computeMonthlyPayment } from './loanMath';
export { loadFniProducts } from './fniProducts';

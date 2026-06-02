export { createDealEngine } from './DealEngine';
export type { DealEngine, DealEngineDeps } from './DealEngine';
export type { CreditTier, CreditTierCatalog, TierDef, LoanParams, LoanResult, CloseDealParams, ClosedDealResult, FniProduct, FniProductCatalog, AttachedFniProduct, FniAutoAttachConfig } from './types';
export { classifyCredit, loadCreditTiers } from './creditTier';
export { computeMonthlyPayment, computeMaxFinancedAmount } from './loanMath';
export { loadFniProducts, loadFniAutoAttachConfig } from './fniProducts';
export {
  generateTradeAsk,
  loadTradeAllowanceNoiseConfig,
  TradeAllowanceNoiseConfigSchema,
  evaluateTrade,
  loadTradeEvalConfig,
  TradeEvalConfigSchema,
  resolveTradeIn,
} from './trade';
export type {
  TradeAllowanceNoiseConfig,
  TradeBookValueFn,
  TradeEvalConfig,
  TradeEvaluation,
  TradeEvalInput,
  TradeEvalDeps,
  TradeAction,
  NegotiationSkill,
  TradeConditionRead,
  TradeResolution,
  TradeResolutionInput,
  TradeResolutionDeps,
} from './trade';

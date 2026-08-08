export { createDealEngine } from './DealEngine';
export type { DealEngine, DealEngineDeps } from './DealEngine';
export type { CreditTier, CreditTierCatalog, TierDef, LoanParams, StructureParams, LoanResult, CloseDealParams, ClosedDealResult, DealSalesQuality, FniProduct, FniProductCatalog, AttachedFniProduct, AutoFniDeal, AutoFniInput, FniAutoAttachConfig, FniReserveConfig, FinanceQuote, ReserveInput } from './types';
export { classifyCredit, loadCreditTiers, CreditTierCatalogSchema } from './creditTier';
export { computeMonthlyPayment, computeMaxFinancedAmount } from './loanMath';
export {
  computeReserve,
  loadFniReserveConfig,
  resolveFinanceQuote,
  loadFniPostureConfig,
  resolveFniPosture,
  resolveFniPostureMarkupPts,
} from './reserve';
export { buildFniMonthVerdict } from './monthVerdict';
export type {
  FniMonthInput,
  FniMonthVerdict,
  FniMixVerdict,
} from './monthVerdict';
export type {
  FinanceQuoteInput,
  FniPostureOption,
  FniPostureConfig,
} from './reserve';
export {
  loadFniDealKillConfig,
  resolveSafeFrontierPts,
  fallThroughProbability,
  rollFinanceFallThrough,
} from './dealKill';
export type { FniDealKillConfig } from './dealKill';
export { loadFniCsiDragConfig, markupSatisfactionHit } from './csiDrag';
export type { FniCsiDragConfig } from './csiDrag';
export { projectFniPostures } from './peakModel';
export type {
  FinancedDealSample,
  FniPostureProjection,
  FniPeakReading,
  FniPeakInput,
  FniPeakDeps,
} from './peakModel';
export { loadFniProducts, loadFniAutoAttachConfig } from './fniProducts';
export { loadDealFraudConfig } from './dealFraudConfig';
export type { DealFraudConfig } from './dealFraudConfig';
export {
  generateTradeAsk,
  loadTradeAllowanceNoiseConfig,
  TradeAllowanceNoiseConfigSchema,
  evaluateTrade,
  loadTradeEvalConfig,
  TradeEvalConfigSchema,
  resolveTradeIn,
  isTradeApprovalUnlocked,
  resolveTradeApprover,
  rollCustomerCounterResponse,
  loadTradePolicyConfig,
  resolveTradePolicyMultiplier,
} from './trade';
export type {
  TradePolicyOption,
  TradePolicyConfig,
  TradeAllowanceNoiseConfig,
  TradeBookValueFn,
  TradeEvalConfig,
  TradeEvaluation,
  TradeEvalInput,
  TradeEvalDeps,
  TradeAction,
  NegotiationSkill,
  TradeConditionRead,
  TradeAllowanceDrift,
  TradeResolution,
  TradeResolutionInput,
  TradeResolutionDeps,
  TradeApprover,
  ApproverCandidate,
  TradeReviewPayload,
  CustomerCounterInput,
} from './trade';

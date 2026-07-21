export { createMarketEconomy } from './MarketEconomy';
export type {
  MarketEconomy,
  MarketEconomyDeps,
  MarketEconomySnapshot,
} from './MarketEconomy';

export { computeAnchor } from './anchor';
export type { AnchorVehicleInput, AnchorDeps } from './anchor';

export { createProviders } from './providers';
export type { LiveProviders, MarketVehicleInput, ProvidersDeps } from './providers';

export { createCompHistory } from './compHistory';
export type {
  CompEntry,
  CompHistory,
  CompHistoryDeps,
  CompHistorySnapshot,
  CompSource,
  CompWindowConfig,
} from './compHistory';

export { createSegmentHeat, createSegmentHeatBySegment } from './segmentHeat';
export type {
  SegmentHeatDeps,
  SegmentHeatFn,
  SegmentHeatBySegmentFn,
  ShockModFn,
} from './segmentHeat';

export {
  createSegmentHeatMonitor,
  createDefaultHeatMonitorSnapshot,
} from './heatMonitor';
export type {
  HeatMonitorSnapshot,
  SegmentHeatMonitor,
  SegmentHeatMonitorDeps,
} from './heatMonitor';

export { createMarketNews, createDefaultNewsSnapshot, wholePercent } from './news';
export type {
  Headline,
  MarketNews,
  MarketNewsDeps,
  NewsDirection,
  NewsSnapshot,
} from './news';

export { createWeeklyReport, createDefaultWeeklyReportSnapshot } from './weeklyReport';
export type {
  WeeklyForwardCall,
  WeeklyMarketReport,
  WeeklyReport,
  WeeklyReportDeps,
  WeeklyReportSnapshot,
  WeeklySegmentMove,
  WeeklyWireTally,
} from './weeklyReport';

export { predictDaysToSell } from './daysToSell';
export type {
  DaysToSellInput,
  DaysToSellPrediction,
  DaysToSellDeps,
} from './daysToSell';

export { resolveIntelPrecision } from './intelPrecision';
export type {
  IntelPrecision,
  IntelLevel,
  PricingStaffRead,
  IntelPrecisionDeps,
} from './intelPrecision';

export { demandMultiplier } from './elasticity';
export type {
  ElasticityInput,
  ElasticityResult,
  ElasticityDeps,
} from './elasticity';

export {
  suggestListPrice,
  resolveIntakeAsk,
  isAutoPricingUnlocked,
  classifyPricePosition,
  deriveCompetitorComps,
} from './pricingSuggestion';
export type {
  PricingStrategyId,
  PricePosition,
  SuggestListPriceInput,
  SuggestListPriceResult,
  IntakeAskInput,
  IntakeAskDrift,
  PricingSuggestionDeps,
  ComparableCompetitorInput,
  CompetitorComp,
} from './pricingSuggestion';

export {
  isSourcingUnlocked,
  normalizeLean,
  scoreCandidate,
  selectAutoBuys,
} from './sourcing';
export type {
  SourcingLean,
  SourcingCandidate,
  SourcingDrift,
  SelectAutoBuysInput,
  SourcingDeps,
} from './sourcing';

export { createShockScheduler } from './shocks';
export type {
  ActiveShockInstance,
  ShockPreview,
  ShockScheduler,
  ShockSchedulerDeps,
  ShocksSnapshot,
} from './shocks';

export {
  rollRecon,
  pickSurpriseTemplate,
  bucketProbabilities,
  reliabilityBand,
  mileageBand,
  deriveReconSeed,
  deriveReconSurpriseSeed,
  loadReconVarianceConfig,
  loadReconSurpriseEventsConfig,
} from './reconVariance';
export type {
  ReconRollInputs,
  ReconRollResult,
} from './reconVariance';

export {
  rollAuctionSourceReliability,
  sampleMotivatedSellerMultiplier,
  loadMotivatedSellerConfig,
  pickAuctionSource,
} from './auctionSources';
export type {
  AuctionSourceReliability,
  MotivatedSellerConfig,
} from './auctionSources';

export {
  NEUTRAL_PERSONALITY,
  rollPersonalityVector,
  personalityBiasFor,
} from './personality';
export type { MarketPersonalityVector } from './personality';

export {
  MarketAnchorConfigSchema,
  MarketSegmentFallbackConfigSchema,
  MarketDepreciationCurvesConfigSchema,
  MarketConditionModsConfigSchema,
  MarketMarkupConfigSchema,
  MarketPersonalityDistributionSchema,
  MileageDistributionConfigSchema,
  MarketShocksConfigSchema,
  NewsTemplatesConfigSchema,
  NEWS_TRIGGERS,
  NEWS_RELIABILITIES,
  WEEKLY_SUMMARY_SHAPES,
  WEEKLY_CALL_KINDS,
  loadNewsTemplatesConfig,
  AuctionSourcesConfigSchema,
  loadAuctionSourcesConfig,
  loadMarketAnchorConfig,
  loadMarketSegmentFallbackConfig,
  loadMarketDepreciationCurvesConfig,
  loadMarketConditionModsConfig,
  loadMarketMarkupConfig,
  loadMarketPersonalityDistribution,
  loadMileageDistributionConfig,
  loadMarketShocksConfig,
  loadDaysToSellCurvesConfig,
  DaysToSellCurvesConfigSchema,
  loadDemandElasticityConfig,
  DemandElasticityConfigSchema,
  loadPricingStrategiesConfig,
  PricingStrategiesConfigSchema,
  loadIntelPrecisionConfig,
  IntelPrecisionConfigSchema,
  loadSourcingConfig,
  SourcingConfigSchema,
} from './schemas';
export type {
  MarketAnchorConfig,
  MarketSegmentFallbackConfig,
  MarketDepreciationCurvesConfig,
  MarketConditionModsConfig,
  MarketMarkupConfig,
  MarketPersonalityDistribution,
  MileageDistributionConfig,
  MarketShocksConfig,
  ShockDefinition,
  ShockSegmentEffect,
  NewsTemplatesConfig,
  NewsTemplate,
  NewsTrigger,
  NewsReliability,
  WeeklyReportCopy,
  WeeklySummaryShape,
  WeeklyCallKind,
  AuctionSourcesConfig,
  AuctionSourceDefinition,
  ReconVarianceConfig,
  ReconBucket,
  ReconBucketId,
  ReconSurpriseEventsConfig,
  ReconSurpriseTemplate,
  DaysToSellCurvesConfig,
  DemandElasticityConfig,
  PricingStrategiesConfig,
  PricingStrategyEntry,
  IntelPrecisionConfig,
  SourcingConfig,
  SourcingLeanConfig,
} from './schemas';
export {
  ReconVarianceConfigSchema,
  ReconSurpriseEventsConfigSchema,
} from './schemas';

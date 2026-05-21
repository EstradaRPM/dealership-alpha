export { createMarketEconomy } from './MarketEconomy';
export type { MarketEconomy, MarketEconomyDeps } from './MarketEconomy';

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

export { createSegmentHeat } from './segmentHeat';
export type { SegmentHeatDeps, SegmentHeatFn, ShockModFn } from './segmentHeat';

export { createShockScheduler } from './shocks';
export type {
  ActiveShockInstance,
  ShockScheduler,
  ShockSchedulerDeps,
  ShocksSnapshot,
} from './shocks';

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
  loadMarketAnchorConfig,
  loadMarketSegmentFallbackConfig,
  loadMarketDepreciationCurvesConfig,
  loadMarketConditionModsConfig,
  loadMarketMarkupConfig,
  loadMarketPersonalityDistribution,
  loadMileageDistributionConfig,
  loadMarketShocksConfig,
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
} from './schemas';

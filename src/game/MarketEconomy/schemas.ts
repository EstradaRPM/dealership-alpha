import { z } from 'zod';
import { parseData } from '../data';

const positive = z.number().positive();
const unit = z.number().min(0).max(1);

export const CURVE_TYPES = ['sedan', 'truck', 'suv'] as const;
const CurveTypeEnum = z.enum(CURVE_TYPES);

export const BRAND_TIERS = ['luxury', 'mainstream', 'economy'] as const;
const BrandTierEnum = z.enum(BRAND_TIERS);

export const CONDITIONS = ['clean', 'average', 'rough'] as const;
const ConditionEnum = z.enum(CONDITIONS);

const AnchorEntrySchema = z
  .object({
    baseAnchor: positive,
    curveType: CurveTypeEnum,
  })
  .strict();

export const MarketAnchorConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    templates: z.record(z.string().min(1), AnchorEntrySchema),
  })
  .strict();
export type MarketAnchorConfig = z.infer<typeof MarketAnchorConfigSchema>;

export const MarketSegmentFallbackConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    fallbacks: z.record(
      z.string().min(1),
      z.record(BrandTierEnum, AnchorEntrySchema),
    ),
  })
  .strict();
export type MarketSegmentFallbackConfig = z.infer<
  typeof MarketSegmentFallbackConfigSchema
>;

const CurveShapeSchema = z
  .object({
    perYearDepreciation: unit,
    floor: unit,
    per10kMileageDepreciation: unit,
    mileageFloor: unit,
  })
  .strict();

export const MarketDepreciationCurvesConfigSchema = z
  .object({
    schemaVersion: z.literal(2),
    referenceYear: z.number().int(),
    referenceMileage: z.number().int().nonnegative(),
    curves: z.record(CurveTypeEnum, CurveShapeSchema),
  })
  .strict();
export type MarketDepreciationCurvesConfig = z.infer<
  typeof MarketDepreciationCurvesConfigSchema
>;

export const MarketConditionModsConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    modifiers: z.record(ConditionEnum, positive),
  })
  .strict();
export type MarketConditionModsConfig = z.infer<
  typeof MarketConditionModsConfigSchema
>;

const PersonalitySegmentBoundsSchema = z
  .object({
    biasMin: z.number(),
    biasMax: z.number(),
  })
  .strict()
  .refine((b) => b.biasMin <= b.biasMax, {
    message: 'biasMin must be <= biasMax',
  });

export const MarketPersonalityDistributionSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    segments: z.record(z.string().min(1), PersonalitySegmentBoundsSchema),
  })
  .strict();
export type MarketPersonalityDistribution = z.infer<
  typeof MarketPersonalityDistributionSchema
>;

const MileageDistributionShapeSchema = z
  .object({
    perYearMean: z.number().positive(),
    perYearSpread: z.number().nonnegative(),
    floor: z.number().nonnegative(),
    ceiling: z.number().positive(),
  })
  .strict()
  .refine((d) => d.floor <= d.ceiling, {
    message: 'floor must be <= ceiling',
  });

export const MileageDistributionConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    referenceYear: z.number().int(),
    distributions: z.record(CurveTypeEnum, MileageDistributionShapeSchema),
  })
  .strict();
export type MileageDistributionConfig = z.infer<
  typeof MileageDistributionConfigSchema
>;

const ShockSegmentEffectSchema = z
  .object({
    segment: z.string().min(1),
    magnitudeMin: z.number(),
    magnitudeMax: z.number(),
  })
  .strict()
  .refine((e) => e.magnitudeMin <= e.magnitudeMax, {
    message: 'magnitudeMin must be <= magnitudeMax',
  });

const ShockDefinitionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    rarityWeight: z.number().positive(),
    durationMinDays: z.number().int().positive(),
    durationMaxDays: z.number().int().positive(),
    segmentEffects: z.array(ShockSegmentEffectSchema).nonempty(),
  })
  .strict()
  .refine((s) => s.durationMinDays <= s.durationMaxDays, {
    message: 'durationMinDays must be <= durationMaxDays',
  });

export const MarketShocksConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    shocks: z.array(ShockDefinitionSchema).nonempty(),
  })
  .strict();
export type MarketShocksConfig = z.infer<typeof MarketShocksConfigSchema>;
export type ShockDefinition = z.infer<typeof ShockDefinitionSchema>;
export type ShockSegmentEffect = z.infer<typeof ShockSegmentEffectSchema>;

const AuctionSourceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    reliabilityBand: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  })
  .strict()
  .refine((s) => s.reliabilityBand[0] <= s.reliabilityBand[1], {
    message: 'reliabilityBand[0] must be <= reliabilityBand[1]',
  });

export const AuctionSourcesConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    sources: z.array(AuctionSourceSchema).nonempty(),
  })
  .strict();
export type AuctionSourcesConfig = z.infer<typeof AuctionSourcesConfigSchema>;
export type AuctionSourceDefinition = z.infer<typeof AuctionSourceSchema>;

const ReconBucketSchema = z
  .object({
    id: z.enum(['within', 'minor', 'major', 'catastrophic']),
    multRange: z.tuple([z.number().positive(), z.number().positive()]),
    baseProb: z.number().min(0).max(1),
  })
  .strict()
  .refine((b) => b.multRange[0] <= b.multRange[1], {
    message: 'multRange[0] must be <= multRange[1]',
  });

const TailBucketFactorsSchema = z
  .object({
    minor: z.number().nonnegative(),
    major: z.number().nonnegative(),
    catastrophic: z.number().nonnegative(),
  })
  .strict();

export const ReconVarianceConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    buckets: z.array(ReconBucketSchema).length(4),
    conditionFactors: z.record(ConditionEnum, TailBucketFactorsSchema),
    sourceReliabilityFactors: z.object({
      high: TailBucketFactorsSchema,
      mid: TailBucketFactorsSchema,
      low: TailBucketFactorsSchema,
    }).strict(),
    mileageFactors: z.object({
      normal: TailBucketFactorsSchema,
      extreme: TailBucketFactorsSchema,
    }).strict(),
    reliabilityBands: z.object({
      highMin: z.number().min(0).max(1),
      midMin: z.number().min(0).max(1),
    }).strict(),
    mileageExtremeThreshold: z.number().positive(),
    surpriseThreshold: z.number().min(1),
    reconDaysByCondition: z.object({
      clean: z.number().int().positive(),
      average: z.number().int().positive(),
      rough: z.number().int().positive(),
    }).strict(),
  })
  .strict();
export type ReconVarianceConfig = z.infer<typeof ReconVarianceConfigSchema>;
export type ReconBucket = z.infer<typeof ReconBucketSchema>;
export type ReconBucketId = ReconBucket['id'];

const ReconSurpriseTemplateSchema = z
  .object({
    id: z.string().min(1),
    bucket: z.enum(['minor', 'major', 'catastrophic']),
    reason: z.string().min(1),
  })
  .strict();

export const ReconSurpriseEventsConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    templates: z.array(ReconSurpriseTemplateSchema).nonempty(),
  })
  .strict();
export type ReconSurpriseEventsConfig = z.infer<typeof ReconSurpriseEventsConfigSchema>;
export type ReconSurpriseTemplate = z.infer<typeof ReconSurpriseTemplateSchema>;

export const MarketMarkupConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    markups: z.record(z.string().min(1), z.record(BrandTierEnum, positive)),
  })
  .strict();
export type MarketMarkupConfig = z.infer<typeof MarketMarkupConfigSchema>;

export const DaysToSellCurvesConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    defaultBaselineDays: positive,
    segmentBaselines: z.record(z.string().min(1), positive),
    priceSensitivity: z
      .object({ above: positive, below: positive })
      .strict(),
    heatSensitivity: z.number().nonnegative(),
    aging: z
      .object({
        referenceDays: positive,
        exponent: z.number().nonnegative(),
        weight: z.number().nonnegative(),
      })
      .strict(),
    bounds: z
      .object({ minDays: positive, maxDays: positive })
      .strict()
      .refine((b) => b.minDays <= b.maxDays, {
        message: 'minDays must be <= maxDays',
      }),
    confidence: z
      .object({
        priceSensitivity: z.number().nonnegative(),
        aboveWeight: z.number().nonnegative(),
        belowWeight: z.number().nonnegative(),
        compFloor: unit,
        compHalfSaturation: positive,
      })
      .strict(),
  })
  .strict();
export type DaysToSellCurvesConfig = z.infer<typeof DaysToSellCurvesConfigSchema>;

const PricingStrategyEntrySchema = z
  .object({
    label: z.string().min(1),
    blurb: z.string().min(1),
    /** Multiplies honest market price: >1 lists above market, <1 below. */
    marketAggression: positive,
    /** Book+gross floor as a fraction of book; the suggestion never undercuts it. */
    targetMarkupPct: z.number().nonnegative(),
  })
  .strict();

export const PricingStrategiesConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    defaultStrategy: z.string().min(1),
    strategies: z.record(z.string().min(1), PricingStrategyEntrySchema),
    positionBands: z
      .object({
        fireSale: positive,
        belowMarket: positive,
        atMarket: positive,
        aboveMarket: positive,
      })
      .strict()
      .refine(
        (b) =>
          b.fireSale <= b.belowMarket &&
          b.belowMarket <= b.atMarket &&
          b.atMarket <= b.aboveMarket,
        { message: 'position bands must be ascending' },
      ),
    competitorSpread: z.number().nonnegative(),
  })
  .strict()
  .refine((c) => c.strategies[c.defaultStrategy] !== undefined, {
    message: 'defaultStrategy must name a defined strategy',
  });
export type PricingStrategiesConfig = z.infer<typeof PricingStrategiesConfigSchema>;
export type PricingStrategyEntry = z.infer<typeof PricingStrategyEntrySchema>;

export function loadMarketAnchorConfig(): MarketAnchorConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-anchor.json');
  return parseData(raw, MarketAnchorConfigSchema, 'data/market-anchor.json');
}

export function loadMarketSegmentFallbackConfig(): MarketSegmentFallbackConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-segment-fallback.json');
  return parseData(
    raw,
    MarketSegmentFallbackConfigSchema,
    'data/market-segment-fallback.json',
  );
}

export function loadMarketDepreciationCurvesConfig(): MarketDepreciationCurvesConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-depreciation-curves.json');
  return parseData(
    raw,
    MarketDepreciationCurvesConfigSchema,
    'data/market-depreciation-curves.json',
  );
}

export function loadMarketConditionModsConfig(): MarketConditionModsConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-condition-mods.json');
  return parseData(
    raw,
    MarketConditionModsConfigSchema,
    'data/market-condition-mods.json',
  );
}

export function loadMarketPersonalityDistribution(): MarketPersonalityDistribution {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-personality-distribution.json');
  return parseData(
    raw,
    MarketPersonalityDistributionSchema,
    'data/market-personality-distribution.json',
  );
}

export function loadMileageDistributionConfig(): MileageDistributionConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/mileage-distribution.json');
  return parseData(
    raw,
    MileageDistributionConfigSchema,
    'data/mileage-distribution.json',
  );
}

export function loadMarketShocksConfig(): MarketShocksConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-shocks.json');
  return parseData(raw, MarketShocksConfigSchema, 'data/market-shocks.json');
}

export function loadAuctionSourcesConfig(): AuctionSourcesConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/auction-sources.json');
  return parseData(raw, AuctionSourcesConfigSchema, 'data/auction-sources.json');
}

export function loadReconVarianceConfig(): ReconVarianceConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/recon-variance.json');
  return parseData(raw, ReconVarianceConfigSchema, 'data/recon-variance.json');
}

export function loadReconSurpriseEventsConfig(): ReconSurpriseEventsConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/recon-surprise-events.json');
  return parseData(
    raw,
    ReconSurpriseEventsConfigSchema,
    'data/recon-surprise-events.json',
  );
}

export function loadMarketMarkupConfig(): MarketMarkupConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-markup.json');
  return parseData(raw, MarketMarkupConfigSchema, 'data/market-markup.json');
}

export function loadDaysToSellCurvesConfig(): DaysToSellCurvesConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/days-to-sell-curves.json');
  return parseData(
    raw,
    DaysToSellCurvesConfigSchema,
    'data/days-to-sell-curves.json',
  );
}

export function loadPricingStrategiesConfig(): PricingStrategiesConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/pricing-strategies.json');
  return parseData(
    raw,
    PricingStrategiesConfigSchema,
    'data/pricing-strategies.json',
  );
}

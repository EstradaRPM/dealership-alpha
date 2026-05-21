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

export const MarketMarkupConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    markups: z.record(z.string().min(1), z.record(BrandTierEnum, positive)),
  })
  .strict();
export type MarketMarkupConfig = z.infer<typeof MarketMarkupConfigSchema>;

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

export function loadMarketMarkupConfig(): MarketMarkupConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-markup.json');
  return parseData(raw, MarketMarkupConfigSchema, 'data/market-markup.json');
}

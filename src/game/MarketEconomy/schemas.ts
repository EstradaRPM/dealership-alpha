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
  })
  .strict();

export const MarketDepreciationCurvesConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    referenceYear: z.number().int(),
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

export function loadMarketMarkupConfig(): MarketMarkupConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/market-markup.json');
  return parseData(raw, MarketMarkupConfigSchema, 'data/market-markup.json');
}

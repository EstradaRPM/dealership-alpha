import { z } from 'zod';
import { parseData } from '../data/loadJson';

// BodyShopInsights tunables (#315). The trailing-window sizes + band/trend
// thresholds that turn the Body-Shop intake stream into the page readouts.
// Mirrors `serviceInsights`, re-keyed for the conquest readout (volume + channel
// mix instead of base health). All ship as S14 (#286) calibration placeholders;
// the JSON carries a `_doc` annotation Zod strips (not `.strict()`).
const HeatThresholdsSchema = z.object({
  /** share × categoryCount at/above which a category reads HOT. */
  hot: z.number().positive(),
  /** share × categoryCount at/below which a category reads COLD. */
  cold: z.number().positive(),
});

const BodyShopInsightsConfigSchema = z.object({
  /** Trailing intake tickets the per-category demand heat is computed over. */
  demandWindowSize: z.number().int().positive(),
  heatThresholds: HeatThresholdsSchema,
  /** Newer−older half share delta below which a category's trend reads steady. */
  demandTrendEpsilon: z.number().min(0),
  /** Trailing day count the conquest volume rate + trend average over. */
  conquestWindowDays: z.number().int().positive(),
  /** Newer−older half per-day-count delta below which the volume trend reads steady. */
  volumeTrendEpsilon: z.number().min(0),
  /** Newer−older half retail-share delta below which the channel trend reads steady. */
  channelTrendEpsilon: z.number().min(0),
});

export type BodyShopInsightsConfig = z.infer<
  typeof BodyShopInsightsConfigSchema
>;

export function loadBodyShopInsightsConfig(): BodyShopInsightsConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as {
    bodyShopInsights: unknown;
  }).bodyShopInsights;
  return parseData(
    raw,
    BodyShopInsightsConfigSchema,
    'data/tunables.json#bodyShopInsights',
  );
}

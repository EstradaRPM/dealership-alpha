import { z } from 'zod';
import { parseData } from '../data';

// ServiceInsights tunables (#308). The trailing-window sizes + band/trend
// thresholds that turn the raw intake + return/defection streams into the
// Service page readouts. All ship as S14 (#286) calibration placeholders; the
// JSON carries a `_doc` annotation Zod strips (not `.strict()`).
const HeatThresholdsSchema = z.object({
  /** share × categoryCount at/above which a category reads HOT. */
  hot: z.number().positive(),
  /** share × categoryCount at/below which a category reads COLD. */
  cold: z.number().positive(),
});

const ServiceInsightsConfigSchema = z.object({
  /** Trailing intake tickets the per-category demand heat is computed over. */
  demandWindowSize: z.number().int().positive(),
  heatThresholds: HeatThresholdsSchema,
  /** Newer−older half share delta below which a category's trend reads steady. */
  demandTrendEpsilon: z.number().min(0),
  /** Trailing day count the base-health rates + trends average over. */
  baseHealthWindowDays: z.number().int().positive(),
  /** Newer−older half per-day-count delta below which a base trend reads steady. */
  baseTrendEpsilon: z.number().min(0),
});

export type ServiceInsightsConfig = z.infer<typeof ServiceInsightsConfigSchema>;

export function loadServiceInsightsConfig(): ServiceInsightsConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as {
    serviceInsights: unknown;
  }).serviceInsights;
  return parseData(
    raw,
    ServiceInsightsConfigSchema,
    'data/tunables.json#serviceInsights',
  );
}

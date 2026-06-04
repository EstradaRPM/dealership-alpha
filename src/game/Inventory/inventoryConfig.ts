import { z } from 'zod';
import { parseData } from '../data/loadJson';

// Paid pre-purchase inspection (#164). Spends `cost` up front, blocks
// purchase for `daysToComplete` days, then exposes a tightened recon band
// centered on the realized truth with half-width = realized × halfWidthFraction.
const InspectionConfigSchema = z
  .object({
    cost: z.number().nonnegative(),
    halfWidthFraction: z.number().nonnegative(),
    daysToComplete: z.number().int().positive(),
  })
  .strict();

// Daily per-vehicle floorplan + carrying cost (#173). Floorplan interest is
// `currentBook × apr / 365`; `apr` is resolved per dealership tier
// (`aprByTier[tier] ?? baselineApr`). The flats are per-unit-per-day; recon
// fade only applies to units whose recon is complete. `agedThresholdDays` is
// the days-on-lot past which a unit is flagged aged in the UI.
// Not `.strict()`: the JSON carries a `_doc` annotation that Zod strips.
const CarryingConfigSchema = z.object({
  baselineApr: z.number().nonnegative(),
  aprByTier: z.record(z.string(), z.number().nonnegative()),
  insurancePerDay: z.number().nonnegative(),
  overheadPerDay: z.number().nonnegative(),
  reconFadePerDay: z.number().nonnegative(),
  agedThresholdDays: z.number().int().positive(),
});

const InventoryConfigSchema = z.object({
  inspection: InspectionConfigSchema,
  carrying: CarryingConfigSchema,
});

export type InspectionConfig = z.infer<typeof InspectionConfigSchema>;
export type CarryingConfig = z.infer<typeof CarryingConfigSchema>;
export type InventoryConfig = z.infer<typeof InventoryConfigSchema>;

export function loadInventoryConfig(): InventoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { inventory: unknown }).inventory;
  return parseData(raw, InventoryConfigSchema, 'data/tunables.json#inventory');
}

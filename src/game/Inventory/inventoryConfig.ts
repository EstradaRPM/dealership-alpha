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

const InventoryConfigSchema = z.object({
  inspection: InspectionConfigSchema,
});

export type InspectionConfig = z.infer<typeof InspectionConfigSchema>;
export type InventoryConfig = z.infer<typeof InventoryConfigSchema>;

export function loadInventoryConfig(): InventoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { inventory: unknown }).inventory;
  return parseData(raw, InventoryConfigSchema, 'data/tunables.json#inventory');
}

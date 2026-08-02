import { z } from 'zod';
import { parseData } from '../data';
import { PART_CATEGORIES, SUPPLIER_TIERS } from './types';

/**
 * PartsInventory procurement tunables (#301, parent #297).
 *
 * `categories` carries each Service part category's `baseUnitCost` (the
 * standard-tier unit price) plus its default `reorderPoint`/`target` par levels
 * (the initial procurement policy the player later overrides). `supplierTiers`
 * trades unit cost against lead time and reliability: `costMultiplier` scales
 * `baseUnitCost`, `leadTimeDays` is the scheduled arrival delay, `reliability`
 * ∈ [0,1] is the per-order on-time probability (a failed seeded roll adds
 * `delayPenaltyDays`). `defaultTier` is the tier a category procures at until the
 * player picks another. All numbers ship as S14 (#286) calibration placeholders.
 *
 * Not `.strict()`: the JSON carries a `_doc` annotation that Zod strips.
 */
const CategoryDefaultsSchema = z.object({
  baseUnitCost: z.number().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
  target: z.number().int().nonnegative(),
});

const SupplierTierSpecSchema = z.object({
  costMultiplier: z.number().nonnegative(),
  leadTimeDays: z.number().int().nonnegative(),
  reliability: z.number().min(0).max(1),
  delayPenaltyDays: z.number().int().nonnegative(),
});

/** Builds a `z.object` keyed by a fixed tuple of keys, all the same value schema. */
function recordOf<K extends string, V extends z.ZodTypeAny>(
  keys: readonly K[],
  value: V,
): z.ZodObject<Record<K, V>> {
  return z.object(
    Object.fromEntries(keys.map((k) => [k, value])) as Record<K, V>,
  );
}

const PartsInventoryConfigSchema = z.object({
  defaultTier: z.enum(SUPPLIER_TIERS),
  categories: recordOf(PART_CATEGORIES, CategoryDefaultsSchema),
  supplierTiers: recordOf(SUPPLIER_TIERS, SupplierTierSpecSchema),
});

export type PartsInventoryConfig = z.infer<typeof PartsInventoryConfigSchema>;

export function loadPartsInventoryConfig(): PartsInventoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { partsInventory: unknown })
    .partsInventory;
  return parseData(
    raw,
    PartsInventoryConfigSchema,
    'data/tunables.json#partsInventory',
  );
}

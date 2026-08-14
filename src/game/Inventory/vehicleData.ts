import { z } from 'zod';
import { parseData } from '../data';
import { assertKnownBrands } from '../Brands';

const VehicleTemplateSchema = z.object({
  id: z.string(),
  /**
   * Opaque canonical brand id (join key into brands.json / brand-tiers.json).
   *
   * A template declares NO brand name of its own (#246). The display name is
   * the brand's `label`, resolved from `data/brands.json` when the vehicle is
   * built, so a brand is named in exactly one place and a relabel reaches every
   * screen. `model`/`trim` are this template's own names and are fictional for
   * the same reason the labels are.
   */
  brand: z.string(),
  model: z.string(),
  trim: z.string(),
  yearRange: z.tuple([z.number().int(), z.number().int()]),
  basePriceRange: z.tuple([z.number(), z.number()]),
  mileageRange: z.tuple([z.number().int(), z.number().int()]),
  category: z.enum(['sedan', 'truck', 'suv']),
});

const ConditionTierSchema = z.object({
  priceMultiplier: z.number(),
  /**
   * Recon budget as a FRACTION of the unit's value (#286), not a dollar figure.
   * A flat dollar recon cannot be right across a catalog that spans a $3.5k
   * beater and a $40k luxury car: at tier 1 a flat $2,800 rough-unit budget ate
   * half the car's value, so a rough unit was always value-destroying — while
   * the anchor's condition discount only takes 12% off it. Proportional makes
   * the condition *discount* and the condition *recon* two halves of one
   * statement, which is what turns "buy the cheap rough one" into a decision
   * (a little cheaper, a little more work, a fatter lemon tail) instead of a
   * trap.
   */
  reconPct: z.number().min(0).max(1),
  label: z.string(),
  report: z.string(),
});

/**
 * The ONE rule for a recon budget: the condition tier's fraction of the unit's
 * value. Every acquisition path (auction listing, customer trade, opening-stock
 * seed) states it through here so the three cannot drift — they differ only in
 * which value they naturally hold at the point of acquisition.
 */
export function reconEstimateFor(value: number, reconPct: number): number {
  return Math.max(0, Math.round(value * reconPct));
}

export const VehicleDataSchema = z.object({
  schemaVersion: z.literal(1),
  templates: z.array(VehicleTemplateSchema),
  conditionTiers: z.object({
    clean: ConditionTierSchema,
    average: ConditionTierSchema,
    rough: ConditionTierSchema,
  }),
  auctionConfig: z.object({
    minListings: z.number().int().positive(),
    maxListings: z.number().int().positive(),
    // Opening days get a fatter board so the player can bootstrap a viable
    // lot with real stocking decisions instead of an RNG-gated trickle.
    // Applies while day <= throughDay; steady-state values apply after.
    earlyGame: z
      .object({
        throughDay: z.number().int().positive(),
        minListings: z.number().int().positive(),
        maxListings: z.number().int().positive(),
      })
      .optional(),
  }),
});

export type VehicleTemplate = z.infer<typeof VehicleTemplateSchema>;
export type ConditionTier = z.infer<typeof ConditionTierSchema>;
export type VehicleData = z.infer<typeof VehicleDataSchema>;

export function loadVehicleData(): VehicleData {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/vehicles.json');
  const data = parseData(raw, VehicleDataSchema, 'data/vehicles.json');
  // Referential integrity (#246). A template pointing at a brand nobody
  // declares used to be silent: it took the `?? 'mainstream'` tier default and,
  // once the display name came from the catalog, would have printed its own
  // opaque id as the car's name. Now it fails at load with the id named.
  assertKnownBrands(
    data.templates.map((t) => t.brand),
    'data/vehicles.json',
  );
  return data;
}

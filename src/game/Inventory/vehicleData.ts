import { z } from 'zod';
import { parseData } from '../data';

const VehicleTemplateSchema = z.object({
  id: z.string(),
  /**
   * Opaque canonical brand id (join key into brands.json / brand-tiers.json).
   * Never a display string — `make`/`model` carry the human-readable name.
   */
  brand: z.string(),
  make: z.string(),
  model: z.string(),
  trim: z.string(),
  yearRange: z.tuple([z.number().int(), z.number().int()]),
  basePriceRange: z.tuple([z.number(), z.number()]),
  mileageRange: z.tuple([z.number().int(), z.number().int()]),
  category: z.enum(['sedan', 'truck', 'suv']),
});

const ConditionTierSchema = z.object({
  priceMultiplier: z.number(),
  reconCost: z.number(),
  label: z.string(),
  report: z.string(),
});

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
  return parseData(raw, VehicleDataSchema, 'data/vehicles.json');
}

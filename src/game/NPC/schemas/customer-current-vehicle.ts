import { z } from 'zod';

const DistSchema = z
  .object({ mu: z.number(), sigma: z.number().min(0) })
  .strict();

const VehicleCategorySchema = z.enum(['sedan', 'truck', 'suv']);
const VehicleConditionSchema = z.enum(['clean', 'average', 'rough']);
const CreditTierKeySchema = z.enum(['A', 'B', 'C', 'D']);

const TemplateDefSchema = z
  .object({
    /** Opaque canonical brand id (join key); never a display string. */
    brand: z.string().min(1),
    make: z.string().min(1),
    model: z.string().min(1),
    category: VehicleCategorySchema,
  })
  .strict();

const ConditionWeightsSchema = z
  .object({
    clean: z.number().nonnegative(),
    average: z.number().nonnegative(),
    rough: z.number().nonnegative(),
  })
  .strict();

const CategoryWeightsSchema = z
  .object({
    sedan: z.number().nonnegative(),
    truck: z.number().nonnegative(),
    suv: z.number().nonnegative(),
  })
  .strict();

const TemplatePoolSchema = z
  .object({
    sedan: z.array(z.string().min(1)).min(1),
    truck: z.array(z.string().min(1)).min(1),
    suv: z.array(z.string().min(1)).min(1),
  })
  .strict();

const ArchetypeProfileSchema = z
  .object({
    categoryWeights: CategoryWeightsSchema,
    templatePool: TemplatePoolSchema,
    ageOffset: DistSchema,
    mileageMultiplier: DistSchema,
    conditionWeights: ConditionWeightsSchema,
    financeProbability: z.number().min(0).max(1),
    payoffByTier: z.record(CreditTierKeySchema, DistSchema),
  })
  .strict();

export const CustomerCurrentVehicleConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    referenceYear: z.number().int(),
    yearBounds: z.tuple([z.number().int(), z.number().int()]),
    mileagePerYear: z.number().positive(),
    templates: z.record(z.string().min(1), TemplateDefSchema),
    archetypes: z.record(z.string().min(1), ArchetypeProfileSchema),
  })
  .strict();

export type CustomerCurrentVehicleConfig = z.infer<
  typeof CustomerCurrentVehicleConfigSchema
>;

// ── CurrentVehicle attached to Person ────────────────────────────────────────

export const CurrentVehicleSchema = z
  .object({
    templateId: z.string().min(1),
    /** Opaque canonical brand id (join key); never a display string. */
    brand: z.string().min(1),
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int(),
    mileage: z.number().int().nonnegative(),
    condition: VehicleConditionSchema,
    category: VehicleCategorySchema,
    /** Outstanding loan balance for financed owners; null for cash-owners. */
    loanPayoff: z.number().nonnegative().nullable(),
  })
  .strict();
export type CurrentVehicle = z.infer<typeof CurrentVehicleSchema>;

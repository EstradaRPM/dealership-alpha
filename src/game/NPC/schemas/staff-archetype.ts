import { z } from 'zod';

const DistributionSchema = z
  .object({
    mu: z.number(),
    sigma: z.number().min(0),
  })
  .strict();

export const StaffArchetypeSchema = z
  .object({
    role_id: z.string().min(1),
    trait_pool: z.array(z.string().min(1)),
    trait_count: z
      .object({
        min: z.number().int().min(0),
        max: z.number().int().min(0),
      })
      .strict()
      .refine((c) => c.min <= c.max, {
        message: 'trait_count.min must be <= trait_count.max',
      }),
    skills: z.record(z.string().min(1), DistributionSchema),
    resources: z
      .object({
        stamina: DistributionSchema,
        morale: DistributionSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const StaffArchetypeCatalogSchema = z.record(
  z.string().min(1),
  StaffArchetypeSchema,
);

export type StaffArchetype = z.infer<typeof StaffArchetypeSchema>;
export type StaffArchetypeCatalog = z.infer<typeof StaffArchetypeCatalogSchema>;

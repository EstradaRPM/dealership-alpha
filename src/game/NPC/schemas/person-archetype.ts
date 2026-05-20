import { z } from 'zod';

const DistributionSchema = z
  .object({
    mu: z.number(),
    sigma: z.number().min(0),
  })
  .strict();

export const PersonArchetypeSchema = z
  .object({
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
    wealth: DistributionSchema,
    credit: DistributionSchema,
    annualIncome: DistributionSchema,
    int: DistributionSchema,
    agreeableness: DistributionSchema,
  })
  .strict();

export const PersonArchetypeCatalogSchema = z.record(
  z.string().min(1),
  PersonArchetypeSchema,
);

export type PersonArchetype = z.infer<typeof PersonArchetypeSchema>;
export type PersonArchetypeCatalog = z.infer<typeof PersonArchetypeCatalogSchema>;

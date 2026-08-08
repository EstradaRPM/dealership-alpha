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
    /**
     * How this archetype pays (#153) — trait id → independent per-customer
     * probability. Deliberately NOT part of `trait_pool`: paying cash and
     * being price-sensitive are different axes, and making them compete for
     * the archetype's one or two personality slots would mean a cash buyer is
     * *less* likely to haggle. Each entry is rolled on its own, so a customer
     * can draw both — `must-finance` wins, stated once at the payment roll.
     * Omit ⇒ this archetype's payment mix is the visit archetype's base.
     */
    payment_traits: z.record(z.string().min(1), z.number().min(0).max(1)).optional(),
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

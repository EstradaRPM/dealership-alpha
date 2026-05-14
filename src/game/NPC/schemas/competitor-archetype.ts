import { z } from 'zod';

const DistributionSchema = z
  .object({
    mu: z.number(),
    sigma: z.number().min(0),
  })
  .strict();

export const CompetitorArchetypeSchema = z
  .object({
    brand_id: z.string().min(1),
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
    attributes: z
      .object({
        csi: DistributionSchema,
        inventory_size: DistributionSchema,
        pricing: DistributionSchema,
        reputation_drift: DistributionSchema,
      })
      .strict(),
  })
  .strict();

export const CompetitorArchetypeCatalogSchema = z.record(
  z.string().min(1),
  CompetitorArchetypeSchema,
);

export type CompetitorArchetype = z.infer<typeof CompetitorArchetypeSchema>;
export type CompetitorArchetypeCatalog = z.infer<typeof CompetitorArchetypeCatalogSchema>;

export const BrandMarketShareEntrySchema = z
  .object({
    share: z.number().min(0).max(1),
    tier: z.number().int().min(1).max(3),
    segment: z.string().min(1),
  })
  .strict();

export const BrandMarketShareCatalogSchema = z.record(
  z.string().min(1),
  BrandMarketShareEntrySchema,
);

export type BrandMarketShareEntry = z.infer<typeof BrandMarketShareEntrySchema>;
export type BrandMarketShareCatalog = z.infer<typeof BrandMarketShareCatalogSchema>;

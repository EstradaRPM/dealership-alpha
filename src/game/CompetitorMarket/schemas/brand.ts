import { z } from 'zod';

export const SpacedLeanSchema = z
  .object({
    safety: z.number().min(0).max(1),
    performance: z.number().min(0).max(1),
    appearance: z.number().min(0).max(1),
    comfort: z.number().min(0).max(1),
    economy: z.number().min(0).max(1),
    dependability: z.number().min(0).max(1),
  })
  .strict();

export const BrandEntrySchema = z
  .object({
    segment_affinity: z.record(z.string().min(1), z.number().min(0).max(1)),
    market_draw: z.number().min(0).max(1),
    spaced_lean: SpacedLeanSchema,
  })
  .strict();

export const BrandCatalogSchema = z.record(z.string().min(1), BrandEntrySchema);

export type SpacedLean = z.infer<typeof SpacedLeanSchema>;
export type BrandEntry = z.infer<typeof BrandEntrySchema>;
export type BrandCatalog = z.infer<typeof BrandCatalogSchema>;

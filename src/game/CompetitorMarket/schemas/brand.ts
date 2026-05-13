import { z } from 'zod';

export const BrandEntrySchema = z
  .object({
    segment_affinity: z.record(z.string().min(1), z.number().min(0).max(1)),
    market_draw: z.number().min(0).max(1),
  })
  .strict();

export const BrandCatalogSchema = z.record(z.string().min(1), BrandEntrySchema);

export type BrandEntry = z.infer<typeof BrandEntrySchema>;
export type BrandCatalog = z.infer<typeof BrandCatalogSchema>;

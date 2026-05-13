import { z } from 'zod';

export const CompetitorSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().min(1),
    rep: z.number().min(0).max(1),
    inventory: z.number().min(0).max(1),
    pricing: z.number().min(0).max(1),
  })
  .strict();

export const CompetitorCatalogSchema = z.array(CompetitorSchema);

export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorCatalog = z.infer<typeof CompetitorCatalogSchema>;

import { z } from 'zod';

const ClampSchema = z
  .object({ lo: z.number().min(0).max(1), hi: z.number().min(0).max(1) })
  .strict()
  .refine((c) => c.lo <= c.hi, { message: 'lo must be <= hi' });

export const CompetitorSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().min(1),
    personality: z.string().min(1),
    price_point: z.enum(['budget', 'value', 'standard', 'premium']),
    rep: z.number().min(0).max(1),
    inventory: z.number().min(0).max(1),
    pricing: z.number().min(0).max(1),
    clamp: z
      .object({ rep: ClampSchema, inventory: ClampSchema, pricing: ClampSchema })
      .strict(),
  })
  .strict();

export const CompetitorCatalogSchema = z.array(CompetitorSchema);

export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorCatalog = z.infer<typeof CompetitorCatalogSchema>;

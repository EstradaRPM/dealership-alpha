import { z } from 'zod';

export const CompetitorClassificationSchema = z.enum(['direct', 'indirect']);
export type CompetitorClassification = z.infer<typeof CompetitorClassificationSchema>;

const CompetitorAttributesSchema = z
  .object({
    csi: z.number(),
    inventory_size: z.number(),
    pricing: z.number(),
    reputation_drift: z.number(),
  })
  .strict();

export const CompetitorSchema = z
  .object({
    id: z.string().min(1),
    archetype_id: z.string().min(1),
    brand_id: z.string().min(1),
    classification: CompetitorClassificationSchema,
    trait_ids: z.array(z.string().min(1)),
    attributes: CompetitorAttributesSchema,
    market_share: z.number().min(0).max(1),
    tier: z.number().int().min(1).max(3),
    segment: z.string().min(1),
  })
  .strict();

export type Competitor = z.infer<typeof CompetitorSchema>;

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

/**
 * One brand, as `data/brands.json` declares it (#246).
 *
 * `id` is the opaque join key every other file and every save references.
 * `label` is the display name — the only brand string a player ever reads, and
 * a property of the brand rather than a key, so relabelling one touches the
 * catalog and nothing else.
 */
export const BrandEntrySchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    segment_affinity: z.record(z.string().min(1), z.number().min(0).max(1)),
    market_draw: z.number().min(0).max(1),
    spaced_lean: SpacedLeanSchema,
  })
  .strict();

// Top level is deliberately NOT `.strict()` — the `_doc` annotations carry the
// record of why the ids did not change in v2, and Zod strips them.
export const BrandsFileSchema = z
  .object({
    schemaVersion: z.literal(2),
    brands: z.array(BrandEntrySchema).nonempty(),
  })
  .refine((c) => new Set(c.brands.map((b) => b.id)).size === c.brands.length, {
    message: 'brand ids must be unique',
  })
  // Two brands sharing a display name would be indistinguishable on screen
  // while behaving differently — the one failure a label-as-property design can
  // still produce, so the catalog refuses it.
  .refine((c) => new Set(c.brands.map((b) => b.label)).size === c.brands.length, {
    message: 'brand labels must be unique',
  });

export type SpacedLean = z.infer<typeof SpacedLeanSchema>;
export type BrandEntry = z.infer<typeof BrandEntrySchema>;
export type BrandsFile = z.infer<typeof BrandsFileSchema>;

/**
 * The catalog as consumers read it: indexed by id.
 *
 * The FILE is an array — that is the `data/auction-sources.json` idiom and the
 * only shape in which an `id` can sit beside its `label`. The runtime shape is a
 * record because every consumer joins by id (`brands[vehicle.brand]`), and
 * making each of them scan an array would be the same lookup written eight
 * times.
 */
export type BrandCatalog = Readonly<Record<string, BrandEntry>>;

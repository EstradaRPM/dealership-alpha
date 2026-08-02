import { z } from 'zod';

/**
 * The name pool every generated person draws from (#347). Two independent
 * lists rather than a list of whole names, so `first × last` gives a large
 * combination space out of a small, hand-curated data file.
 */
export const PersonNameCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    first: z.array(z.string().min(1)).min(1),
    last: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type PersonNameCatalog = z.infer<typeof PersonNameCatalogSchema>;

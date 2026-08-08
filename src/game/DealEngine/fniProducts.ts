import { z } from 'zod';
import { parseData } from '../data';
import type { FniProduct, FniProductCatalog, FniAutoAttachConfig } from './types';

// `.strict()` per product (#152, same call as `TierDefSchema`): a mistyped
// `loanSensitivty` would otherwise be silently stripped, leaving a product that
// looks tuned in the file and attaches flat in the game.
const FniProductSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    shortLabel: z.string().min(1),
    defaultPrice: z.number().nonnegative(),
    cost: z.number().nonnegative(),
    requiredRole: z.string().min(1).optional(),
    requiresFinancing: z.boolean().optional(),
    // Bounded at 1: past it the multiplier goes negative on a small note, which
    // is not "very sensitive", it is a broken rate.
    loanSensitivity: z.number().min(0).max(1).optional(),
  })
  .strict();

export const FniProductCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  _doc: z.string().optional(),
  products: z.array(FniProductSchema).nonempty(),
});

export function loadFniProducts(): FniProductCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../../data/fni-products.json') as unknown;
  return parseData(raw, FniProductCatalogSchema, 'data/fni-products.json');
}

export function getFniProductById(catalog: FniProductCatalog, id: string): FniProduct | undefined {
  return catalog.products.find((p) => p.id === id);
}

export function loadFniAutoAttachConfig(): FniAutoAttachConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { fniAutoAttach: FniAutoAttachConfig }).fniAutoAttach;
  return raw;
}

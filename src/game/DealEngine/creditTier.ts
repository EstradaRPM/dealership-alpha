import { z } from 'zod';
import { parseData } from '../data';
import type { CreditTier, CreditTierCatalog } from './types';

// `.strict()` is load-bearing (#365): the tier table used to call the lender's
// cost of money `apr`, and the whole point of the rename is that the customer's
// rate is `buyRate + markup`. A stale `apr` key would otherwise be silently
// stripped and the file would look fine while the reserve read zero, so the
// loader refuses any key it does not know.
const TierDefSchema = z
  .object({
    minScore: z.number().nonnegative(),
    buyRate: z.number().positive(),
    markupCapPts: z.number().min(0),
    maxTerm: z.number().int().positive(),
    ptiCap: z.number().positive().max(1),
    minDownPct: z.number().min(0).max(1),
    ltvCeiling: z.number().positive(),
  })
  .strict();

export const CreditTierCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  tiers: z.object({
    A: TierDefSchema,
    B: TierDefSchema,
    C: TierDefSchema,
    D: TierDefSchema,
  }),
});

export function loadCreditTiers(): CreditTierCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../../data/credit-tiers.json') as unknown;
  return parseData(raw, CreditTierCatalogSchema, 'data/credit-tiers.json');
}

// Tiers evaluated highest-threshold first; D is the floor (minScore 0).
const TIER_ORDER: CreditTier[] = ['A', 'B', 'C', 'D'];

export function classifyCredit(score: number, catalog: CreditTierCatalog): CreditTier {
  for (const tier of TIER_ORDER) {
    if (score >= catalog.tiers[tier].minScore) return tier;
  }
  return 'D';
}

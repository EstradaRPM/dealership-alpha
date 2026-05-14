import { z } from 'zod';
import { parseData } from '../data/loadJson';
import type { CreditTier, CreditTierCatalog } from './types';

const TierDefSchema = z.object({
  minScore: z.number().nonnegative(),
  apr: z.number().positive(),
});

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

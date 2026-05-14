import type { SalesVisit } from '../NPC';
import type { Competitor } from './Competitor';
import type { BrandCatalog } from './schemas/brand';

const SPACED_KEYS = [
  'safety',
  'performance',
  'appearance',
  'comfort',
  'economy',
  'dependability',
] as const;

export function scoreCompetitor(
  competitor: Competitor,
  visit: SalesVisit,
  brands: BrandCatalog,
): number {
  const brand = brands[competitor.brand];
  if (!brand) return 0;

  const p = visit.preferences;
  const lean = brand.spaced_lean;

  // Brand match: weighted average of brand SPACED lean, weighted by customer's positive preferences
  let dot = 0;
  let mass = 0;
  for (const k of SPACED_KEYS) {
    const w = Math.max(0, p[k]);
    dot += w * lean[k];
    mass += w;
  }
  const brandMatch = mass > 0 ? dot / mass : 0.5;

  // Dealer score: customer-preference-weighted sum of three stat axes
  // Weights derived from SPACED dims closest to each axis concern:
  //   rep     ← safety + dependability (reliability/trust orientation)
  //   inventory ← performance + appearance (selection/variety orientation)
  //   pricing ← economy (price sensitivity)
  const repW = Math.max(0, p.safety + p.dependability);
  const invW = Math.max(0, p.performance + p.appearance);
  const priceW = Math.max(0, p.economy);
  const totalW = repW + invW + priceW;

  const dealerScore =
    totalW === 0
      ? (competitor.rep + competitor.inventory + (1 - competitor.pricing)) / 3
      : (repW * competitor.rep + invW * competitor.inventory + priceW * (1 - competitor.pricing)) /
        totalW;

  return brandMatch * dealerScore;
}

import type { SalesVisit } from '../NPC';
import type { Competitor } from '../CompetitorMarket/Competitor';
import { scoreCompetitor } from '../CompetitorMarket/ScoreCompetitor';
import type { BrandCatalog } from '../CompetitorMarket/schemas/brand';

export interface PoachOutcome {
  poached: true;
  competitor: Competitor;
}

export type PoachResult = PoachOutcome | { poached: false };

export interface PoachParams {
  traitIds: readonly string[];
  visit: SalesVisit;
  competitors: ReadonlyArray<Competitor>;
  brands: BrandCatalog;
  /** Player dealership strength, normalized 0–1. */
  playerStrength: number;
  shopAroundBaseRate: number;
  shopAroundHighRate: number;
  shopAroundTraitId: string;
  rng: () => number;
}

/**
 * Poach probability = shopAround × competitorRelativeStrength
 *
 * shopAround: high for customers with the shop-around trait, low otherwise.
 * competitorRelativeStrength: how much the best-matching competitor outscores
 * the player, clamped to [0, 1].
 */
export function checkPoach(p: PoachParams): PoachResult {
  if (p.competitors.length === 0) return { poached: false };

  const shopAround = p.traitIds.includes(p.shopAroundTraitId)
    ? p.shopAroundHighRate
    : p.shopAroundBaseRate;

  let bestCompetitor: Competitor | null = null;
  let bestScore = 0;
  for (const c of p.competitors) {
    const score = Math.max(0, scoreCompetitor(c, p.visit, p.brands));
    if (score > bestScore) {
      bestScore = score;
      bestCompetitor = c;
    }
  }

  if (!bestCompetitor || bestScore === 0) return { poached: false };

  const competitorRelativeStrength = Math.max(0, Math.min(1, bestScore - p.playerStrength));
  const poachProb = shopAround * competitorRelativeStrength;

  return p.rng() < poachProb
    ? { poached: true, competitor: bestCompetitor }
    : { poached: false };
}

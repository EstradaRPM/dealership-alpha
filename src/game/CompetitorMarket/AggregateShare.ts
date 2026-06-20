import type { SalesVisit } from '../NPC';
import type { Competitor, CompetitorCatalog } from './Competitor';
import type { BrandCatalog } from './schemas/brand';
import { scoreCompetitor } from './ScoreCompetitor';

/**
 * Caller-side aggregation over `scoreCompetitor` (ADR-0002 §4).
 *
 * For each visit, scores are normalized into a share-of-preference across
 * competitors; the average over all visits yields each competitor's expected
 * share of the population.
 *
 * Optional `filter` slices the population without changing the function
 * signature — adding new customer facets (segment, region, credit tier) later
 * comes for free.
 *
 * Returned shares sum to ~1 when at least one visit yields a non-zero score
 * for at least one competitor. Visits where every competitor scores zero
 * contribute nothing (they're "no-shop" visits, not silent ties).
 */
export function aggregateShare(
  competitors: CompetitorCatalog,
  visits: ReadonlyArray<SalesVisit>,
  brands: BrandCatalog,
  filter?: (visit: SalesVisit) => boolean,
): Map<Competitor['id'], number> {
  const subset = filter ? visits.filter(filter) : visits;
  const shares = new Map<string, number>();
  for (const c of competitors) shares.set(c.id, 0);

  if (subset.length === 0) return shares;

  let contributing = 0;
  for (const visit of subset) {
    const scores: number[] = new Array(competitors.length);
    let total = 0;
    for (let i = 0; i < competitors.length; i++) {
      const s = Math.max(0, scoreCompetitor(competitors[i], visit, brands));
      scores[i] = s;
      total += s;
    }
    if (total === 0) continue;
    contributing++;
    for (let i = 0; i < competitors.length; i++) {
      const c = competitors[i];
      shares.set(c.id, (shares.get(c.id) ?? 0) + scores[i] / total);
    }
  }

  if (contributing === 0) return shares;
  for (const [k, v] of shares) shares.set(k, v / contributing);
  return shares;
}

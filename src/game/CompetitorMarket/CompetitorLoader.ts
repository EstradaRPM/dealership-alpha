import { parseData, DataValidationError } from '../data';
import { CompetitorCatalogSchema, type CompetitorCatalog } from './Competitor';
import { loadBrands } from './BrandLoader';

export function loadCompetitors(): CompetitorCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/competitors.json');
  const competitors = parseData(raw, CompetitorCatalogSchema, 'data/competitors.json');

  const knownBrands = new Set(Object.keys(loadBrands()));
  for (const c of competitors) {
    if (!knownBrands.has(c.brand)) {
      throw new DataValidationError(
        'data/competitors.json',
        `competitor "${c.id}" references unknown brand "${c.brand}"`,
      );
    }
  }

  return competitors;
}

import { parseData } from '../data';
import {
  CompetitorArchetypeCatalogSchema,
  BrandMarketShareCatalogSchema,
  type CompetitorArchetype,
  type CompetitorArchetypeCatalog,
  type BrandMarketShareEntry,
  type BrandMarketShareCatalog,
} from './schemas/competitor-archetype';

export type { CompetitorArchetype, CompetitorArchetypeCatalog };
export type { BrandMarketShareEntry, BrandMarketShareCatalog };

export function loadCompetitorArchetypes(): CompetitorArchetypeCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/competitor-archetypes.json');
  return parseData(raw, CompetitorArchetypeCatalogSchema, 'data/competitor-archetypes.json');
}

export function loadBrandMarketShare(): BrandMarketShareCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/brand-market-share.json');
  return parseData(raw, BrandMarketShareCatalogSchema, 'data/brand-market-share.json');
}

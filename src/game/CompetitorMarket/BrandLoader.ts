import { parseData } from '../data';
import { BrandCatalogSchema, type BrandCatalog } from './schemas/brand';

export function loadBrands(): BrandCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/brands.json');
  return parseData(raw, BrandCatalogSchema, 'data/brands.json');
}

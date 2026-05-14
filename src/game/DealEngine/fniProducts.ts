import type { FniProduct, FniProductCatalog } from './types';

export function loadFniProducts(): FniProductCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../data/fni-products.json') as FniProductCatalog;
}

export function getFniProductById(catalog: FniProductCatalog, id: string): FniProduct | undefined {
  return catalog.products.find((p) => p.id === id);
}

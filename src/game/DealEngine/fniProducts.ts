import type { FniProduct, FniProductCatalog, FniAutoAttachConfig } from './types';

export function loadFniProducts(): FniProductCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../data/fni-products.json') as FniProductCatalog;
}

export function getFniProductById(catalog: FniProductCatalog, id: string): FniProduct | undefined {
  return catalog.products.find((p) => p.id === id);
}

export function loadFniAutoAttachConfig(): FniAutoAttachConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { fniAutoAttach: FniAutoAttachConfig }).fniAutoAttach;
  return raw;
}

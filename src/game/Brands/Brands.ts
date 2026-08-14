import { parseData } from '../data';
import { BrandsFileSchema, type BrandCatalog, type BrandEntry } from './schemas';

/**
 * The canonical Brand catalog (#246).
 *
 * A library module, not an EventBus participant — the same shape as `Rng` and
 * `data`. It lives on its own rather than inside `CompetitorMarket` because a
 * brand is not a rival-dealer concern: Inventory names the cars on the lot from
 * it, SalesProcess reads its tier, NPC reads its market share, MarketEconomy
 * reads its price anchor, and the Reveal and the wire read its label. Any one of
 * those importing another module's barrel to learn what a car is called would be
 * a dependency nobody could justify from the domain.
 */
export function loadBrandsFile() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/brands.json');
  return parseData(raw, BrandsFileSchema, 'data/brands.json');
}

/**
 * The catalog, indexed by id.
 *
 * Deliberately NOT memoized, and that is a behaviour decision rather than an
 * oversight: `loadBrands()` returned a freshly-parsed object on every call
 * before this module existed, and entries are handed out by reference (a
 * competitor's `segment_affinity` rides an event payload). A shared instance
 * would make any in-place write by a consumer outlive the world that made it,
 * which in a 600-day calibration run is a drift nobody could trace back here.
 * The parse is a `require` of an already-cached module plus one Zod pass.
 */
export function loadBrands(): BrandCatalog {
  const file = loadBrandsFile();
  const byId: Record<string, BrandEntry> = {};
  for (const brand of file.brands) byId[brand.id] = brand;
  return byId;
}

/** Every declared brand id, in catalog order. */
export function brandIds(): readonly string[] {
  return Object.keys(loadBrands());
}

/**
 * The display name for a brand id.
 *
 * Falls back to the id for a brand the catalog does not know. That is the right
 * failure for a *name*: a save or a fixture carrying a retired brand still
 * renders something a human can read and report, where a throw would take the
 * whole career down over a label. A brand the game generates is checked at load
 * instead — `assertKnownBrands` — so an unknown id here can only come from data
 * that predates the catalog.
 */
export function brandLabel(brandId: string): string {
  return loadBrands()[brandId]?.label ?? brandId;
}

/**
 * Referential integrity for any file that joins on a brand id.
 *
 * Called by the loaders that read a brand-bearing catalog, so a template
 * pointing at a brand nobody declares fails at load with the offending id named
 * — rather than silently taking every `?? 'mainstream'` default downstream and
 * rendering its own id as a car's name.
 */
export function assertKnownBrands(
  brandIdsUsed: readonly string[],
  source: string,
): void {
  const known = loadBrands();
  const unknown = [...new Set(brandIdsUsed)].filter((id) => !(id in known));
  if (unknown.length > 0) {
    throw new Error(
      `${source}: references brand id(s) not declared in data/brands.json: ${unknown.join(', ')}`,
    );
  }
}

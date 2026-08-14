# Brands

The canonical Brand entity (#246). A **library module**, not an EventBus participant — the same
shape as `Rng` and `data`. It emits nothing, subscribes to nothing, and takes no `EventBus`.

## Why it is its own module

A brand is not a rival-dealer concern, and it used to live inside `CompetitorMarket`. Inventory
names the cars on the lot from it, SalesProcess reads its tier, NPC reads its market share,
MarketEconomy reads its price anchor, and the Reveal and the industry wire read its label. Any one
of those importing `CompetitorMarket`'s barrel to learn what a car is called would be a dependency
nobody could justify from the domain.

## Public API (`index.ts`)

- `loadBrands(): BrandCatalog` — the catalog indexed by **opaque id**, parsed once per process.
- `brandLabel(id): string` — the display name. Falls back to the id for an unknown brand: the
  failure mode of a *name* is showing something odd, never taking the career down.
- `brandIds(): readonly string[]` — every declared id, in catalog order.
- `assertKnownBrands(ids, source)` — referential integrity, called by every loader that joins on a
  brand id so an undeclared brand fails at load with the offending id named.
- `loadBrandsFile()` — the raw array form; only tests and the catalog itself need it.
- Types: `BrandCatalog`, `BrandEntry`, `BrandsFile`, `SpacedLean`.

## Tunable data

`data/brands.json` (`schemaVersion: 2`) — an array of `{ id, label, segment_affinity,
market_draw, spaced_lean }`.

## The two rules

**`id` is the join key and is never displayed.** `vehicles.json`,
`customer-current-vehicle.json`, `brand-tiers.json`, `brand-market-share.json`, `competitors.json`
and `competitor-archetypes.json` all reference it, and the engine persists it inside the
`inventory`, `competitorMarket` and `reputation` save blobs. Renaming an id is therefore a
three-module save migration; the ids deliberately did not change in v2.

**`label` is the only brand string a player ever reads.** No vehicle template carries a brand name
of its own — the label is resolved from this catalog when the vehicle is built, and re-resolved on
restore, so a brand is named in exactly one place and a relabel reaches every screen and every
existing save. A surface that wants to print a brand takes the resolved name off the vehicle; it
never reaches in here itself (UI does not import game internals).

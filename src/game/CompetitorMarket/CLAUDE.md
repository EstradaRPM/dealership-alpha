# CompetitorMarket

Static competitor roster. Each competitor has a personality, price point, and weekly stat drift. Publishes daily competitive pressure that `CustomerPool` consumes for poach decisions.

## Public API (`index.ts`)
- `createCompetitorMarket()` → `CompetitorMarket`. Exposes `getCompetitors`, `getCompetitor`, `snapshot/restore` (#191), `dispose`.
- Loaders: `loadBrands`, `loadCompetitors`, `loadPersonalityDrift`.
- Scoring: `scoreCompetitor`, `aggregateShare`.
- Schemas: `CompetitorSchema`, `CompetitorCatalogSchema`.
- Types: `Competitor`, `CompetitorCatalog`, `BrandEntry`, `BrandCatalog`, `SpacedLean`, `DriftSigma`, `PersonalityDriftCatalog`.

## Events
- **Emits:** `market:competitive_pressure` every `clock:day_started` (carries the read-only competitor list); `competitor:price_changed` (slice #158) during weekly drift when `|new − old| ≥ competitorMarket.pricingChangeThreshold` *and* the optional `brands` dep was passed in (omit `brands` to suppress the event in tests that don't care).
- **Consumes:** `clock:day_started` (publish pressure), `clock:day_ended` (run drift + maybe emit price-changed).

## Data
- `data/competitors.json`, `data/competitor-archetypes.json`, `data/competitor-personality-drift.json`, `data/brands.json`, `data/brand-market-share.json`.

## Current simplification
Static roster; weekly drift only. ADR-0001 §10 documents the pressure-publish contract — read it before changing the publish/consume shape.

## Persistence & determinism (#183 → #191)
Wired into the world in `createWorld` from `seed: deriveSeed(masterSeed, 'competitor_market.drift', {})`.

**Drift is persisted via `snapshot/restore` (#191), not reconstructed.** The earlier #183 plan (re-derive drift from seed + elapsed day count) assumed something replays the weekly `clock:day_ended` ticks on reconstruction. The #186 world seam (`restoreWorld`) does the opposite: it builds a fresh World (competitors at the cold `loadCompetitors()` baseline) and overwrites state in place — it never re-runs the day-by-day rebuild. So the drift must be captured:
- `CompetitorMarketSnapshot = { schemaVersion, competitors, rngState }`. `competitors` is the live (post-drift) stats; `rngState` is the drift RNG cursor.
- `restore` overwrites stats *in place* onto the existing `live`/`byId` objects (so the references handed out by `getCompetitors()` and published in `market:competitive_pressure` stay stable), then rewinds the RNG cursor. Persisting `rngState` keeps *future* drift on the exact trajectory the original world was on, so a save/load never diverges from a no-save playthrough.
- #122 mid-day FloorSim replay still never advances `clock:day_ended`, so competitor drift is invariant across a checkpoint resume regardless.

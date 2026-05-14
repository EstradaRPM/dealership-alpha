# CompetitorMarket

Static (v1) competitor roster. Each competitor has a personality, price point, and weekly stat drift. Publishes daily competitive pressure that `CustomerPool` consumes for poach decisions.

## Public API (`index.ts`)
- `createCompetitorMarket()` → `CompetitorMarket`.
- Loaders: `loadBrands`, `loadCompetitors`, `loadPersonalityDrift`.
- Scoring: `scoreCompetitor`, `aggregateShare`.
- Schemas: `CompetitorSchema`, `CompetitorCatalogSchema`.
- Types: `Competitor`, `CompetitorCatalog`, `BrandEntry`, `BrandCatalog`, `SpacedLean`, `DriftSigma`, `PersonalityDriftCatalog`.

## Events
- **Emits:** `market:competitive_pressure` every `clock:day_started` (carries the read-only competitor list).
- **Consumes:** `clock:day_started` (run drift, publish pressure).

## Data
- `data/competitors.json`, `data/competitor-archetypes.json`, `data/competitor-personality-drift.json`, `data/brands.json`, `data/brand-market-share.json`.

## v1 simplification
Static roster; weekly drift only. ADR-0001 §10 documents the pressure-publish contract — read it before changing the publish/consume shape.

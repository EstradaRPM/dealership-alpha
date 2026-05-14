# NPC

Shared people-and-traits substrate used by `CustomerPool`, `StaffOrg`, and `CompetitorMarket`. Centralizes person/trait modeling so the three NPC kinds compose from common parts.

## Public API (`index.ts`)
- Traits: `resolveEffects`, `TraitAppliesError`, `loadTraitTaxonomy`. Types: `Trait`, `TraitSet`.
- Staff: `loadStaffTaxonomy`, `loadStaffArchetypes`, `createStaff`, `promoteStaff`. Types: `Staff`, `StaffRole`, `StaffSkill`, `CreateStaffContext`, `CreateStaffDeps`, `StaffWithComposites`.
- Customers: `createCustomer`, `hotButtons`, `loadPersonArchetypes`, `loadVisitArchetypes`. Types: `Person`, `SalesVisit`, `ServiceVisit`, `BodyVisit`, `Visit`, `CustomerBundle`, `CreateCustomerContext`, `CreateCustomerDeps`.
- Competitors: `loadCompetitorArchetypes`, `loadBrandMarketShare`, `createCompetitor`. Types: `Competitor`, `CreateCompetitorContext`, `CreateCompetitorDeps`.
- Shared: `Rng` (deterministic RNG seed plumbing).

## Events
NPC is a factory/library module — does not publish or subscribe. Consumers (CustomerPool, StaffOrg, CompetitorMarket) publish on its outputs.

## Data
- `data/npc-traits.json` — trait taxonomy.
- `data/person-archetypes.json`, `data/visit-archetypes.json`, `data/customer-tunables.json`.
- `data/staff-archetypes.json`, `data/staff-roles.json`, `data/staff-skills.json`.
- `data/competitor-archetypes.json`, `data/brand-market-share.json`.

## Why this exists
Issue #5 grilled on NPC architecture; this module is the resulting shared substrate. See `npc-architecture-grill-me` memory for context if extending the trait or factory model.

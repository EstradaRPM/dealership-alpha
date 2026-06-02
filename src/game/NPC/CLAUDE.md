# NPC

Shared people-and-traits substrate used by `CustomerPool`, `StaffOrg`, and `CompetitorMarket`. Centralizes person/trait modeling so the three NPC kinds compose from common parts.

## Public API (`index.ts`)
- Traits: `resolveEffects`, `TraitAppliesError`, `loadTraitTaxonomy`. Types: `Trait`, `TraitSet`.
- Staff: `loadStaffTaxonomy`, `loadStaffArchetypes`, `createStaff`, `promoteStaff`. Types: `Staff`, `StaffRole`, `StaffSkill`, `CreateStaffContext`, `CreateStaffDeps`, `StaffWithComposites`.
- Customers: `createCustomer`, `hotButtons`, `loadPersonArchetypes`, `loadVisitArchetypes`. Types: `Person`, `SalesVisit`, `ServiceVisit`, `BodyVisit`, `Visit`, `CustomerBundle`, `CreateCustomerContext`, `CreateCustomerDeps`.
- CurrentVehicle (#165): `rollCurrentVehicle`, `loadCustomerCurrentVehicleConfig`, `CurrentVehicleSchema`, `CustomerCurrentVehicleConfigSchema`. Types: `CurrentVehicle`, `CustomerCurrentVehicleConfig`. When the composition root passes `currentVehicleConfig` + `classifyCreditTier` to `createCustomer`, the rolled `Person` carries `currentVehicle` (the car they drove in on) with an optional `loanPayoff` per finance roll × credit tier. Legacy callers (omitting both deps) get a Person without the field — the engine doesn't require it yet (#165 is data-only; trade-in machinery is #166–#171).
- TradeIncidence (#166): `rollHasTrade`, `loadTradeIncidenceConfig`, `TradeIncidenceConfigSchema`. Types: `TradeIncidenceConfig`. When `tradeIncidenceConfig` + `classifyCreditTier` are both wired, every sales `Visit` carries `hasTrade: boolean` rolled from the composite (archetype × paymentMethod × creditTier) probability matrix. Legacy callers omit the field.
- TradeAsk (#167): `createCustomer` accepts an optional `tradeAskFn(currentVehicle, seed) → number` seam. When wired *and* a sales visit rolled `hasTrade: true` with a `currentVehicle`, the visit carries `allowanceAsk: number` — the dollar figure the customer wants for their trade. NPC derives the seed; the seam (composed at the root from DealEngine's `generateTradeAsk` bound to the live book-value provider) owns the valuation + noise, so NPC stays free of a DealEngine/MarketEconomy dep. Legacy callers omit the field.
- Competitors: `loadCompetitorArchetypes`, `loadBrandMarketShare`, `createCompetitor`. Types: `Competitor`, `CreateCompetitorContext`, `CreateCompetitorDeps`.
- Shared: `Rng` (deterministic RNG seed plumbing).

## Events
NPC is a factory/library module — does not publish or subscribe. Consumers (CustomerPool, StaffOrg, CompetitorMarket) publish on its outputs.

## Data
- `data/npc-traits.json` — trait taxonomy.
- `data/person-archetypes.json`, `data/visit-archetypes.json`, `data/customer-tunables.json`.
- `data/staff-archetypes.json`, `data/staff-roles.json`, `data/staff-skills.json`.
- `data/competitor-archetypes.json`, `data/brand-market-share.json`.
- `data/customer-current-vehicle.json` (#165) — per-archetype distribution: category weights, year-age + mileage skews, condition weights, finance probability, and per-credit-tier loan-payoff distributions. Templates declared inline so NPC stays free of an Inventory dep.
- `data/trade-incidence.json` (#166) — per-archetype trade probability matrix: `cash | finance` × `A | B | C | D`. Captures the real-world skew (financers > cash buyers; sub-prime > prime; family-replacement / luxury-trader archetypes > commuters / retirees).

## Why this exists
Issue #5 grilled on NPC architecture; this module is the resulting shared substrate. See `npc-architecture-grill-me` memory for context if extending the trait or factory model.

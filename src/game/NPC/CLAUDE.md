# NPC

Shared people-and-traits substrate used by `CustomerPool`, `StaffOrg`, and `CompetitorMarket`. Centralizes person/trait modeling so the three NPC kinds compose from common parts.

## Public API (`index.ts`)
- Traits: `resolveEffects`, `TraitAppliesError`, `loadTraitTaxonomy`. Types: `Trait`, `TraitSet`.
- Staff: `loadStaffTaxonomy`, `loadStaffArchetypes`, `createStaff`, `promoteStaff`, `effectiveSkillValue`, `computeEffectiveSkills`. Types: `Staff`, `StaffRole`, `StaffSkill`, `CreateStaffContext`, `CreateStaffDeps`, `StaffWithComposites`.
  - **Effective skill (#294, channel-desk M7):** `StaffWithComposites` carries a non-enumerable `effectiveSkills` getter (parallel to `effectiveness`/`trustworthiness`) = Model B derived skill: `clamp(base + growth_rate × counter, base, perHireCap)` per axis, where `perHireCap = min(skill cap, base + max(0, gaussian(cap_headroom)))` is rolled deterministically from the staff id (`SKILL_CAP_HEADROOM_NAMESPACE`). Pure — never mutates `skills`; reflects live `counters`, so it grows as StaffOrg accrues counters overnight. With zero counters `effective === base`. `growth_counter` + `cap_headroom` are optional per-skill fields in `data/staff-skills.json`; omit `growth_counter` ⇒ static axis. `createStaff` seeds the cap from `deps.masterSeed`; `rehydrateStaff`/`promoteStaff` take an optional `masterSeed` (default 0) so the cap re-derives identically on a save reload.
- Customers: `createCustomer`, `hotButtons`, `loadPersonArchetypes`, `loadVisitArchetypes`. Types: `Person`, `SalesVisit`, `ServiceVisit`, `BodyVisit`, `Visit`, `CustomerBundle`, `CreateCustomerContext`, `CreateCustomerDeps`.
- CurrentVehicle (#165): `rollCurrentVehicle`, `loadCustomerCurrentVehicleConfig`, `CurrentVehicleSchema`, `CustomerCurrentVehicleConfigSchema`. Types: `CurrentVehicle`, `CustomerCurrentVehicleConfig`, `FinancingConfig`. When the composition root passes `currentVehicleConfig` + `classifyCreditTier` to `createCustomer`, the rolled `Person` carries `currentVehicle` (the car they drove in on). Legacy callers (omitting both deps) get a Person without the field — the engine doesn't require it yet (#165 is data-only; trade-in machinery is #166–#171).
  - **Loan payoff (#282):** a financed owner's `loanPayoff` is derived *relative to the trade's current book value*, not as a value-blind dollar draw: `payoff = book × clamp(ltvAtOrigination × remainingPrincipalFraction ÷ depreciationOverLoanAge)`. The book is read via an injected `bookValueFn` dep (the live MarketEconomy `bookValueFn`, same seam as `tradeAskFn`, threaded through `CreateCustomerDeps.bookValueFn` → `RollCurrentVehicleDeps.bookValueFn`) so NPC stays MarketEconomy-free. The three factors (origination LTV / amortization paydown / depreciation) are the honest mechanics behind negative equity; a tunable `deepTailWeight` sets how many loans sit in the "fresh" high-balance region where negative equity concentrates → mild majority, occasional steep, rare deep tail. **Omit `bookValueFn` (legacy/test path) ⇒ a financed owner comes back with `loanPayoff: null`.** This replaced the old per-archetype absolute-dollar `payoffByTier` table (the "$5k car / $35k payoff" absurdity); the vehicle-cost signal it encoded now flows through book value, so the model is tier-keyed (`config.financing`), not archetype-keyed.
- TradeIncidence (#166): `rollHasTrade`, `loadTradeIncidenceConfig`, `TradeIncidenceConfigSchema`. Types: `TradeIncidenceConfig`. When `tradeIncidenceConfig` + `classifyCreditTier` are both wired, every sales `Visit` carries `hasTrade: boolean` rolled from the composite (archetype × paymentMethod × creditTier) probability matrix. Legacy callers omit the field.
- TradeAsk (#167): `createCustomer` accepts an optional `tradeAskFn(currentVehicle, seed) → number` seam. When wired *and* a sales visit rolled `hasTrade: true` with a `currentVehicle`, the visit carries `allowanceAsk: number` — the dollar figure the customer wants for their trade. NPC derives the seed; the seam (composed at the root from DealEngine's `generateTradeAsk` bound to the live book-value provider) owns the valuation + noise, so NPC stays free of a DealEngine/MarketEconomy dep. Legacy callers omit the field.
- Competitors: `loadCompetitorArchetypes`, `loadBrandMarketShare`, `createCompetitor`. Types: `Competitor`, `CreateCompetitorContext`, `CreateCompetitorDeps`.
- Shared: `SkillDrift` — the shared
  execution-fidelity drift primitive (channel-desk M5, #292): `skillDriftFraction(skill,
  seed, config)` → a non-negative drift fraction in `[0, deficit×maxDriftFraction)`
  the caller applies toward the single *worse* direction (weaker desking counter,
  looser trade allowance); `signedSkillDrift(skill, seed, config)` → a two-sided
  drift in `(−span, +span)` for a *mis-target* (auto-pricing scatter). `deficit =
  clamp01(1 − skill/skillReference)`, so a manager at/above `skillReference` holds
  the player's setpoint exactly (zero drift) and a just-gated one drifts most.
  Deterministic in `(skill, seed)`; the call site derives a per-(entity, day) seed
  so a #122 mid-day replay reproduces the same drift. Type `SkillDriftConfig`
  (`{ maxDriftFraction, skillReference }`, from `tunables.managerGates.executionDrift`).
  The three unlocked UCM acting capabilities (pricing/desking/trade) scale their
  drift through this one helper — "higher skill ⇒ tighter adherence + better
  outcomes" expressed once. See `docs/planning/manager-roles-channel-desk.md` §4.

## Not here: the seeded RNG
`deriveSeed` / `createRng` used to live at `NPC/Rng.ts` and were never on this barrel. They
moved out to their own module in #342 — `src/game/Rng/`. NPC's factories consume it like any
other module (`import { createRng, deriveSeed } from '../../Rng'`). Seeded randomness is not
an NPC concept; do not re-export it from here.

## Events
NPC is a factory/library module — does not publish or subscribe. Consumers (CustomerPool, StaffOrg, CompetitorMarket) publish on its outputs.

## Data
- `data/npc-traits.json` — trait taxonomy.
- `data/person-archetypes.json`, `data/visit-archetypes.json`, `data/customer-tunables.json`.
- `data/staff-archetypes.json`, `data/staff-roles.json`, `data/staff-skills.json`.
- `data/competitor-archetypes.json`, `data/brand-market-share.json`.
- `data/customer-current-vehicle.json` (#165, #282) — per-archetype distribution: category weights, year-age + mileage skews, condition weights, finance probability. Plus a top-level `financing` block (#282): per-credit-tier `ltvAtOrigination` / `termMonths` / `aprAnnual`, global `annualDepreciation`, the `deepTailWeight` negative-equity tail knob (calibration S14), `freshCutoff`, and `ltvClamp`/`ratioClamp` safety clamps. Templates declared inline so NPC stays free of an Inventory dep.
- `data/trade-incidence.json` (#166) — per-archetype trade probability matrix: `cash | finance` × `A | B | C | D`. Captures the real-world skew (financers > cash buyers; sub-prime > prime; family-replacement / luxury-trader archetypes > commuters / retirees).

## Why this exists
Issue #5 grilled on NPC architecture; this module is the resulting shared substrate. See `npc-architecture-grill-me` memory for context if extending the trait or factory model.

# ADR-0001: NPC Architecture (Traits, Skills, Wants/Needs, Factories)

- **Status:** Accepted
- **Date:** 2026-05-12
- **Issue:** #5
- **Source:** Grill-me session, 2026-05-12

## Context

Issue #5 calls for a "unified NPC model" powering customers, staff, and competitors,
backed by data-driven trait taxonomies, wants/needs, staff skills, and seeded
factories. The session resolved how to model entities, where logic lives, how
randomness is seeded, and how data is organized.

This is foundation only. No gameplay consumes the NPC layer in this slice.

## Decisions

### 1. The unification is the **Trait primitive**, not an "NPC" type

Three distinct entity types — `Person` (customer), `Staff`, `Competitor` — each
own their shape. They share **one Trait primitive** (data shape, taxonomy
loading, RNG, effect-resolution machinery). "Unified NPC architecture" means a
shared primitive across three entity types, not one struct that pretends to be
all three.

### 2. Module layout

All foundational machinery lives in `src/game/NPC/`:

```
src/game/NPC/
├── index.ts                       barrel — only this is public
├── Trait.ts                       Trait type, TraitSet, resolveEffects
├── TraitTaxonomy.ts               loads + validates data/npc-traits.json
├── Rng.ts                         deriveSeed + createRng (per-roll seeding)
├── Customer.ts                    Person, Visit, SalesVisit, ServiceVisit types
├── Staff.ts                       Staff, StaffRole, StaffSkill types
├── Competitor.ts                  Competitor type
├── factories/
│   ├── CustomerFactory.ts         createCustomer(ctx)
│   ├── StaffFactory.ts            createStaff(ctx)
│   └── CompetitorFactory.ts       createCompetitor(ctx)
└── schemas/                       Zod schemas for every data file below
```

`CustomerPool`, `StaffOrg`, `CompetitorMarket` import only from
`@/game/NPC` — they own gameplay (pool sizing, hiring market, market
pressure), not primitive logic.

### 3. Staff state — four buckets

A `Staff` carries four distinct kinds of state:

| Bucket        | Shape                              | Examples                                                  | Storage                           |
| ------------- | ---------------------------------- | --------------------------------------------------------- | --------------------------------- |
| **Traits**    | Innate, ~static, bidirectional     | charisma, ego, aggressiveness, transparency               | rolled at hire; `data/npc-traits` |
| **Skills**    | Trained, monotonic, 0–100          | productivity, product_knowledge, communication, pricing   | grows with use; `data/staff-skills` |
| **Resources** | Daily, depleting/refilling          | stamina (possibly morale)                                  | per-tick; reset on rest           |
| **Counters**  | Career history, monotonic           | experience, deals_closed, days_employed                    | accumulate forever                |

Composites (`effectiveness`, `trustworthiness`) are **derived getters**, not
stored fields. They pull from whichever buckets they need and serve dual duty
as gameplay levers + promotion gates.

### 4. Staff roles — flat enum, DAG promotion

`data/staff-roles.json` is a flat catalog of named roles. Each role:

```
{
  "id": "salesperson",
  "tier": "customer-facing",          // worker | customer-facing | manager | gm
  "department": "sales",              // sales | service | body | null
  "grants_skills": [...],
  "promotes_to": ["sales-manager"],
  "promotion_gates": { "trustworthiness": 0.65 }
}
```

The `promotes_to` edges form a DAG (porter feeds many roles; GM is a sink
reachable from all three department managers). Lot porter is the universal
feeder (`department: null`, promotes into any customer-facing entry role).

Skills are **cumulative on promotion** — promoted staff retain prior-tier
skills active alongside new ones ("overlaps downward").

### 5. Traits vs Skills boundary

- **Traits**: innate, rolled at hire, mostly static, **bidirectional**
  (good in some contexts, bad in others). Define behavioral tendencies.
- **Skills**: trained, monotonically growing, define competence.

Items reclassified during the session: `charisma`, `ego`, `aggressiveness`,
`transparency` are **traits**, not skills. Manager-tier "overlaps" act through
their *trait profile*, not a manager skill composite — GM promotion is gated
on trait profile, not skill threshold.

### 6. Customers — Person + Visit split

- **Person**: long-lived identity. Traits, wealth, credit (sales-only), int,
  agreeableness, brand affinity, counters (prior_visits, prior_deals,
  days_since_last_visit). Reused across visits.
- **Visit**: per-interaction. `kind: 'sales' | 'service' | 'body'`, the
  per-visit preference vector (SPACED or PSQTC, see below), deal/service
  constraints, Resources (trust, patience).

Same Person can appear in any department over a career. Visits roll fresh
each time; Person is reused.

### 7. Preference frameworks per visit kind

**Sales visits — SPACED** (6-vector, continuous, emergent hot buttons):

- Safety, Performance, Appearance, Comfort/Connectivity/Convenience,
  Economy, Dependability.

Customer carries a 6-vector of weights; vehicles carry a 6-vector of scores.
Match drives a gateway to "agreement"; above threshold, additional match
lowers customer resistance / raises trust. Hot buttons are **emergent** (top-N
weights), not declared.

**Service / body visits — PSQTC** (5-vector):

- Price, Speed, Quality, Trust-in-shop, Convenience.

Body shop weights insurance/paperwork friction heavily under Convenience.
Same emergent-weight pattern as SPACED.

### 8. Customer Resources

Per-visit, depleting/refilling:

- **Trust**: variable score; built by SPACED/PSQTC match above threshold and
  by staff `trustworthiness` composite; the gameplay lever the deal engine
  consumes for "easy/profitable."
- **Patience**: drains if salesperson fumbles or the process drags.

Starting values live on the visit-archetype, modified by Person traits (e.g.
`agreeable` → higher starting trust).

### 9. Competitors — shared primitive, separate entity

Competitors are organizations, not people. They live in `CompetitorMarket`
(separate module) but use the shared **Trait primitive** for their attribute
sheet (`csi`, `inventory_size`, `pricing`, `reputation_drift_profile`). No
skills, no resources, no visits, no Person machinery.

**Two-class market model:**

- **Direct competitors**: `competitor.brand == player.brand`. Apply strong
  multi-dimensional modifier (CSI × size × pricing) to player's opportunity
  flow.
- **Indirect competitors**: different brand. Apply **bidirectional
  cross-shopping bleed** — strong indirect competitors siphon shoppers out
  of player's brand pool; weak indirect competitors feed cross-brand
  defectors *in*. Net leakage depends on relative CSI/pricing. Sized small
  (~20% of total competitive pressure).

### 10. Customer pool — brand market share economics

```
GLOBAL POOL
  ├─ split into BRAND POOLS by market share         data/brand-market-share.json
  └─ each brand pool contested by:
        ├─ player's slice (function of player's presence)
        ├─ direct competitors (steal slice)
        └─ indirect leakage (bidirectional bleed)

Player's daily accessible pool
  = Σ(slice of every brand the player has presence in)
    − direct competition loss
    ± net indirect leakage
```

`CompetitorMarket` publishes daily pressure via `EventBus`; `CustomerPool`
consumes it when rolling today's customers. Multi-brand career progression
(later tiers) sums slices across brand pools.

**Currently stays at brand granularity, not segment granularity.** Cross-segment
shopping (Camry shopper considering CR-V) is a later nuance.

### 11. Trait math — tagged effects in data

Each trait in `data/npc-traits.json` declares typed, named effect
contributions:

```json
"price-sensitive": {
  "applies_to": ["customer"],
  "effects": {
    "spaced_weight.economy": 0.30,
    "trust_build_rate": -0.10,
    "want_count": 1
  }
}
```

Consumers (`DealEngine`, `CustomerPool`, etc.) read effects by **known
effect-key** (a small enumerated contract). All trait behavior lives in data;
no magic numbers in code. The trait taxonomy file becomes the single source
of truth for game balance.

### 12. Factories — archetype-biased rolls with bounded variance

Archetypes are **templates with μ/σ**, not fixed identities. A `young_family`
archetype declares:

```json
"young_family": {
  "trait_probabilities": { "brand-loyal": 0.6, "detail-oriented": 0.5 },
  "wealth": { "mu": 65000, "sigma": 12000 },
  "credit": { "mu": 700, "sigma": 60 }
}
```

The factory rolls within those distributions — two `young_family` customers
are recognizably the same type but distinct individuals. Designer authors N
archetypes; player encounters effectively infinite people *within* those
types.

### 13. RNG — per-roll deterministic seed derivation

One **master seed** stored on the save. Every individual roll computes its
own seed by hashing context:

```ts
const seed = deriveSeed(save.seed, "customer", { day: 7, slot: 3 });
const rng  = createRng(seed);
```

- Adding RNG calls anywhere does not shift outcomes elsewhere.
- Save format: only the master seed + the day are stored; all rolls are
  re-derivable.
- Tests assert exact values for `(saveSeed, day, slot)` and hold forever.

Hash and RNG primitives are private internals (cyrb53 / mulberry32 or
equivalent); they are not part of the public surface.

### 14. Data files — 9 total

| File                              | Purpose                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `data/npc-traits.json`            | Shared trait taxonomy + effects. `applies_to` per trait.         |
| `data/staff-skills.json`          | Staff competencies, tier, growth rate, cap, composite mapping.   |
| `data/staff-roles.json`           | Role catalog + DAG promotion + gates.                            |
| `data/person-archetypes.json`     | Long-lived person templates (traits, wealth, credit, int).       |
| `data/visit-archetypes.json`      | Per-visit templates, discriminated by kind (sales/service/body). |
| `data/staff-archetypes.json`      | Hiring-market candidate templates.                               |
| `data/competitor-archetypes.json` | Market personality templates.                                    |
| `data/brand-market-share.json`    | Brand → share + tier/segment metadata.                           |

All files share the existing `parseData` + Zod validation pipeline from
`src/game/data/`. Schemas live in `src/game/NPC/schemas/`.

### 15. Test scope

Isolation tests on the public factory surface + trait-effect resolver:

1. **Determinism** — same `(saveSeed, day, slot)` → byte-identical output.
2. **Schema validity** — every rolled entity passes its Zod schema.
3. **Output bounds** — over 1000 seeded rolls of each archetype: mean within
   ε of authored μ; std-dev within ε of σ; all values within μ±4σ.
4. **Trait effect composition** — `resolveEffects` returns baseline plus sum
   of trait contributions for any combination.
5. **Visit composition** — visit-archetype priors + person-trait modifiers
   compose deterministically regardless of roll order.
6. **`applies_to` enforcement** — factory never rolls a trait onto an entity
   type whose `applies_to` excludes it.
7. **Promotion graph validity** — `staff-roles.json` `promotes_to` is a
   valid DAG; all referenced ids exist; GM is a sink.
8. **Factory smoke** — each factory runs end-to-end with minimal context.

Bound-check harness (#3) doubles as a balance lint for data authoring.

**Out of scope:** hash/RNG internals (private), gameplay outcomes (no
DealEngine/CustomerPool consumers in this slice), snapshot tests
(not used).

## Consequences

- Issue #5's deliverable is `src/game/NPC/` + the 9 data files (initially
  small/example contents) + the test suite.
- Downstream slices (`CustomerPool`, `StaffOrg`, `CompetitorMarket`,
  `DealEngine`) consume `@/game/NPC` — they import factories and effect
  resolution, never internal types or RNG.
- Game balance lives in `data/`. Numeric tuning needs no code changes.
- Save format minimized to master seed + day + non-derivable state. Customer
  rolls are re-derivable per visit slot.
- Adding a new trait, archetype, or staff role is a pure data change covered
  automatically by the generic bound-check harness.

## Open items deferred

- Exact initial trait list, skill list, archetype list — authored during
  implementation, not part of this ADR.
- `int` (intelligence) mechanics — agreed it exists as a Person trait; its
  consumer-side effects (lowball resistance, F&I scrutiny) are deal-engine
  concerns, deferred to later slices.
- Segment-level customer pool granularity — later.
- Dynamic brand market-share — later.

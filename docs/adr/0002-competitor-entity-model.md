# ADR-0002: Competitor Entity Model

- **Status:** Accepted
- **Date:** 2026-05-13
- **Source:** Grill-me session, 2026-05-13
- **Supersedes:** ADR-0001 §9 (competitor uses shared Trait primitive), parts of §11 and §14 (competitor as trait-bearing entity, `data/competitor-archetypes.json`)

## Context

ADR-0001 declared competitors as trait-bearing entities sharing the NPC Trait
primitive. Implementation work on slice 2 (`schemas/trait.ts`) locked
`APPLIES_TO = ['customer', 'staff']` — competitors were never wired in. Before
authoring competitor content (issue #44 follow-up), the grill-me session
re-examined whether competitors actually belong in the trait/effect machinery.

Conclusion: they don't. Competitors are organizations, not people; their
defining characteristics are macro-economic stat axes with substitutability
relationships, not bidirectional behavioral tendencies that compose by
addition. Forcing them through the Trait primitive bundles two unrelated
concerns under one abstraction.

## Decisions

### 1. Competitors are not NPCs

`CompetitorMarket` is its own module. It does not import from `@/game/NPC`.
The Trait primitive remains `customer` + `staff` only. The pattern (data-driven
entities, Zod schema, deterministic seeding) is reused; the *code* is not
shared.

### 2. Competitor shape: three-stat tradeoff vector

Each competitor is characterized by exactly three numeric axes:

- **Reputation** (CSI + transparency, fused into one stat)
- **Inventory** (size / depth)
- **Pricing** (customer-favorable ↔ dealer-favorable)

The three stats have a *substitutability* relationship: strength on one axis
compensates for weakness on the other two. This is the entire competitor
mental model. No trait stack, no effect-key enum, no archetype composition.

Fusing CSI + transparency is deliberate. They covary IRL; a three-stat ratio
is far more designable than four; the substitutability geometry only works
cleanly with three axes.

### 3. Brand is a foreign key, not a fourth stat

```
Competitor = { brand: string, rep: number, inventory: number, pricing: number }
```

`brand` references the OEM/brand module. Brand attributes (segment affinity:
truck-strong, luxury-strong, economy-strong; overall market draw; drift
profile) live in their own data file, owned by the OEM module.

This keeps "what this dealer does" (the triangle) separate from "what brand
they happen to sell" (exogenous market position). The same dealer-stat
vector under a different brand yields a different market outcome — exactly
the IRL relationship.

Brand evolution is the OEM module's concern. Current OEM tables are static *by
current choice*, not because the competitor model locked it in. Dynamic
OEM behavior drops in later without changing competitor data.

### 4. Scoring is pairwise; market share is caller-side aggregation

```ts
scoreCompetitor(competitor, customer, brands): number  // attractiveness
```

The function takes one competitor and one customer; it returns a scalar
attractiveness score. It does **not** return market share. Market share is
an aggregate property derived by callers over a customer subset.

Mechanically, the score combines:
- brand affinity match against the customer's SPACED weights (this is where
  brand impact lives — pulled via OEM module's public interface)
- modulated by the rep/inventory/pricing triangle of the competitor

Per-segment market share, per-region market share, per-financing-posture
share — all of these are caller-side `filter + aggregate` over the same
pairwise function. Adding a new customer facet later (e.g. `segment`) does
not change `scoreCompetitor`'s signature; it only adds slicing dimensions
available to callers.

### 5. Scoring lives in `CompetitorMarket`

`scoreCompetitor` and the thin aggregation wrapper (`aggregateShare` or
similar) both live in `CompetitorMarket`. CompetitorMarket's reason to exist
*is* "how do competitors steal customers from me" — that math is the module's
core, not a sibling concern. Deep module, narrow interface.

### 6. "Unique NPC" needs decompose into three other concerns

The grill explored singleton/narrative characters (receptionist as tutorial
persona; auditor as compliance trigger; heat-case repeat customer). None
warrant a new NPC branch:

- **Narrative personas** (receptionist, mascot, auditor's face) → narrative/UI
  layer. A persona table sibling to `data/narrative-beats.json`. No traits,
  no effects — just dialogue/portrait/role metadata.
- **Event-driven actors** (auditor *behavior*) → owned by whichever module
  produces the event (regulatory meter, reputation). The character is the
  presentation skin on a rule trigger.
- **Heat-case customers** → an extension of the customer system: persistent
  customer identity + interaction history + elevated re-spawn weight. They
  remain regular Persons in the NPC model; what's missing is cross-visit
  identity persistence, not a new entity type.

Each is filed as its own follow-up issue when its parent module exists.

## Consequences

- ADR-0001 §9 is replaced by this ADR's §1–5.
- `data/competitor-archetypes.json` (listed in ADR-0001 §14) is **not built**.
  Replaced by `data/competitors.json` (the small hand-authored set of dealer
  stat vectors) and `data/brands.json` (brand attributes, OEM module).
- The Trait primitive in `src/game/NPC/schemas/trait.ts` does **not** gain a
  `'competitor'` applies_to value. Slice 2's contract is final for customer
  + staff.
- `scoreCompetitor` is blocked by enough customer model existing to read
  SPACED weights and (eventually) brand affinity. Slice ordering must
  respect this dependency.
- The pairwise-scoring + caller-side-aggregation contract is what makes the
  incremental evolution drop-in: richer customer facets become slicing
  dimensions without function-signature churn.

## Open items deferred

- Exact functional form of `scoreCompetitor` (weighted sum, Cobb-Douglas-like
  product, softmax over triangle distance) — content for the slice that
  builds it, not for this ADR.
- Initial brand list and per-brand segment affinity values — authoring slice.
- Initial competitor set (count and stat distribution) — authoring slice.
- Customer identity persistence shape — its own future slice under the
  customer subsystem.
- Narrative persona table shape — owned by `NarrativeBeat` module, future
  slice.

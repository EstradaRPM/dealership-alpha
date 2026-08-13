# Reputation

Dealership reputation score + marketing → demand feedback loop. Drifts overnight, takes hits from bad customer outcomes, feeds back into customer arrival rates.

## Public API (`index.ts`)
- `createReputation()` → `Reputation`.
- `repFor(brand)` → the store's standing selling one make ∈ `[-1, 1]` (#151).
- `loadReputationConfig` — reads reputation tunables.
- `withOpeningPenalty(config)` → the same config opened
  `startingStandingPenalty` points lower on both standing scalars (#391).
- Types: `Reputation`, `ReputationDeps`, `ReputationConfig`, `ReputationSnapshot`,
  `ReputationSnapshotV1`, `AnyReputationSnapshot`.

## Per-brand standing (#151, B2 I6)

**Ambient depth, not a dashboard.** The store's record selling a make is modeled
honestly and never rendered as a number: it reaches the player through the
customer→vehicle match (a distrusted make loses ground to an otherwise identical
unit) and, later, as Reveal reaction text. There is no brand-reputation screen,
and `tests/Reputation.perBrand.test.ts` asserts no UI file reads the surface —
that is the standing "model honest under the hood, promote only what is a fun
decision" rule, not an unfinished half.

Three rules and no more:

- **Keyed by the canonical brand id** (#224), never a display make string — the
  same join key `pickVehicleFor` scores a lot vehicle by.
- **Carried from SOLD deals only**, off `staff:auto_resolved` — the live outcome
  truth (#180), which is the one event carrying both the make (`brand`) and how
  the delivery went (`badReview`, the low-trust forced close). A walk moves
  nothing: a customer who never owned the car says nothing about it. `deal:closed`
  is deliberately *not* the input — it has no satisfaction signal, and re-deriving
  one there would be a second definition of a fact #180 already settled.
- **Mean-reverts on the same night and by the same rule as the store-wide
  scalars.** Without the drift one rough early run would stain a make for the
  whole career — a trap, not depth. An unseen make reads 0: no record is neutral,
  not bad.

The consuming end is one closure at the composition root:
`salesProcessDeps.reputationBonusFn = repFor(brand) × brandReputation.matchWeight`.
`repFor` stays the honest state; how much a shopper *cares* is the matcher's
business, so the weight is applied at the boundary rather than baked into the
read. Read live, so a brand's record moves the very next customer's match.

## Opening under a cloud (#391)

A career can start BELOW the standing a stranger gets — today that is the
Inheritor, whose town remembers the last owner. The whole mechanic is
`withOpeningPenalty`: two opening numbers moved down by
`startingStandingPenalty`, and nothing else. **Reputation is handed a standing,
never a reason** — whether the penalty applies is decided in `createWorld` off
the Day 1 modifier, so no rule in this module branches on who the owner is and
the module never learns what a backstory is.

- **A starting position, not a permanent multiplier.** Every rule above it — the
  close bonus, the walk penalty, the overnight drift — is the one every founder
  gets, so a store that has climbed out is indistinguishable from one that never
  fell. `tests/BackstoryModifiers.test.ts` drives a month of the same trading
  through both and asserts the gap only ever closes.
- **Both scalars, not just the review score.** `reviewDriftRate` pulls the review
  toward satisfaction every night, so a deficit on the review alone would be
  handed back inside two weeks with no play involved.
- It is an opening value only, so `ReputationSnapshot` is unchanged and there is
  no migration: a save restores its stored standing verbatim.

## Persistence (#192, parent #186; per-brand #151)
- `snapshot()/restore()` — module-owned `schemaVersion`, captures the three live
  scalars (`customerSatisfaction`, `reviewScore`, `marketingBudget`) plus the
  per-brand standings. The demand curve + config are data-derived and not
  persisted. Wired into the world seam under the `reputation` key.
- Per-brand standings joining the blob is the module's own `schemaVersion`
  **1 → 2** and is **not** an envelope bump — the `modules` key set did not
  change. A `ReputationSnapshotV1` blob restores as "no make has a record yet",
  which is the state every pre-#151 save was actually in; `AnyReputationSnapshot`
  is the union `restore` accepts (same idiom as `AnyFacilitySnapshot`, #359).

## Events
- **Emits:** Reputation itself emits none directly (state read by `CustomerPool` / `CapacityManager` for arrival rates). `RegulatoryMeter` (same module barrel) emits the AG-complaint family + `regulatory:suspension_lifted`, and (#327) `regulatory:audit_failure` when pressure sits in the audit band `[auditThreshold, pressureThreshold)` at an overnight tick — a latched IndictmentMonitor producer (one crossing = one failure; the escalating warning below the AG complaint). `auditThreshold` lives in `data/failure-tunables.json` `regulatory` section.
- **Consumes:** `clock:overnight_reputation_drift` (mean-reversion drift, store-wide *and* per-brand), `reputation:satisfaction_hit` (negative outcomes — the ONE channel into store satisfaction, and the reason a new consequence adds a producer rather than a second path; `reason` is diagnostic and nothing here branches on it. Producers: CapacityManager, InstalledBase, RegulatoryMeter/Bankruptcy/Indictment, and DealEngine's over-marked F&I close, #368), `deal:closed` (positive bump — note a gouged close therefore lands **both**, the bonus and the drag, and the drag is measured against the fair close rather than against nothing), `customer:resolved` with outcome=walk (small hit), `staff:auto_resolved` with outcome=closed (#151 — per-brand standing, the only consumer of its `brand` field).

**The walk penalty only became live in #363**, and it was retuned when it did. `walkSatisfactionPenalty` went `-1` → `-0.12` against `closedDealSatisfactionBonus` `+3`, because the number had been set against a producer that never fired: the live floor walks ~88% of its ups, so a full point per walk drove a competently-run store's satisfaction from 70 to ~12 inside one career and collapsed arrivals with it. Do not read the small magnitude as the mechanic being timid — it is charged 2.6 times a day, every day. `RegulatoryMeter`'s `walkPressure`/`angerPressure` were retuned in the same pass and for the same reason.

## Data
- `data/tunables.json` — reputation section (drift rate, hit magnitudes, marketing curve, `startingStandingPenalty` (#391 — the points a store opening under a cloud starts below default; **10**, which puts the opening review at exactly the demand-neutral 50: the town gives no benefit of the doubt where a stranger gets some), and the `brandReputation` block: `closedDealBonus` / `badReviewPenalty` / `driftRate` / `matchWeight`). The bonus and penalty are **sign-checked by schema** — a positive penalty would mean a bad delivery helps the brand, and would read as balance rather than a dropped minus sign.

## Current simplification
The marketing → demand curve is a static lookup for now. The interface allows a richer replacement (dynamic marketing campaigns) later without changing consumers.

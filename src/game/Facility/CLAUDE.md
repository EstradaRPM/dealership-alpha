# Facility

What the store has physically **built** — lot spaces, service bays, body bays —
and the current tier's ceiling over each. Source of truth for "how much room do
we have".

## The rule this module exists to hold (#358, A2 R1)

**Desks come with the tier. Buildings are bought.** Tier-up hands you the staff
slots outright (`StaffOrg`, #352) but only raises the *ceiling* on physical
capacity; you arrive at a new tier holding exactly what you built at the last
one, and you build up from there with cash and construction days (#359).

That is why built capacity is **owned, persisted state** rather than the per-tier
constant it was. `serviceDispatch.baysByTier` and `bodyShopDispatch.baysByTier`
are **deleted** from `data/tunables.json` *and* both zod schemas — two truths
that can disagree is the bug this build order exists to avoid.

## Public API (`index.ts`)

- `createFacility({ bus, getTier, economy, getCurrentDay, data? })` → `Facility`.
- Reads: `getBuilt()` and `getCeilings()`, both returning the same
  `FacilityCapacity` shape (`lotSpaces` / `serviceBays` / `bodyBays`) — the
  facility score is one divided by the other, so the shapes must match.
  `getCeilings()` re-reads the live tier every call; a stored ceiling could go
  stale on tier-up.
- `getFacilityScore()` (#360) — how built-out the store is, 0–100. See below.
- `FacilityCapacityReader` (`Pick<Facility, 'getBuilt' | 'getCeilings'>`) is the
  narrow read consumers hold — nothing outside this module can change what is
  built.
- Construction (#359): `getBuildOptions()` — one `FacilityBuildOption` per kind,
  in `FACILITY_CAPACITY_KINDS` order, carrying built / ceiling / in-flight, what
  the next block costs and takes, and a `refusal` iff `build()` would say no;
  `getJobs()`; `build(kind)` → `{ ok: true, job } | { ok: false, reason }`.
  The UI must not re-derive any of those rules — that is why the option row
  exists at all.
- `loadFacilityData`, `ceilingsAtTier`, `buildSpecFor`, `FacilityDataSchema`,
  `MAX_TIER`, `CONSTRUCTION_EXPENSE_LABEL`.
- `createDefaultFacilitySnapshot(tier)` — built capacity at that tier's ceiling;
  the seed a new world starts with and what the save migration materializes.

## One bay truth

Both department lines take their bay count from here and nowhere else:
`src/serviceDepartment.ts` passes `facility.getBuilt().serviceBays` and
`src/bodyShopDepartment.ts` passes `.bodyBays` into the shared dispatch engine's
`bays` dep (`ServiceDispatch/DeptDispatchDeps`), which replaced the old
`facilityTier` + `config.baysByTier` lookup. `slots = min(bays, advisors on
duty)` is unchanged. The count is snapshotted per-day with the rest of the drain
seam, so newly finished construction applies the next morning.

## Construction (#359, A2 R1)

**Cash now, capacity later.** `build(kind)` debits the cost through `Economy`
(`postExpense`, label `Construction`) and schedules a `ConstructionJob` with an
absolute `completesOnDay` — the #295 frontline-hold idiom, so nothing ticks a
counter that could drift out of step with the calendar across a save/load. Jobs
settle on `clock:day_started`, which puts newly finished capacity on the ground
*before* the day's department drain snapshots its bay count.

Three rules, and they are all in `optionFor`:

- **A block is the size of one job, not a divisor.** `blockSize` clamped down to
  the room left — 5 against a gap of 3 builds 3 and is priced for 3 — so the
  ceiling is always exactly reachable without a second pricing rule.
- **Committed capacity is built PLUS in flight**, and that is what the ceiling
  measures against. The same space can never be paid for twice.
- **A refusal changes nothing at all.** `at-ceiling` and `cannot-afford` are
  checked before the debit; neither moves cash or schedules anything.

## The facility score (#360)

`getFacilityScore()` is the number the monthly tier gate's `facility` face
grades — the face that sat dormant from #232 until construction gave it
something the player controls.

**One rule: built ÷ ceiling, per kind, averaged.** Each capacity kind counts
once. A combined built÷ceiling total would let a store buy its facility score
on lot spaces alone (35 of them against 6 service bays at T3) while running a
one-bay shop; averaging the per-kind ratios makes every department's room
count the same.

**A kind the tier has no ceiling for is excluded, not counted as unbuilt.** Body
bays are 0 below T3, and scoring them as "0 of 0" would peg a fully built-out
Tier-1 store at 67 for a building the tier forbids. The flip side is the teeth:
**arriving at T3 drops the score**, because the body shop just became something
you are allowed — and therefore expected — to build.

Each kind's ratio is capped at 1 (you cannot be more than fully built out), and
in-flight construction counts for nothing until it lands. Wired into the gate as
`signals.facility` in `createWorld`; the engine never imports this module.

## Events

- `facility:capacity_built` — a job finished; `built` is the kind's new TOTAL and
  `units` the delta, so a consumer never has to add. Published from the morning
  settle. This is the module's only publisher, and it did not exist before #359,
  because nothing before construction ever *changed* a built number.

## Data

- `data/facility.json` — the module's catalog (`loadFacilityData`,
  `facilityData.ts`): the per-tier ceiling table, three rows × seven tiers, plus
  a `construction` block giving each kind its `blockSize` / `unitCost` / `days`.
  The ceilings are **monotonic by schema** (a file that decreases is refused) and
  every tier is stated explicitly, so a missing key can never read as "no
  capacity" and silently shut a department. Construction prices are **flat across
  the ladder** — a service bay costs what a service bay costs; a per-tier price
  table would be a second number beside the ceiling and would make the same
  purchase mean two things depending on where the player stood.
- Where the tier CSV stops (service bays at T3, lot spaces and body bays at T5)
  the last value repeats. Those tail values are placeholders pending calibration
  (C2, #286), not design.

## Persistence

- `snapshot()`/`restore()` carry `built`, the in-flight `jobs` and the `jobSeq`
  that keeps job ids unique across a reload; ceilings are derived from the live
  tier, so there is nothing there to migrate. Jobs joining the blob is the
  module's own `schemaVersion` **1 → 2** and needs **no envelope bump** — a #358
  v1 blob restores as "nothing being built", which is the state every save
  already was in (`AnyFacilitySnapshot` is the union `restore` accepts).
- Wired into `snapshotWorld`/`restoreWorld` under the `facility` key (envelope
  v20 → v21). The migration reads the save's **actual** tier out of the
  `tierManager` blob and materializes that tier's constants — the numbers that
  save was already running on — so no save regresses. Same idiom as the #314
  Body-Shop gate migration. See `docs/save-migration-recipe.md`.

## Collaborators

- `TierManager` (via the injected `getTier`, never a module reference) — the
  ceiling's only input.
- `ServiceDispatch`'s shared department-dispatch engine, through the two
  department packages.
- `Economy`, through the narrow `FacilitySpender` (`cash` + `postExpense`) — this
  module spends and never reads the ledger back.
- `src/ui/GrowthTab/FacilityBuild.tsx` + `facilityBuildModel.ts` — the build
  surface, mounted through `GrowthTabContainer`. Growth's charter is "work ON the
  business"; buying buildings compounds and spends the cash inventory wants.
- `TierGate`, through the injected `signals.facility` closure (#360) — the gate
  grades what this module scores and knows nothing about a bay.
- `Inventory` (#361), through the injected `getBuiltLotSpaces` closure —
  `getBuilt().lotSpaces` is the cap on buying, read live so a finished
  construction job reopens the auction the morning the space lands. Same shape
  as the bay seam: a closure at the composition root, never a module reference.

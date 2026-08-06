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

- `createFacility({ getTier, ceilings? })` → `Facility`.
- Reads: `getBuilt()` and `getCeilings()`, both returning the same
  `FacilityCapacity` shape (`lotSpaces` / `serviceBays` / `bodyBays`) — the
  facility score (#360) is one divided by the other, so the shapes must match.
  `getCeilings()` re-reads the live tier every call; a stored ceiling could go
  stale on tier-up.
- `FacilityCapacityReader` (`Pick<Facility, 'getBuilt' | 'getCeilings'>`) is the
  narrow read consumers hold — nothing outside this module can change what is
  built.
- `loadFacilityCeilings`, `ceilingsAtTier`, `FacilityCeilingSchema`, `MAX_TIER`.
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

## Events

**None yet, and no `bus` dep.** Nothing in this slice *changes* a built number —
a new world is seeded at its tier's constants and a tier-up only lifts the
ceiling. Construction (#359) is the first thing that moves one, and it is the
first publisher of `facility:*`. An event with no publisher would be dead code.

## Data

- `data/facility.json` — the per-tier ceiling table (`loadFacilityCeilings`,
  `facilityData.ts`), three rows × seven tiers. **Monotonic by schema** (a file
  that decreases is refused) and every tier stated explicitly, so a missing key
  can never read as "no capacity" and silently shut a department.
- Where the tier CSV stops (service bays at T3, lot spaces and body bays at T5)
  the last value repeats. Those tail values are placeholders pending calibration
  (C2, #286), not design.

## Persistence

- `snapshot()`/`restore()` carry `built` only; ceilings are derived from the live
  tier, so there is nothing there to migrate.
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
- Coming: construction purchase + the Growth build surface (#359), the `facility`
  tier-gate face (#360), the lot cap on buying (#361).

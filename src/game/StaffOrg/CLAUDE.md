# StaffOrg

Roster + hiring/firing + candidate listings. Source of truth for "who is on payroll".

## Public API (`index.ts`)
- `createStaffOrg()` → `StaffOrg`. Error type: `StaffOrgError`.
- `loadStaffOrgConfig` — reads `data/staff-roles.json` + related tunables.
- `computeConditionRead`, `deriveConditionReadSeed` — pure helpers behind
  `assessCondition` (also exported for fixture/test use).
- Types: `StaffOrg`, `StaffOrgDeps`, `StaffOrgConfig`, `CandidateListing`,
  `ConditionAssessInput`, `ConditionRead`, `ConditionReadConfig`.

## UCM condition read (#163)
- `assessCondition(vehicle) → ConditionRead | null`. Returns null when no
  `used-car-manager` is on the roster OR when `realizedReconFor` is omitted
  (test/fixture path). Picks the highest-skilled UCM (`condition_reading`).
- The pure math lives in `conditionRead.ts`. Band half-width shrinks with
  skill via `skill^widthSkillExponent`; the center can be off realized by
  up to `maxBiasFraction × estimate` at zero skill, scaling linearly to 0.
- Determinism: `deriveConditionReadSeed(masterSeed, vehicleId, staffId)` —
  identical seed + UCM + vehicle → identical read. Different UCMs reading
  the same vehicle get different (but skill-bounded) bands.
- Tunables in `data/tunables.json#staffOrg.conditionRead`.

## Events
- **Emits:** `staff:hired` (with `hiringCost`), `staff:fired`.
- **Consumes:** `clock:overnight_payroll` (post payroll expenses via `Economy`).

## Hiring constraints
- **Role hire-tier gate:** `getCandidates(roleId)` throws if the role's `hireTier` exceeds the current dealership tier (`deps.getTier`).
- **Headcount cap (#131):** `hire()` throws `StaffOrgError` once `currentRoster.length` reaches `config.headcountCapByTier[currentTier]`. Tier comes from `deps.getTier` (defaults to tier 1 if unwired); the composition root wires it to `TierManager.currentTier`. Missing cap entry ⇒ unbounded.

## Data
- `data/tunables.json#staffOrg` — `hiringCostByTier`, `candidatesPerRole`, `headcountCapByTier`.
- `data/staff-roles.json` — role definitions, salaries.
- `data/staff-archetypes.json`, `data/staff-skills.json` — used via `NPC` for candidate generation.

## Persistence (#190)
- `snapshot()/restore()` (barrel-exported `StaffOrgSnapshot`) capture the hired
  roster + `currentDay` for save/load. The candidate pool is NOT persisted — it
  is cleared every `clock:day_started` and regenerated deterministically from
  `masterSeed` (same pattern as Inventory's auction board, #189).
- Roster entries serialize as plain `Staff`; the `effectiveness` /
  `trustworthiness` composites are non-enumerable derived getters that JSON
  drops, then `restore` re-attaches them via `NPC.rehydrateStaff(staff, taxonomy)`
  — pure re-derivation, identical to what `createStaff` produces.
- Wired into `snapshotWorld`/`restoreWorld` under the `staffOrg` key, restored
  before `staffMorale` so morale rehydrates onto the same staff ids.

## Collaborators
- `NPC.createStaff` / `NPC.promoteStaff` produce the underlying `Staff` records.
- `StaffMorale` tracks state for active roster members.
- `StaffDispatch` reads the roster to auto-resolve queue items.

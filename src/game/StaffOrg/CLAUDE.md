# StaffOrg

Roster + hiring/firing + candidate listings. Source of truth for "who is on payroll".

## Public API (`index.ts`)
- `createStaffOrg()` → `StaffOrg`. Error type: `StaffOrgError`.
- `loadStaffOrgConfig` — reads `data/staff-roles.json` + related tunables.
- Types: `StaffOrg`, `StaffOrgDeps`, `StaffOrgConfig`, `CandidateListing`.

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

## Collaborators
- `NPC.createStaff` / `NPC.promoteStaff` produce the underlying `Staff` records.
- `StaffMorale` tracks state for active roster members.
- `StaffDispatch` reads the roster to auto-resolve queue items.

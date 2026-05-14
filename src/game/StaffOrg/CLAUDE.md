# StaffOrg

Roster + hiring/firing + candidate listings. Source of truth for "who is on payroll".

## Public API (`index.ts`)
- `createStaffOrg()` → `StaffOrg`. Error type: `StaffOrgError`.
- `loadStaffOrgConfig` — reads `data/staff-roles.json` + related tunables.
- Types: `StaffOrg`, `StaffOrgDeps`, `StaffOrgConfig`, `CandidateListing`.

## Events
- **Emits:** `staff:hired` (with `hiringCost`), `staff:fired`.
- **Consumes:** `clock:overnight_payroll` (post payroll expenses via `Economy`).

## Data
- `data/staff-roles.json` — role definitions, salaries.
- `data/staff-archetypes.json`, `data/staff-skills.json` — used via `NPC` for candidate generation.

## Collaborators
- `NPC.createStaff` / `NPC.promoteStaff` produce the underlying `Staff` records.
- `StaffMorale` tracks state for active roster members.
- `StaffDispatch` reads the roster to auto-resolve queue items.

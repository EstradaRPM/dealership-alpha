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

## Skill growth — Model B (#294, channel-desk M7)
- A roster member's **effective** skill is *derived, never mutated*:
  `effective = base (rolled at hire) + growth_rate × counter`, clamped to a
  **per-hire cap** (`min(axis cap, base + headroom)`, headroom rolled
  deterministically from the staff id — see `StaffFactory.computeEffectiveSkills`).
  Exposed as the non-enumerable `staff.effectiveSkills` getter; **this is what
  every capability gate/refinement reads** (M2–M6 + `assessCondition`).
- StaffOrg accrues the dormant `counters` **overnight only** (on `clock:day_ended`):
  `days_employed += 1` and `deals_closed += (the day's `deal:closed` count)` for
  every roster member. Because the counters change only overnight, the derived
  effective skill is **constant within an open day** (replay-safe, #122) and
  steps up between days toward the per-hire cap. The in-day close tally is
  transient (reset each `day_started`, rebuilt deterministically on replay); the
  durable growth lives in the serialized counters → **no save migration**.
- Which counter drives which axis is data (`data/staff-skills.json#<skill>.growth_counter`):
  `pricing`/`t_o_closing` → `deals_closed`; `condition_reading` → `days_employed`.
  Axes without a `growth_counter` stay static. Magnitudes (`growth_rate`,
  `cap_headroom`) are placeholders — calibration deferred to S14 (#286).

## Events
- **Emits:** `staff:hired` (with `hiringCost`), `staff:fired`.
- **Consumes:** `clock:day_ended` (Model B counter accrual, #294),
  `clock:day_started` (reset candidate pool + day close tally), `deal:closed`
  (day close tally), `staff:quit`, `clock:overnight_payroll` (post payroll
  expenses via `Economy`).

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

# DepartmentLine

The shared department **assembly line** (#311, parent #297). Service and Body
Shop run the same operational structure but feed it from different, self-contained
recipe packages. The contract is LOCKED in
`docs/planning/shared-department-structure.md` — read it before touching this
module or building a department against it.

## What the shared line is

Most of the assembly line already lives in existing modules and is reused as-is —
this module does **not** re-wrap them:

- tier-gated queue → `ServiceQueue` (Service = Tier 2; Body Shop = Tier 3),
- parts gate + stock → `PartsInventory` (keys all 8 categories; Body Shop
  activates its 4),
- advisor auto-resolution + capacity + read-model → `ServiceDispatch`
  (`createServiceFloorDrain` / `createServiceReadModel`) — the resolver is
  department-agnostic in behavior,
- page / floor-card shell → `ServicePage`.

The one piece that had been inlined at the composition root, and so the only code
this module factors out, is the **manager-automation pattern**.

## Public API (`index.ts`)

- `createDepartmentManagerAutomation(deps)` — the shared skill-threshold ladder
  that hands a department's standing functions over to a later-tier manager as
  the manager's gating skill clears each function's threshold. Wired at the
  composition boundary so departments stay decoupled from `StaffOrg`: the root
  supplies the live `topManagerSkill` read, the `isAutomated` gate predicate
  (e.g. `isServiceFunctionAutomated`), and the department-specific `functions`
  (each a `threshold` + an `apply` setpoint). The helper owns only the
  gate-and-apply loop on `clock:day_started`. Replay-safe (#122): the manager
  skill is read once per morning and reused across functions.
- Types: `DepartmentSeam` (the narrow inbound contract: `pricingRead`, plus the
  `enrichedIntake` bus event documented inline), `DepartmentAutomatedFunction`,
  `DepartmentManagerAutomationDeps`.

## The narrow seam

The backbone asks a department only two things — *"what jobs today?"*
(`enrichedIntake`, crossing as a bus event the queue gates) and *"what's the
price for this job?"* (`pricingRead`). The demand spine, marketing, and feedback
loop stay inside the department package and never cross the seam. Service is the
reference package (`src/serviceDepartment.ts`); Body Shop (#312–#317) supplies
its own against this same contract.

## Events

Emits/consumes none of its own. `createDepartmentManagerAutomation` subscribes to
`clock:day_started` and invokes the supplied `apply` closures; all department
side effects flow through those closures, not through this module.

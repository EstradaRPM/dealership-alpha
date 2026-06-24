import type { EventBus } from '../EventBus';

/**
 * Shared department backbone (#311, parent #297).
 *
 * Service and Body Shop run the **same operational assembly line** but feed it
 * from **different, self-contained recipe packages**. The line is built once and
 * is department-agnostic; each department supplies a complete package and plugs
 * in at one narrow seam. See `docs/planning/shared-department-structure.md`
 * (LOCKED 2026-06-23) for the full contract.
 *
 * Most of the assembly line already lives in modules and is reused as-is:
 * - tier-gated queue → `ServiceQueue` (Service = Tier 2; Body Shop = Tier 3),
 * - parts gate + stock → `PartsInventory`,
 * - advisor auto-resolution + capacity + read-model → `ServiceDispatch`
 *   (`createServiceFloorDrain` / `createServiceReadModel`),
 * - page/floor-card shell → `ServicePage`.
 *
 * The one piece that was previously inlined at the composition root — and so the
 * piece this module factors out — is the **manager-automation pattern** below.
 */

/**
 * The narrow seam — the entire inbound interface the shared line asks a
 * department for. The backbone only ever asks two questions:
 *
 * 1. **"what jobs today?"** — `enrichedIntake`: the day's jobs, each carrying
 *    customer + vehicle identity, parts/job category, and base revenue. This
 *    crosses the seam as a bus event the shared tier-gated queue gates and the
 *    shared drain consumes (today `service:intake_ready`; the generalization of
 *    that event name to a department-tagged family is a #312/#314 decision).
 * 2. **"what's the price for this job?"** — `pricingRead`: a live per-resolve
 *    multiplier source the shared resolver folds into ticket revenue (the
 *    `getPricingPosture` idiom the Service resolver already uses).
 *
 * Everything else — where demand comes from (the demand spine), how marketing
 * drums it up, what good/bad service does to the future (the feedback loop) —
 * stays inside the department package and never crosses this seam.
 */
export interface DepartmentSeam {
  /** Live competitive↔premium pricing read, `[0,1]`, read per-resolve. */
  readonly pricingRead: () => number;
}

/**
 * One manager-automatable standing function: a skill threshold the on-staff
 * manager's gating skill must clear before the manager takes the function over,
 * plus the setpoint to apply on the morning it is automated. The *specific*
 * functions automated (Service par/posture/marketing; Body Shop's insurance↔
 * retail posture / channel choice) belong to the department; only the gating
 * *pattern* is shared.
 */
export interface DepartmentAutomatedFunction {
  /** Manager gating-skill threshold this function automates above. */
  readonly threshold: number;
  /** Apply the automated setpoint for the day. Called on `clock:day_started`
   *  only while the gate is open. */
  readonly apply: () => void;
}

export interface DepartmentManagerAutomationDeps {
  readonly bus: EventBus;
  /**
   * The live top on-staff manager skill on the gating axis (`null` = no such
   * manager on staff ⇒ every gate closed ⇒ player keeps manual control). Read
   * once per morning; the effective skill is constant within an open day, so a
   * single read is replay-deterministic (#122).
   */
  readonly topManagerSkill: () => number | null;
  /**
   * The gate predicate (e.g. `isServiceFunctionAutomated`): does this skill
   * clear this threshold? Injected so the pattern stays decoupled from any one
   * department's gate implementation.
   */
  readonly isAutomated: (skill: number | null, threshold: number) => boolean;
  /**
   * The department's automatable functions, in ladder order. Each gates
   * independently, so as the manager grows the functions engage one at a time.
   */
  readonly functions: readonly DepartmentAutomatedFunction[];
}

/**
 * The shared manager-automation pattern (#310 generalized by #311): the
 * skill-threshold ladder that hands standing decisions over to a later-tier
 * manager. Wired at the composition boundary so departments stay decoupled from
 * `StaffOrg` — the root resolves the live manager skill and supplies the
 * department-specific `apply` setpoints; this helper only owns the gate-and-apply
 * loop on `clock:day_started`.
 *
 * Replay-safe: `topManagerSkill` is read once per morning and reused across all
 * functions (the roster is invariant within the handler), and each `apply`
 * closure is itself replay-deterministic, so a fixed seed replays
 * byte-identically (#122).
 */
export function createDepartmentManagerAutomation(
  deps: DepartmentManagerAutomationDeps,
): void {
  const { bus, topManagerSkill, isAutomated, functions } = deps;
  bus.subscribe('clock:day_started', () => {
    const skill = topManagerSkill();
    for (const fn of functions) {
      if (isAutomated(skill, fn.threshold)) fn.apply();
    }
  });
}

/**
 * Manager status read-model (#325) — the *delegated-authority* surface.
 *
 * Pure, presentation-layer facts. The composition root
 * (`src/app/config.ts buildManagerStatus`) resolves live gate state from `world`
 * — reusing the SAME act-gate predicates the engine gates on
 * (`isAutoPricingUnlocked` etc.), read off each manager's grown `effectiveSkills`
 * — and the `ManagerStatusCard` renders it. No game logic, no EventBus, no
 * imports of game internals here (mirrors `KPIDashboard/marketState.ts`).
 *
 * Per macro-loop-spine §2, delegation must feel like *permission*: the player
 * should always know what they've handed off. So the model carries the act-gate
 * status PLUS the skill/threshold, letting the card show the earned-stripes
 * progress toward each gate, and the card names the always-override invariant
 * (manager-roles-channel-desk.md §5) so delegation reads as permission, not
 * amputation.
 */

/** The three UCM capability axes, each gating on its own skill (channel-desk §3). */
export type UcmAxis = 'pricing' | 'condition_reading' | 't_o_closing';

export interface UcmCapabilityFact {
  readonly axis: UcmAxis;
  /** Act gate crossed — the UCM handles all cases of this type for the player. */
  readonly delegated: boolean;
  /**
   * Top on-staff UCM *effective* (grown) skill on this axis, or `null` when no
   * UCM is on staff. `null` ⇒ the manual path; a non-null value below the
   * threshold ⇒ the UCM advises (free on hire) but doesn't yet act.
   */
  readonly skill: number | null;
  /** The act threshold for this axis (`managerGates.actThresholds[axis]`). */
  readonly threshold: number;
}

/** Which fixed-ops department a manager runs. */
export type DeptManagerKey = 'service' | 'body';

export interface DeptFunctionFact {
  /** Stable ladder-rung id (e.g. `par`, `pricing`, `channel`, `rush`). */
  readonly fn: string;
  /** The manager currently runs this standing decision (its gate is crossed). */
  readonly automated: boolean;
}

export interface DeptManagerFact {
  readonly dept: DeptManagerKey;
  /** A manager of this department is on staff. */
  readonly present: boolean;
  /** Ladder rungs, lowest gate first, each with its automated status. */
  readonly functions: readonly DeptFunctionFact[];
}

export interface ManagerStatusModel {
  /** A used-car manager is on staff (advises even below the act gates). */
  readonly ucmPresent: boolean;
  readonly ucm: readonly UcmCapabilityFact[];
  readonly departments: readonly DeptManagerFact[];
}

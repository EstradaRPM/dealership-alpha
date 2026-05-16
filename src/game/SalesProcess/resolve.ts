import {
  accumulateMeters,
  evaluateGate,
  type EvaluatorDeps,
  type GateEvaluation,
  type MeterState,
} from './evaluator';
import {
  loadSalesProcessConfig,
  type Gate,
  type SalesProcessConfig,
} from './salesProcessData';
import type { SalespersonSkill } from './seams';
import type { SpacedVector } from './vehicleSpaced';
import {
  classifyAxes,
  nonnegotiablesSatisfied,
  revealsNonnegotiables,
  wantAxisFit,
  type CustomerAxisProfile,
  type NonnegotiablesDeps,
} from './nonnegotiables';

/** Every walk has a named cause (PRD #85 decision 9). */
export type WalkCause =
  | 'patience_drain'
  | 'trust_collapse'
  | 'demo_nonnegotiable_miss';

export interface SalesProcessVisitInput {
  readonly masterSeed: number;
  readonly customerId: string;
  readonly day: number;
  readonly skill: SalespersonSkill;
  readonly customerDifficulty: number;
  /** Per-gate patience drain = `(1 − q) × archetypeImpatience` (decision 9). */
  readonly archetypeImpatience: number;
  /** Starting patience from the existing `SalesVisit.resources.patience`. */
  readonly initialPatience: number;
  /** Customer's required SPACED levels (unit-scaled). */
  readonly customerSpaced: SpacedVector;
  /** The vehicle the salesperson DEMOs (unit-scaled SPACED). */
  readonly vehicleSpaced: SpacedVector;
  /** Optional visit-archetype id; biases the nonnegotiable distribution. */
  readonly visitArchetypeId?: string;
}

interface ResolutionBase {
  readonly evaluations: readonly GateEvaluation[];
  readonly meters: MeterState;
  readonly axisProfile: CustomerAxisProfile;
  /** Whether QUALIFY was strong enough to reveal the nonnegotiables. */
  readonly nonnegotiablesRevealed: boolean;
  readonly wantFit: number;
  readonly patience: number;
}

export type SalesProcessResolution =
  | (ResolutionBase & {
      readonly outcome: 'walk';
      readonly cause: WalkCause;
      /** The gate at which the customer walked. */
      readonly gate: Gate;
    })
  | (ResolutionBase & {
      readonly outcome: 'reached_close';
    });

export type ResolveDeps = EvaluatorDeps & NonnegotiablesDeps;

/**
 * Run the gates in order applying the named walk model (PRD #85 decision 9).
 *
 * Per gate: resolve quality, drain patience by `(1 − q) × archetypeImpatience`,
 * roll the running meters, then test walk conditions in priority order:
 *  1. DEMO with an unmet nonnegotiable → hard walk regardless of charisma.
 *  2. running Trust/Integrity below the collapse floor → trust-collapse walk.
 *  3. patience at/below the floor → patience-drain walk.
 *
 * QUALIFY is skill-gated: a weak QUALIFY hides the nonnegotiables, so the DEMO
 * pick is blind. Surviving every gate yields `reached_close` — the quadrant
 * close + price formation is the next slice (#90), which extends this without
 * reworking it. Pure and deterministic for a fixed seed.
 */
export function resolveSalesProcess(
  input: SalesProcessVisitInput,
  deps: ResolveDeps = {},
): SalesProcessResolution {
  const cfg: SalesProcessConfig = deps.config ?? loadSalesProcessConfig();
  const evalDeps = { config: cfg };

  const axisProfile = classifyAxes(
    {
      masterSeed: input.masterSeed,
      customerId: input.customerId,
      visitArchetypeId: input.visitArchetypeId,
    },
    deps,
  );

  const wantFit = wantAxisFit(
    axisProfile,
    input.customerSpaced,
    input.vehicleSpaced,
  );

  const evaluations: GateEvaluation[] = [];
  let patience = input.initialPatience;
  let nonnegotiablesRevealed = false;

  const fitFor = (gate: Gate): number => (gate === 'DEMO' ? wantFit : 0.5);

  for (const gate of cfg.gates) {
    const ev = evaluateGate(
      {
        masterSeed: input.masterSeed,
        customerId: input.customerId,
        day: input.day,
        gate,
        skill: input.skill,
        customerDifficulty: input.customerDifficulty,
        fit: fitFor(gate),
      },
      evalDeps,
    );
    evaluations.push(ev);
    patience -= (1 - ev.q) * input.archetypeImpatience;

    if (gate === 'QUALIFY') {
      nonnegotiablesRevealed = revealsNonnegotiables(ev.q, deps);
    }

    const meters = accumulateMeters(evaluations, evalDeps);
    const base: ResolutionBase = {
      evaluations: [...evaluations],
      meters,
      axisProfile,
      nonnegotiablesRevealed,
      wantFit,
      patience,
    };

    if (
      gate === 'DEMO' &&
      !nonnegotiablesSatisfied(
        axisProfile,
        input.customerSpaced,
        input.vehicleSpaced,
        deps,
      )
    ) {
      return {
        ...base,
        outcome: 'walk',
        cause: 'demo_nonnegotiable_miss',
        gate,
      };
    }

    if (meters.trustIntegrity < cfg.walk.trustCollapseFloor) {
      return { ...base, outcome: 'walk', cause: 'trust_collapse', gate };
    }

    if (patience <= cfg.walk.patienceFloor) {
      return { ...base, outcome: 'walk', cause: 'patience_drain', gate };
    }
  }

  return {
    outcome: 'reached_close',
    evaluations,
    meters: accumulateMeters(evaluations, evalDeps),
    axisProfile,
    nonnegotiablesRevealed,
    wantFit,
    patience,
  };
}

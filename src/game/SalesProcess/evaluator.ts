import { createRng, deriveSeed } from '../Rng';
import {
  loadSalesProcessConfig,
  type SalesProcessConfig,
  type Gate,
} from './salesProcessData';
import type { SalespersonSkill, GateSkill } from './seams';

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** One gate's resolved quality and the pieces that produced it. */
export interface GateEvaluation {
  readonly gate: Gate;
  /** Quality `q ∈ [0,1]` — deterministic core + bounded seeded jitter. */
  readonly q: number;
  /** The deterministic skill/fit/difficulty center, before jitter. */
  readonly core: number;
  /** The bounded RNG band applied (`∈ [−jitterBand, +jitterBand]`). */
  readonly jitter: number;
  /** The composite skill used for this gate (carried for meter roll-up). */
  readonly skill: GateSkill;
}

/** Two-meter currency model (PRD #85 decision 1). Both unit-scaled. */
export interface MeterState {
  readonly trustIntegrity: number;
  readonly value: number;
}

export interface GateInput {
  readonly masterSeed: number;
  readonly customerId: string;
  readonly day: number;
  readonly gate: Gate;
  readonly skill: SalespersonSkill;
  /** Customer's resistance for this gate, unit-scaled (higher = harder). */
  readonly customerDifficulty: number;
  /** Skill/inventory fit for this gate, unit-scaled (SPACED fit lands in #89). */
  readonly fit: number;
}

export interface EvaluatorDeps {
  readonly config?: SalesProcessConfig;
}

/**
 * Deterministic center: skill effectiveness, gate fit, and inverted customer
 * difficulty, blended by tunable weights and normalized to [0,1]. Skill/fit is
 * the signal; RNG is only a small bounded band around it (PRD decision 10).
 */
function deterministicCore(
  cfg: SalesProcessConfig,
  effectiveness: number,
  fit: number,
  customerDifficulty: number,
): number {
  const { skillWeight, fitWeight, easeWeight } = cfg.core;
  const sum = skillWeight + fitWeight + easeWeight;
  const blended =
    effectiveness * skillWeight +
    fit * fitWeight +
    (1 - customerDifficulty) * easeWeight;
  return clampUnit(blended / sum);
}

/**
 * Resolve a single gate's quality `q` (PRD #85 decision 10):
 * `q = clamp(deterministicCore(skill, difficulty, fit) + boundedJitter)`.
 *
 * Jitter is drawn from a per-`(customerId, gate, day)` derived seed under the
 * configured namespace, so each gate has an independent reproducible stream and
 * a fixed seed always produces the same `q` (saves / replays / admin re-rolls).
 */
export function evaluateGate(
  input: GateInput,
  deps: EvaluatorDeps = {},
): GateEvaluation {
  const cfg = deps.config ?? loadSalesProcessConfig();
  const skill = input.skill.skillFor(input.gate);

  const core = deterministicCore(
    cfg,
    skill.effectiveness,
    input.fit,
    input.customerDifficulty,
  );

  const seed = deriveSeed(input.masterSeed, cfg.rng.seedNamespace, {
    customerId: input.customerId,
    gate: input.gate,
    day: input.day,
  });
  const roll = createRng(seed)();
  const jitter = (roll * 2 - 1) * cfg.rng.jitterBand;

  return {
    gate: input.gate,
    q: clampUnit(core + jitter),
    core,
    jitter,
    skill,
  };
}

/**
 * Roll gate qualities up into the two meters (PRD #85 decision 1). Each gate
 * contributes by its configured trust/value weight; the Trust/Integrity meter
 * is additionally scaled by the rep's trustworthiness, so a trustworthy rep
 * running a clean process is what builds trust. Both meters stay in [0,1] via
 * weighted mean and are order-independent.
 */
export function accumulateMeters(
  evaluations: readonly GateEvaluation[],
  deps: EvaluatorDeps = {},
): MeterState {
  const cfg = deps.config ?? loadSalesProcessConfig();

  let trustNum = 0;
  let trustDen = 0;
  let valueNum = 0;
  let valueDen = 0;

  for (const ev of evaluations) {
    const w = cfg.meters[ev.gate];
    if (w === undefined) continue;
    trustNum += ev.q * ev.skill.trustworthiness * w.trust;
    trustDen += w.trust;
    valueNum += ev.q * w.value;
    valueDen += w.value;
  }

  return {
    trustIntegrity: trustDen > 0 ? clampUnit(trustNum / trustDen) : 0,
    value: valueDen > 0 ? clampUnit(valueNum / valueDen) : 0,
  };
}

export interface SalesProcessInput {
  readonly masterSeed: number;
  readonly customerId: string;
  readonly day: number;
  readonly skill: SalespersonSkill;
  readonly customerDifficulty: number;
  /** Per-gate fit lookup; defaults to neutral 0.5 (SPACED-driven fit is #89). */
  readonly fitFor?: (gate: Gate) => number;
}

export interface SalesProcessResult {
  readonly evaluations: readonly GateEvaluation[];
  readonly meters: MeterState;
}

/**
 * Run every configured gate in order and roll the results into the two meters.
 * Pure and input-source-agnostic (PRD #85 decision-18 module): no walk model
 * (#89), no quadrant close / price formation (#90) — those slices extend this
 * spine without reworking it.
 */
export function evaluateSalesProcess(
  input: SalesProcessInput,
  deps: EvaluatorDeps = {},
): SalesProcessResult {
  const cfg = deps.config ?? loadSalesProcessConfig();
  const fitFor = input.fitFor ?? (() => 0.5);

  const evaluations = cfg.gates.map((gate) =>
    evaluateGate(
      {
        masterSeed: input.masterSeed,
        customerId: input.customerId,
        day: input.day,
        gate,
        skill: input.skill,
        customerDifficulty: input.customerDifficulty,
        fit: clampUnit(fitFor(gate)),
      },
      { config: cfg },
    ),
  );

  return { evaluations, meters: accumulateMeters(evaluations, { config: cfg }) };
}

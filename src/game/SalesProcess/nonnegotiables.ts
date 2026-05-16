import { createRng, deriveSeed } from '../NPC/Rng';
import {
  loadCustomerNonnegotiablesConfig,
  loadSalesProcessConfig,
  type CustomerNonnegotiablesConfig,
  type SalesProcessConfig,
} from './salesProcessData';
import type { SpacedAxis, SpacedVector } from './vehicleSpaced';

const AXES: readonly SpacedAxis[] = [
  'safety',
  'performance',
  'appearance',
  'comfort',
  'economy',
  'dependability',
];

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Per-axis role for one customer (PRD #85 decision 4 / SPACED.md line 24):
 * `nonnegotiable` = hard walk gate at DEMO, `want` = graded Value contribution,
 * `pass` = no effect.
 */
export type AxisClass = 'nonnegotiable' | 'want' | 'pass';

export interface CustomerAxisProfile {
  readonly classes: Readonly<Record<SpacedAxis, AxisClass>>;
  readonly nonnegotiables: readonly SpacedAxis[];
  readonly wants: readonly SpacedAxis[];
}

export interface ClassifyAxesInput {
  readonly masterSeed: number;
  readonly customerId: string;
  /** Optional visit-archetype id; biases the distribution if present. */
  readonly visitArchetypeId?: string;
}

export interface NonnegotiablesDeps {
  readonly nonnegotiablesConfig?: CustomerNonnegotiablesConfig;
  readonly config?: SalesProcessConfig;
}

const SEED_NS = 'customer_pool.nonnegotiables';

/** Resolve the count/want distribution after applying any visit-archetype bias. */
function effectiveDistribution(
  cfg: CustomerNonnegotiablesConfig,
  visitArchetypeId: string | undefined,
): {
  countWeights: Record<string, number>;
  wantProbability: number;
} {
  const bias =
    visitArchetypeId !== undefined
      ? cfg.visitArchetypeBias[visitArchetypeId]
      : undefined;
  return {
    countWeights: bias?.nonnegotiableCountWeights ?? cfg.nonnegotiableCountWeights,
    wantProbability:
      bias?.remainingAxisWantProbability ?? cfg.remainingAxisWantProbability,
  };
}

/** Deterministic weighted pick over `{ "<count>": weight }`, ascending by count. */
function pickCount(weights: Record<string, number>, roll: number): number {
  const entries = Object.entries(weights)
    .map(([k, w]) => [Number(k), w] as const)
    .sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  const target = roll * total;
  for (const [count, w] of entries) {
    acc += w;
    if (target < acc) return count;
  }
  return entries[entries.length - 1][0];
}

/**
 * Deterministically classify a customer's six SPACED axes into
 * nonnegotiable / want / pass (PRD decision 4). Seeded by `(customerId)` under
 * the nonnegotiables namespace, so a fixed seed always yields the same puzzle
 * (saves / replays / admin re-rolls).
 */
export function classifyAxes(
  input: ClassifyAxesInput,
  deps: NonnegotiablesDeps = {},
): CustomerAxisProfile {
  const cfg = deps.nonnegotiablesConfig ?? loadCustomerNonnegotiablesConfig();
  const { countWeights, wantProbability } = effectiveDistribution(
    cfg,
    input.visitArchetypeId,
  );

  const seed = deriveSeed(input.masterSeed, SEED_NS, {
    customerId: input.customerId,
  });
  const rng = createRng(seed);

  const count = pickCount(countWeights, rng());

  // Seeded Fisher–Yates over the axis order, then take the first `count`
  // as nonnegotiable.
  const order = [...AXES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const nonnegotiableSet = new Set(order.slice(0, count));

  const classes = {} as Record<SpacedAxis, AxisClass>;
  const nonnegotiables: SpacedAxis[] = [];
  const wants: SpacedAxis[] = [];
  for (const axis of AXES) {
    if (nonnegotiableSet.has(axis)) {
      classes[axis] = 'nonnegotiable';
      nonnegotiables.push(axis);
    } else if (rng() < wantProbability) {
      classes[axis] = 'want';
      wants.push(axis);
    } else {
      classes[axis] = 'pass';
    }
  }

  return { classes, nonnegotiables, wants };
}

/**
 * Skill-gated nonnegotiable reveal (PRD decision 5): a QUALIFY whose quality
 * reaches `qualifyRevealThreshold` exposes the customer's nonnegotiables; a
 * weaker QUALIFY leaves them hidden, forcing a blind DEMO pick. Deterministic
 * because `qualifyQuality` is itself seeded.
 */
export function revealsNonnegotiables(
  qualifyQuality: number,
  deps: NonnegotiablesDeps = {},
): boolean {
  const cfg = deps.config ?? loadSalesProcessConfig();
  return qualifyQuality >= cfg.nonnegotiables.qualifyRevealThreshold;
}

/**
 * Graded want-axis fit: mean closeness (`1 − |vehicle − customer|`) over the
 * customer's `want` axes, feeding the DEMO gate's Value contribution. No want
 * axes → neutral 0.5 (nothing to reward or punish).
 */
export function wantAxisFit(
  profile: CustomerAxisProfile,
  customerSpaced: SpacedVector,
  vehicleSpaced: SpacedVector,
): number {
  if (profile.wants.length === 0) return 0.5;
  let sum = 0;
  for (const axis of profile.wants) {
    sum += 1 - Math.abs(vehicleSpaced[axis] - customerSpaced[axis]);
  }
  return clampUnit(sum / profile.wants.length);
}

/**
 * True when every nonnegotiable axis is met: the vehicle's SPACED value is
 * within `tolerance` below the customer's required level. A single miss is a
 * hard DEMO walk regardless of charisma (PRD decision 4/9).
 */
export function nonnegotiablesSatisfied(
  profile: CustomerAxisProfile,
  customerSpaced: SpacedVector,
  vehicleSpaced: SpacedVector,
  deps: NonnegotiablesDeps = {},
): boolean {
  const cfg = deps.config ?? loadSalesProcessConfig();
  const tol = cfg.nonnegotiables.tolerance;
  return profile.nonnegotiables.every(
    (axis) => vehicleSpaced[axis] >= customerSpaced[axis] - tol,
  );
}

import {
  loadSalesProcessConfig,
  GATES,
  type SalesProcessConfig,
} from './salesProcessData';
import type { SalesProcessResolution } from './resolve';

export interface ResidualHeatInput {
  /** The resolution the customer actually went through. */
  readonly resolution: SalesProcessResolution;
  /**
   * Whether the customer bought. A completed purchase leaves no residual
   * interest to follow up on — they already have the car.
   */
  readonly bought?: boolean;
}

export interface ResidualHeatDeps {
  readonly config?: SalesProcessConfig;
}

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * How warm a customer left — the residual interest a visit that did NOT end in
 * a sale leaves behind (∈ [0,1]).
 *
 * Three things make someone worth calling back: how far they got before it
 * fell apart (a customer who walked at GREET is barely a lead; one who walked
 * at NEGOTIATE nearly bought), how much value the salesperson built, and how
 * much they trusted the store. The blend lives in `data/sales-process.json`
 * (`heat`).
 *
 * A buy returns 0 — not because the visit went badly, but because there is
 * nothing left to follow up on.
 *
 * Pure and deterministic; no RNG. This is the ONE definition of the quantity —
 * `FollowUpPool` consumes it as "who is worth calling back" and the live-engine
 * calibration reads it as the warm-walk band. It used to be hand-copied between
 * `CustomerPool` and the #94 calibration harness, which is exactly how the two
 * drift apart.
 */
export function residualHeat(
  input: ResidualHeatInput,
  deps: ResidualHeatDeps = {},
): number {
  if (input.bought) return 0;
  const { heat } = deps.config ?? loadSalesProcessConfig();
  const { resolution } = input;

  // How far through the gates they got. A walk stops at its gate; a customer
  // who reached the close ran the whole process, so they score a full 1.
  const stageProgress =
    resolution.outcome === 'walk'
      ? GATES.indexOf(resolution.gate) / Math.max(1, GATES.length - 1)
      : 1.0;

  return clampUnit(
    stageProgress * heat.stageWeight +
      resolution.meters.value * heat.valueWeight +
      resolution.meters.trustIntegrity * heat.trustWeight,
  );
}

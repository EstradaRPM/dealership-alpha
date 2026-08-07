import {
  loadSalesProcessConfig,
  type SalesProcessConfig,
} from './salesProcessData';
import type { SalesProcessResolution } from './resolve';
import type { CloseResult } from './close';

/**
 * How the customer felt about the visit — the three scalars `customer:resolved`
 * carries downstream.
 */
export interface ResolutionQuality {
  /** [0,1] Trust/Integrity meter → F&I receptivity input. */
  readonly receptivity: number;
  /** -1 bad review | 0 neutral | 1 positive review → Reputation delta. */
  readonly satisfaction: number;
  /** [0,1] trust+deal blend → InstalledBase starting loyalty. */
  readonly retentionSeed: number;
}

export interface ResolutionQualityInput {
  /** The resolution the customer actually went through. */
  readonly resolution: SalesProcessResolution;
  /**
   * The close that was actually evaluated, when the customer reached one.
   * Omitted for a customer who walked at a gate — they never got to an offer,
   * so there is no deal for them to have an opinion about.
   */
  readonly close?: CloseResult;
}

export interface ResolutionQualityDeps {
  readonly config?: SalesProcessConfig;
}

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * The customer's read on the visit: how much they trusted the store
 * (`receptivity`), whether they'll say something good or bad about it
 * (`satisfaction`), and how much of a future owner relationship it seeded
 * (`retentionSeed`). Retention weights live in `data/sales-process.json`
 * (`retention`) and sum to 1.
 *
 * Satisfaction is the `CloseResult` quadrant read straight: a low-trust forced
 * close (`badReview`) is -1, any other buy is 1, and a walk is 0 — a customer
 * who left without buying is not a bad review, they're an absent one (the
 * reputation cost of a walk is `Reputation`'s `walkSatisfactionPenalty`,
 * applied off the outcome).
 *
 * Pure and deterministic; no RNG. **This is the ONE definition of the trio** —
 * the sibling of `residualHeat`, and for the same reason (#363). `CustomerPool`
 * had the only copy, computed against a STUB vehicle, so the live floor's
 * honest close scalars were thrown away and replaced by a re-run against a car
 * nobody was shown. Both paths call this now; do not re-derive it at a call
 * site.
 */
export function resolutionQuality(
  input: ResolutionQualityInput,
  deps: ResolutionQualityDeps = {},
): ResolutionQuality {
  const { retention } = deps.config ?? loadSalesProcessConfig();
  const { resolution, close } = input;

  const trust = resolution.meters.trustIntegrity;
  const bought = close?.outcome === 'buy';

  return {
    receptivity: trust,
    satisfaction: close?.badReview ? -1 : bought ? 1 : 0,
    // The deal term is present iff an offer was actually formed. Someone who
    // walked at GREET never saw a number, so their loyalty seed is trust alone.
    retentionSeed: clampUnit(
      trust * retention.trustWeight +
        (close?.objectiveDeal ?? 0) * retention.dealWeight,
    ),
  };
}

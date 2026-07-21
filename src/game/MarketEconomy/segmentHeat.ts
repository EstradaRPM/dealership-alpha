import type { AnchorVehicleInput } from './anchor';
import type { CompHistory } from './compHistory';
import {
  personalityBiasFor,
  type MarketPersonalityVector,
} from './personality';

/**
 * Composer for `segmentHeat(segment, vehicle)` (slice #157). Three additive
 * terms, layered in the locked order from design record #182:
 *
 *   segmentHeat(v) = personalityBias(category)        // #156
 *                  + segmentDrift(category, currentDay) // #157 (this slice)
 *                  + activeShockMod(category, v)        // #159 placeholder
 *
 * The `activeShockMod` term stays at 0 until the stochastic shock scheduler
 * lands; the seam is here so #159 drops in without touching providers.
 *
 * `getCurrentDay` is a function so the composer reads the *live* day each
 * time (the engine subscribes to `clock:day_started`), keeping drift's
 * age-cutoff math consistent without threading day through every provider
 * call.
 */
export type SegmentHeatFn = (v: AnchorVehicleInput) => number;

/**
 * The same composition read by segment alone (slice #176). All three terms are
 * per-*segment* — no term has ever consulted the vehicle beyond its category —
 * so surfaces that reason about the market rather than about a specific unit
 * (the heat monitor, KPI readouts) can ask directly instead of fabricating a
 * placeholder vehicle.
 */
export type SegmentHeatBySegmentFn = (segment: string) => number;

/** `v` is optional: every implementation keys off `segment` alone. */
export type ShockModFn = (segment: string, v?: AnchorVehicleInput) => number;

export interface SegmentHeatDeps {
  readonly personality: MarketPersonalityVector;
  readonly compHistory: Pick<CompHistory, 'segmentDrift'>;
  readonly getCurrentDay: () => number;
  readonly activeShockMod?: ShockModFn;
}

export function createSegmentHeatBySegment(
  deps: SegmentHeatDeps,
): SegmentHeatBySegmentFn {
  const shockMod = deps.activeShockMod ?? (() => 0);
  return (segment) =>
    personalityBiasFor(deps.personality, segment) +
    deps.compHistory.segmentDrift(segment, deps.getCurrentDay()) +
    shockMod(segment);
}

export function createSegmentHeat(deps: SegmentHeatDeps): SegmentHeatFn {
  const bySegment = createSegmentHeatBySegment(deps);
  return (v) => bySegment(v.category);
}

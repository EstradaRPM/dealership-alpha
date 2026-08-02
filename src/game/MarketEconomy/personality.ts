import { createRng, deriveSeed } from '../Rng';
import {
  loadMarketPersonalityDistribution,
  type MarketPersonalityDistribution,
} from './schemas';

/**
 * Per-save hidden market personality (slice #156). One scalar bias per segment,
 * sampled once from the per-save masterSeed (#96). It is the day-1 non-zero
 * term of `segmentHeat(...)` — the comp/shock layers (#157–#159) layer on top.
 *
 * Determinism: same masterSeed → identical vector forever. Different seeds
 * across slots → different worlds. Re-derived at module construction rather
 * than persisted; the seed itself is the canonical save artifact.
 */
export interface MarketPersonalityVector {
  readonly segments: Readonly<Record<string, number>>;
}

export const NEUTRAL_PERSONALITY: MarketPersonalityVector = { segments: {} };

export function rollPersonalityVector(
  masterSeed: number,
  dist: MarketPersonalityDistribution = loadMarketPersonalityDistribution(),
): MarketPersonalityVector {
  const segments: Record<string, number> = {};
  for (const [segment, bounds] of Object.entries(dist.segments)) {
    const seed = deriveSeed(masterSeed, 'market_economy.personality', {
      segment,
    });
    const rng = createRng(seed);
    const t = rng();
    segments[segment] = bounds.biasMin + (bounds.biasMax - bounds.biasMin) * t;
  }
  return { segments };
}

export function personalityBiasFor(
  vector: MarketPersonalityVector,
  segment: string,
): number {
  return vector.segments[segment] ?? 0;
}

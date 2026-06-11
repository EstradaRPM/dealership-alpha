import rawConfig from '../../../data/tier-gate.json';
import type { GateFaceKind } from './types';

/**
 * Config loader for the tier-gate engine (#232). Every tunable — per-tier
 * targets, band ratios, trend sensitivity — lives in `data/tier-gate.json`; the
 * engine holds no magic numbers (CLAUDE.md). Face *ids* (`units`/`gross`/`cash`/
 * `csi`/`facility`) are semantic constants the engine understands; their kinds,
 * labels, targets, and which are active per tier are all data, so the gate can
 * be retuned — or a face lit at a different tier (decision 2's progressive
 * unlock) — without touching logic.
 */

export interface GateFaceDef {
  readonly kind: GateFaceKind;
  readonly label: string;
}

export interface GateBandThresholds {
  /** ratio ≥ this ⇒ Exceed. */
  readonly exceed: number;
  /** ratio ≥ this ⇒ Meet. */
  readonly meet: number;
  /** ratio ≥ this ⇒ Near-miss; below ⇒ Miss. */
  readonly nearMiss: number;
}

export interface TierGateConfig {
  /** Max daily samples retained for a trend face's rolling window. */
  readonly trendWindowDays: number;
  /** Min recent-vs-earlier delta to read a trend face as climbing/sliding. */
  readonly trendEpsilon: number;
  /** Min level movement (in the level's own units) to read a level trend arrow. */
  readonly levelTrendEpsilon: number;
  readonly bands: GateBandThresholds;
  /** Face id → its kind + display label. */
  readonly faces: Readonly<Record<string, GateFaceDef>>;
  /** Tier number (as string key) → { faceId → target }. Listed faces are the
   *  active faces for that tier; an absent face is dark at that tier. */
  readonly tiers: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export function loadTierGateConfig(): TierGateConfig {
  return rawConfig as TierGateConfig;
}

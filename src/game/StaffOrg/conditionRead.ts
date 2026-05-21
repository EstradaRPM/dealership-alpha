import { createRng, deriveSeed } from '../NPC/Rng';
import type { ConditionReadConfig } from './staffOrgData';

export const CONDITION_READ_NAMESPACE = 'staff.condition_read';
export const CONDITION_READING_SKILL_ID = 'condition_reading';

/**
 * Pure skill-gated condition read for the UCM (#163). Given the hidden
 * realized recon, the player-visible estimate, the UCM's `condition_reading`
 * skill, and a seed, produces a `[low, high]` band + a `confidence` scalar.
 *
 * Math:
 *   skillNorm     = clamp(skill / 100, 0, 1)
 *   widthFactor   = 1 − skillNorm^widthSkillExponent   (1 at skill=0, 0 at skill=100)
 *   halfWidth     = estimate × lerp(min, max, widthFactor)
 *   biasFraction  = (1 − skillNorm) × maxBiasFraction
 *   biasOffset    = estimate × biasFraction × (rng()*2 − 1)
 *   center        = realized + biasOffset
 *   [low, high]   = clamp([center − halfWidth, center + halfWidth], min 0)
 *   confidence    = skillNorm
 *
 * Determinism is the caller's responsibility — pass a seed that namespaces
 * (masterSeed, vehicleId, staffId) so each read is reproducible.
 */
export interface ConditionReadInputs {
  readonly realizedRecon: number;
  readonly estimate: number;
  readonly skill: number;
  readonly seed: number;
}

export interface ConditionRead {
  readonly estimatedReconLow: number;
  readonly estimatedReconHigh: number;
  readonly confidence: number;
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function computeConditionRead(
  inputs: ConditionReadInputs,
  cfg: ConditionReadConfig,
): ConditionRead {
  const { realizedRecon, estimate, skill, seed } = inputs;
  const skillNorm = clamp01(skill / 100);
  const widthFactor = 1 - Math.pow(skillNorm, cfg.widthSkillExponent);
  const halfWidthFraction =
    cfg.minHalfWidthFraction +
    (cfg.maxHalfWidthFraction - cfg.minHalfWidthFraction) * widthFactor;
  const halfWidth = estimate * halfWidthFraction;

  const biasFraction = (1 - skillNorm) * cfg.maxBiasFraction;
  const rng = createRng(seed);
  const biasOffset = estimate * biasFraction * (rng() * 2 - 1);
  const center = realizedRecon + biasOffset;

  const low = Math.max(0, Math.round(center - halfWidth));
  const high = Math.max(low, Math.round(center + halfWidth));
  return {
    estimatedReconLow: low,
    estimatedReconHigh: high,
    confidence: skillNorm,
  };
}

export function deriveConditionReadSeed(
  masterSeed: number,
  vehicleId: string,
  staffId: string,
): number {
  return deriveSeed(masterSeed, CONDITION_READ_NAMESPACE, { vehicleId, staffId });
}

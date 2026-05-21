import { createRng, deriveSeed } from '../NPC/Rng';
import {
  loadReconVarianceConfig,
  loadReconSurpriseEventsConfig,
  type ReconVarianceConfig,
  type ReconBucketId,
  type ReconSurpriseEventsConfig,
  type ReconSurpriseTemplate,
} from './schemas';

/**
 * Hidden-lemon recon variance (slice #162 — the "B mid" dopamine layer from
 * #182). Realized recon = estimate × bucketMultiplier where the bucket
 * distribution is shaped by three independent gates: condition ×
 * source-reliability-band × mileage-extreme. Sampling is deterministic from
 * a per-vehicle seed namespace so the same vehicle on the same save always
 * rolls the same realized cost.
 */
export interface ReconRollInputs {
  readonly estimate: number;
  readonly condition: 'clean' | 'average' | 'rough';
  readonly mileage: number;
  readonly sourceReliability: number;
}

export interface ReconRollResult {
  readonly realizedCost: number;
  readonly bucket: ReconBucketId;
  readonly multiplier: number;
}

export function reliabilityBand(
  reliability: number,
  cfg: ReconVarianceConfig = loadReconVarianceConfig(),
): 'high' | 'mid' | 'low' {
  if (reliability >= cfg.reliabilityBands.highMin) return 'high';
  if (reliability >= cfg.reliabilityBands.midMin) return 'mid';
  return 'low';
}

export function mileageBand(
  mileage: number,
  cfg: ReconVarianceConfig = loadReconVarianceConfig(),
): 'normal' | 'extreme' {
  return mileage >= cfg.mileageExtremeThreshold ? 'extreme' : 'normal';
}

interface BucketProbs {
  readonly within: number;
  readonly minor: number;
  readonly major: number;
  readonly catastrophic: number;
}

export function bucketProbabilities(
  inputs: Pick<ReconRollInputs, 'condition' | 'mileage' | 'sourceReliability'>,
  cfg: ReconVarianceConfig = loadReconVarianceConfig(),
): BucketProbs {
  const condF = cfg.conditionFactors[inputs.condition]!;
  const relF = cfg.sourceReliabilityFactors[reliabilityBand(inputs.sourceReliability, cfg)];
  const mileF = cfg.mileageFactors[mileageBand(inputs.mileage, cfg)];

  const baseByBucket: Record<ReconBucketId, number> = {
    within: 0,
    minor: 0,
    major: 0,
    catastrophic: 0,
  };
  for (const b of cfg.buckets) baseByBucket[b.id] = b.baseProb;

  const minor = baseByBucket.minor * condF.minor * relF.minor * mileF.minor;
  const major = baseByBucket.major * condF.major * relF.major * mileF.major;
  const catastrophic =
    baseByBucket.catastrophic *
    condF.catastrophic *
    relF.catastrophic *
    mileF.catastrophic;
  const tail = minor + major + catastrophic;
  // 'within' is the renormalization sink — whatever's left after tails take
  // their reshaped share. If tail saturation pushes past 1, scale tails down
  // to leave a minimum 'within' floor of 1% (a sanity guard, the realistic
  // configured bands never get close).
  let within = Math.max(0, 1 - tail);
  if (within < 0.01) {
    const scale = (1 - 0.01) / tail;
    return {
      within: 0.01,
      minor: minor * scale,
      major: major * scale,
      catastrophic: catastrophic * scale,
    };
  }
  return { within, minor, major, catastrophic };
}

export function rollRecon(
  inputs: ReconRollInputs,
  seed: number,
  cfg: ReconVarianceConfig = loadReconVarianceConfig(),
): ReconRollResult {
  const rng = createRng(seed);
  const probs = bucketProbabilities(inputs, cfg);
  const order: ReconBucketId[] = ['within', 'minor', 'major', 'catastrophic'];

  const bucketRoll = rng();
  let bucket: ReconBucketId = 'within';
  let acc = 0;
  for (const id of order) {
    acc += probs[id];
    if (bucketRoll <= acc) {
      bucket = id;
      break;
    }
  }

  const bucketCfg = cfg.buckets.find((b) => b.id === bucket)!;
  const [lo, hi] = bucketCfg.multRange;
  const multiplier = lo + (hi - lo) * rng();
  const realizedCost = Math.max(0, Math.round(inputs.estimate * multiplier));
  return { realizedCost, bucket, multiplier };
}

/**
 * Pick a surprise-event template by realized bucket. Returns `undefined` for
 * the `within` bucket (no surprise fires) and for buckets with no matching
 * templates (defensive — the catalog covers all tail buckets).
 */
export function pickSurpriseTemplate(
  bucket: ReconBucketId,
  seed: number,
  catalog: ReconSurpriseEventsConfig = loadReconSurpriseEventsConfig(),
): ReconSurpriseTemplate | undefined {
  if (bucket === 'within') return undefined;
  const matches = catalog.templates.filter((t) => t.bucket === bucket);
  if (matches.length === 0) return undefined;
  const rng = createRng(seed);
  const idx = Math.floor(rng() * matches.length);
  return matches[Math.min(idx, matches.length - 1)];
}

export function deriveReconSeed(masterSeed: number, vehicleId: string): number {
  return deriveSeed(masterSeed, 'inventory.recon_variance', { vehicleId });
}

export function deriveReconSurpriseSeed(
  masterSeed: number,
  vehicleId: string,
): number {
  return deriveSeed(masterSeed, 'inventory.recon_surprise', { vehicleId });
}

export { loadReconVarianceConfig, loadReconSurpriseEventsConfig };

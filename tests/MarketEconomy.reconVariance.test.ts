import {
  rollRecon,
  pickSurpriseTemplate,
  bucketProbabilities,
  reliabilityBand,
  mileageBand,
  deriveReconSeed,
  loadReconVarianceConfig,
  loadReconSurpriseEventsConfig,
} from '../src/game/MarketEconomy';
import { deriveSeed } from '../src/game/NPC/Rng';

const CFG = loadReconVarianceConfig();
const SURPRISES = loadReconSurpriseEventsConfig();

describe('MarketEconomy — recon variance (#162)', () => {
  it('catalog has tail-shape parameters for every condition × reliability × mileage band cell', () => {
    expect(Object.keys(CFG.conditionFactors).sort()).toEqual(['average', 'clean', 'rough']);
    expect(Object.keys(CFG.sourceReliabilityFactors).sort()).toEqual(['high', 'low', 'mid']);
    expect(Object.keys(CFG.mileageFactors).sort()).toEqual(['extreme', 'normal']);
    expect(CFG.buckets).toHaveLength(4);
    expect(CFG.surpriseThreshold).toBeGreaterThan(1);
  });

  it('reliabilityBand + mileageBand bucket the inputs correctly', () => {
    expect(reliabilityBand(0.9, CFG)).toBe('high');
    expect(reliabilityBand(0.6, CFG)).toBe('mid');
    expect(reliabilityBand(0.3, CFG)).toBe('low');
    expect(mileageBand(50_000, CFG)).toBe('normal');
    expect(mileageBand(200_000, CFG)).toBe('extreme');
  });

  it('bucket probabilities sum to 1', () => {
    const p = bucketProbabilities(
      { condition: 'average', mileage: 60_000, sourceReliability: 0.7 },
      CFG,
    );
    const sum = p.within + p.minor + p.major + p.catastrophic;
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it('clean + high-reliability + normal-mileage compresses tails vs. rough/low/extreme', () => {
    const clean = bucketProbabilities(
      { condition: 'clean', mileage: 50_000, sourceReliability: 0.9 },
      CFG,
    );
    const harsh = bucketProbabilities(
      { condition: 'rough', mileage: 200_000, sourceReliability: 0.3 },
      CFG,
    );
    expect(clean.catastrophic).toBeLessThan(harsh.catastrophic);
    expect(clean.major).toBeLessThan(harsh.major);
    expect(clean.minor).toBeLessThan(harsh.minor);
    expect(clean.within).toBeGreaterThan(harsh.within);
  });

  it('deterministic: same seed + inputs → same realized cost', () => {
    const seed = deriveReconSeed(42, 'veh:1');
    const a = rollRecon(
      { estimate: 1000, condition: 'average', mileage: 60_000, sourceReliability: 0.7 },
      seed,
      CFG,
    );
    const b = rollRecon(
      { estimate: 1000, condition: 'average', mileage: 60_000, sourceReliability: 0.7 },
      seed,
      CFG,
    );
    expect(a).toEqual(b);
  });

  it('different vehicleIds produce different realized costs', () => {
    const a = rollRecon(
      { estimate: 1000, condition: 'average', mileage: 60_000, sourceReliability: 0.7 },
      deriveReconSeed(42, 'veh:1'),
      CFG,
    );
    const b = rollRecon(
      { estimate: 1000, condition: 'average', mileage: 60_000, sourceReliability: 0.7 },
      deriveReconSeed(42, 'veh:2'),
      CFG,
    );
    // overwhelmingly likely the rolls differ across vehicle seeds
    expect(a.realizedCost !== b.realizedCost || a.bucket !== b.bucket).toBe(true);
  });

  function distribution(
    inputs: { condition: 'clean' | 'average' | 'rough'; mileage: number; sourceReliability: number },
    n: number,
  ): Record<string, number> {
    const counts: Record<string, number> = { within: 0, minor: 0, major: 0, catastrophic: 0 };
    for (let i = 0; i < n; i++) {
      const seed = deriveSeed(7, 'test.recon', { i, ...inputs });
      const result = rollRecon({ estimate: 1500, ...inputs }, seed, CFG);
      counts[result.bucket]++;
    }
    return counts;
  }

  it('average + mid reliability + normal mileage lands ~85/10/4/1 across N draws', () => {
    const counts = distribution(
      { condition: 'average', mileage: 60_000, sourceReliability: 0.65 },
      5000,
    );
    const total = 5000;
    expect(counts.within / total).toBeGreaterThan(0.78);
    expect(counts.within / total).toBeLessThan(0.92);
    // tails present but rare
    expect(counts.major).toBeGreaterThan(0);
    expect(counts.catastrophic / total).toBeLessThan(0.05);
  });

  it('rough + low + extreme dramatically thickens the catastrophic tail', () => {
    const baseline = distribution(
      { condition: 'average', mileage: 60_000, sourceReliability: 0.65 },
      5000,
    );
    const harsh = distribution(
      { condition: 'rough', mileage: 200_000, sourceReliability: 0.3 },
      5000,
    );
    expect(harsh.catastrophic).toBeGreaterThan(baseline.catastrophic);
    expect(harsh.major).toBeGreaterThan(baseline.major);
  });

  it('realized cost lies within bucket multiplier range × estimate', () => {
    for (let i = 0; i < 500; i++) {
      const seed = deriveSeed(11, 'test.recon_range', { i });
      const r = rollRecon(
        { estimate: 2000, condition: 'rough', mileage: 180_000, sourceReliability: 0.3 },
        seed,
        CFG,
      );
      const bucket = CFG.buckets.find((b) => b.id === r.bucket)!;
      expect(r.realizedCost).toBeGreaterThanOrEqual(Math.floor(2000 * bucket.multRange[0]) - 1);
      expect(r.realizedCost).toBeLessThanOrEqual(Math.ceil(2000 * bucket.multRange[1]) + 1);
    }
  });
});

describe('MarketEconomy — recon surprise template selection (#162)', () => {
  it('catalog covers every tail bucket', () => {
    const buckets = new Set(SURPRISES.templates.map((t) => t.bucket));
    expect(buckets.has('minor')).toBe(true);
    expect(buckets.has('major')).toBe(true);
    expect(buckets.has('catastrophic')).toBe(true);
  });

  it('returns undefined for within bucket (no surprise fires)', () => {
    expect(pickSurpriseTemplate('within', 42, SURPRISES)).toBeUndefined();
  });

  it('returns a template matching the requested bucket', () => {
    for (const bucket of ['minor', 'major', 'catastrophic'] as const) {
      const t = pickSurpriseTemplate(bucket, 42, SURPRISES);
      expect(t).toBeDefined();
      expect(t!.bucket).toBe(bucket);
    }
  });

  it('deterministic for same seed', () => {
    const a = pickSurpriseTemplate('major', 99, SURPRISES);
    const b = pickSurpriseTemplate('major', 99, SURPRISES);
    expect(a).toEqual(b);
  });
});

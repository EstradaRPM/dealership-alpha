import {
  createDemandShaper,
  type DemandShaperSnapshot,
} from '../src/game/DemandShaper';
import { createRng } from '../src/game/NPC/Rng';

const SEGMENTS = ['sedan', 'truck', 'suv'] as const;

const CONFIG = { windowSize: 60, trendEpsilon: 0.08 };

function makeShaper(initialMix?: Record<string, number>) {
  return createDemandShaper({ segments: SEGMENTS, config: CONFIG, initialMix });
}

describe('DemandShaper — heat-map normalization', () => {
  it('defaults to a uniform, normalized heat map', () => {
    const mix = makeShaper().getMix();
    for (const s of SEGMENTS) expect(mix[s]).toBeCloseTo(1 / SEGMENTS.length, 10);
    const sum = SEGMENTS.reduce((acc, s) => acc + mix[s], 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('normalizes arbitrary raw weights to sum 1 while preserving ratios', () => {
    const shaper = makeShaper();
    shaper.setMix({ sedan: 3, truck: 1, suv: 0 });
    const mix = shaper.getMix();
    expect(mix.sedan).toBeCloseTo(0.75, 10);
    expect(mix.truck).toBeCloseTo(0.25, 10);
    expect(mix.suv).toBe(0);
    expect(SEGMENTS.reduce((acc, s) => acc + mix[s], 0)).toBeCloseTo(1, 10);
  });

  it('rejects unknown segments, negative weights, and an all-zero map', () => {
    const shaper = makeShaper();
    expect(() => shaper.setMix({ ghost: 1 } as Record<string, number>)).toThrow();
    expect(() => shaper.setMix({ sedan: -1 })).toThrow();
    expect(() => shaper.setMix({ sedan: 0, truck: 0, suv: 0 })).toThrow();
  });

  it('layers active influence inputs over the baseline heat map', () => {
    const shaper = makeShaper({ sedan: 1, truck: 1, suv: 1 });
    const before = shaper.getMix();
    shaper.setInfluenceInputs([
      {
        id: 'inventory-composition',
        label: 'Inventory composition',
        producer: 'inventory',
        weights: { truck: 2 },
        lagDays: 0,
      },
    ]);
    const after = shaper.getMix();
    expect(after.truck).toBeGreaterThan(before.truck);
    expect(after.sedan).toBeLessThan(before.sedan);
    const [input] = shaper.getInfluenceInputs();
    expect(input).toMatchObject({
      id: 'inventory-composition',
      label: 'Inventory composition',
      producer: 'inventory',
      lagDays: 0,
      decayDays: 0,
      elapsedDays: 0,
      removing: false,
    });
    expect(input.weights.truck).toBe(2);
    expect(input.targetWeights.truck).toBe(2);
  });

  it('ramps changed influence targets over whole days', () => {
    const shaper = makeShaper({ sedan: 1, truck: 1, suv: 1 });
    const before = shaper.getMix();
    shaper.upsertInfluenceInput({
      id: 'advertising:local-radio',
      label: 'Advertising: Local radio',
      producer: 'advertising',
      weights: { suv: 1.2, truck: -0.2 },
      lagDays: 3,
      decayDays: 2,
    });

    expect(shaper.getMix()).toEqual(before);
    shaper.advanceInfluenceDay();
    const dayOne = shaper.getMix();
    expect(dayOne.suv).toBeGreaterThan(before.suv);
    expect(dayOne.suv).toBeLessThan(
      makeShaper({ sedan: 1, truck: 1, suv: 1 }).getMix().suv + 0.2,
    );
    const partialWeight = shaper.getInfluenceInputs()[0].weights.suv;
    expect(partialWeight).toBeGreaterThan(0);
    expect(partialWeight).toBeLessThan(1.2);

    shaper.advanceInfluenceDay(2);
    const full = shaper.getInfluenceInputs()[0];
    expect(full.weights.suv).toBeCloseTo(1.2, 10);
    expect(full.weights.truck).toBeCloseTo(-0.2, 10);
  });
});

describe('DemandShaper — deterministic weighted draw', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = makeShaper();
    const b = makeShaper();
    const seqA = Array.from({ length: 50 }, () => a.drawSegment(createRng(7)));
    const seqB = Array.from({ length: 50 }, () => b.drawSegment(createRng(7)));
    expect(seqA).toEqual(seqB);
  });

  it('realized frequencies track the heat map within tolerance over many draws', () => {
    const shaper = makeShaper();
    shaper.setMix({ sedan: 6, truck: 3, suv: 0 });
    const N = 20_000;
    const counts: Record<string, number> = {};
    for (const s of SEGMENTS) counts[s] = 0;
    // One continuous RNG stream → a proper sample of the distribution.
    const rng = createRng(12345);
    for (let i = 0; i < N; i++) counts[shaper.drawSegment(rng)]++;

    const mix = shaper.getMix();
    for (const s of SEGMENTS) {
      expect(counts[s] / N).toBeCloseTo(mix[s], 1); // within ~0.05
    }
    expect(counts.suv).toBe(0); // zero weight ⇒ never drawn
  });
});

describe('DemandShaper — observed mix + trend', () => {
  it('reports zero shares before any arrivals', () => {
    const observed = makeShaper().getObservedMix();
    expect(observed).toHaveLength(SEGMENTS.length);
    for (const e of observed) {
      expect(e.count).toBe(0);
      expect(e.share).toBe(0);
      expect(e.trend).toBe('steady');
    }
  });

  it('counts arrivals and computes shares over the trailing window', () => {
    const shaper = makeShaper();
    shaper.recordArrival('suv');
    shaper.recordArrival('suv');
    shaper.recordArrival('sedan');
    const observed = shaper.getObservedMix();
    const suv = observed.find((e) => e.segment === 'suv')!;
    const sedan = observed.find((e) => e.segment === 'sedan')!;
    expect(suv.count).toBe(2);
    expect(suv.share).toBeCloseTo(2 / 3, 10);
    expect(sedan.count).toBe(1);
  });

  it('caps the window at windowSize (oldest arrivals drop out)', () => {
    const shaper = createDemandShaper({
      segments: SEGMENTS,
      config: { windowSize: 4, trendEpsilon: 0.08 },
    });
    // 4 trucks then 4 sedans → window holds only the last 4 (sedans).
    for (let i = 0; i < 4; i++) shaper.recordArrival('truck');
    for (let i = 0; i < 4; i++) shaper.recordArrival('sedan');
    const observed = shaper.getObservedMix();
    expect(observed.find((e) => e.segment === 'truck')!.count).toBe(0);
    expect(observed.find((e) => e.segment === 'sedan')!.count).toBe(4);
  });

  it('flags rising / falling trends when a segment shifts across the window halves', () => {
    const shaper = makeShaper();
    // Older half: all sedans. Newer half: all trucks.
    for (let i = 0; i < 10; i++) shaper.recordArrival('sedan');
    for (let i = 0; i < 10; i++) shaper.recordArrival('truck');
    const observed = shaper.getObservedMix();
    expect(observed.find((e) => e.segment === 'truck')!.trend).toBe('rising');
    expect(observed.find((e) => e.segment === 'sedan')!.trend).toBe('falling');
    expect(observed.find((e) => e.segment === 'suv')!.trend).toBe('steady');
  });
});

describe('DemandShaper — snapshot/restore', () => {
  it('round-trips baseline, active inputs, and observed history exactly', () => {
    const original = makeShaper();
    original.setMix({ sedan: 5, truck: 1, suv: 3 });
    original.recordArrival('sedan');
    original.recordArrival('suv');
    original.recordArrival('sedan');
    original.upsertInfluenceInput({
      id: 'test-inventory',
      label: 'Inventory lean',
      producer: 'test',
      weights: { suv: 0.25, truck: 0.15 },
      lagDays: 0,
    });

    const snap: DemandShaperSnapshot = original.snapshot();
    expect(snap.schemaVersion).toBe(3);
    const reparsed = JSON.parse(JSON.stringify(snap)) as DemandShaperSnapshot;

    const rebuilt = makeShaper();
    rebuilt.restore(reparsed);

    expect(rebuilt.snapshot()).toEqual(reparsed);
    expect(rebuilt.getMix()).toEqual(original.getMix());
    expect(rebuilt.getInfluenceInputs()[0].targetWeights.suv).toBe(0.25);
    expect(rebuilt.getObservedMix()).toEqual(original.getObservedMix());
  });

  it('migrates legacy persona-keyed snapshots to the uniform segment default', () => {
    const shaper = makeShaper({ sedan: 5, truck: 1, suv: 1 });
    shaper.recordArrival('truck');
    // A pre-#278 persona-keyed snapshot can't be re-keyed; it resets to uniform.
    shaper.restore({
      schemaVersion: 2,
      baselineMix: { young_family: 1, enthusiast: 1, commuter: 1, retiree: 1, tradesperson: 1 },
      activeInputs: [],
      observedHistory: ['young_family', 'commuter'],
    });
    const mix = shaper.getMix();
    for (const s of SEGMENTS) expect(mix[s]).toBeCloseTo(1 / SEGMENTS.length, 10);
    expect(shaper.snapshot().observedHistory).toEqual([]);
    expect(shaper.getInfluenceInputs()).toEqual([]);
  });

  it('caps restored observed history to the configured trailing window', () => {
    const shaper = createDemandShaper({
      segments: SEGMENTS,
      config: { windowSize: 2, trendEpsilon: 0.08 },
    });
    shaper.restore({
      schemaVersion: 3,
      baselineMix: { sedan: 1, truck: 1, suv: 1 },
      activeInputs: [],
      observedHistory: ['sedan', 'truck', 'suv'],
    });

    expect(shaper.snapshot().observedHistory).toEqual(['truck', 'suv']);
  });
});

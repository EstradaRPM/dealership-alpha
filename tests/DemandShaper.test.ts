import {
  createDemandShaper,
  type DemandShaperSnapshot,
} from '../src/game/DemandShaper';
import { createRng } from '../src/game/NPC/Rng';

const PERSONAS = [
  'young_family',
  'enthusiast',
  'commuter',
  'retiree',
  'tradesperson',
] as const;

const CONFIG = { windowSize: 60, trendEpsilon: 0.08 };

function makeShaper(initialMix?: Record<string, number>) {
  return createDemandShaper({ personas: PERSONAS, config: CONFIG, initialMix });
}

describe('DemandShaper — mix normalization', () => {
  it('defaults to a uniform, normalized mix', () => {
    const mix = makeShaper().getMix();
    for (const p of PERSONAS) expect(mix[p]).toBeCloseTo(1 / PERSONAS.length, 10);
    const sum = PERSONAS.reduce((s, p) => s + mix[p], 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('normalizes arbitrary raw weights to sum 1 while preserving ratios', () => {
    const shaper = makeShaper();
    shaper.setMix({ young_family: 3, enthusiast: 1, commuter: 0, retiree: 0, tradesperson: 0 });
    const mix = shaper.getMix();
    expect(mix.young_family).toBeCloseTo(0.75, 10);
    expect(mix.enthusiast).toBeCloseTo(0.25, 10);
    expect(mix.commuter).toBe(0);
    expect(PERSONAS.reduce((s, p) => s + mix[p], 0)).toBeCloseTo(1, 10);
  });

  it('rejects unknown personas, negative weights, and an all-zero mix', () => {
    const shaper = makeShaper();
    expect(() => shaper.setMix({ ghost: 1 } as Record<string, number>)).toThrow();
    expect(() => shaper.setMix({ young_family: -1 })).toThrow();
    expect(() =>
      shaper.setMix({ young_family: 0, enthusiast: 0, commuter: 0, retiree: 0, tradesperson: 0 }),
    ).toThrow();
  });
});

describe('DemandShaper — deterministic weighted draw', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = makeShaper();
    const b = makeShaper();
    const seqA = Array.from({ length: 50 }, () => a.drawPersona(createRng(7)));
    const seqB = Array.from({ length: 50 }, () => b.drawPersona(createRng(7)));
    expect(seqA).toEqual(seqB);
  });

  it('realized frequencies track the mix within tolerance over many draws', () => {
    const shaper = makeShaper();
    shaper.setMix({ young_family: 5, enthusiast: 3, commuter: 1, retiree: 1, tradesperson: 0 });
    const N = 20_000;
    const counts: Record<string, number> = {};
    for (const p of PERSONAS) counts[p] = 0;
    // One continuous RNG stream → a proper sample of the distribution.
    const rng = createRng(12345);
    for (let i = 0; i < N; i++) counts[shaper.drawPersona(rng)]++;

    const mix = shaper.getMix();
    for (const p of PERSONAS) {
      expect(counts[p] / N).toBeCloseTo(mix[p], 1); // within ~0.05
    }
    expect(counts.tradesperson).toBe(0); // zero weight ⇒ never drawn
  });
});

describe('DemandShaper — observed mix + trend', () => {
  it('reports zero shares before any arrivals', () => {
    const observed = makeShaper().getObservedMix();
    expect(observed).toHaveLength(PERSONAS.length);
    for (const e of observed) {
      expect(e.count).toBe(0);
      expect(e.share).toBe(0);
      expect(e.trend).toBe('steady');
    }
  });

  it('counts arrivals and computes shares over the trailing window', () => {
    const shaper = makeShaper();
    shaper.recordArrival('young_family');
    shaper.recordArrival('young_family');
    shaper.recordArrival('commuter');
    const observed = shaper.getObservedMix();
    const yf = observed.find((e) => e.persona === 'young_family')!;
    const cm = observed.find((e) => e.persona === 'commuter')!;
    expect(yf.count).toBe(2);
    expect(yf.share).toBeCloseTo(2 / 3, 10);
    expect(cm.count).toBe(1);
  });

  it('caps the window at windowSize (oldest arrivals drop out)', () => {
    const shaper = createDemandShaper({
      personas: PERSONAS,
      config: { windowSize: 4, trendEpsilon: 0.08 },
    });
    // 4 enthusiasts then 4 commuters → window holds only the last 4 (commuters).
    for (let i = 0; i < 4; i++) shaper.recordArrival('enthusiast');
    for (let i = 0; i < 4; i++) shaper.recordArrival('commuter');
    const observed = shaper.getObservedMix();
    expect(observed.find((e) => e.persona === 'enthusiast')!.count).toBe(0);
    expect(observed.find((e) => e.persona === 'commuter')!.count).toBe(4);
  });

  it('flags rising / falling trends when a persona shifts across the window halves', () => {
    const shaper = makeShaper();
    // Older half: all commuters. Newer half: all enthusiasts.
    for (let i = 0; i < 10; i++) shaper.recordArrival('commuter');
    for (let i = 0; i < 10; i++) shaper.recordArrival('enthusiast');
    const observed = shaper.getObservedMix();
    expect(observed.find((e) => e.persona === 'enthusiast')!.trend).toBe('rising');
    expect(observed.find((e) => e.persona === 'commuter')!.trend).toBe('falling');
    expect(observed.find((e) => e.persona === 'retiree')!.trend).toBe('steady');
  });
});

describe('DemandShaper — snapshot/restore', () => {
  it('round-trips baseline, active inputs, and observed history exactly', () => {
    const original = makeShaper();
    original.setMix({
      young_family: 5,
      enthusiast: 1,
      commuter: 3,
      retiree: 0,
      tradesperson: 1,
    });
    original.recordArrival('young_family');
    original.recordArrival('commuter');
    original.recordArrival('young_family');

    const snap: DemandShaperSnapshot = {
      ...original.snapshot(),
      activeInputs: [
        {
          id: 'test-inventory',
          label: 'Inventory lean',
          weights: { commuter: 0.25, tradesperson: 0.15 },
        },
      ],
    };
    const reparsed = JSON.parse(JSON.stringify(snap)) as DemandShaperSnapshot;

    const rebuilt = makeShaper();
    rebuilt.restore(reparsed);

    expect(rebuilt.snapshot()).toEqual(reparsed);
    expect(rebuilt.getMix()).toEqual(original.getMix());
    expect(rebuilt.getObservedMix()).toEqual(original.getObservedMix());
  });

  it('caps restored observed history to the configured trailing window', () => {
    const shaper = createDemandShaper({
      personas: PERSONAS,
      config: { windowSize: 2, trendEpsilon: 0.08 },
    });
    shaper.restore({
      schemaVersion: 1,
      baselineMix: { young_family: 1, enthusiast: 1, commuter: 1, retiree: 1, tradesperson: 1 },
      activeInputs: [],
      observedHistory: ['young_family', 'commuter', 'tradesperson'],
    });

    expect(shaper.snapshot().observedHistory).toEqual(['commuter', 'tradesperson']);
  });
});

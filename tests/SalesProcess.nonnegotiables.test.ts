import {
  resolveSalesProcess,
  classifyAxes,
  revealsNonnegotiables,
  wantAxisFit,
  nonnegotiablesSatisfied,
  makeSalespersonProfile,
} from '../src/game/SalesProcess';
import type {
  SalesProcessConfig,
  CustomerNonnegotiablesConfig,
  SpacedVector,
  SpacedAxis,
} from '../src/game/SalesProcess';

const config: SalesProcessConfig = {
  schemaVersion: 1,
  gates: ['GREET', 'QUALIFY', 'DEMO', 'NEGOTIATE'],
  rng: { seedNamespace: 'customer_pool.sales_gate', jitterBand: 0.15 },
  core: { skillWeight: 0.55, fitWeight: 0.3, easeWeight: 0.15 },
  meters: {
    GREET: { trust: 1, value: 0 },
    QUALIFY: { trust: 0.6, value: 0.4 },
    DEMO: { trust: 0.3, value: 0.7 },
    NEGOTIATE: { trust: 0.5, value: 0.5 },
  },
  walk: { trustCollapseFloor: 0.15, patienceFloor: 0 },
  nonnegotiables: { qualifyRevealThreshold: 0.45, tolerance: 0.1 },
  close: { buyThreshold: 0.75, softThreshold: 0.55, trustFloor: 0.45 },
  price: {
    base: 500,
    valueGapWeight: 4000,
    sensitivityWeight: 3000,
    skillHoldWeight: 2500,
    trustHoldWeight: 1500,
    minGross: 800,
    overageAllowed: 1500,
  },
  calibration: {
    positiveMin: 0.85,
    apatheticMin: 0.1,
    apatheticMax: 0.12,
    negativeDealMin: 0.03,
    negativeDealMax: 0.05,
  },
};

const nnConfig: CustomerNonnegotiablesConfig = {
  schemaVersion: 1,
  axes: [
    'safety',
    'performance',
    'appearance',
    'comfort',
    'economy',
    'dependability',
  ],
  nonnegotiableCountWeights: { '1': 0.6, '2': 0.4 },
  remainingAxisWantProbability: 0.5,
  visitArchetypeBias: {},
};

const deps = { config, nonnegotiablesConfig: nnConfig };

const vec = (n: number): SpacedVector => ({
  safety: n,
  performance: n,
  appearance: n,
  comfort: n,
  economy: n,
  dependability: n,
});

const profile = (eff: number, trust: number) =>
  makeSalespersonProfile({
    GREET: { effectiveness: eff, trustworthiness: trust },
    QUALIFY: { effectiveness: eff, trustworthiness: trust },
    DEMO: { effectiveness: eff, trustworthiness: trust },
    NEGOTIATE: { effectiveness: eff, trustworthiness: trust },
  });

const baseVisit = {
  masterSeed: 4242,
  customerId: 'cust-nn-1',
  day: 1,
  customerDifficulty: 0.3,
  archetypeImpatience: 0.001,
  initialPatience: 100,
  customerSpaced: vec(1),
  vehicleSpaced: vec(1),
};

describe('classifyAxes', () => {
  it('assigns 1–2 nonnegotiables and classifies all six axes deterministically', () => {
    const a = classifyAxes(
      { masterSeed: 1, customerId: 'c-1' },
      { nonnegotiablesConfig: nnConfig },
    );
    const b = classifyAxes(
      { masterSeed: 1, customerId: 'c-1' },
      { nonnegotiablesConfig: nnConfig },
    );
    expect(b).toEqual(a);
    expect(a.nonnegotiables.length).toBeGreaterThanOrEqual(1);
    expect(a.nonnegotiables.length).toBeLessThanOrEqual(2);
    expect(Object.keys(a.classes)).toHaveLength(6);
    const all: SpacedAxis[] = [
      ...a.nonnegotiables,
      ...a.wants,
      ...(Object.keys(a.classes) as SpacedAxis[]).filter(
        (x) => a.classes[x] === 'pass',
      ),
    ];
    expect(new Set(all).size).toBe(6);
  });

  it('produces different puzzles for different customers', () => {
    const a = classifyAxes(
      { masterSeed: 1, customerId: 'c-1' },
      { nonnegotiablesConfig: nnConfig },
    );
    const b = classifyAxes(
      { masterSeed: 1, customerId: 'c-2' },
      { nonnegotiablesConfig: nnConfig },
    );
    expect(b).not.toEqual(a);
  });
});

describe('revealsNonnegotiables — skill-gated', () => {
  it('hides on weak QUALIFY, reveals on strong QUALIFY', () => {
    expect(revealsNonnegotiables(0.2, deps)).toBe(false);
    expect(revealsNonnegotiables(0.45, deps)).toBe(true);
    expect(revealsNonnegotiables(0.9, deps)).toBe(true);
  });
});

describe('wantAxisFit / nonnegotiablesSatisfied', () => {
  it('grades want fit by closeness', () => {
    const p = {
      classes: {} as never,
      nonnegotiables: [],
      wants: ['safety', 'comfort'] as SpacedAxis[],
    };
    expect(wantAxisFit(p, vec(1), vec(1))).toBeCloseTo(1, 9);
    expect(wantAxisFit(p, vec(1), vec(0.5))).toBeCloseTo(0.5, 9);
    expect(wantAxisFit(p, vec(1), vec(0))).toBeCloseTo(0, 9);
  });

  it('fails when any nonnegotiable axis is unmet beyond tolerance', () => {
    const p = {
      classes: {} as never,
      nonnegotiables: ['safety'] as SpacedAxis[],
      wants: [],
    };
    expect(nonnegotiablesSatisfied(p, vec(1), vec(1), deps)).toBe(true);
    expect(nonnegotiablesSatisfied(p, vec(1), vec(0.95), deps)).toBe(true);
    expect(nonnegotiablesSatisfied(p, vec(1), vec(0), deps)).toBe(false);
  });
});

describe('resolveSalesProcess — named walk model', () => {
  it('patience-drain walk: low quality + high impatience + thin patience', () => {
    const r = resolveSalesProcess(
      {
        ...baseVisit,
        skill: profile(0.5, 1),
        archetypeImpatience: 5,
        initialPatience: 0.1,
      },
      deps,
    );
    expect(r.outcome).toBe('walk');
    if (r.outcome === 'walk') {
      expect(r.cause).toBe('patience_drain');
      expect(r.patience).toBeLessThanOrEqual(0);
    }
  });

  it('trust-collapse walk: untrustworthy rep drops the meter below the floor', () => {
    const r = resolveSalesProcess(
      { ...baseVisit, skill: profile(0.05, 0) },
      deps,
    );
    expect(r.outcome).toBe('walk');
    if (r.outcome === 'walk') {
      expect(r.cause).toBe('trust_collapse');
      expect(r.meters.trustIntegrity).toBeLessThan(0.15);
    }
  });

  it('DEMO hard-fail walk even at max charisma when a nonnegotiable is missed', () => {
    const r = resolveSalesProcess(
      {
        ...baseVisit,
        skill: profile(1, 1),
        customerSpaced: vec(1),
        vehicleSpaced: vec(0),
      },
      deps,
    );
    expect(r.outcome).toBe('walk');
    if (r.outcome === 'walk') {
      expect(r.cause).toBe('demo_nonnegotiable_miss');
      expect(r.gate).toBe('DEMO');
    }
  });

  it('blind DEMO from weak QUALIFY: nonnegotiables stay hidden yet still hard-fail', () => {
    const r = resolveSalesProcess(
      {
        ...baseVisit,
        skill: makeSalespersonProfile({
          GREET: { effectiveness: 1, trustworthiness: 1 },
          QUALIFY: { effectiveness: 0, trustworthiness: 1 },
          DEMO: { effectiveness: 1, trustworthiness: 1 },
          NEGOTIATE: { effectiveness: 1, trustworthiness: 1 },
        }),
        customerDifficulty: 1,
        customerSpaced: vec(1),
        vehicleSpaced: vec(0),
      },
      deps,
    );
    expect(r.outcome).toBe('walk');
    if (r.outcome === 'walk') {
      expect(r.nonnegotiablesRevealed).toBe(false);
      expect(r.cause).toBe('demo_nonnegotiable_miss');
    }
  });

  it('reaches close with strong skill, a satisfying vehicle, and strong QUALIFY reveal', () => {
    const r = resolveSalesProcess(
      {
        ...baseVisit,
        skill: profile(0.9, 0.9),
        customerDifficulty: 0,
      },
      deps,
    );
    expect(r.outcome).toBe('reached_close');
    expect(r.nonnegotiablesRevealed).toBe(true);
    expect(r.evaluations.map((e) => e.gate)).toEqual(config.gates);
  });

  it('is deterministic for a fixed seed', () => {
    const args = { ...baseVisit, skill: profile(0.6, 0.6) };
    expect(resolveSalesProcess(args, deps)).toEqual(
      resolveSalesProcess(args, deps),
    );
  });
});

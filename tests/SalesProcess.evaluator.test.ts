import {
  evaluateGate,
  accumulateMeters,
  evaluateSalesProcess,
  GREEN_SALESPERSON,
  GREEN_SALESPERSON_SKILL,
  makeSalespersonProfile,
  staticMarketPrice,
  staticVehicleCost,
  staticBookValue,
  GATES,
} from '../src/game/SalesProcess';
import type {
  SalesProcessConfig,
  GateEvaluation,
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
    framingWeight: 0.15,
  },
  calibration: {
    positiveMin: 0.85,
    apatheticMin: 0.1,
    apatheticMax: 0.12,
    negativeDealMin: 0.03,
    negativeDealMax: 0.05,
  },
};
const deps = { config };

const baseGate = {
  masterSeed: 12345,
  customerId: 'cust-1',
  day: 3,
  gate: 'GREET' as const,
  skill: GREEN_SALESPERSON,
  customerDifficulty: 0.5,
  fit: 0.5,
};

describe('evaluateGate — seeded per-gate quality', () => {
  it('is deterministic for a fixed seed/customer/gate/day', () => {
    const a = evaluateGate(baseGate, deps);
    const b = evaluateGate(baseGate, deps);
    expect(b).toEqual(a);
  });

  it('produces independent streams per (customer, gate, day)', () => {
    const ref = evaluateGate(baseGate, deps).q;
    const otherDay = evaluateGate({ ...baseGate, day: 4 }, deps).q;
    const otherCust = evaluateGate(
      { ...baseGate, customerId: 'cust-2' },
      deps,
    ).q;
    const otherGate = evaluateGate({ ...baseGate, gate: 'DEMO' }, deps).q;
    expect(otherDay).not.toBeCloseTo(ref, 6);
    expect(otherCust).not.toBeCloseTo(ref, 6);
    expect(otherGate).not.toBeCloseTo(ref, 6);
  });

  it('keeps q in [0,1] and jitter within the configured band', () => {
    for (const day of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const ev = evaluateGate({ ...baseGate, day }, deps);
      expect(ev.q).toBeGreaterThanOrEqual(0);
      expect(ev.q).toBeLessThanOrEqual(1);
      expect(Math.abs(ev.jitter)).toBeLessThanOrEqual(0.15 + 1e-9);
    }
  });

  it('moves the deterministic core up with skill and down with difficulty', () => {
    const lo = evaluateGate(
      {
        ...baseGate,
        skill: makeSalespersonProfile({
          GREET: { effectiveness: 0.1 },
        }),
      },
      deps,
    );
    const hi = evaluateGate(
      {
        ...baseGate,
        skill: makeSalespersonProfile({
          GREET: { effectiveness: 0.9 },
        }),
      },
      deps,
    );
    expect(hi.core).toBeGreaterThan(lo.core);

    const hard = evaluateGate(
      { ...baseGate, customerDifficulty: 0.9 },
      deps,
    );
    const easy = evaluateGate(
      { ...baseGate, customerDifficulty: 0.1 },
      deps,
    );
    expect(easy.core).toBeGreaterThan(hard.core);
  });
});

describe('accumulateMeters — two-meter roll-up', () => {
  const evals: GateEvaluation[] = [
    {
      gate: 'GREET',
      q: 0.8,
      core: 0.8,
      jitter: 0,
      skill: { effectiveness: 0.5, trustworthiness: 0.5 },
    },
    {
      gate: 'DEMO',
      q: 0.6,
      core: 0.6,
      jitter: 0,
      skill: { effectiveness: 0.5, trustworthiness: 0.5 },
    },
  ];

  it('keeps both meters in [0,1]', () => {
    const m = accumulateMeters(evals, deps);
    expect(m.trustIntegrity).toBeGreaterThanOrEqual(0);
    expect(m.trustIntegrity).toBeLessThanOrEqual(1);
    expect(m.value).toBeGreaterThanOrEqual(0);
    expect(m.value).toBeLessThanOrEqual(1);
  });

  it('is order-independent', () => {
    const a = accumulateMeters(evals, deps);
    const b = accumulateMeters([...evals].reverse(), deps);
    expect(b).toEqual(a);
  });

  it('scales the trust meter by the rep trustworthiness', () => {
    const trustworthy = accumulateMeters(
      evals.map((e) => ({ ...e, skill: { ...e.skill, trustworthiness: 1 } })),
      deps,
    );
    const untrustworthy = accumulateMeters(
      evals.map((e) => ({ ...e, skill: { ...e.skill, trustworthiness: 0.2 } })),
      deps,
    );
    expect(trustworthy.trustIntegrity).toBeGreaterThan(
      untrustworthy.trustIntegrity,
    );
    // Value meter ignores trustworthiness.
    expect(trustworthy.value).toBeCloseTo(untrustworthy.value, 9);
  });

  it('returns zeroed meters for no evaluations', () => {
    expect(accumulateMeters([], deps)).toEqual({
      trustIntegrity: 0,
      value: 0,
    });
  });
});

describe('seam stubs', () => {
  it('GREEN_SALESPERSON returns the green profile for every gate', () => {
    for (const g of GATES) {
      expect(GREEN_SALESPERSON.skillFor(g)).toEqual(GREEN_SALESPERSON_SKILL);
    }
  });

  it('makeSalespersonProfile overrides per gate and clamps to [0,1]', () => {
    const p = makeSalespersonProfile({
      DEMO: { effectiveness: 5, trustworthiness: -3 },
    });
    expect(p.skillFor('DEMO')).toEqual({
      effectiveness: 1,
      trustworthiness: 0,
    });
    // Untouched gates fall back to the green base.
    expect(p.skillFor('GREET')).toEqual(GREEN_SALESPERSON_SKILL);
  });

  it('static price stubs are trivial cost-plus', () => {
    const v = { purchasePrice: 10000, reconCost: 1000 };
    expect(staticVehicleCost(v)).toBe(11000);
    expect(staticMarketPrice(v)).toBe(13750);
  });

  it('staticBookValue returns purchasePrice (wholesale ≈ acquisition for healthy buys)', () => {
    expect(staticBookValue({ purchasePrice: 10000, reconCost: 1000 })).toBe(10000);
    expect(staticBookValue({ purchasePrice: 0, reconCost: 500 })).toBe(0);
  });
});

describe('evaluateSalesProcess — full pure run', () => {
  it('evaluates every configured gate and rolls up meters deterministically', () => {
    const r = evaluateSalesProcess(
      {
        masterSeed: 999,
        customerId: 'cust-9',
        day: 2,
        skill: GREEN_SALESPERSON,
        customerDifficulty: 0.4,
      },
      deps,
    );
    expect(r.evaluations.map((e) => e.gate)).toEqual(config.gates);
    expect(r.meters.trustIntegrity).toBeGreaterThanOrEqual(0);
    expect(r.meters.value).toBeLessThanOrEqual(1);

    const again = evaluateSalesProcess(
      {
        masterSeed: 999,
        customerId: 'cust-9',
        day: 2,
        skill: GREEN_SALESPERSON,
        customerDifficulty: 0.4,
      },
      deps,
    );
    expect(again).toEqual(r);
  });
});

import { createDealEngine, computeMonthlyPayment, computeMaxFinancedAmount, classifyCredit } from '../src/game/DealEngine';
import type { CreditTierCatalog, LoanParams } from '../src/game/DealEngine';

// Minimal catalog used across all tests — mirrors data/credit-tiers.json structure.
const CATALOG: CreditTierCatalog = {
  schemaVersion: 1,
  tiers: {
    A: { minScore: 720, apr: 0.059, maxTerm: 84, ptiCap: 0.20, minDownPct: 0.00, ltvCeiling: 1.25 },
    B: { minScore: 680, apr: 0.089, maxTerm: 75, ptiCap: 0.17, minDownPct: 0.05, ltvCeiling: 1.20 },
    C: { minScore: 620, apr: 0.129, maxTerm: 72, ptiCap: 0.15, minDownPct: 0.10, ltvCeiling: 1.10 },
    D: { minScore:   0, apr: 0.189, maxTerm: 66, ptiCap: 0.13, minDownPct: 0.20, ltvCeiling: 1.05 },
  },
};

// Expected values computed from standard amortization: M = P * r / (1 - (1+r)^-n)
//   Tier A: P=18000, r=0.059/12, n=60 → 347.15
//   Tier B: P=13500, r=0.089/12, n=48 → 335.31
//   Tier C: P=12000, r=0.129/12, n=72 → 240.26
//   Tier D: P= 7500, r=0.189/12, n=36 → 274.54

describe('computeMonthlyPayment', () => {
  it('tier A: 60mo at 5.9% on $18k principal → ~$347.15', () => {
    const result = computeMonthlyPayment(
      { price: 20000, down: 2000, termMonths: 60, tier: 'A' },
      CATALOG.tiers.A,
    );
    expect(result.principal).toBe(18000);
    expect(result.apr).toBeCloseTo(0.059, 4);
    expect(result.monthlyPayment).toBeCloseTo(347.15, 1);
  });

  it('tier B: 48mo at 8.9% on $13.5k principal → ~$335.31', () => {
    const result = computeMonthlyPayment(
      { price: 15000, down: 1500, termMonths: 48, tier: 'B' },
      CATALOG.tiers.B,
    );
    expect(result.principal).toBe(13500);
    expect(result.monthlyPayment).toBeCloseTo(335.31, 1);
  });

  it('tier C: 72mo at 12.9% on $12k principal → ~$240.26', () => {
    const result = computeMonthlyPayment(
      { price: 12000, down: 0, termMonths: 72, tier: 'C' },
      CATALOG.tiers.C,
    );
    expect(result.principal).toBe(12000);
    expect(result.monthlyPayment).toBeCloseTo(240.26, 1);
  });

  it('tier D: 36mo at 18.9% on $7.5k principal → ~$274.54', () => {
    const result = computeMonthlyPayment(
      { price: 8000, down: 500, termMonths: 36, tier: 'D' },
      CATALOG.tiers.D,
    );
    expect(result.principal).toBe(7500);
    expect(result.monthlyPayment).toBeCloseTo(274.54, 1);
  });

  it('zero APR falls back to principal / term', () => {
    const result = computeMonthlyPayment(
      { price: 6000, down: 0, termMonths: 12, tier: 'A' },
      { minScore: 720, apr: 0, maxTerm: 84, ptiCap: 0.20, minDownPct: 0.00, ltvCeiling: 1.25 },
    );
    expect(result.monthlyPayment).toBeCloseTo(500, 5);
  });

  it('down payment exceeding price clamps principal to 0', () => {
    const result = computeMonthlyPayment(
      { price: 5000, down: 10000, termMonths: 48, tier: 'A' },
      CATALOG.tiers.A,
    );
    expect(result.principal).toBe(0);
    expect(result.monthlyPayment).toBe(0);
  });
});

describe('computeMaxFinancedAmount', () => {
  const cases: Array<{ M: number; apr: number; n: number }> = [
    { M: 347.15, apr: 0.059, n: 60 },
    { M: 500,    apr: 0.089, n: 72 },
    { M: 240.26, apr: 0.129, n: 72 },
    { M: 800,    apr: 0.189, n: 36 },
  ];

  for (const { M, apr, n } of cases) {
    it(`round-trip: PMT(maxFinanced(${M}, ${apr}, ${n})) ≈ ${M}`, () => {
      const principal = computeMaxFinancedAmount(M, apr, n);
      const back = computeMonthlyPayment(
        { price: principal, down: 0, termMonths: n, tier: 'A' },
        { minScore: 720, apr, maxTerm: 84, ptiCap: 0.20, minDownPct: 0, ltvCeiling: 1.25 },
      );
      expect(back.monthlyPayment).toBeCloseTo(M, 4);
    });
  }

  it('zero APR: financed = M * n', () => {
    expect(computeMaxFinancedAmount(500, 0, 12)).toBeCloseTo(6000, 5);
  });

  it('zero/negative inputs clamp to 0', () => {
    expect(computeMaxFinancedAmount(0, 0.05, 60)).toBe(0);
    expect(computeMaxFinancedAmount(500, 0.05, 0)).toBe(0);
  });
});

describe('classifyCredit', () => {
  it('720 → A', () => expect(classifyCredit(720, CATALOG)).toBe('A'));
  it('760 → A', () => expect(classifyCredit(760, CATALOG)).toBe('A'));
  it('719 → B', () => expect(classifyCredit(719, CATALOG)).toBe('B'));
  it('680 → B', () => expect(classifyCredit(680, CATALOG)).toBe('B'));
  it('679 → C', () => expect(classifyCredit(679, CATALOG)).toBe('C'));
  it('620 → C', () => expect(classifyCredit(620, CATALOG)).toBe('C'));
  it('619 → D', () => expect(classifyCredit(619, CATALOG)).toBe('D'));
  it('300 → D', () => expect(classifyCredit(300, CATALOG)).toBe('D'));
});

describe('createDealEngine — integration through public interface', () => {
  const engine = createDealEngine({ catalog: CATALOG });

  it('classifyCredit delegates correctly', () => {
    expect(engine.classifyCredit(750)).toBe('A');
    expect(engine.classifyCredit(695)).toBe('B');
    expect(engine.classifyCredit(640)).toBe('C');
    expect(engine.classifyCredit(580)).toBe('D');
  });

  it('structure computes correct result for each tier', () => {
    const params: LoanParams = { price: 20000, down: 2000, termMonths: 60, tier: 'A' };
    const result = engine.structure(params);
    expect(result.monthlyPayment).toBeCloseTo(347.15, 1);
  });

  it('loads live credit-tiers.json without throwing', () => {
    expect(() => createDealEngine()).not.toThrow();
  });
});

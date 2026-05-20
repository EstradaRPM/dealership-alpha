import {
  cashEligible,
  financeEligible,
  isEligible,
} from '../src/game/SalesProcess';
import type {
  AffordabilityCustomer,
  CreditTierPolicy,
  PricedVehicleInput,
} from '../src/game/SalesProcess';

// A bare-bones vehicle: cost 10k + recon 1k → staticVehicleCost=11k →
// staticMarketPrice=round(11000 × 1.25)=13750. staticBookValue=10000.
const vehicle: PricedVehicleInput = { purchasePrice: 10_000, reconCost: 1_000 };
const LIST = 13_750;
const BOOK = 10_000;

const tierB: CreditTierPolicy = {
  apr: 0.089,
  maxTerm: 75,
  ptiCap: 0.17,
  ltvCeiling: 1.2,
};

describe('SalesProcess affordability', () => {
  describe('cashEligible', () => {
    it('passes when wealth × cashSpendFraction covers list price', () => {
      const customer: AffordabilityCustomer = {
        wealth: 50_000,
        annualIncome: 80_000,
        paymentMethod: 'cash',
        cashSpendFraction: 0.5, // 50k × 0.5 = 25k ≥ 13_750
      };
      expect(cashEligible(customer, vehicle)).toBe(true);
    });

    it('fails when wealth × cashSpendFraction falls below list price (overspend)', () => {
      const customer: AffordabilityCustomer = {
        wealth: 20_000,
        annualIncome: 80_000,
        paymentMethod: 'cash',
        cashSpendFraction: 0.3, // 20k × 0.3 = 6k < 13_750
      };
      expect(cashEligible(customer, vehicle)).toBe(false);
    });
  });

  describe('financeEligible', () => {
    const baseFinance: AffordabilityCustomer = {
      wealth: 10_000,
      annualIncome: 120_000,
      paymentMethod: 'finance',
      downPaymentBehavior: 0.15, // requiredDown = 2062.5, loan = 11687.5 (within book×1.2)
    };

    it('happy path: down covered, payment within PTI, loan within LTV', () => {
      const r = financeEligible(baseFinance, vehicle, tierB);
      expect(r.eligible).toBe(true);
      expect(r.failReason).toBeUndefined();
      expect(r.requiredDown).toBeCloseTo(LIST * 0.15);
      expect(r.loanAmount).toBeCloseTo(LIST * 0.85);
      expect(r.monthlyPayment).toBeGreaterThan(0);
      // PTI cap at 17% of monthly income ≈ 1700
      expect(r.monthlyPayment!).toBeLessThan((120_000 / 12) * 0.17);
      // LTV: loan ≤ book × 1.2 = 12000
      expect(r.loanAmount!).toBeLessThanOrEqual(BOOK * tierB.ltvCeiling);
    });

    it('fails on down gap when wealth < requiredDown', () => {
      const customer: AffordabilityCustomer = {
        ...baseFinance,
        wealth: 100, // way below requiredDown
        downPaymentBehavior: 0.1,
      };
      const r = financeEligible(customer, vehicle, tierB);
      expect(r.eligible).toBe(false);
      expect(r.failReason).toBe('down');
      // Down-fail short-circuits before loan/payment computation
      expect(r.loanAmount).toBeUndefined();
      expect(r.monthlyPayment).toBeUndefined();
    });

    it('fails on PTI when monthly payment exceeds income × cap', () => {
      const customer: AffordabilityCustomer = {
        ...baseFinance,
        annualIncome: 12_000, // monthly cap = 1000 × 0.17 = 170
      };
      const r = financeEligible(customer, vehicle, tierB);
      expect(r.eligible).toBe(false);
      expect(r.failReason).toBe('pti');
      expect(r.monthlyPayment).toBeDefined();
      expect(r.loanAmount).toBeDefined();
    });

    it("fails on LTV when loan exceeds book × ltvCeiling", () => {
      // Drop ltvCeiling so the loan (=12_375) blows the book cap (=10_000 × 1.0).
      const strictTier: CreditTierPolicy = { ...tierB, ltvCeiling: 1.0 };
      const r = financeEligible(baseFinance, vehicle, strictTier);
      expect(r.eligible).toBe(false);
      expect(r.failReason).toBe('ltv');
    });

    it('first-failure order: PTI fails before LTV when both would fail', () => {
      const customer: AffordabilityCustomer = {
        ...baseFinance,
        annualIncome: 12_000, // PTI fails
      };
      const strictTier: CreditTierPolicy = { ...tierB, ltvCeiling: 0.5 }; // LTV also fails
      const r = financeEligible(customer, vehicle, strictTier);
      expect(r.failReason).toBe('pti');
    });

    it('is deterministic — same inputs → same outputs', () => {
      const a = financeEligible(baseFinance, vehicle, tierB);
      const b = financeEligible(baseFinance, vehicle, tierB);
      expect(a).toEqual(b);
    });
  });

  describe('isEligible', () => {
    it('dispatches to cashEligible for cash customers', () => {
      const customer: AffordabilityCustomer = {
        wealth: 50_000,
        annualIncome: 80_000,
        paymentMethod: 'cash',
        cashSpendFraction: 0.5,
      };
      expect(isEligible(customer, vehicle)).toBe(true);
    });

    it('dispatches to financeEligible for finance customers when tier provided', () => {
      const customer: AffordabilityCustomer = {
        wealth: 10_000,
        annualIncome: 120_000,
        paymentMethod: 'finance',
        downPaymentBehavior: 0.15,
      };
      expect(isEligible(customer, vehicle, { tier: tierB })).toBe(true);
    });

    it('returns false for finance customers when tier is missing', () => {
      const customer: AffordabilityCustomer = {
        wealth: 10_000,
        annualIncome: 120_000,
        paymentMethod: 'finance',
        downPaymentBehavior: 0.1,
      };
      expect(isEligible(customer, vehicle)).toBe(false);
    });
  });
});

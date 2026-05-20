import type { LoanParams, LoanResult, TierDef } from './types';

export function computeMonthlyPayment(params: LoanParams, tierDef: TierDef): LoanResult {
  const principal = Math.max(0, params.price - params.down);
  const apr = tierDef.apr;
  const r = apr / 12;
  const n = params.termMonths;

  let monthlyPayment: number;
  if (n <= 0) {
    monthlyPayment = 0;
  } else if (r === 0) {
    monthlyPayment = principal / n;
  } else {
    monthlyPayment = (principal * r) / (1 - Math.pow(1 + r, -n));
  }

  return { principal, apr, monthlyPayment };
}

// PMT inverse: given a target monthly payment, APR, and term, returns the
// financed principal whose amortized monthly payment equals maxMonthly.
// Used for payment-based affordability (cap principal at what a buyer's
// max comfortable payment can support).
export function computeMaxFinancedAmount(
  maxMonthly: number,
  apr: number,
  termMonths: number,
): number {
  if (maxMonthly <= 0 || termMonths <= 0) return 0;
  const r = apr / 12;
  if (r === 0) return maxMonthly * termMonths;
  return (maxMonthly * (1 - Math.pow(1 + r, -termMonths))) / r;
}

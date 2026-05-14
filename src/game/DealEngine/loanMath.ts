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

import { computeMonthlyPayment } from '../DealEngine';
import {
  staticBookValue,
  staticMarketPrice,
  type BookValueFn,
  type MarketPriceFn,
  type PricedVehicleInput,
} from './seams';

/**
 * Narrow structural customer input the affordability helpers need. Whatever
 * upstream stamps `cashSpendFraction` / `downPaymentBehavior` (CustomerFactory
 * today) is responsible for assembling this shape; affordability stays pure.
 */
export interface AffordabilityCustomer {
  readonly wealth: number;
  readonly annualIncome: number;
  readonly paymentMethod: 'cash' | 'finance';
  readonly cashSpendFraction?: number;
  readonly downPaymentBehavior?: number;
}

/**
 * Subset of `TierDef` the finance-eligibility math needs. Kept local so the
 * affordability surface doesn't drag in DealEngine's full tier type at the
 * caller boundary.
 */
export interface CreditTierPolicy {
  /**
   * The rate the CUSTOMER is quoted — the lender's buy rate plus the store's
   * markup (#365). Deliberately not the tier table's `buyRate`: the payment a
   * buyer is measured against has to be the payment they would actually make,
   * which is what lets an over-marked structure fail PTI on its own instead of
   * needing a second deal-kill check. The caller resolves it once through
   * `DealEngine.quoteFinance` and hands the same number to the close.
   */
  readonly apr: number;
  readonly maxTerm: number;
  readonly ptiCap: number;
  readonly ltvCeiling: number;
}

export type FinanceFailReason = 'down' | 'pti' | 'ltv';

export interface FinanceEligibility {
  readonly eligible: boolean;
  readonly loanAmount?: number;
  readonly monthlyPayment?: number;
  readonly requiredDown?: number;
  readonly failReason?: FinanceFailReason;
}

export interface AffordabilityDeps {
  readonly marketPriceFn?: MarketPriceFn;
  readonly bookValueFn?: BookValueFn;
  /** Required when `customer.paymentMethod === 'finance'`. */
  readonly tier?: CreditTierPolicy;
}

/** Cash buyer can spend up to `wealth × cashSpendFraction` on the vehicle. */
export function cashEligible(
  customer: AffordabilityCustomer,
  vehicle: PricedVehicleInput,
  marketPriceFn: MarketPriceFn = staticMarketPrice,
): boolean {
  const listPrice = marketPriceFn(vehicle);
  const fraction = customer.cashSpendFraction ?? 0;
  return listPrice <= customer.wealth * fraction;
}

/**
 * Finance eligibility — checks down-gap, then PTI, then LTV. `failReason`
 * identifies the FIRST failure mode in that order.
 */
export function financeEligible(
  customer: AffordabilityCustomer,
  vehicle: PricedVehicleInput,
  tier: CreditTierPolicy,
  marketPriceFn: MarketPriceFn = staticMarketPrice,
  bookValueFn: BookValueFn = staticBookValue,
): FinanceEligibility {
  const listPrice = marketPriceFn(vehicle);
  const downBehavior = customer.downPaymentBehavior ?? 0;
  const requiredDown = listPrice * downBehavior;

  if (customer.wealth < requiredDown) {
    return { eligible: false, requiredDown, failReason: 'down' };
  }

  const loanAmount = listPrice - requiredDown;
  const { monthlyPayment } = computeMonthlyPayment(
    { price: loanAmount, down: 0, termMonths: tier.maxTerm },
    tier.apr,
  );
  const maxMonthly = (customer.annualIncome / 12) * tier.ptiCap;
  if (monthlyPayment > maxMonthly) {
    return { eligible: false, loanAmount, monthlyPayment, requiredDown, failReason: 'pti' };
  }

  const bookValue = bookValueFn(vehicle);
  if (loanAmount > bookValue * tier.ltvCeiling) {
    return { eligible: false, loanAmount, monthlyPayment, requiredDown, failReason: 'ltv' };
  }

  return { eligible: true, loanAmount, monthlyPayment, requiredDown };
}

/** Dispatches on `paymentMethod`. Finance requires `deps.tier`. */
export function isEligible(
  customer: AffordabilityCustomer,
  vehicle: PricedVehicleInput,
  deps: AffordabilityDeps = {},
): boolean {
  if (customer.paymentMethod === 'cash') {
    return cashEligible(customer, vehicle, deps.marketPriceFn);
  }
  if (!deps.tier) return false;
  return financeEligible(
    customer,
    vehicle,
    deps.tier,
    deps.marketPriceFn,
    deps.bookValueFn,
  ).eligible;
}

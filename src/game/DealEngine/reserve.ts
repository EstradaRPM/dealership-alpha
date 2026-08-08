import { loadTunables } from '../data';
import { computeMonthlyPayment, computeMaxFinancedAmount } from './loanMath';
import type { FinanceQuote, FniReserveConfig, ReserveInput, TierDef } from './types';

export function loadFniReserveConfig(): FniReserveConfig {
  return loadTunables().fniReserve;
}

/**
 * What the store quotes a financed customer (#365).
 *
 * The markup target is the whole of the player's F&I involvement at this point
 * in the ladder: a store with no `f&i-manager` on the desk earns the ambient
 * markup and nothing more (grill Q2 — the T1–T2 backend is minimal and has no
 * lever), and a store with a desk works to the Balanced posture's target. The
 * three-position posture dial that moves that target is #366; this function is
 * where it will land, so there is exactly one place a markup is decided.
 *
 * The lender's cap is a hard clamp, not a suggestion: subprime programs allow
 * the least markup, which is why the most desperate customer is not the most
 * profitable one.
 */
export function resolveFinanceQuote(
  tierDef: TierDef,
  deskStaffed: boolean,
  config: FniReserveConfig,
): FinanceQuote {
  const target = deskStaffed ? config.balancedMarkupPts : config.ambientMarkupPts;
  const markupPts = Math.max(0, Math.min(target, tierDef.markupCapPts));
  return {
    buyRate: tierDef.buyRate,
    markupPts,
    customerRate: tierDef.buyRate + markupPts,
  };
}

/**
 * Finance reserve — the store's share of the rate spread (#365).
 *
 * Honest amortization, not a percentage of amount financed. The customer's
 * payment is built at the marked-up rate; the lender buys that payment stream
 * at its own buy rate, so what it will advance is the present value of those
 * payments discounted at `buyRate`. The difference between that advance and the
 * amount financed is the spread the markup created, and the dealer keeps
 * `dealerSharePct` of it (the lender keeps the rest).
 *
 * This falls out of the two loan-math primitives already here — PMT for the
 * payment, its inverse for the present value — so the reserve moves correctly
 * with term and principal without a second rate model to keep in step.
 */
export function computeReserve(input: ReserveInput, dealerSharePct: number): number {
  const { amountFinanced, termMonths, buyRate, customerRate } = input;
  if (amountFinanced <= 0 || termMonths <= 0) return 0;
  if (customerRate <= buyRate) return 0;

  const { monthlyPayment } = computeMonthlyPayment(
    { price: amountFinanced, down: 0, termMonths },
    customerRate,
  );
  const lenderAdvance = computeMaxFinancedAmount(monthlyPayment, buyRate, termMonths);
  return Math.max(0, (lenderAdvance - amountFinanced) * dealerSharePct);
}

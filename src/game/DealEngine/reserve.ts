import { loadTunables } from '../data';
import { computeMonthlyPayment, computeMaxFinancedAmount } from './loanMath';
import type { FinanceQuote, FniReserveConfig, ReserveInput, TierDef } from './types';

export function loadFniReserveConfig(): FniReserveConfig {
  return loadTunables().fniReserve;
}

// ── The F&I posture dial (#366) ──────────────────────────────────────────────

/**
 * One selectable standing F&I posture. `markupPts` is the rate markup in points
 * of APR the desk works to; `label`/`blurb` drive the Prep lever. Tunables live
 * in `data/tunables.json` (`fniPosture`).
 *
 * The dial is the player's ONE finance input and it is standing, not per-deal
 * (grill Q5/Q9/Q10) — the F&I manager executes optimally within it.
 */
export interface FniPostureOption {
  readonly id: string;
  readonly label: string;
  readonly markupPts: number;
  readonly blurb: string;
}

export interface FniPostureConfig {
  /** Posture applied when a slot has no persisted choice (default: `balanced`). */
  readonly defaultId: string;
  readonly postures: readonly FniPostureOption[];
}

/** Reads the posture catalog from the `fniPosture` section of tunables. */
export function loadFniPostureConfig(): FniPostureConfig {
  return loadTunables().fniPosture;
}

/**
 * Resolve a persisted posture id to its markup target (#366).
 *
 * An unknown id — a slot saved before the dial existed, or one naming a posture
 * the catalog no longer sells — falls back to the catalog default rather than
 * throwing, and a catalog whose `defaultId` has itself been retired falls back
 * to the first posture. This always returns a real markup, which is what lets
 * the composition root hand DealEngine a getter it never has to null-check.
 */
export function resolveFniPostureMarkupPts(
  postureId: string | undefined,
  config: FniPostureConfig = loadFniPostureConfig(),
): number {
  const chosen =
    config.postures.find((p) => p.id === postureId) ??
    config.postures.find((p) => p.id === config.defaultId) ??
    config.postures[0];
  return chosen.markupPts;
}

/** Whose markup the store is working to on this deal (#365, posture #366). */
export interface FinanceQuoteInput {
  /** Is an `f&i-manager` working the desk right now? */
  readonly deskStaffed: boolean;
  /** The selected posture's markup target, in points of APR. */
  readonly postureMarkupPts: number;
}

/**
 * What the store quotes a financed customer (#365).
 *
 * The markup target is the whole of the player's F&I involvement at this point
 * in the ladder: a store with no `f&i-manager` on the desk earns the ambient
 * markup and nothing more (grill Q2 — the T1–T2 backend is minimal and has no
 * lever), and a store with a desk works to the posture the player selected
 * (#366). One place decides a markup, and it is here.
 *
 * The input is named rather than positional for the #365/#152 reason: a quote
 * resolved against no posture is a silent default, so every call site states
 * both halves of the answer.
 *
 * The lender's cap is a hard clamp, not a suggestion: subprime programs allow
 * the least markup, which is why the most desperate customer is not the most
 * profitable one.
 */
export function resolveFinanceQuote(
  tierDef: TierDef,
  input: FinanceQuoteInput,
  config: FniReserveConfig,
): FinanceQuote {
  const target = input.deskStaffed ? input.postureMarkupPts : config.ambientMarkupPts;
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

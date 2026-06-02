import { z } from 'zod';
import { createRng } from '../NPC/Rng';
import type { CurrentVehicle } from '../NPC';
import { parseData } from '../data';

/**
 * Trade-in machinery (slice #167+, parent #150). The customer's *ask* — what
 * they want for the car they drove in on — is rolled here as a pure,
 * deterministic function. Staff evaluation, counter-offers, auto-resolution
 * and the `trade:resolved` event (#168–#169) accrue onto this same module so
 * trade logic stays co-located with the rest of deal construction.
 */

// ── Noise config (data/trade-allowance-noise.json) ────────────────────────────

export const TradeAllowanceNoiseConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    meanMultiplier: z.number(),
    stdev: z.number().min(0),
    floor: z.number(),
    ceiling: z.number(),
  })
  .strict();

export type TradeAllowanceNoiseConfig = z.infer<
  typeof TradeAllowanceNoiseConfigSchema
>;

export function loadTradeAllowanceNoiseConfig(): TradeAllowanceNoiseConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/trade-allowance-noise.json');
  return parseData(
    raw,
    TradeAllowanceNoiseConfigSchema,
    'data/trade-allowance-noise.json',
  );
}

// ── Trade valuation seam ──────────────────────────────────────────────────────

/**
 * Reads honest wholesale book for a customer's trade-in vehicle. The live
 * MarketEconomy provider (`createProviders().bookValueFn`) satisfies this at
 * runtime — `CurrentVehicle` carries the anchor fields (templateId / make /
 * year / mileage / category / condition) the provider actually reads. The
 * composition root adapts the provider to this narrower shape; game logic
 * never sees the cast.
 */
export type TradeBookValueFn = (vehicle: CurrentVehicle) => number;

// ── Allowance ask ─────────────────────────────────────────────────────────────

/**
 * Sample one trade-allowance noise multiplier. Mirrors the auction-side
 * motivated-seller draw (slice #160): a Box-Muller normal centered at
 * `meanMultiplier`, clipped to `[floor, ceiling]`. The clip turns the tails
 * into the hard "ignorance bargain" / "entitled ask" caps.
 */
function sampleTradeNoise(
  seed: number,
  cfg: TradeAllowanceNoiseConfig,
): number {
  const rng = createRng(seed);
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const raw = cfg.meanMultiplier + z * cfg.stdev;
  if (raw < cfg.floor) return cfg.floor;
  if (raw > cfg.ceiling) return cfg.ceiling;
  return raw;
}

/**
 * Generate the customer's trade allowance ask — the dollar number they want
 * for their trade. Pure and deterministic: identical `seed` (and inputs) →
 * identical ask.
 *
 *   allowanceAsk = bookValue(currentVehicle) × motivatedSellerMultiplier(seed)
 *                + max(0, loanPayoff − bookValue(currentVehicle))
 *
 * The noise term spreads the ask around honest book (most ±1 stdev, tails for
 * the entitled / ignorant). The negative-equity term floors the ask so an
 * underwater owner asks roughly enough to clear their payoff — they cannot
 * walk away owing the bank on a trade they expect us to absorb.
 *
 * `loanPayoff` is passed explicitly (it lives on `currentVehicle` but the
 * formula takes it as its own term); `null` (a cash-owner) reads as 0.
 */
export function generateTradeAsk(
  currentVehicle: CurrentVehicle,
  loanPayoff: number | null,
  bookValueFn: TradeBookValueFn,
  seed: number,
  config: TradeAllowanceNoiseConfig = loadTradeAllowanceNoiseConfig(),
): number {
  const book = bookValueFn(currentVehicle);
  const noisyValue = book * sampleTradeNoise(seed, config);
  const negativeEquity = Math.max(0, (loanPayoff ?? 0) - book);
  return Math.round(noisyValue + negativeEquity);
}

// ── Staff trade evaluation (#168) ─────────────────────────────────────────────

export const TradeEvalConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    counterWindowFraction: z.number().min(0),
    confidencePenaltyFraction: z.number().min(0).max(1),
    counterGiveWeight: z.number().min(0).max(1),
    skillCounterThreshold: z.number().min(0).max(1),
  })
  .strict();

export type TradeEvalConfig = z.infer<typeof TradeEvalConfigSchema>;

export function loadTradeEvalConfig(): TradeEvalConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/trade-evaluation.json');
  return parseData(raw, TradeEvalConfigSchema, 'data/trade-evaluation.json');
}

/**
 * Narrow read of the acting salesperson's NEGOTIATE composite. Mirrors
 * SalesProcess's `GateSkill` but is defined locally so DealEngine never imports
 * SalesProcess (which depends on DealEngine — that would be a cycle). The
 * composition root resolves `skill.skillFor('NEGOTIATE')` and passes the result.
 */
export interface NegotiationSkill {
  readonly effectiveness: number;
  readonly trustworthiness: number;
}

/**
 * Narrow read of a UCM condition assessment. Mirrors StaffOrg's `ConditionRead`
 * (structurally compatible) but only the `confidence` scalar drives the
 * defensive valuation pull here. `null` ⇒ no used-car-manager on staff to read
 * the trade, which reads as zero confidence (maximally defensive).
 */
export interface TradeConditionRead {
  readonly confidence: number;
}

export type TradeAction = 'accept' | 'counter' | 'decline';

export interface TradeEvaluation {
  readonly action: TradeAction;
  /** Present only when `action === 'counter'`. Whole dollars. */
  readonly counterAmount?: number;
  /** Human-readable decision trace (figures, target, gating skill). */
  readonly rationale: string;
}

export interface TradeEvalInput {
  readonly currentVehicle: CurrentVehicle;
  /** What the customer wants for the trade (`generateTradeAsk` output). */
  readonly allowanceAsk: number;
  /** Acting salesperson's resolved NEGOTIATE composite. */
  readonly skill: NegotiationSkill;
  /** UCM condition read on the trade, or `null` when no UCM is on staff. */
  readonly conditionRead: TradeConditionRead | null;
}

export interface TradeEvalDeps {
  /** Honest wholesale book for the trade (live MarketEconomy provider at runtime). */
  readonly bookValueFn: TradeBookValueFn;
  /**
   * Trade policy multiplier (slice #18 seam). `1.0` = 'market' (default until
   * #18 lands); `> 1` aggressive (chase volume, overpay vs book); `< 1`
   * conservative (protect gross). Scales the internal acceptance target.
   */
  readonly policyMultiplier?: number;
  readonly config?: TradeEvalConfig;
}

/**
 * Staff decision engine for a customer's trade allowance ask (#168). Pure and
 * deterministic: no RNG, no I/O — identical inputs → identical decision. This
 * slice ships the engine only; flow integration (#94) is untouched.
 *
 * Decision tree:
 *
 *   book          = bookValueFn(currentVehicle)              honest wholesale
 *   confidence    = conditionRead?.confidence ?? 0           0 when no UCM reads it
 *   defensive     = 1 − (1 − confidence)·confidencePenaltyFraction
 *   target        = book × policyMultiplier × defensive      internal max allowance
 *
 *   ask ≤ target                          → ACCEPT  (we'd have paid at least this)
 *   target < ask ≤ target·(1+window)      → COUNTER at counterAmount
 *   ask > target·(1+window)               → COUNTER if a skilled closer
 *                                            (NEGOTIATE effectiveness ≥ threshold),
 *                                            else DECLINE (weak staff lets it walk)
 *
 *   counterAmount = round( target + (ask − target)·(1 − effectiveness)·counterGiveWeight )
 *
 * The two skill seams pull the counter in opposite directions, the source of the
 * "skilled staff counter near book; weak staff over- or under-pay" behavior:
 *   • Low condition-read confidence (poor/absent UCM) pulls `target` below book
 *     → defensive under-pay.
 *   • Low NEGOTIATE effectiveness drifts the counter up toward the ask
 *     → over-pay. A perfect closer holds exactly at `target ≈ book × policy`.
 */
export function evaluateTrade(
  input: TradeEvalInput,
  deps: TradeEvalDeps,
): TradeEvaluation {
  const cfg = deps.config ?? loadTradeEvalConfig();
  const policyMultiplier = deps.policyMultiplier ?? 1.0;
  const { currentVehicle, allowanceAsk, skill, conditionRead } = input;

  const book = deps.bookValueFn(currentVehicle);
  const confidence = conditionRead?.confidence ?? 0;
  const defensiveFactor = 1 - (1 - confidence) * cfg.confidencePenaltyFraction;
  const target = book * policyMultiplier * defensiveFactor;

  const dollars = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

  if (allowanceAsk <= target) {
    return {
      action: 'accept',
      rationale: `Ask ${dollars(allowanceAsk)} ≤ internal target ${dollars(
        target,
      )} (book ${dollars(book)} × policy ${policyMultiplier} × read-confidence factor ${defensiveFactor.toFixed(
        2,
      )}); accepted.`,
    };
  }

  // Counter amount: hold at target, then drift toward the ask the weaker the
  // negotiator (over-pay). A perfect closer (effectiveness=1) holds at target.
  const giveFraction = (1 - skill.effectiveness) * cfg.counterGiveWeight;
  const counterAmount = Math.round(target + (allowanceAsk - target) * giveFraction);

  const farAbove = allowanceAsk > target * (1 + cfg.counterWindowFraction);
  if (farAbove && skill.effectiveness < cfg.skillCounterThreshold) {
    return {
      action: 'decline',
      rationale: `Ask ${dollars(allowanceAsk)} far above target ${dollars(
        target,
      )} (> +${(cfg.counterWindowFraction * 100).toFixed(
        0,
      )}%) and NEGOTIATE effectiveness ${skill.effectiveness.toFixed(
        2,
      )} below threshold ${cfg.skillCounterThreshold}; declined.`,
    };
  }

  return {
    action: 'counter',
    counterAmount,
    rationale: `Ask ${dollars(allowanceAsk)} above target ${dollars(
      target,
    )}; counter ${dollars(counterAmount)} (NEGOTIATE effectiveness ${skill.effectiveness.toFixed(
      2,
    )}${farAbove ? ', skilled closer holding a far-above ask' : ''}).`,
  };
}

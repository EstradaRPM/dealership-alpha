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

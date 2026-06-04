import type { CarryingConfig } from './inventoryConfig';

/**
 * Floorplan APR for a dealership tier (#173). Better tiers borrow money more
 * cheaply — a diegetic CareerProgression reward. Any tier without an explicit
 * `aprByTier` entry falls back to `baselineApr`.
 */
export function floorplanAprForTier(cfg: CarryingConfig, tier: number): number {
  return cfg.aprByTier[String(tier)] ?? cfg.baselineApr;
}

/**
 * One vehicle's carrying cost for a single day (#173), rounded to whole
 * dollars. Pure + deterministic — identical inputs always produce the same
 * burn, which is what keeps the daily accrual replay-stable.
 *
 * - Floorplan interest: `bookValue × apr / 365` (the financing cost of holding
 *   the unit's book value for a day).
 * - Insurance + overhead: flat per-unit-per-day allocations.
 * - Recon fade: a small additive that only applies once recon is complete — a
 *   freshly detailed car quietly depreciating while it waits for a buyer.
 */
export function computeDailyCarryingCost(args: {
  bookValue: number;
  apr: number;
  reconComplete: boolean;
  config: CarryingConfig;
}): number {
  const { bookValue, apr, reconComplete, config } = args;
  const floorplanDaily = (bookValue * apr) / 365;
  const reconFade = reconComplete ? config.reconFadePerDay : 0;
  return Math.round(
    floorplanDaily + config.insurancePerDay + config.overheadPerDay + reconFade,
  );
}

import type { InstalledBaseConfig } from './installedBaseConfig';
import type { JobCategory, OwnerPowertrain } from './types';

/**
 * The pure life-cycle math behind the return cadence (#300). Kept free of the
 * EventBus / RNG so it is isolation-testable on its own: the module composes
 * these with a seeded draw and the live reputation read to produce the day's
 * returning-owner stream.
 */

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Whether an owner is service-due today. Owners come due on a powertrain-varying
 * interval measured from sale day — i.e. at each whole multiple of the cadence.
 * `ageDays = day − saleDay`; due when the age is a positive multiple of the
 * interval. EVs carry the longest interval, so they come due least often.
 */
export function isServiceDue(ageDays: number, cadenceDays: number): boolean {
  if (ageDays <= 0 || cadenceDays <= 0) return false;
  return ageDays % cadenceDays === 0;
}

/** The cadence interval (game days) for a powertrain. */
export function cadenceForPowertrain(
  powertrain: OwnerPowertrain,
  config: InstalledBaseConfig,
): number {
  return config.returnCadence[powertrain];
}

/**
 * The probability a due owner brings the car to the player's shop:
 * `clamp01(loyalty × reputation × convenience − priceSensitivity)`. Monotone
 * increasing in loyalty, reputation and convenience; decreasing in
 * price-sensitivity. `reputation` is a [0,1] read; `convenience` and
 * `priceSensitivity` are tunables (the future marketing/pricing levers drive
 * them — placeholders this slice).
 */
export function returnProbability(inputs: {
  loyalty: number;
  reputation: number;
  convenience: number;
  priceSensitivity: number;
}): number {
  const { loyalty, reputation, convenience, priceSensitivity } = inputs;
  return clamp01(loyalty * reputation * convenience - priceSensitivity);
}

/**
 * The job category a returning car of this age is due for — base-age drift from
 * early consumables (oil/tires) through brakes/drivetrain to electronics. Walks
 * the ordered drift ladder and returns the first band whose `untilAgeDays`
 * bound the age sits under; the final band omits the bound as the catch-all.
 */
export function selectJobCategory(
  ageDays: number,
  config: InstalledBaseConfig,
): JobCategory {
  for (const band of config.jobCategoryDrift) {
    if (band.untilAgeDays === undefined || ageDays < band.untilAgeDays) {
      return band.category;
    }
  }
  // The schema guarantees a final catch-all band, but fall back defensively to
  // the last declared category rather than throwing inside the day loop.
  return config.jobCategoryDrift[config.jobCategoryDrift.length - 1].category;
}

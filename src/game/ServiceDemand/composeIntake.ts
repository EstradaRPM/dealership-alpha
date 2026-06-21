import { createRng, deriveSeed } from '../NPC/Rng';
import { JOB_CATEGORIES, POWERTRAINS, type ServiceDemandConfig } from './serviceDemandConfig';
import type {
  JobCategory,
  OwnerPowertrain,
  ServiceDemandInput,
  ServiceIntakeEntry,
} from './types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Weighted draw over parallel items/weights using a single [0,1) roll. Negative
 *  weights are treated as 0; a zero total falls back to the first item. */
function weightedPick<T>(items: readonly T[], weights: readonly number[], roll: number): T {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return items[0];
  let x = roll * total;
  for (let i = 0; i < items.length; i++) {
    x -= Math.max(0, weights[i]);
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

/** The day's number of conquest walk-ins: a fixed floor (always present, even
 *  with an empty installed base) plus a volume that scales with the product of
 *  reputation and service marketing. Either input at 0 ⇒ the floor only. */
export function conquestVolume(
  reputation: number,
  serviceMarketing: number,
  config: ServiceDemandConfig['conquest'],
): number {
  return config.floor + Math.round(config.scale * clamp01(reputation) * clamp01(serviceMarketing));
}

/** The installed base's powertrain distribution (shares summing to 1). Falls
 *  back to the assumed local-fleet mix when the base is empty, so a brand-new
 *  dealership still gets a sensible conquest skew. */
function powertrainDistribution(
  owners: ServiceDemandInput['owners'],
  fallback: ServiceDemandConfig['conquestPowertrainMix'],
): Record<OwnerPowertrain, number> {
  if (owners.length === 0) {
    const total = POWERTRAINS.reduce((s, pt) => s + fallback[pt], 0);
    if (total <= 0) return { ice: 1, hybrid: 0, ev: 0 };
    return { ice: fallback.ice / total, hybrid: fallback.hybrid / total, ev: fallback.ev / total };
  }
  const counts: Record<OwnerPowertrain, number> = { ice: 0, hybrid: 0, ev: 0 };
  for (const o of owners) counts[o.powertrain] += 1;
  const n = owners.length;
  return { ice: counts.ice / n, hybrid: counts.hybrid / n, ev: counts.ev / n };
}

/**
 * Compose the normalized conquest job/parts-category mix from the five inputs:
 * the consumable-heavy `usualSplit` base, the day's `seasonalLean`, a base-age
 * drift (older installed fleet shifts toward drivetrain/electronics), a
 * powertrain skew (weighted by the installed base's powertrain distribution),
 * and a per-category RNG jitter. Returns weights that sum to 1.
 */
export function composeConquestMix(
  input: ServiceDemandInput,
  config: ServiceDemandConfig,
): Record<JobCategory, number> {
  const lean = config.seasonalLean[input.season];

  // Mean fleet age → a [0,1] drift factor (saturating at the reference age).
  const meanAge =
    input.owners.length === 0
      ? 0
      : input.owners.reduce((s, o) => s + (input.day - o.saleDay), 0) / input.owners.length;
  const ageFactor = clamp01(meanAge / config.baseAgeDrift.referenceAgeDays);

  const ptDist = powertrainDistribution(input.owners, config.conquestPowertrainMix);

  const weights = {} as Record<JobCategory, number>;
  for (const cat of JOB_CATEGORIES) {
    let w = config.usualSplit[cat];
    w += lean[cat] ?? 0; // seasonal lean
    w += ageFactor * config.baseAgeDrift.categoryShift[cat]; // base-age drift

    // Powertrain skew: the base's powertrain distribution blends the per-
    // powertrain category multipliers into one factor.
    let skew = 0;
    for (const pt of POWERTRAINS) skew += ptDist[pt] * config.powertrainSkew[pt][cat];
    w *= skew;

    // RNG variance: a per-category multiplicative jitter, seeded off
    // masterSeed + day + category so it is order-independent + replay-safe.
    const rng = createRng(
      deriveSeed(input.masterSeed, 'service_demand.mix', { day: input.day, cat }),
    );
    w *= 1 + (rng() * 2 - 1) * config.rngVariance;

    weights[cat] = Math.max(0, w);
  }

  // Normalize to a probability distribution (uniform fallback if all zeroed).
  let total = 0;
  for (const cat of JOB_CATEGORIES) total += weights[cat];
  if (total <= 0) {
    const u = 1 / JOB_CATEGORIES.length;
    for (const cat of JOB_CATEGORIES) weights[cat] = u;
    return weights;
  }
  for (const cat of JOB_CATEGORIES) weights[cat] /= total;
  return weights;
}

/**
 * Compose the day's enriched service intake (#302). The installed-base returns
 * are folded in first as the primary stream (identity + due category already
 * resolved upstream); the conquest walk-ins follow as the floor, each drawing a
 * job category from the composed mix and a vehicle category + powertrain from
 * the conquest distributions. Pure + seeded — deterministic under a fixed
 * `masterSeed` + day.
 */
export function composeServiceIntake(
  input: ServiceDemandInput,
  config: ServiceDemandConfig,
): ServiceIntakeEntry[] {
  const entries: ServiceIntakeEntry[] = [];

  // 1. Returns — the primary stream. Category was age-selected by InstalledBase.
  input.returns.forEach((ret, i) => {
    entries.push({
      ticketId: `svc:return:${input.day}:${i}`,
      source: 'return',
      customerId: ret.customerId,
      vehicleId: ret.vehicleId,
      category: ret.category,
      powertrain: ret.powertrain,
      jobCategory: ret.jobCategory,
      baseRevenue: config.jobRevenue[ret.jobCategory],
    });
  });

  // 2. Conquest — the floor. Fresh walk-ins drawn from the composed mix.
  const count = conquestVolume(input.reputation, input.serviceMarketing, config.conquest);
  if (count > 0) {
    const mixWeights = composeConquestMix(input, config);
    const mix = JOB_CATEGORIES.map((c) => mixWeights[c]);
    const ptWeights = POWERTRAINS.map((p) => config.conquestPowertrainMix[p]);
    const catKeys = Object.keys(config.conquestVehicleCategories);
    const catWeights = catKeys.map((k) => config.conquestVehicleCategories[k]);

    for (let i = 0; i < count; i++) {
      const rng = createRng(
        deriveSeed(input.masterSeed, 'service_demand.conquest', { day: input.day, i }),
      );
      const jobCategory = weightedPick(JOB_CATEGORIES, mix, rng());
      const powertrain = weightedPick(POWERTRAINS, ptWeights, rng());
      const category = weightedPick(catKeys, catWeights, rng());
      entries.push({
        ticketId: `svc:conquest:${input.day}:${i}`,
        source: 'conquest',
        customerId: `svc-conquest:${input.day}:${i}`,
        vehicleId: `svc-conquest-veh:${input.day}:${i}`,
        category,
        powertrain,
        jobCategory,
        baseRevenue: config.jobRevenue[jobCategory],
      });
    }
  }

  return entries;
}

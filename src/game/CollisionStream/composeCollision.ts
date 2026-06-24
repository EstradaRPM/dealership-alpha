import { createRng, deriveSeed } from '../NPC/Rng';
import {
  BODY_SHOP_JOB_CATEGORIES,
  COLLISION_POWERTRAINS,
  type CollisionStreamConfig,
} from './collisionStreamConfig';
import type {
  BodyShopJobCategory,
  CollisionChannel,
  CollisionIntakeEntry,
  CollisionPowertrain,
  CollisionStreamInput,
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

/**
 * A seeded Poisson draw (Knuth) — the engine of the feast-or-famine collision
 * volume. A low mean ⇒ most days quiet with occasional spikes; the weather/season
 * multipliers raise the mean on bad-weather days so a storm genuinely floods the
 * shop rather than nudging a fixed cadence. `lambda` is clamped to `maxLambda` so
 * a corrupt config can't hang the draw; `k` is hard-capped as a second guard.
 */
export function samplePoisson(lambda: number, maxLambda: number, rng: () => number): number {
  const lam = Math.min(Math.max(0, lambda), maxLambda);
  if (lam <= 0) return 0;
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
    if (k > 10000) break;
  } while (p > L);
  return k - 1;
}

/** The day's weather/season spike multiplier for the lumpy retail stream (the
 *  full spike) — condition × season. Unmapped conditions fall back to 1. */
function fullWeatherSpike(input: CollisionStreamInput, config: CollisionStreamConfig): number {
  const byCondition = config.weatherSpike.byCondition as Record<string, number>;
  const bySeason = config.weatherSpike.bySeason;
  const cond = byCondition[input.conditionId] ?? 1;
  return cond * bySeason[input.season];
}

/**
 * The day's two expected collision rates (Poisson means), before drawing counts.
 * - **Retail/conquest** — the lumpy stream: base × full weather spike ×
 *   reputation gain (the conquest-dominant lever) + the small installed-base tie,
 *   grown by leaning retail (`posture` → 1).
 * - **Insurance-DRP** — the steady stream: base × a damped weather spike
 *   (rep-independent), grown by leaning insurance (`posture` → 0).
 * Pure; exposed for isolation tests of the volume profiles.
 */
export function collisionRates(
  input: CollisionStreamInput,
  config: CollisionStreamConfig,
): { insurance: number; retail: number } {
  const { volume } = config;
  const full = fullWeatherSpike(input, config);
  const rep = clamp01(input.reputation);
  const posture = clamp01(input.posture);

  const baseTieAdd = Math.min(volume.baseTieCap, volume.baseTie * Math.max(0, input.baseSize));
  const retail =
    (volume.conquestBase * full * (1 + volume.repGain * rep) + baseTieAdd) *
    (1 + volume.retailLeanBonus * posture);

  const damped = 1 + (full - 1) * config.weatherSpike.insuranceDamping;
  const insurance = volume.referralBase * damped * (1 - posture);

  return { insurance: Math.max(0, insurance), retail: Math.max(0, retail) };
}

/**
 * The normalized collision job-category mix: `jobSplit` base + the day's seasonal
 * lean + the day's condition lean (snow/storm tilt toward glass/panels/paint) +
 * a per-category multiplicative RNG jitter, seeded off `masterSeed + day +
 * category`. Returns weights that sum to 1 (uniform fallback if all zeroed).
 */
export function composeCollisionMix(
  input: CollisionStreamInput,
  config: CollisionStreamConfig,
): Record<BodyShopJobCategory, number> {
  const { mix } = config;
  const seasonLean = mix.seasonalLean[input.season];
  const conditionLean = (mix.conditionLean as Record<string, Partial<Record<BodyShopJobCategory, number>>>)[
    input.conditionId
  ];

  const weights = {} as Record<BodyShopJobCategory, number>;
  for (const cat of BODY_SHOP_JOB_CATEGORIES) {
    let w = mix.jobSplit[cat];
    w += seasonLean[cat] ?? 0;
    w += conditionLean?.[cat] ?? 0;

    const rng = createRng(deriveSeed(input.masterSeed, 'collision_stream.mix', { day: input.day, cat }));
    w *= 1 + (rng() * 2 - 1) * mix.rngVariance;

    weights[cat] = Math.max(0, w);
  }

  let total = 0;
  for (const cat of BODY_SHOP_JOB_CATEGORIES) total += weights[cat];
  if (total <= 0) {
    const u = 1 / BODY_SHOP_JOB_CATEGORIES.length;
    for (const cat of BODY_SHOP_JOB_CATEGORIES) weights[cat] = u;
    return weights;
  }
  for (const cat of BODY_SHOP_JOB_CATEGORIES) weights[cat] /= total;
  return weights;
}

/** The base ticket revenue for a job, carrying the channel margin profile:
 *  insurance jobs are rate-capped (< book), retail jobs carry the fatter
 *  structural margin. */
function channelRevenue(
  jobCategory: BodyShopJobCategory,
  channel: CollisionChannel,
  config: CollisionStreamConfig,
): number {
  const book = config.jobRevenue[jobCategory];
  const mult =
    channel === 'insurance' ? config.channel.insuranceRateCap : config.channel.retailMarginMultiplier;
  return Math.round(book * mult);
}

/** Build the `count` collision tickets for one channel: each draws a job category
 *  from the composed mix and a vehicle category + powertrain from the conquest
 *  distributions, with synthetic `bs:*` customer/vehicle ids. */
function buildChannelTickets(
  input: CollisionStreamInput,
  config: CollisionStreamConfig,
  channel: CollisionChannel,
  count: number,
  mix: number[],
): CollisionIntakeEntry[] {
  const entries: CollisionIntakeEntry[] = [];
  if (count <= 0) return entries;

  const catKeys = Object.keys(config.mix.vehicleCategories);
  const catWeights = catKeys.map((k) => config.mix.vehicleCategories[k]);
  const ptWeights = COLLISION_POWERTRAINS.map((p) => config.mix.powertrainMix[p]);

  for (let i = 0; i < count; i++) {
    const rng = createRng(
      deriveSeed(input.masterSeed, 'collision_stream.event', { day: input.day, channel, i }),
    );
    const jobCategory = weightedPick(BODY_SHOP_JOB_CATEGORIES, mix, rng());
    const powertrain = weightedPick(COLLISION_POWERTRAINS, ptWeights, rng()) as CollisionPowertrain;
    const category = weightedPick(catKeys, catWeights, rng());
    entries.push({
      ticketId: `bs:${channel}:${input.day}:${i}`,
      source: channel,
      customerId: `bs-${channel}:${input.day}:${i}`,
      vehicleId: `bs-${channel}-veh:${input.day}:${i}`,
      category,
      powertrain,
      jobCategory,
      baseRevenue: channelRevenue(jobCategory, channel, config),
    });
  }
  return entries;
}

/**
 * Compose the day's enriched collision intake (#313). Draws two seeded Poisson
 * counts — insurance + retail — from the day's rates, then builds each channel's
 * tickets from the composed job mix. Insurance tickets lead (the steady DRP
 * stream), retail follow (the lumpy conquest stream). Pure + seeded —
 * deterministic under a fixed `masterSeed` + day.
 */
export function composeCollisionIntake(
  input: CollisionStreamInput,
  config: CollisionStreamConfig,
): CollisionIntakeEntry[] {
  const rates = collisionRates(input, config);
  const { maxLambda } = config.volume;

  const insRng = createRng(
    deriveSeed(input.masterSeed, 'collision_stream.volume', { day: input.day, channel: 'insurance' }),
  );
  const retRng = createRng(
    deriveSeed(input.masterSeed, 'collision_stream.volume', { day: input.day, channel: 'retail' }),
  );
  const insuranceCount = samplePoisson(rates.insurance, maxLambda, insRng);
  const retailCount = samplePoisson(rates.retail, maxLambda, retRng);

  if (insuranceCount + retailCount === 0) return [];

  const mixWeights = composeCollisionMix(input, config);
  const mix = BODY_SHOP_JOB_CATEGORIES.map((c) => mixWeights[c]);

  return [
    ...buildChannelTickets(input, config, 'insurance', insuranceCount, mix),
    ...buildChannelTickets(input, config, 'retail', retailCount, mix),
  ];
}

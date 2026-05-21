import { createRng, deriveSeed, type SeedContext } from '../Rng';
import { parseData } from '../../data';
import {
  CustomerCurrentVehicleConfigSchema,
  CurrentVehicleSchema,
  type CustomerCurrentVehicleConfig,
  type CurrentVehicle,
} from '../schemas/customer-current-vehicle';

export const CURRENT_VEHICLE_NAMESPACE = 'npc.customer.currentVehicle';

export function loadCustomerCurrentVehicleConfig(): CustomerCurrentVehicleConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../../data/customer-current-vehicle.json');
  return parseData(
    raw,
    CustomerCurrentVehicleConfigSchema,
    'data/customer-current-vehicle.json',
  );
}

export interface RollCurrentVehicleContext extends SeedContext {
  personArchetypeId: string;
  day: number;
  slot: number;
}

export interface RollCurrentVehicleDeps {
  masterSeed: number;
  config: CustomerCurrentVehicleConfig;
  /**
   * The person's classified credit tier. Selects which payoff distribution
   * applies. The caller resolves the tier (typically via DealEngine's
   * `classifyCredit`) so this factory stays free of a DealEngine dep.
   */
  creditTier: 'A' | 'B' | 'C' | 'D';
}

function gaussian(rng: () => number, mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function weightedPick<K extends string>(
  rng: () => number,
  weights: Readonly<Record<K, number>>,
): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) {
    throw new Error('weightedPick: total weight must be positive');
  }
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

function clampInt(n: number, lo: number, hi: number): number {
  const r = Math.round(n);
  return r < lo ? lo : r > hi ? hi : r;
}

/**
 * Roll a deterministic `currentVehicle` for a customer at pool entry.
 *
 * The same `(masterSeed, personArchetypeId, day, slot, creditTier)` always
 * produces an identical CurrentVehicle. Pure — no side effects.
 */
export function rollCurrentVehicle(
  ctx: RollCurrentVehicleContext,
  deps: RollCurrentVehicleDeps,
): CurrentVehicle {
  const { masterSeed, config, creditTier } = deps;
  const profile = config.archetypes[ctx.personArchetypeId];
  if (!profile) {
    throw new Error(
      `rollCurrentVehicle: no archetype profile for "${ctx.personArchetypeId}"`,
    );
  }

  const seedFor = (sub: string): number =>
    deriveSeed(masterSeed, `${CURRENT_VEHICLE_NAMESPACE}.${sub}`, ctx);

  const category = weightedPick(
    createRng(seedFor('category')),
    profile.categoryWeights,
  );

  const pool = profile.templatePool[category];
  const templateId = pool[Math.floor(createRng(seedFor('template'))() * pool.length)];
  const template = config.templates[templateId];
  if (!template) {
    throw new Error(
      `rollCurrentVehicle: template "${templateId}" referenced by ` +
        `"${ctx.personArchetypeId}" pool is not declared in templates`,
    );
  }

  const [yearMin, yearMax] = config.yearBounds;
  const ageRaw = gaussian(
    createRng(seedFor('ageOffset')),
    profile.ageOffset.mu,
    profile.ageOffset.sigma,
  );
  const year = clampInt(config.referenceYear - ageRaw, yearMin, yearMax);

  const mileageMult = Math.max(
    0,
    gaussian(
      createRng(seedFor('mileageMultiplier')),
      profile.mileageMultiplier.mu,
      profile.mileageMultiplier.sigma,
    ),
  );
  const yearsOld = Math.max(0, config.referenceYear - year);
  const mileage = clampInt(
    yearsOld * config.mileagePerYear * mileageMult,
    0,
    400000,
  );

  const condition = weightedPick(
    createRng(seedFor('condition')),
    profile.conditionWeights,
  );

  const financed = createRng(seedFor('finance'))() < profile.financeProbability;
  let loanPayoff: number | null = null;
  if (financed) {
    const payoffDist = profile.payoffByTier[creditTier];
    if (!payoffDist) {
      throw new Error(
        `rollCurrentVehicle: archetype "${ctx.personArchetypeId}" missing payoff ` +
          `entry for credit tier "${creditTier}"`,
      );
    }
    const raw = gaussian(
      createRng(seedFor('payoff')),
      payoffDist.mu,
      payoffDist.sigma,
    );
    loanPayoff = Math.max(0, Math.round(raw));
  }

  return CurrentVehicleSchema.parse({
    templateId,
    make: template.make,
    model: template.model,
    year,
    mileage,
    condition,
    category: template.category,
    loanPayoff,
  });
}

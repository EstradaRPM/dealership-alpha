import { createRng, deriveSeed, type SeedContext } from '../../Rng';
import { parseData } from '../../data';
import { assertKnownBrands, brandLabel } from '../../Brands';
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
  const config = parseData(
    raw,
    CustomerCurrentVehicleConfigSchema,
    'data/customer-current-vehicle.json',
  );
  // Referential integrity (#246) — the same check `data/vehicles.json` gets.
  // These templates are declared here rather than imported from Inventory (see
  // this module's CLAUDE.md), so they need the check in their own right.
  assertKnownBrands(
    Object.values(config.templates).map((t) => t.brand),
    'data/customer-current-vehicle.json',
  );
  return config;
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
   * The person's classified credit tier. Selects the financing terms
   * (origination LTV / term / APR) the payoff is derived from. The caller
   * resolves the tier (typically via DealEngine's `classifyCredit`) so this
   * factory stays free of a DealEngine dep.
   */
  creditTier: 'A' | 'B' | 'C' | 'D';
  /**
   * Honest wholesale book for the trade's current vehicle (#282). The loan
   * payoff is derived *relative to* this value (`book × ltv × remaining ÷
   * depreciation`), so a financed owner's lien tracks the car they drove in
   * on instead of a value-blind dollar draw. Injected from the composition
   * root (the live MarketEconomy `bookValueFn`) so NPC stays free of a
   * MarketEconomy dep — same seam pattern as `tradeAskFn`. Omit (legacy/test
   * path) and a financed owner comes back with `loanPayoff: null`.
   */
  bookValueFn?: (vehicle: CurrentVehicle) => number;
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

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Fraction of the original loan principal still owed after `monthsPaid` of a
 * `termMonths` loan at `aprAnnual` — the standard amortization remaining-balance
 * ratio `((1+i)^n − (1+i)^k) / ((1+i)^n − 1)` (i = monthly rate). Early payments
 * are mostly interest, so principal pays down slowly at first — which is exactly
 * what keeps a fresh loan underwater. Clamped to `[0, 1]`.
 */
function remainingPrincipalFraction(
  aprAnnual: number,
  termMonths: number,
  monthsPaid: number,
): number {
  const n = termMonths;
  if (n <= 0) return 0;
  const k = clamp(monthsPaid, 0, n);
  const i = aprAnnual / 12;
  if (i <= 0) return 1 - k / n;
  const pow = (x: number): number => Math.pow(1 + i, x);
  return clamp((pow(n) - pow(k)) / (pow(n) - 1), 0, 1);
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

  // The car they drove in on, sans lien — built first so `bookValueFn` can read
  // its anchor fields when deriving the payoff.
  const vehicleBase: CurrentVehicle = {
    templateId,
    brand: template.brand,
    make: brandLabel(template.brand),
    model: template.model,
    year,
    mileage,
    condition,
    category: template.category,
    loanPayoff: null,
  };

  const financed = createRng(seedFor('finance'))() < profile.financeProbability;
  let loanPayoff: number | null = null;
  if (financed && deps.bookValueFn) {
    loanPayoff = derivePayoff(
      vehicleBase,
      config.financing,
      creditTier,
      deps.bookValueFn,
      seedFor,
    );
  }

  return CurrentVehicleSchema.parse({ ...vehicleBase, loanPayoff });
}

/**
 * Derive a financed owner's loan payoff (#282) as a controlled multiple of the
 * trade's *current* book value:
 *
 *   payoff = book × clamp( ltvAtOrigination × remainingPrincipal ÷ depreciation )
 *
 * where the three factors are the honest mechanics behind negative equity:
 *   • `ltvAtOrigination` — how much of the original value was financed (sub-prime
 *     borrows more; rolled-in equity/fees push it over 1.0).
 *   • `remainingPrincipal` — amortization paydown given the loan's age and terms.
 *     A small, tunable `deepTailWeight` share of loans sit in the "fresh"
 *     (early, high-balance) region where negative equity concentrates.
 *   • `depreciation` — the car has shed value since origination, so the current
 *     book is un-depreciated back to the origination value before applying LTV.
 *
 * The result: most trades land mildly underwater or equity-positive; steep is
 * occasional; deeply-underwater is the rare tail (governed by `deepTailWeight`).
 */
function derivePayoff(
  vehicle: CurrentVehicle,
  fin: CustomerCurrentVehicleConfig['financing'],
  creditTier: 'A' | 'B' | 'C' | 'D',
  bookValueFn: (vehicle: CurrentVehicle) => number,
  seedFor: (sub: string) => number,
): number {
  const book = bookValueFn(vehicle);

  // LTV at origination — sub-prime financed more of the (higher) original value.
  const [ltvLo, ltvHi] = fin.ltvClamp;
  const ltvDist = fin.ltvAtOrigination[creditTier];
  const ltv = clamp(
    gaussian(createRng(seedFor('ltv')), ltvDist.mu, ltvDist.sigma),
    ltvLo,
    ltvHi,
  );

  // Loan age — a tunable share land in the "fresh" (high-balance) region where
  // negative equity concentrates; the rest are seasoned (mostly paid down).
  const ageRng = createRng(seedFor('loanAge'));
  const fresh = ageRng() < fin.deepTailWeight;
  const ageFraction = fresh
    ? ageRng() * fin.freshCutoff
    : fin.freshCutoff + ageRng() * (1 - fin.freshCutoff);

  const term = fin.termMonths[creditTier];
  const monthsPaid = Math.round(ageFraction * term);
  const remaining = remainingPrincipalFraction(
    fin.aprAnnual[creditTier],
    term,
    monthsPaid,
  );

  // Un-depreciate current book back to the value at origination, then apply
  // origination LTV × remaining principal to get today's payoff.
  const loanAgeYears = monthsPaid / 12;
  const depFactor = Math.pow(1 - fin.annualDepreciation, loanAgeYears); // (0, 1]
  const [ratioLo, ratioHi] = fin.ratioClamp;
  const ratio = clamp((ltv * remaining) / depFactor, ratioLo, ratioHi);

  return Math.max(0, Math.round(book * ratio));
}

import {
  isEligible,
  type AffordabilityCustomer,
  type AffordabilityDeps,
} from './affordability';
import {
  classifyAxes,
  nonnegotiablesSatisfied,
  wantAxisFit,
  type CustomerAxisProfile,
  type NonnegotiablesDeps,
} from './nonnegotiables';
import { staticMarketPrice, type MarketPriceFn, type PricedVehicleInput } from './seams';
import {
  vehicleSpaced as computeVehicleSpaced,
  type SpacedVector,
  type SpacedVehicleInput,
  type VehicleSpacedDeps,
} from './vehicleSpaced';

/**
 * Narrow structural lot vehicle: SPACED + price inputs + a stable id for
 * deterministic tie-breaking. Inventory's `LotVehicle` satisfies this without
 * a module dependency.
 */
export type MatchableVehicle = SpacedVehicleInput &
  PricedVehicleInput & { readonly id: string };

/**
 * Narrow structural customer input the matcher needs. The caller assembles
 * this from the live Customer (Person + Visit) — keeps SalesProcess pure.
 */
export interface MatchCustomer extends AffordabilityCustomer {
  readonly masterSeed: number;
  readonly customerId: string;
  /** Customer's required SPACED levels (unit-scaled). */
  readonly customerSpaced: SpacedVector;
  /** Unit-scaled archetype attribute. */
  readonly priceSensitivity: number;
  readonly visitArchetypeId?: string;
  /** Optional pre-classified profile; computed via `classifyAxes` if omitted. */
  readonly axisProfile?: CustomerAxisProfile;
}

/** Stubbed reputation hook — real surface is a follow-on. */
export type ReputationBonusFn = (make: string) => number;

const noReputationBonus: ReputationBonusFn = () => 0;

export interface PickVehicleDeps
  extends VehicleSpacedDeps,
    NonnegotiablesDeps,
    AffordabilityDeps {
  readonly marketPriceFn?: MarketPriceFn;
  readonly reputationBonusFn?: ReputationBonusFn;
}

const WANT_WEIGHT = 1;

/** Headroom a price penalty is scaled against — caller-independent of eligibility. */
function affordabilityHeadroom(customer: MatchCustomer): number {
  if (customer.paymentMethod === 'cash') {
    return customer.wealth * (customer.cashSpendFraction ?? 0);
  }
  // Finance: anchor on annual income (a recognizable "comfortable car price"
  // proxy). Eligibility already filtered the unaffordable; this just lets
  // sensitive buyers prefer cheaper cars among the survivors.
  return customer.annualIncome;
}

/** Unit-scaled penalty for list price relative to the customer's headroom. */
function pricePenalty(listPrice: number, headroom: number): number {
  if (headroom <= 0) return 1;
  const ratio = listPrice / headroom;
  return ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
}

/**
 * The chosen vehicle plus the loop's match-payoff signal (#199): the want-axis
 * `fit` of the winner ∈ [0,1]. "Strong match" = the stocked unit closely met
 * what the buyer wanted — the dopamine beat the floor toast + recap tally fire
 * on. Distinct from the argmax `score` (which also folds in price + reputation):
 * the player-facing payoff is "you had what they wanted," i.e. want-axis fit.
 */
export interface VehicleMatch {
  readonly vehicleId: string;
  /** Want-axis fit of the chosen vehicle ∈ [0,1]. */
  readonly matchQuality: number;
}

/**
 * Pure customer→vehicle matcher (#145), match-quality variant (#199). Filters
 * the lot by affordability and nonnegotiables, argmax-scores survivors, and
 * returns the winner's id alongside its want-axis fit. Deterministic: ties
 * break by stable ascending `vehicleId` order, no RNG.
 */
export function pickVehicleForMatch(
  customer: MatchCustomer,
  lot: readonly MatchableVehicle[],
  deps: PickVehicleDeps = {},
): VehicleMatch | null {
  if (lot.length === 0) return null;

  const marketPriceFn = deps.marketPriceFn ?? staticMarketPrice;
  const reputationBonusFn = deps.reputationBonusFn ?? noReputationBonus;

  const axisProfile =
    customer.axisProfile ??
    classifyAxes(
      {
        masterSeed: customer.masterSeed,
        customerId: customer.customerId,
        visitArchetypeId: customer.visitArchetypeId,
      },
      deps,
    );

  const headroom = affordabilityHeadroom(customer);

  // Sort once by id so iteration order — and therefore tie-breaking — is stable.
  const sorted = [...lot].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let bestId: string | null = null;
  let bestScore = -Infinity;
  let bestFit = 0;

  for (const v of sorted) {
    if (!isEligible(customer, v, { ...deps, marketPriceFn })) continue;

    const spaced = computeVehicleSpaced(v, deps);
    if (!nonnegotiablesSatisfied(axisProfile, customer.customerSpaced, spaced, deps)) {
      continue;
    }

    const fit = wantAxisFit(axisProfile, customer.customerSpaced, spaced);
    const listPrice = marketPriceFn(v);
    const score =
      fit * WANT_WEIGHT -
      pricePenalty(listPrice, headroom) * customer.priceSensitivity +
      reputationBonusFn(v.make);

    if (score > bestScore) {
      bestScore = score;
      bestId = v.id;
      bestFit = fit;
    }
  }

  return bestId === null ? null : { vehicleId: bestId, matchQuality: bestFit };
}

/**
 * Id-only matcher (#145). Thin wrapper over `pickVehicleForMatch` for callers
 * that don't need the match-quality signal.
 */
export function pickVehicleFor(
  customer: MatchCustomer,
  lot: readonly MatchableVehicle[],
  deps: PickVehicleDeps = {},
): string | null {
  return pickVehicleForMatch(customer, lot, deps)?.vehicleId ?? null;
}

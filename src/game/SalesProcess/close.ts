import {
  loadSalesProcessConfig,
  type SalesProcessConfig,
} from './salesProcessData';
import {
  staticMarketPrice,
  staticVehicleCost,
  type GateSkill,
  type MarketPriceFn,
  type PricedVehicleInput,
  type SalespersonSkill,
  type VehicleCostFn,
} from './seams';
import type { MeterState } from './evaluator';

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface CloseInput {
  readonly meters: MeterState;
  readonly skill: SalespersonSkill;
  /** Customer's price sensitivity, unit-scaled (archetype attribute). */
  readonly priceSensitivity: number;
  readonly vehicle: PricedVehicleInput;
  readonly marketPriceFn?: MarketPriceFn;
  readonly vehicleCostFn?: VehicleCostFn;
}

export interface CloseDeps {
  readonly config?: SalesProcessConfig;
  /**
   * Optional injection point so composition can route live MarketEconomy
   * providers (#155) through `salesProcessDeps` without per-call wiring. If
   * the same fn is set on `CloseInput` it wins; otherwise these are consulted;
   * otherwise the static stubs.
   */
  readonly marketPriceFn?: MarketPriceFn;
  readonly vehicleCostFn?: VehicleCostFn;
}

export type CloseOutcome = 'buy' | 'no_close';

/** Intermediate price-formation values, exposed for HITL review and tests. */
export interface PriceFormation {
  readonly marketPrice: number;
  readonly vehicleCost: number;
  readonly closingComposite: GateSkill;
  /**
   * `base + (1−Value)·valueGapWeight + sensitivity·sensitivityWeight
   *  − closingEffectiveness·skillHoldWeight − trust·trustHoldWeight`
   */
  readonly requiredDiscount: number;
  readonly marginFloorPrice: number;
  /**
   * `marketPrice − requiredDiscount` — the raw price before margin clamping.
   * When this is below `marginFloorPrice` the deal is not closeable on price.
   */
  readonly rawPrice: number;
}

export interface CloseResult {
  readonly outcome: CloseOutcome;
  /** Objective deal attractiveness ∈ [0,1] (PRD decision 11). */
  readonly objectiveDeal: number;
  /** Clamped to `[marginFloorPrice, marketPrice + overageAllowed]`. */
  readonly realizedPrice: number;
  readonly frontGross: number;
  /**
   * True when the price math can work (rawPrice ≥ marginFloorPrice).
   * A deal can fail to close on the quadrant even if closeable=true;
   * and can never close if closeable=false regardless of quadrant.
   */
  readonly closeable: boolean;
  /** Bought via strong objectiveDeal despite low trust. Flags bad review downstream. */
  readonly badReview: boolean;
  /** Same condition as badReview — signals high F&I resistance in the next module. */
  readonly highFiResistance: boolean;
  readonly priceFormation: PriceFormation;
}

/**
 * Quadrant close model + price formation (PRD #85 decisions 11–12).
 *
 * Close rule:
 *   objectiveDeal ≥ buyThreshold               → buy (trust irrelevant)
 *   objectiveDeal ≥ softThreshold AND trust ≥ trustFloor → soft buy
 *   otherwise                                  → no_close
 *
 * Price formation (applied before evaluating objectiveDeal):
 *   requiredDiscount = base + (1−Value)·valueGapWeight + sensitivity·sensitivityWeight
 *                      − closingSkill·skillHoldWeight − trust·trustHoldWeight
 *   marginFloorPrice = vehicleCost + minGross
 *   realizedPrice    = clamp(marketPrice − requiredDiscount,
 *                            marginFloorPrice, marketPrice + overageAllowed)
 *   closeable        = rawPrice ≥ marginFloorPrice
 *   frontGross       = realizedPrice − vehicleCost
 *
 * objectiveDeal = clamp(base + framingBoost, 0, 1)
 * where base = (1−sensitivity)×Value + sensitivity×normalizedPriceScore
 *       normalizedPriceScore = discountGiven / (marketPrice − marginFloorPrice)
 *       framingBoost = closingEff × sensitivity × framingWeight
 * priceSensitivity blends value vs price; framingBoost lets skilled closers lift
 * objectiveDeal for price-focused customers regardless of the held price.
 *
 * Low-trust forced close (objectiveDeal ≥ buyThreshold but trust < trustFloor)
 * sets badReview + highFiResistance for downstream modules.
 */
export function closeAndPrice(
  input: CloseInput,
  deps: CloseDeps = {},
): CloseResult {
  const cfg = deps.config ?? loadSalesProcessConfig();
  const { meters, skill, priceSensitivity, vehicle } = input;
  const marketPriceFn = input.marketPriceFn ?? deps.marketPriceFn ?? staticMarketPrice;
  const vehicleCostFn = input.vehicleCostFn ?? deps.vehicleCostFn ?? staticVehicleCost;

  const marketPrice = marketPriceFn(vehicle);
  const vehicleCost = vehicleCostFn(vehicle);

  // Closing gate skill (NEGOTIATE drives price hold)
  const closingComposite: GateSkill = skill.skillFor('NEGOTIATE');

  // Price formation (PRD decision 12)
  const { price: p } = cfg;
  const requiredDiscount =
    p.base +
    (1 - meters.value) * p.valueGapWeight +
    priceSensitivity * p.sensitivityWeight -
    closingComposite.effectiveness * p.skillHoldWeight -
    meters.trustIntegrity * p.trustHoldWeight;

  const marginFloorPrice = vehicleCost + p.minGross;
  const rawPrice = marketPrice - requiredDiscount;
  const realizedPrice = Math.max(
    marginFloorPrice,
    Math.min(marketPrice + p.overageAllowed, rawPrice),
  );
  const closeable = rawPrice >= marginFloorPrice;
  const frontGross = realizedPrice - vehicleCost;

  // objectiveDeal (PRD decision 11): weighted blend of value and price satisfaction.
  // priceSensitivity is the blend weight — low sensitivity customers buy on value
  // built; high sensitivity customers buy on how much of the available discount
  // they received. normalizedPriceScore uses the actual margin room (floor→market)
  // so a $500 discount on a $3k-room vehicle scores meaningfully, not near-zero.
  const maxDiscount = Math.max(marketPrice - marginFloorPrice, 0);
  const discountGiven = Math.max(marketPrice - realizedPrice, 0);
  const normalizedPriceScore = maxDiscount > 0 ? Math.min(discountGiven / maxDiscount, 1) : 0;
  // Closing framing boost: a skilled closer actively reframes value for price-focused
  // customers at the decision moment, lifting objectiveDeal independently of discount.
  // Scales with both closing effectiveness and sensitivity — irrelevant when sensitivity=0.
  const framingBoost =
    closingComposite.effectiveness * priceSensitivity * p.framingWeight;
  const objectiveDeal = clampUnit(
    (1 - priceSensitivity) * meters.value +
      priceSensitivity * normalizedPriceScore +
      framingBoost,
  );

  // Quadrant close rule
  const { close: c } = cfg;
  const unconditionalClose = objectiveDeal >= c.buyThreshold;
  const softClose =
    objectiveDeal >= c.softThreshold && meters.trustIntegrity >= c.trustFloor;
  const quadrantWantsToBuy = unconditionalClose || softClose;

  const outcome: CloseOutcome =
    closeable && quadrantWantsToBuy ? 'buy' : 'no_close';

  // Low-trust forced close: bought via strong deal despite low trust
  const lowTrustForced =
    outcome === 'buy' &&
    unconditionalClose &&
    meters.trustIntegrity < c.trustFloor;

  return {
    outcome,
    objectiveDeal,
    realizedPrice,
    frontGross,
    closeable,
    badReview: lowTrustForced,
    highFiResistance: lowTrustForced,
    priceFormation: {
      marketPrice,
      vehicleCost,
      closingComposite,
      requiredDiscount,
      marginFloorPrice,
      rawPrice,
    },
  };
}

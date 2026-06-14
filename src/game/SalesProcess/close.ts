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

/**
 * Vehicle input to the close. Widens the narrow price seam (#273) with the
 * player-set `askingPrice` — the transaction anchor. Inventory's `LotVehicle`
 * (which carries a required `askingPrice`) satisfies it; narrow seam-stub /
 * calibration callers omit it and fall back to the market benchmark, which
 * preserves the legacy `book × markup` math for those paths.
 */
export type CloseVehicleInput = PricedVehicleInput & {
  readonly askingPrice?: number;
};

export interface CloseInput {
  readonly meters: MeterState;
  readonly skill: SalespersonSkill;
  /** Customer's price sensitivity, unit-scaled (archetype attribute). */
  readonly priceSensitivity: number;
  readonly vehicle: CloseVehicleInput;
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
  /**
   * The transaction anchor (#273): the player-set `askingPrice`, or the market
   * benchmark when no ask is supplied. `realizedPrice` forms off this.
   */
  readonly askingPrice: number;
  /**
   * Competitor benchmark (`book × markup`). Demoted from the transaction price
   * (#273) — retained only for below/above-market labeling and comps; it no
   * longer sets what the customer pays.
   */
  readonly marketPrice: number;
  readonly vehicleCost: number;
  readonly closingComposite: GateSkill;
  /**
   * The customer's max willingness-to-pay (#274): the market benchmark scaled by
   * `reservationBase + Value·valueLift − sensitivity·sensitivityDrag`, floored at
   * 0. `requiredDiscount` derives from the gap between this and the ask.
   */
  readonly reservationPrice: number;
  /**
   * `max(0, askingPrice − reservationPrice)` (#274). Zero when the ask sits at or
   * below the customer's reservation (they buy at ask); positive when the ask
   * exceeds it (discount toward the reservation, or escalate if that's below the
   * margin floor). Never negative — a customer never volunteers above their max.
   */
  readonly requiredDiscount: number;
  readonly marginFloorPrice: number;
  /**
   * `askingPrice − requiredDiscount` — the raw price before margin clamping.
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
 * Price formation (applied before evaluating objectiveDeal). The transaction
 * anchor is the player-set `askingPrice` (#273); `marketPrice` is demoted to a
 * competitor benchmark (labeling/comps + reservation anchor) and no longer sets
 * the price. The reservation-price model (#274) replaces the old additive
 * requiredDiscount formula:
 *   reservationPrice = marketPrice × max(0, reservationBase
 *                      + Value·valueLift − sensitivity·sensitivityDrag)
 *   requiredDiscount = max(0, askingPrice − reservationPrice)
 *   marginFloorPrice = vehicleCost + minGross
 *   rawPrice         = askingPrice − requiredDiscount   (= min(ask, reservation))
 *   realizedPrice    = clamp(rawPrice, marginFloorPrice, askingPrice + overageAllowed)
 *   closeable        = rawPrice ≥ marginFloorPrice
 *   frontGross       = realizedPrice − vehicleCost
 * ask ≤ reservation ⇒ requiredDiscount 0 ⇒ buys at ask. ask > reservation ⇒
 * discount toward reservation, or (reservation < floor) not closeable ⇒ escalate.
 *
 * objectiveDeal = clamp(base + framingBoost, 0, 1)
 * where base = (1−sensitivity)×Value + sensitivity×priceSatisfaction
 *       priceSatisfaction = consumer surplus = (reservation − realizedPrice)
 *                           / (reservation − marginFloorPrice), clamped [0,1]
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

  // marketPrice is now the competitor benchmark only (#273) — labeling/comps,
  // never the anchor. The transaction anchors on the player-set askingPrice;
  // narrow seam-stub callers that carry no ask fall back to the benchmark,
  // preserving the legacy book×markup math (and the #94 calibration path).
  const marketPrice = marketPriceFn(vehicle);
  const askingPrice = vehicle.askingPrice ?? marketPrice;
  const vehicleCost = vehicleCostFn(vehicle);

  // Closing gate skill (NEGOTIATE drives price hold)
  const closingComposite: GateSkill = skill.skillFor('NEGOTIATE');

  // Price formation (PRD decision 12; reservation-price model #274)
  const { price: p } = cfg;

  // Reservation price: the customer's max willingness-to-pay. Anchored on the
  // market benchmark (segment retail reference), lifted by value built during
  // the visit, dragged down by price sensitivity (their wealth proxy). Skill and
  // trust no longer move the price here — the salesperson's price work lives in
  // the discount event (#274 spine, the discount-escalation branch).
  const reservationFactor = Math.max(
    0,
    p.reservationBase +
      meters.value * p.valueLift -
      priceSensitivity * p.sensitivityDrag,
  );
  const reservationPrice = marketPrice * reservationFactor;

  // requiredDiscount = the gap between ask and reservation, floored at 0.
  const requiredDiscount = Math.max(0, askingPrice - reservationPrice);

  const marginFloorPrice = vehicleCost + p.minGross;
  const rawPrice = askingPrice - requiredDiscount; // = min(ask, reservationPrice)
  const realizedPrice = Math.max(
    marginFloorPrice,
    Math.min(askingPrice + p.overageAllowed, rawPrice),
  );
  const closeable = rawPrice >= marginFloorPrice;
  const frontGross = realizedPrice - vehicleCost;

  // objectiveDeal (PRD decision 11): weighted blend of value and price satisfaction.
  // priceSensitivity is the blend weight — low sensitivity customers buy on value
  // built; high sensitivity customers buy on the price relative to their own
  // reservation. priceSatisfaction is consumer surplus (#274): how far below their
  // max willingness-to-pay they actually paid, scaled by the room between the
  // reservation and the margin floor — paying at reservation scores 0, at the floor
  // scores 1. This is the coherent reservation-model price signal (a discount off a
  // sticker the customer would never have paid is not satisfaction).
  const reservationRoom = Math.max(reservationPrice - marginFloorPrice, 0);
  const surplus = Math.max(reservationPrice - realizedPrice, 0);
  const priceSatisfaction =
    reservationRoom > 0 ? Math.min(surplus / reservationRoom, 1) : 0;
  // Closing framing boost: a skilled closer actively reframes value for price-focused
  // customers at the decision moment, lifting objectiveDeal independently of price.
  // Scales with both closing effectiveness and sensitivity — irrelevant when sensitivity=0.
  const framingBoost =
    closingComposite.effectiveness * priceSensitivity * p.framingWeight;
  const objectiveDeal = clampUnit(
    (1 - priceSensitivity) * meters.value +
      priceSensitivity * priceSatisfaction +
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
      askingPrice,
      marketPrice,
      vehicleCost,
      closingComposite,
      reservationPrice,
      requiredDiscount,
      marginFloorPrice,
      rawPrice,
    },
  };
}

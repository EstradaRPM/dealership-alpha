import {
  loadBrandTiersConfig,
  type BookValueFn,
  type BrandTiersConfig,
  type MarketPriceFn,
  type PricedVehicleInput,
  type VehicleCostFn,
} from '../SalesProcess';
import {
  computeAnchor,
  type AnchorDeps,
  type AnchorVehicleInput,
} from './anchor';
import {
  NEUTRAL_PERSONALITY,
  personalityBiasFor,
  type MarketPersonalityVector,
} from './personality';
import {
  loadMarketMarkupConfig,
  type MarketMarkupConfig,
} from './schemas';

/**
 * Full structural input the live providers consume. Inventory's `LotVehicle`
 * satisfies it; tests using the seam-narrow `PricedVehicleInput` shape route
 * through the static stubs in `SalesProcess/seams.ts` instead.
 *
 * The seam types (`MarketPriceFn` / `BookValueFn` / `VehicleCostFn`) only
 * declare `PricedVehicleInput`. The composition root is the runtime contract:
 * it only wires these live providers where a richer vehicle is guaranteed
 * (StaffFloorDrain, where the input is always a `LotVehicle`). The cast below
 * is documented as that contract — do not pass `PricedVehicleInput`-narrow
 * values to live providers; pass the static stubs in `seams.ts` instead.
 */
export type MarketVehicleInput = PricedVehicleInput & AnchorVehicleInput;

export interface ProvidersDeps extends AnchorDeps {
  readonly markupConfig?: MarketMarkupConfig;
  readonly brandTiers?: BrandTiersConfig;
  /**
   * Per-save hidden personality (slice #156). Omit for the neutral
   * (population-mean) world used by the calibration test and the static-stub
   * fixtures. Future slices layer comp drift + active shocks on top of this.
   */
  readonly personality?: MarketPersonalityVector;
}

function markupFor(
  vehicle: AnchorVehicleInput,
  markup: MarketMarkupConfig,
  brandTiers: BrandTiersConfig,
): number {
  const segmentTable = markup.markups[vehicle.category];
  if (!segmentTable) {
    throw new Error(
      `MarketEconomy: missing markup table for category="${vehicle.category}"`,
    );
  }
  const tier = brandTiers.makes[vehicle.make] ?? 'mainstream';
  const m = (segmentTable as Record<string, number | undefined>)[tier];
  if (m === undefined) {
    throw new Error(
      `MarketEconomy: missing markup for (category="${vehicle.category}", tier="${tier}")`,
    );
  }
  return m;
}

export interface LiveProviders {
  readonly bookValueFn: BookValueFn;
  readonly marketPriceFn: MarketPriceFn;
  readonly vehicleCostFn: VehicleCostFn;
}

/**
 * Composes the three providers against the closed-form anchor. SegmentHeat is
 * a `0` placeholder (slice #157 wires the live composer). `vehicleCostFn`
 * stays as `purchasePrice + reconCost` — design-locked unchanged.
 */
export function createProviders(deps: ProvidersDeps = {}): LiveProviders {
  const markup = deps.markupConfig ?? loadMarketMarkupConfig();
  const brandTiers = deps.brandTiers ?? loadBrandTiersConfig();
  const personality = deps.personality ?? NEUTRAL_PERSONALITY;
  const anchorDeps: AnchorDeps = { ...deps, brandTiers };

  // segmentHeat(v) = personalityBias(category) + 0 (#157 adds drift + shocks)
  const segmentHeat = (v: AnchorVehicleInput): number =>
    personalityBiasFor(personality, v.category);

  const bookValueFn: BookValueFn = (v) => {
    const wide = v as MarketVehicleInput;
    return computeAnchor(wide, anchorDeps) * (1 + segmentHeat(wide));
  };

  const marketPriceFn: MarketPriceFn = (v) => {
    const wide = v as MarketVehicleInput;
    const book = computeAnchor(wide, anchorDeps) * (1 + segmentHeat(wide));
    return Math.round(book * markupFor(wide, markup, brandTiers));
  };

  const vehicleCostFn: VehicleCostFn = (v) => v.purchasePrice + v.reconCost;

  return { bookValueFn, marketPriceFn, vehicleCostFn };
}

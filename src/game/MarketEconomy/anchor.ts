import { loadBrandTiersConfig, type BrandTiersConfig } from '../SalesProcess';
import {
  loadMarketAnchorConfig,
  loadMarketConditionModsConfig,
  loadMarketDepreciationCurvesConfig,
  loadMarketSegmentFallbackConfig,
  type MarketAnchorConfig,
  type MarketConditionModsConfig,
  type MarketDepreciationCurvesConfig,
  type MarketSegmentFallbackConfig,
} from './schemas';

/**
 * Narrow structural shape the anchor engine reads. Inventory's `LotVehicle`
 * and `AuctionListing` satisfy this without an explicit Inventory dependency
 * — MarketEconomy stays decoupled.
 *
 * Slice #156 makes `mileage` load-bearing: it enters the anchor formula via
 * the mileage curve (per-curveType `per10kMileageDepreciation` discount
 * relative to `referenceMileage`). Trucks tolerate mileage better than sedans.
 */
export interface AnchorVehicleInput {
  readonly templateId: string;
  /** Opaque canonical brand id — the brand-tier join key (never a display make). */
  readonly brand: string;
  readonly year: number;
  readonly mileage: number;
  readonly category: string;
  readonly condition: 'clean' | 'average' | 'rough';
}

export interface AnchorDeps {
  readonly anchorConfig?: MarketAnchorConfig;
  readonly fallbackConfig?: MarketSegmentFallbackConfig;
  readonly curvesConfig?: MarketDepreciationCurvesConfig;
  readonly conditionConfig?: MarketConditionModsConfig;
  readonly brandTiers?: BrandTiersConfig;
}

interface ResolvedAnchorEntry {
  readonly baseAnchor: number;
  readonly curveType: string;
}

function resolveAnchorEntry(
  v: AnchorVehicleInput,
  anchor: MarketAnchorConfig,
  fallback: MarketSegmentFallbackConfig,
  brandTiers: BrandTiersConfig,
): ResolvedAnchorEntry {
  const perTemplate = anchor.templates[v.templateId];
  if (perTemplate) return perTemplate;

  const segmentTable = fallback.fallbacks[v.category] as
    | Record<string, ResolvedAnchorEntry>
    | undefined;
  const tier = brandTiers.brands[v.brand] ?? 'mainstream';
  const entry = segmentTable?.[tier];
  if (!entry) {
    throw new Error(
      `MarketEconomy: no anchor for templateId="${v.templateId}" and no fallback for (category="${v.category}", tier="${tier}")`,
    );
  }
  return entry;
}

interface CurveShape {
  perYearDepreciation: number;
  floor: number;
  per10kMileageDepreciation: number;
  mileageFloor: number;
}

function resolveCurve(
  curveType: string,
  curves: MarketDepreciationCurvesConfig,
): CurveShape {
  const shape = (curves.curves as Record<string, CurveShape | undefined>)[curveType];
  if (!shape) {
    throw new Error(`MarketEconomy: missing depreciation curve "${curveType}"`);
  }
  return shape;
}

function yearCurveMultiplier(
  vehicleYear: number,
  shape: CurveShape,
  referenceYear: number,
): number {
  const age = Math.max(0, referenceYear - vehicleYear);
  const mult = 1 - shape.perYearDepreciation * age;
  return mult < shape.floor ? shape.floor : mult;
}

function mileageCurveMultiplier(
  mileage: number,
  shape: CurveShape,
  referenceMileage: number,
): number {
  const overage = Math.max(0, mileage - referenceMileage);
  const tenKs = overage / 10_000;
  const mult = 1 - shape.per10kMileageDepreciation * tenKs;
  return mult < shape.mileageFloor ? shape.mileageFloor : mult;
}

function conditionMultiplier(
  condition: AnchorVehicleInput['condition'],
  mods: MarketConditionModsConfig,
): number {
  const m = mods.modifiers[condition];
  if (m === undefined) {
    throw new Error(`MarketEconomy: missing condition modifier "${condition}"`);
  }
  return m;
}

/**
 * Pure, deterministic closed-form anchor — no RNG, no segment heat (slice #155
 * placeholder of 0). Slice #157 wraps this with the live segmentHeat composer.
 *
 *   anchor = baseAnchor(template OR segment×tier fallback)
 *          × yearCurve(yearAge, curveType)
 *          × conditionMod(condition)
 */
export function computeAnchor(
  vehicle: AnchorVehicleInput,
  deps: AnchorDeps = {},
): number {
  const anchorCfg = deps.anchorConfig ?? loadMarketAnchorConfig();
  const fallbackCfg = deps.fallbackConfig ?? loadMarketSegmentFallbackConfig();
  const curvesCfg = deps.curvesConfig ?? loadMarketDepreciationCurvesConfig();
  const conditionCfg = deps.conditionConfig ?? loadMarketConditionModsConfig();
  const brandTiersCfg = deps.brandTiers ?? loadBrandTiersConfig();

  const entry = resolveAnchorEntry(vehicle, anchorCfg, fallbackCfg, brandTiersCfg);
  const shape = resolveCurve(entry.curveType, curvesCfg);
  return (
    entry.baseAnchor *
    yearCurveMultiplier(vehicle.year, shape, curvesCfg.referenceYear) *
    mileageCurveMultiplier(vehicle.mileage, shape, curvesCfg.referenceMileage) *
    conditionMultiplier(vehicle.condition, conditionCfg)
  );
}

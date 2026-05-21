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
 * Mileage is reserved for slice #156; the v1 anchor uses
 * baseAnchor × yearCurve × conditionMod.
 */
export interface AnchorVehicleInput {
  readonly templateId: string;
  readonly make: string;
  readonly year: number;
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
  const tier = brandTiers.makes[v.make] ?? 'mainstream';
  const entry = segmentTable?.[tier];
  if (!entry) {
    throw new Error(
      `MarketEconomy: no anchor for templateId="${v.templateId}" and no fallback for (category="${v.category}", tier="${tier}")`,
    );
  }
  return entry;
}

function yearCurveMultiplier(
  vehicleYear: number,
  curveType: string,
  curves: MarketDepreciationCurvesConfig,
): number {
  const shape = (curves.curves as Record<string, { perYearDepreciation: number; floor: number } | undefined>)[curveType];
  if (!shape) {
    throw new Error(`MarketEconomy: missing depreciation curve "${curveType}"`);
  }
  const age = Math.max(0, curves.referenceYear - vehicleYear);
  const mult = 1 - shape.perYearDepreciation * age;
  return mult < shape.floor ? shape.floor : mult;
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
  return (
    entry.baseAnchor *
    yearCurveMultiplier(vehicle.year, entry.curveType, curvesCfg) *
    conditionMultiplier(vehicle.condition, conditionCfg)
  );
}

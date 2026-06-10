import {
  loadVehicleSpacedConfig,
  loadBrandTiersConfig,
  type VehicleSpacedConfig,
  type BrandTiersConfig,
} from './salesProcessData';

export type SpacedAxis =
  | 'safety'
  | 'performance'
  | 'appearance'
  | 'comfort'
  | 'economy'
  | 'dependability';

export type SpacedVector = Readonly<Record<SpacedAxis, number>>;

const AXES: readonly SpacedAxis[] = [
  'safety',
  'performance',
  'appearance',
  'comfort',
  'economy',
  'dependability',
];

/**
 * Narrow structural input the accessor needs. Inventory's `LotVehicle` /
 * `AuctionListing` satisfy this without an explicit dependency, keeping
 * SalesProcess decoupled from Inventory internals.
 */
export interface SpacedVehicleInput {
  readonly category: string;
  readonly templateId: string;
  /** Opaque canonical brand id — the brand-tier join key (never a display make). */
  readonly brand: string;
  readonly year: number;
}

export interface VehicleSpacedDeps {
  readonly vehicleSpacedConfig?: VehicleSpacedConfig;
  readonly brandTiersConfig?: BrandTiersConfig;
}

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

/**
 * Resolve a vehicle's SPACED vector: spine + two modifiers (PRD #85 decision 6).
 *
 * Layers, in order:
 *  1. category base vector (the spine)
 *  2. per-template overrides — replace the named axes (new templates inherit
 *     the category base by having no override entry)
 *  3. brand-tier modifier — additive delta keyed by brand id → tier (unknown
 *     brand contributes no modifier)
 *  4. deterministic, bounded year modifier — `(year − referenceYear)` scaled by
 *     per-axis perYearDelta, each axis clamped to ±maxAbs
 *
 * Every axis of the result is clamped to [0, 1]. Pure: same input → same output.
 */
export function vehicleSpaced(
  vehicle: SpacedVehicleInput,
  deps: VehicleSpacedDeps = {},
): SpacedVector {
  const cfg = deps.vehicleSpacedConfig ?? loadVehicleSpacedConfig();
  const brands = deps.brandTiersConfig ?? loadBrandTiersConfig();

  const base = cfg.categoryBase[vehicle.category];
  if (base === undefined) {
    throw new Error(
      `vehicleSpaced: no category base for "${vehicle.category}"`,
    );
  }

  const result: Record<SpacedAxis, number> = { ...base };

  // Layer 2: per-template override (replace specified axes).
  const override = cfg.templateOverrides[vehicle.templateId];
  if (override !== undefined) {
    for (const axis of AXES) {
      const v = override[axis];
      if (v !== undefined) result[axis] = v;
    }
  }

  // Layer 3: brand-tier additive modifier (unknown brand → no tier).
  const tierName = brands.brands[vehicle.brand];
  if (tierName !== undefined) {
    const tierMod = brands.tiers[tierName].modifier;
    for (const axis of AXES) {
      const v = tierMod[axis];
      if (v !== undefined) result[axis] += v;
    }
  }

  // Layer 4: deterministic, bounded year modifier.
  const { referenceYear, perYearDelta, maxAbs } = cfg.yearModifier;
  const yearGap = vehicle.year - referenceYear;
  for (const axis of AXES) {
    const per = perYearDelta[axis];
    if (per !== undefined) {
      result[axis] += clamp(per * yearGap, -maxAbs, maxAbs);
    }
  }

  for (const axis of AXES) {
    result[axis] = clamp(result[axis], 0, 1);
  }

  return result;
}

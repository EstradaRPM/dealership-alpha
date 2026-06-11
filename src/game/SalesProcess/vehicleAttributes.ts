import {
  loadVehicleSpacedConfig,
  type VehicleSpacedConfig,
} from './salesProcessData';
import type { SpacedVehicleInput } from './vehicleSpaced';

/**
 * Vehicle ATTRIBUTE axes (#231 S4) — the across-the-board physical traits that
 * honest real-world weather nuance rides, complementing the 6 persona-driven
 * SPACED axes. Unit-scaled:
 *  - `winterCapability` — drivetrain (AWD/4WD) + ground clearance; high for
 *    trucks/SUVs, low for sedans. Snow/storm/winter demand leans toward it.
 *  - `openAir` — convertible / open-top body sub-type; ~0 across the current
 *    closed-body inventory, lifted by summer demand. The schema is in place so a
 *    future convertible template responds with no code change.
 *  - `fuelEfficiency` — fuel economy; high for small sedans, low for trucks.
 *    Spring (tax-refund) + summer demand leans toward it.
 *
 * These are *vehicle* attributes (what the unit is), distinct from the
 * persona-SPACED axes (what a buyer innately wants). Weather creates a transient
 * demand lean over them in the match; the persona match is untouched.
 */
export type AttributeAxis = 'winterCapability' | 'openAir' | 'fuelEfficiency';

export type AttributeVector = Readonly<Record<AttributeAxis, number>>;

export const ATTRIBUTE_AXES: readonly AttributeAxis[] = [
  'winterCapability',
  'openAir',
  'fuelEfficiency',
];

export interface VehicleAttributesDeps {
  readonly vehicleSpacedConfig?: VehicleSpacedConfig;
}

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

/**
 * Resolve a vehicle's attribute vector (#231 S4): category base → per-template
 * override (replace named axes; unknown template inherits the base) → clamp to
 * [0,1]. Pure: same input → same output. No brand/year modifiers — these are
 * physical traits of the platform, not perception or wear (unlike SPACED). The
 * input is the same narrow `SpacedVehicleInput` the SPACED accessor takes, so
 * Inventory's `LotVehicle` satisfies it structurally.
 */
export function vehicleAttributes(
  vehicle: SpacedVehicleInput,
  deps: VehicleAttributesDeps = {},
): AttributeVector {
  const cfg = deps.vehicleSpacedConfig ?? loadVehicleSpacedConfig();

  const base = cfg.attributeBase[vehicle.category];
  if (base === undefined) {
    throw new Error(
      `vehicleAttributes: no attribute base for "${vehicle.category}"`,
    );
  }

  const result: Record<AttributeAxis, number> = { ...base };

  const override = cfg.attributeOverrides[vehicle.templateId];
  if (override !== undefined) {
    for (const axis of ATTRIBUTE_AXES) {
      const v = override[axis];
      if (v !== undefined) result[axis] = v;
    }
  }

  for (const axis of ATTRIBUTE_AXES) {
    result[axis] = clamp(result[axis], 0, 1);
  }

  return result;
}

/** Neutral attribute level — a lean rewards/penalizes deviation from this. */
export const ATTRIBUTE_NEUTRAL = 0.5;

/**
 * The weather demand bonus a vehicle earns for the day's attribute lean (#231
 * S4): `Σ_axis lean[axis] · (attr[axis] − neutral)`. A vehicle above neutral on
 * a positively-leaned axis scores higher (AWD on a snow day); a negative lean
 * (winter → openAir) penalizes high-attribute units symmetrically. Exactly 0
 * when the lean is empty, so calm days and lean-less callers are behavior-neutral.
 * Magnitude lives entirely in the (data-driven) lean deltas — no code weight.
 */
export function weatherAttributeBonus(
  lean: Readonly<Record<string, number>>,
  attrs: AttributeVector,
): number {
  let sum = 0;
  for (const axis of Object.keys(lean) as AttributeAxis[]) {
    const v = attrs[axis];
    if (v !== undefined) sum += lean[axis] * (v - ATTRIBUTE_NEUTRAL);
  }
  return sum;
}

import { loadVehicleSpacedConfig, type VehicleSpacedConfig } from './salesProcessData';
import type { SpacedAxis, SpacedVector } from './vehicleSpaced';

export type VehicleCategory = 'sedan' | 'truck' | 'suv';

const CATEGORIES: readonly VehicleCategory[] = ['sedan', 'truck', 'suv'];

export interface WantedCategoryDeps {
  readonly vehicleSpacedConfig?: VehicleSpacedConfig;
}

function squaredDistance(a: SpacedVector, b: SpacedVector): number {
  let sum = 0;
  for (const axis of Object.keys(a) as SpacedAxis[]) {
    const d = a[axis] - b[axis];
    sum += d * d;
  }
  return sum;
}

/**
 * The vehicle category whose SPACED reference vector (`vehicle-spaced.json`
 * `categoryBase`) is nearest the customer's want-vector (#321 walk-off
 * reactions) — a "what they wanted" label derivable even when no vehicle was
 * ever matched (e.g. a `no_fit` walk-off). Nearest by squared Euclidean
 * distance; ties break by `CATEGORIES` declaration order. Pure, deterministic.
 */
export function wantedVehicleCategory(
  customerSpaced: SpacedVector,
  deps: WantedCategoryDeps = {},
): VehicleCategory {
  const cfg = deps.vehicleSpacedConfig ?? loadVehicleSpacedConfig();
  let best: VehicleCategory = CATEGORIES[0];
  let bestDist = Infinity;
  for (const category of CATEGORIES) {
    const base = cfg.categoryBase[category];
    if (base === undefined) continue;
    const dist = squaredDistance(customerSpaced, base);
    if (dist < bestDist) {
      bestDist = dist;
      best = category;
    }
  }
  return best;
}

import type { LotVehicle } from './game/Inventory';
import type { Tunables } from './game/data';

type DemandModelConfig = Tunables['demandModel'];

/**
 * Composite controllable-lever traffic multiplier (#128a), computed behind
 * the locked #125 `DemandSource` seam and ridden on `pricing.trafficMultiplier`
 * so FloorSim's #99 contract takes only the single projected `demandFactor`.
 *
 * Current inputs: inventory depth (Hill-saturating — an empty lot draws nobody) ×
 * inventory quality (avg condition desirability). Pricing/marketing slot into
 * this same composite later with zero further #99/#125 changes. All numbers
 * are tunables (`data/tunables.json` → `demandModel`).
 */
export function computeDemandFactor(
  lot: readonly LotVehicle[],
  cfg: DemandModelConfig,
): number {
  const stock = lot.length;
  if (stock === 0) return 0;

  const depthSat = stock / (stock + cfg.inventoryHalfSat);

  const totalWeight = lot.reduce(
    (sum, v) => sum + cfg.conditionWeight[v.condition],
    0,
  );
  const avgWeight = totalWeight / stock;
  const qualityMult =
    cfg.qualityMultMin +
    (cfg.qualityMultMax - cfg.qualityMultMin) * avgWeight;

  const factor = depthSat * qualityMult;
  return factor < 0 ? 0 : factor > cfg.demandFactorMax ? cfg.demandFactorMax : factor;
}

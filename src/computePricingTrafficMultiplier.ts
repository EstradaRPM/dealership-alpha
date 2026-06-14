import type { LotVehicle } from './game/Inventory';

/**
 * Price → arrivals seam (#277, Pricing/Demand spine S5).
 *
 * The multiplier by which the player's price posture scales FloorSim arrival
 * VOLUME. It rides the same locked #125 `pricing.trafficMultiplier` composite as
 * the inventory-depth `demandFactor` and the weather rider — so FloorSim's #99
 * contract still takes only the single projected `demandFactor`, and the macro
 * boundary "marketing/pricing never enter arrivals" is reopened to admit pricing
 * as a demand input (`docs/planning/pricing-demand-spine.md` Pillars 1+4, §7).
 *
 * **Ships at identity.** With `weight = 0` (the S5 default in
 * `data/tunables.json` → `demandModel.pricingTrafficWeight`) or no per-vehicle
 * response injected, this returns exactly `1` — zero behavior change, existing
 * arrival draws byte-identical. The seam is wired; the curve is not yet armed.
 *
 * When the calibration slice arms it (raises the weight and injects
 * `vehicleResponse`), the response MUST come from MarketEconomy's shared
 * `demandMultiplier` (the ONE price-elasticity model, #276 / Pillar 3 — "one
 * model, two consumers"), NOT a second curve reimplemented here. The lot-wide
 * mean of the per-vehicle response is blended toward identity by `weight`, so a
 * partial weight eases pricing's grip on volume during balancing.
 *
 * Pure and deterministic: same lot + config → same output, no RNG, no state.
 */
export interface PricingDemandConfig {
  /**
   * How strongly the lot-wide price-posture response bends arrival volume.
   * `0` ⇒ identity (no pricing effect on traffic — the S5 ship default); `1` ⇒
   * the raw mean response drives volume; in-between eases the grip for
   * calibration.
   */
  readonly weight: number;
}

export function computePricingTrafficMultiplier(
  lot: readonly LotVehicle[],
  cfg: PricingDemandConfig,
  /**
   * Per-vehicle relative demand response to its price posture — `1` neutral,
   * `<1` over-priced (slower), `>1` under-priced (faster). Injected by the
   * composition root from MarketEconomy's shared `demandMultiplier` once the
   * calibration slice arms the seam. Omitted ⇒ identity.
   */
  vehicleResponse?: (vehicle: LotVehicle) => number,
): number {
  if (cfg.weight === 0 || lot.length === 0 || !vehicleResponse) return 1;

  const meanResponse =
    lot.reduce((sum, vehicle) => sum + vehicleResponse(vehicle), 0) / lot.length;
  const blended = 1 + cfg.weight * (meanResponse - 1);
  return blended < 0 ? 0 : blended;
}

import {
  loadBodyShopManagerConfig,
  type BodyShopManagerConfig,
} from './bodyShopManagerConfig';

/**
 * Body-shop-manager automation engine (#316, parent PRD #297).
 *
 * The Tier-3 mirror of the service-manager engine (`serviceManager.ts`): a
 * sufficiently-skilled body-shop manager progressively takes over the standing
 * Body-Shop decisions the player otherwise runs by hand — par tuning, the
 * insurance↔retail channel posture, and the capacity-aware rush-vs-walk call.
 * Each function unlocks when the on-staff manager's `shop_throughput` clears that
 * function's gate (a ladder, so automation engages one function at a time as the
 * manager grows), exactly as each service-manager function gates on
 * `managerGates.bodyShopManager.actThresholds`.
 *
 * The Body Shop has ONE pricing/marketing lever — the channel posture — because
 * the locked satellite table defines Body-Shop marketing as "channel choice (no
 * separate mailer arms)". So the single `channel` function is the unified
 * pricing+marketing decision; there is no separate marketing engine to mirror
 * Service's retention/conquest arms.
 *
 * Pure + deterministic. The composition root resolves the live readouts
 * (BodyShopInsights demand heat, Reputation, the live capacity read-model) and the
 * per-function gate (top manager `shop_throughput` vs
 * `managerGates.bodyShopManager.actThresholds`); this module turns those into the
 * standing setpoints + the rush decision. The manager skill is constant within a
 * day, the readouts are themselves replay-deterministic, and the morning setpoints
 * are applied once at `day_started` — so a fixed seed replays byte-identically
 * (#122/#317).
 *
 * Below a function's gate (or with no manager on staff) the player keeps manual
 * control of that function — no behavior change.
 */

/** The four manager-automatable Body-Shop functions, each with its own gate. */
export type BodyShopManagerFunction = 'par' | 'channel' | 'rush' | 'capacity';

export interface BodyShopManagerDeps {
  readonly config?: BodyShopManagerConfig;
}

function resolveConfig(deps?: BodyShopManagerDeps): BodyShopManagerConfig {
  return deps?.config ?? loadBodyShopManagerConfig();
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Whether the body-shop manager may act on a Body-Shop function (#316) — gated on
 * the top on-staff manager's `shop_throughput` clearing that function's act
 * threshold, mirroring `isServiceFunctionAutomated`. Below the gate (or no manager,
 * `skill == null`) the player runs the function by hand. Pure; the composition
 * root supplies the top manager skill (roster) + threshold
 * (`tunables.managerGates.bodyShopManager.actThresholds[fn]`).
 */
export function isBodyShopFunctionAutomated(
  shopThroughputSkill: number | null,
  threshold: number,
): boolean {
  return shopThroughputSkill != null && shopThroughputSkill >= threshold;
}

// ---------------------------------------------------------------------------
// Par tuning
// ---------------------------------------------------------------------------

/** One collision category reduced to the trailing demand signal par tuning reads. */
export interface BodyShopParInput {
  readonly category: string;
  /** Trailing intake demand (the BodyShopInsights demand-heat window count). */
  readonly demand: number;
}

/** A computed procurement-policy setpoint the manager writes to PartsInventory. */
export interface BodyShopParSetpoint {
  readonly category: string;
  readonly reorderPoint: number;
  readonly target: number;
}

/**
 * Demand-driven par tuning over the collision categories. Each category's `target`
 * covers `targetCoverDays` of trailing demand and its `reorderPoint` covers
 * `reorderCoverDays` (capped at target), each floored at the configured minimum so
 * a cold/empty window still keeps a thin buffer. Monotonic in demand — more demand
 * never lowers par. Identical shape to `autoServicePar`; reads its own Body-Shop
 * config so the two departments tune independently.
 */
export function autoBodyShopPar(
  rows: readonly BodyShopParInput[],
  deps?: BodyShopManagerDeps,
): BodyShopParSetpoint[] {
  const { par } = resolveConfig(deps);
  return rows.map((row) => {
    const demand = Math.max(0, row.demand);
    const target = Math.max(par.minTarget, Math.ceil(demand * par.targetCoverDays));
    const reorderPoint = Math.min(
      target,
      Math.max(par.minReorderPoint, Math.ceil(demand * par.reorderCoverDays)),
    );
    return { category: row.category, reorderPoint, target };
  });
}

// ---------------------------------------------------------------------------
// Channel posture (the unified pricing + marketing lever)
// ---------------------------------------------------------------------------

/**
 * Reputation-driven insurance↔retail channel posture in `[0,1]` (0 = full
 * insurance-DRP lean, 1 = full retail customer-pay). The Body Shop's single
 * pricing+marketing decision: a strong reputation lets the manager lean into
 * retail (win + price up fatter customer-pay work without driving it away); a weak
 * one stays on rate-capped insurance volume to keep the bays fed. Monotonic
 * non-decreasing in reputation; clamped to `[minPosture, maxPosture]`. Mirrors
 * `autoServicePosture` mathematically — the difference is purely semantic (which
 * channel, not how premium).
 */
export function autoBodyShopChannelPosture(
  reputation01: number,
  deps?: BodyShopManagerDeps,
): number {
  const { channel } = resolveConfig(deps);
  const span = channel.reputationCeil - channel.reputationFloor;
  const t =
    span <= 0
      ? reputation01 >= channel.reputationCeil
        ? 1
        : 0
      : clamp01((reputation01 - channel.reputationFloor) / span);
  return clamp01(
    channel.minPosture + t * (channel.maxPosture - channel.minPosture),
  );
}

// ---------------------------------------------------------------------------
// Rush-vs-walk (capacity-aware)
// ---------------------------------------------------------------------------

export interface ShouldRushBodyShopInput {
  /** Live shop utilization `[0,1]` from the capacity read-model. */
  readonly utilization: number;
  /** Whether the capacity function is also automated (the higher gate). When
   *  false the manager simply keeps customers (always rush); when true the call
   *  becomes capacity-aware. */
  readonly capacityAware: boolean;
}

/**
 * The manager's rush-vs-walk call on a parts miss. With only the rush function
 * automated the manager always rush-orders to keep the customer (it IS the
 * operational maturity the tier gate otherwise stands in for). Once the capacity
 * function is also automated the call balances against the live bay/advisor floor:
 * rush only while the shop has slack (utilization below the ceiling), else walk the
 * job rather than overcommit a slammed shop. Pure. Mirrors `shouldRush`.
 */
export function shouldRushBodyShop(
  input: ShouldRushBodyShopInput,
  deps?: BodyShopManagerDeps,
): boolean {
  if (!input.capacityAware) return true;
  const { capacity } = resolveConfig(deps);
  return input.utilization < capacity.utilizationRushCeiling;
}

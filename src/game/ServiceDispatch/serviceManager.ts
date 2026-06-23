import {
  loadServiceManagerConfig,
  type ServiceManagerConfig,
} from './serviceManagerData';

/**
 * Service-manager automation engine (#310, parent PRD #297).
 *
 * The Service-side mirror of the channel-desk manager model (UCM/NCM/GM): a
 * sufficiently-skilled service manager progressively takes over the standing
 * Service decisions the player otherwise runs by hand — par tuning, pricing
 * posture, marketing arms, and the capacity-aware rush-vs-walk call. Each
 * function unlocks when the on-staff SM's `shop_throughput` clears that
 * function's gate (a ladder, so automation engages one function at a time as the
 * manager grows), exactly as each channel-desk capability gates on its own skill
 * axis crossing `managerGates.actThresholds`.
 *
 * Pure + deterministic. The composition root resolves the live readouts
 * (ServiceInsights demand heat / base health, PartsInventory stock, Reputation,
 * the live capacity read-model) and the per-function gate (top SM
 * `shop_throughput` vs `managerGates.serviceManager.actThresholds`); this module
 * turns those into the standing setpoints + the rush decision. The SM skill is
 * constant within a day (channel-desk M7), the readouts are themselves
 * replay-deterministic, and the morning setpoints are applied once at
 * `day_started` — so a fixed seed replays byte-identically (#122).
 *
 * Below a function's gate (or with no SM on staff) the player keeps manual
 * control of that function — no behavior change, mirroring the channel-desk
 * "suggestion-only" floor.
 */

/** The five SM-automatable Service functions, each with its own gate. */
export type ServiceManagerFunction =
  | 'par'
  | 'pricing'
  | 'marketing'
  | 'rush'
  | 'capacity';

export interface ServiceManagerDeps {
  readonly config?: ServiceManagerConfig;
}

function resolveConfig(deps?: ServiceManagerDeps): ServiceManagerConfig {
  return deps?.config ?? loadServiceManagerConfig();
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Whether the service manager may act on a Service function (#310) — gated on the
 * top on-staff SM's `shop_throughput` clearing that function's act threshold,
 * mirroring `isAutoPricingUnlocked` (channel-desk M2). Below the gate (or no SM,
 * `skill == null`) the player runs the function by hand. Pure; the composition
 * root supplies the top SM skill (roster) + threshold
 * (`tunables.managerGates.serviceManager.actThresholds[fn]`).
 */
export function isServiceFunctionAutomated(
  shopThroughputSkill: number | null,
  threshold: number,
): boolean {
  return shopThroughputSkill != null && shopThroughputSkill >= threshold;
}

// ---------------------------------------------------------------------------
// Par tuning
// ---------------------------------------------------------------------------

/** One parts category reduced to the trailing demand signal par tuning reads. */
export interface ServiceParInput {
  readonly category: string;
  /** Trailing intake demand (the ServiceInsights window ticket count). */
  readonly demand: number;
}

/** A computed procurement-policy setpoint the SM writes back to PartsInventory. */
export interface ServiceParSetpoint {
  readonly category: string;
  readonly reorderPoint: number;
  readonly target: number;
}

/**
 * Demand-driven par tuning. Each category's `target` covers `targetCoverDays` of
 * trailing demand and its `reorderPoint` covers `reorderCoverDays` (capped at
 * target), each floored at the configured minimum so a cold/empty window still
 * keeps a thin buffer. Monotonic in demand — more demand never lowers par.
 */
export function autoServicePar(
  rows: readonly ServiceParInput[],
  deps?: ServiceManagerDeps,
): ServiceParSetpoint[] {
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
// Pricing posture
// ---------------------------------------------------------------------------

/**
 * Reputation-driven pricing posture in `[0,1]` (competitive↔premium). A strong
 * reputation sustains a premium labor/markup posture without driving owners away;
 * a weak one stays competitive to protect retention. Monotonic non-decreasing in
 * reputation; clamped to `[minPosture, maxPosture]`.
 */
export function autoServicePosture(
  reputation01: number,
  deps?: ServiceManagerDeps,
): number {
  const { posture } = resolveConfig(deps);
  const span = posture.reputationCeil - posture.reputationFloor;
  const t =
    span <= 0
      ? reputation01 >= posture.reputationCeil
        ? 1
        : 0
      : clamp01((reputation01 - posture.reputationFloor) / span);
  return clamp01(posture.minPosture + t * (posture.maxPosture - posture.minPosture));
}

// ---------------------------------------------------------------------------
// Marketing arms
// ---------------------------------------------------------------------------

/** Narrowed base-health read the marketing decision needs (forward churn). */
export interface ServiceMarketingHealth {
  readonly size: number;
  readonly atRiskCount: number;
  readonly churnTrend: 'rising' | 'steady' | 'falling';
}

/** One parts category's stock-vs-demand the conquest arm reads to clear stock. */
export interface ServiceMarketingCoverage {
  readonly category: string;
  readonly demand: number;
  readonly onHand: number;
}

export interface AutoServiceMarketingInput {
  readonly health: ServiceMarketingHealth;
  readonly coverage: readonly ServiceMarketingCoverage[];
  /** The retention campaign the SM enables when churn pressure is high
   *  (resolved by the composition root from the available campaigns). */
  readonly retentionCampaignId: string;
}

/** The two marketing-arm selections the SM writes back to ServiceMarketing. */
export interface ServiceMarketingDecision {
  /** Retention campaign id, or `'none'` to clear the arm. */
  readonly retentionId: string;
  /** Conquest target job category, or `'none'` to clear the arm. */
  readonly conquestCategory: string;
}

/**
 * Base-health / over-stock-driven marketing. The SM runs the retention arm when
 * forward churn pressure is high (at-risk owner share over the trigger, or churn
 * already rising), and aims the conquest arm at the MOST over-stocked parts
 * category (`onHand / demand` over the trigger) to manufacture demand that clears
 * dead capital — the documented "clear over-stocked parts" use of the conquest
 * arm. Deterministic: ties broken by `PART_CATEGORIES`/input order.
 */
export function autoServiceMarketing(
  input: AutoServiceMarketingInput,
  deps?: ServiceManagerDeps,
): ServiceMarketingDecision {
  const { marketing } = resolveConfig(deps);
  const { health, coverage, retentionCampaignId } = input;

  const atRiskShare = health.size > 0 ? health.atRiskCount / health.size : 0;
  const retentionId =
    atRiskShare >= marketing.atRiskShareTrigger || health.churnTrend === 'rising'
      ? retentionCampaignId
      : 'none';

  let conquestCategory = 'none';
  let bestRatio = marketing.overstockRatioTrigger;
  for (const c of coverage) {
    if (c.onHand <= 0) continue;
    const ratio = c.onHand / Math.max(1, c.demand);
    if (ratio >= bestRatio && ratio > 0) {
      // `>=` with the trigger seed + strict input order ⇒ the first category to
      // reach the running best wins ties deterministically.
      if (ratio > bestRatio || conquestCategory === 'none') {
        bestRatio = ratio;
        conquestCategory = c.category;
      }
    }
  }

  return { retentionId, conquestCategory };
}

// ---------------------------------------------------------------------------
// Rush-vs-walk (capacity-aware)
// ---------------------------------------------------------------------------

export interface ShouldRushInput {
  /** Live shop utilization `[0,1]` from the capacity read-model. */
  readonly utilization: number;
  /** Whether the capacity function is also automated (the higher gate). When
   *  false the SM simply keeps customers (always rush); when true the call
   *  becomes capacity-aware. */
  readonly capacityAware: boolean;
}

/**
 * The SM's rush-vs-walk call on a parts miss. With only the rush function
 * automated the SM always rush-orders to keep the customer (it IS the
 * operational maturity that the tier gate otherwise stands in for). Once the
 * capacity function is also automated the call balances against the live
 * bay/advisor floor: rush only while the shop has slack (utilization below the
 * ceiling), else walk the job rather than overcommit a slammed shop. Pure.
 */
export function shouldRush(
  input: ShouldRushInput,
  deps?: ServiceManagerDeps,
): boolean {
  if (!input.capacityAware) return true;
  const { capacity } = resolveConfig(deps);
  return input.utilization < capacity.utilizationRushCeiling;
}

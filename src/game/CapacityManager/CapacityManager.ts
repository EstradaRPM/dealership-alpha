import type { EventBus } from '../EventBus';
import type { StaffOrg } from '../StaffOrg';
import { loadCapacityConfig, getStaffContribution, type CapacityConfig } from './capacityData';

export interface CapacityManagerDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  facilityTier?: 1 | 2 | 3;
  config?: CapacityConfig;
}

/**
 * Per-tick admittance seam consumed by FloorSim (the locked #99 `capacity`
 * seam). One gate instance is created per simulated day by the composition
 * root, snapshotting that day's capacity. Each tick FloorSim hands it the
 * tick's arrival count; the gate admits against the remaining daily budget
 * and turns away the overflow as a felt in-day walk. Per walked customer it
 * preserves the daily-gate domain semantics (capacity:missed_opportunity +
 * reputation:satisfaction_hit). Structurally matches FloorSim's CapacityGate.
 */
export interface CapacityFloorGate {
  /** Admit up to `arrivals` against remaining daily budget; emit a walk's
   *  domain consequences per overflow customer. Returns the count walked. */
  admit(arrivals: number, ctx: { day: number; tick: number }): number;
  /** Remaining daily admittance budget (drops as ticks admit). */
  remaining(): number;
}

/**
 * Which funnel transition lost the most customers today — enough signal for
 * the composition root to render a plain-language biggest-leak callout.
 *   'capacity'   — drove-by → walked-in (turned away at the gate)
 *   'engagement' — walked-in → staff-engaged (nobody worked them)
 *   'closing'    — staff-engaged → sold (engaged but didn't buy)
 *   'none'       — no traffic, or no measurable drop
 */
export type FunnelLeakCause = 'capacity' | 'engagement' | 'closing' | 'none';

/**
 * End-of-day customer funnel, derived purely from observed domain events.
 * Read-model only — no side effects, no FloorSim/#99 coupling.
 */
export interface DayFunnel {
  /** Drove-by: every customer offered to the admittance gate today. */
  potentialTraffic: number;
  /** Walked-in: admitted within the day's capacity. */
  walkedIn: number;
  /** A salesperson actually engaged the customer. */
  staffEngaged: number;
  /** Engagement resulted in a closed deal. */
  sold: number;
  /** The single biggest-leak transition for a plain-language callout. */
  leakCause: FunnelLeakCause;
}

export interface CapacityManager {
  getDailyCapacity(): number;
  getDailyArrivals(): number;
  getMissedCount(): number;
  /** Read-only end-of-day funnel: drove-by → walked-in → engaged → sold. */
  getDayFunnel(): DayFunnel;
  /** Create a per-day per-tick admittance gate for FloorSim to drive. */
  createFloorGate(): CapacityFloorGate;
}

export function createCapacityManager(deps: CapacityManagerDeps): CapacityManager {
  const { bus, staffOrg } = deps;
  const facilityTier = deps.facilityTier ?? 1;
  const config = deps.config ?? loadCapacityConfig();

  function computeCapacity(): number {
    const base = config.facilityTierBaseCapacity[String(facilityTier)] ?? 0;
    const staffBonus = staffOrg.currentRoster.reduce(
      (sum, s) => sum + getStaffContribution(s.role_id, config),
      0,
    );
    return base + staffBonus;
  }

  let dailyCapacity = computeCapacity();
  let dailyArrivals = 0;
  let missedCount = 0;
  let currentDay = 1;

  // Funnel read-model counters (reset each day with the rest).
  let funnelPotential = 0;
  let funnelWalkedIn = 0;
  let funnelStaffEngaged = 0;
  let funnelSold = 0;

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;
    dailyArrivals = 0;
    missedCount = 0;
    funnelPotential = 0;
    funnelWalkedIn = 0;
    funnelStaffEngaged = 0;
    funnelSold = 0;
    dailyCapacity = computeCapacity();
  });

  bus.subscribe('staff:auto_resolved', ({ outcome }) => {
    funnelStaffEngaged++;
    if (outcome === 'closed') funnelSold++;
  });

  bus.subscribe('customer:arrived', ({ day, customerId, label }) => {
    dailyArrivals++;
    funnelPotential++;
    if (dailyArrivals <= dailyCapacity) {
      funnelWalkedIn++;
      bus.publish('capacity:customer_admitted', { day, customerId, label });
    } else {
      missedCount++;
      bus.publish('capacity:missed_opportunity', { day, customerId, label });
      bus.publish('reputation:satisfaction_hit', {
        day,
        amount: config.missedOpportunitySatisfactionHit,
        reason: 'missed_opportunity',
      });
    }
  });

  function createFloorGate(): CapacityFloorGate {
    let budget = computeCapacity();
    return {
      remaining: () => budget,
      admit(arrivals, { day, tick }) {
        let walked = 0;
        for (let i = 0; i < arrivals; i++) {
          funnelPotential++;
          if (budget > 0) {
            budget--;
            funnelWalkedIn++;
          } else {
            const customerId = `floor-walk:${day}:${tick}:${i}`;
            const label = 'Walk-in';
            walked++;
            missedCount++;
            bus.publish('capacity:missed_opportunity', { day, customerId, label });
            bus.publish('reputation:satisfaction_hit', {
              day,
              amount: config.missedOpportunitySatisfactionHit,
              reason: 'missed_opportunity',
            });
          }
        }
        return walked;
      },
    };
  }

  function deriveLeakCause(): FunnelLeakCause {
    if (funnelPotential <= 0) return 'none';
    const capacityDrop = Math.max(0, funnelPotential - funnelWalkedIn);
    const engagementDrop = Math.max(0, funnelWalkedIn - funnelStaffEngaged);
    const closingDrop = Math.max(0, funnelStaffEngaged - funnelSold);
    const max = Math.max(capacityDrop, engagementDrop, closingDrop);
    if (max <= 0) return 'none';
    // Tie-break toward the earliest funnel stage (fix the leak nearest the top).
    if (capacityDrop === max) return 'capacity';
    if (engagementDrop === max) return 'engagement';
    return 'closing';
  }

  return {
    getDailyCapacity: () => dailyCapacity,
    getDailyArrivals: () => dailyArrivals,
    getMissedCount: () => missedCount,
    getDayFunnel: () => ({
      potentialTraffic: funnelPotential,
      walkedIn: funnelWalkedIn,
      staffEngaged: funnelStaffEngaged,
      sold: funnelSold,
      leakCause: deriveLeakCause(),
    }),
    createFloorGate,
  };
}

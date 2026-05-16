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

export interface CapacityManager {
  getDailyCapacity(): number;
  getDailyArrivals(): number;
  getMissedCount(): number;
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

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;
    dailyArrivals = 0;
    missedCount = 0;
    dailyCapacity = computeCapacity();
  });

  bus.subscribe('customer:arrived', ({ day, customerId, label }) => {
    dailyArrivals++;
    if (dailyArrivals <= dailyCapacity) {
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
          if (budget > 0) {
            budget--;
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

  return {
    getDailyCapacity: () => dailyCapacity,
    getDailyArrivals: () => dailyArrivals,
    getMissedCount: () => missedCount,
    createFloorGate,
  };
}

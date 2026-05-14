import type { EventBus } from '../EventBus';
import type { StaffOrg } from '../StaffOrg';
import { loadCapacityConfig, getStaffContribution, type CapacityConfig } from './capacityData';

export interface CapacityManagerDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  facilityTier?: 1 | 2 | 3;
  config?: CapacityConfig;
}

export interface CapacityManager {
  getDailyCapacity(): number;
  getDailyArrivals(): number;
  getMissedCount(): number;
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

  return {
    getDailyCapacity: () => dailyCapacity,
    getDailyArrivals: () => dailyArrivals,
    getMissedCount: () => missedCount,
  };
}

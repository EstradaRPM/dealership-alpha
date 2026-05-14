import type { EventBus } from '../EventBus';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadStaffMoraleConfig, type StaffMoraleConfig } from './staffMoraleData';

export interface StaffMoraleDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  masterSeed: number;
  config?: StaffMoraleConfig;
}

export interface StaffMorale {
  getMorale(staffId: string): number;
  getMoraleMultiplier(staffId: string): number;
  readonly snapshot: ReadonlyMap<string, number>;
}

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createStaffMorale(deps: StaffMoraleDeps): StaffMorale {
  const { bus, staffOrg, queue, masterSeed } = deps;
  const config = deps.config ?? loadStaffMoraleConfig();

  const moraleMap = new Map<string, number>();

  function get(staffId: string): number {
    return moraleMap.get(staffId) ?? config.defaultMorale;
  }

  function set(staffId: string, value: number): void {
    moraleMap.set(staffId, clamp(value, config.moraleFloor, config.moraleCeiling));
  }

  function adjust(staffId: string, delta: number): void {
    set(staffId, get(staffId) + delta);
  }

  bus.subscribe('staff:hired', ({ staffId }) => {
    moraleMap.set(staffId, config.defaultMorale);
  });

  bus.subscribe('staff:fired', ({ staffId }) => {
    moraleMap.delete(staffId);
  });

  bus.subscribe('staff:auto_resolved', ({ staffId, outcome }) => {
    if (outcome === 'closed') {
      adjust(staffId, config.recognitionBonus);
    }
  });

  // Workload drift: compare sales queue depth against capacity at end of day.
  bus.subscribe('clock:day_ended', () => {
    const salespeople = staffOrg.currentRoster.filter(s => s.role_id === 'salesperson');
    if (salespeople.length === 0) return;

    const queueDepth = queue.getBadgeCount('sales');
    const capacity = salespeople.length * config.workloadCapacityPerStaff;
    const delta = queueDepth > capacity ? config.workloadOverloadPenalty : config.workloadIdleBonus;

    for (const s of salespeople) {
      if (!moraleMap.has(s.id)) moraleMap.set(s.id, config.defaultMorale);
      adjust(s.id, delta);
    }
  });

  bus.subscribe('clock:overnight_payroll', () => {
    for (const s of staffOrg.currentRoster) {
      if (!moraleMap.has(s.id)) moraleMap.set(s.id, config.defaultMorale);
      adjust(s.id, config.payVsMarketBonus);
    }
  });

  // Overnight quit risk check — runs last in overnight sequence.
  bus.subscribe('clock:overnight_followup_decay', ({ day }) => {
    for (const s of staffOrg.currentRoster) {
      const morale = get(s.id);
      if (morale > config.quitRiskThreshold) continue;

      const rng = createRng(deriveSeed(masterSeed, 'staff_morale.quit', { staffId: s.id, day }));
      if (rng() < config.quitRiskRate) {
        moraleMap.delete(s.id);
        bus.publish('staff:quit', {
          staffId: s.id,
          roleId: s.role_id,
          day,
          morale,
        });
      }
    }
  });

  return {
    getMorale(staffId) {
      return get(staffId);
    },

    getMoraleMultiplier(staffId) {
      return lerp(config.moraleMultiplierMin, config.moraleMultiplierMax, get(staffId) / 100);
    },

    get snapshot() {
      return moraleMap as ReadonlyMap<string, number>;
    },
  };
}

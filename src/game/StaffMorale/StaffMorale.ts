import type { EventBus } from '../EventBus';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import { createRng, deriveSeed } from '../Rng';
import { loadStaffMoraleConfig, type StaffMoraleConfig } from './staffMoraleData';

export interface StaffMoraleDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  masterSeed: number;
  config?: StaffMoraleConfig;
}

/**
 * Persistence surface for StaffMorale (#190, parent #186). The per-staff
 * morale map flattened to `[staffId, morale]` pairs for JSON. StaffOrg owns
 * the roster; this captures only the morale dimension layered over it, keyed
 * by the same staff ids — so it restores cleanly after StaffOrg's roster does.
 */
export interface StaffMoraleSnapshot {
  readonly schemaVersion: 1;
  readonly morale: readonly (readonly [string, number])[];
}

export interface StaffMorale {
  getMorale(staffId: string): number;
  getMoraleMultiplier(staffId: string): number;
  /** #190 SaveStore seam: capture/rehydrate the per-staff morale map. */
  snapshot(): StaffMoraleSnapshot;
  restore(snap: StaffMoraleSnapshot): void;
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

  // Pay vs market, every payroll night (#356). This used to add a flat
  // `payVsMarketBonus` to everyone unconditionally — a placeholder wearing a
  // mechanic's name, since it compared nothing and so could never make being
  // underpaid feel like anything. The comparison is now real, and it is the
  // SAME comparison that fires the raise request in StaffOrg: what they are
  // paid against what someone at their current grade asks for. Read off
  // `getPayBoard()` rather than re-derived here — StaffOrg owns the wage book,
  // and a second reading of it could disagree with the one the player is shown.
  bus.subscribe('clock:overnight_payroll', () => {
    for (const pay of staffOrg.getPayBoard()) {
      if (!moraleMap.has(pay.staffId)) moraleMap.set(pay.staffId, config.defaultMorale);
      adjust(
        pay.staffId,
        pay.dailyWage < pay.askingWage
          ? config.paidBelowMarketPenalty
          : config.paidAtMarketBonus,
      );
    }
  });

  // The answer to a raise demand (#356). StaffOrg moves the wage; the morale
  // consequence lives here because this module owns the morale dimension. A
  // refusal deliberately routes into the EXISTING quit machinery below rather
  // than a quit path of its own: refuse someone often enough and the standing
  // overnight risk check takes them.
  bus.subscribe('staff:raise_answered', ({ staffId, accepted }) => {
    if (!moraleMap.has(staffId)) moraleMap.set(staffId, config.defaultMorale);
    adjust(staffId, accepted ? config.raiseAcceptedBonus : config.raiseRefusedPenalty);
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

    snapshot(): StaffMoraleSnapshot {
      return { schemaVersion: 1, morale: [...moraleMap.entries()] };
    },

    restore(snap: StaffMoraleSnapshot): void {
      moraleMap.clear();
      for (const [staffId, morale] of snap.morale) {
        moraleMap.set(staffId, morale);
      }
    },
  };
}

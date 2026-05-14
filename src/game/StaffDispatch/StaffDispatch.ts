import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { StaffMorale } from '../StaffMorale';
import { createRng, deriveSeed } from '../NPC/Rng';
import { EXCEPTION_FLAGS } from './types';
import { loadStaffDispatchConfig, type StaffDispatchConfig } from './staffDispatchData';

export interface StaffDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  economy: Economy;
  masterSeed: number;
  staffMorale?: StaffMorale;
  config?: StaffDispatchConfig;
}

// Intentionally empty — dispatch is fully autonomous.
export interface StaffDispatch {}

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

export function createStaffDispatch(deps: StaffDispatchDeps): StaffDispatch {
  const { bus, staffOrg, queue, economy, masterSeed, staffMorale } = deps;
  const config = deps.config ?? loadStaffDispatchConfig();

  bus.subscribe('capacity:customer_admitted', ({ customerId, day }) => {
    const salespeople = staffOrg.currentRoster.filter(s => s.role_id === 'salesperson');
    if (salespeople.length === 0) return;

    const rng = createRng(deriveSeed(masterSeed, 'staff_dispatch', { customerId, day }));

    // Roll exception flags; any match forces player escalation.
    for (const flag of EXCEPTION_FLAGS) {
      const rate = config.exceptionFlagRates[flag] ?? 0;
      if (rng() < rate) return;
    }

    // Pick highest-effectiveness salesperson.
    const salesperson = salespeople.reduce((best, s) =>
      s.effectiveness > best.effectiveness ? s : best,
    );

    // Skill-based probability of auto-resolving (vs leaving for player).
    const autoChance = lerp(
      config.minAutoResolveRate,
      config.maxAutoResolveRate,
      salesperson.effectiveness,
    );
    if (rng() > autoChance) return;

    // Auto-resolve: remove workspace item the queue just added.
    queue.resolveByCustomerId(customerId);

    const moraleMult = staffMorale?.getMoraleMultiplier(salesperson.id) ?? 1.0;

    // Outcome quality scales with effectiveness and morale.
    const closeChance = Math.min(1, lerp(
      config.minCloseRate,
      config.maxCloseRate,
      salesperson.effectiveness,
    ) * moraleMult);
    const isClosed = rng() < closeChance;

    if (isClosed) {
      const grossMod = Math.min(1, lerp(config.minGrossModifier, 1.0, salesperson.effectiveness) * moraleMult);
      const gross = Math.round(config.baseAutoGross * grossMod);
      economy.postRevenue(gross, 'Auto-sale — salesperson');
      bus.publish('staff:auto_resolved', {
        customerId,
        staffId: salesperson.id,
        day,
        outcome: 'closed',
        grossImpact: gross,
      });
    } else {
      bus.publish('staff:auto_resolved', {
        customerId,
        staffId: salesperson.id,
        day,
        outcome: 'no_sale',
        grossImpact: 0,
      });
    }
  });

  return {};
}

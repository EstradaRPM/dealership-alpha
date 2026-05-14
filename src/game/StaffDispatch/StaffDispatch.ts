import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import { createRng, deriveSeed } from '../NPC/Rng';
import { EXCEPTION_FLAGS } from './types';
import { loadStaffDispatchConfig, type StaffDispatchConfig } from './staffDispatchData';

export interface StaffDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  economy: Economy;
  masterSeed: number;
  config?: StaffDispatchConfig;
}

// Intentionally empty — dispatch is fully autonomous.
export interface StaffDispatch {}

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

export function createStaffDispatch(deps: StaffDispatchDeps): StaffDispatch {
  const { bus, staffOrg, queue, economy, masterSeed } = deps;
  const config = deps.config ?? loadStaffDispatchConfig();

  bus.subscribe('customer:arrived', ({ customerId, day }) => {
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

    // Outcome quality scales with effectiveness.
    const closeChance = lerp(
      config.minCloseRate,
      config.maxCloseRate,
      salesperson.effectiveness,
    );
    const isClosed = rng() < closeChance;

    if (isClosed) {
      const grossMod = lerp(config.minGrossModifier, 1.0, salesperson.effectiveness);
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

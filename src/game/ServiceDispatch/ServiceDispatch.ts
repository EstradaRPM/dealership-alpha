import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadServiceDispatchConfig, type ServiceDispatchConfig } from './serviceDispatchData';

export interface ServiceDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  economy: Economy;
  masterSeed: number;
  config?: ServiceDispatchConfig;
}

// Intentionally empty — dispatch is fully autonomous.
export interface ServiceDispatch {}

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

export function createServiceDispatch(deps: ServiceDispatchDeps): ServiceDispatch {
  const { bus, staffOrg, queue, economy, masterSeed } = deps;
  const config = deps.config ?? loadServiceDispatchConfig();

  bus.subscribe('service:intake_ready', ({ day, items }) => {
    const advisors = staffOrg.currentRoster.filter(s => s.role_id === 'service-advisor');
    if (advisors.length === 0) return;

    // Pick highest-effectiveness advisor.
    const advisor = advisors.reduce((best, s) =>
      s.effectiveness > best.effectiveness ? s : best,
    );

    const autoChance = lerp(
      config.minAutoResolveRate,
      config.maxAutoResolveRate,
      advisor.effectiveness,
    );

    const upsellNorm = (advisor.skills['upsell'] ?? 0) / 100;

    for (const item of items) {
      const rng = createRng(
        deriveSeed(masterSeed, 'service_dispatch', { serviceItemId: item.serviceItemId, day }),
      );

      if (rng() > autoChance) continue;

      queue.resolveItem(item.serviceItemId);

      const revenueMultiplier = lerp(
        config.minRevenueMultiplier,
        config.maxRevenueMultiplier,
        upsellNorm,
      );
      const revenue = Math.round(item.baseRevenue * revenueMultiplier);

      if (revenue > 0) {
        economy.postRevenue(revenue, `Service — ${item.label}`);
      }

      bus.publish('service:ticket_closed', {
        serviceItemId: item.serviceItemId,
        day,
        revenue,
        advisorId: advisor.id,
      });
    }
  });

  return {};
}

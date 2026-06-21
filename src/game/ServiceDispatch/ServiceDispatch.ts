import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { QueueItem } from '../DepartmentQueue';
import type { DeptDrain } from '../FloorSim';
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

/** A pending service intake item carrying the data resolution needs. */
interface ServiceIntakeItem {
  serviceItemId: string;
  label: string;
  baseRevenue: number;
}

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

/**
 * Builds the per-item service auto-resolution closure shared by the legacy
 * once-per-intake path and the per-tick floor drain (#101). Behaviour — advisor
 * pick, skill-scaled auto chance, upsell-scaled revenue, events, RNG keying on
 * (serviceItemId, day) — is identical regardless of caller, so cadence changes
 * never change outcomes. Returns true iff the item was resolved.
 */
function makeServiceResolver(deps: ServiceDispatchDeps) {
  const { bus, staffOrg, queue, economy, masterSeed } = deps;
  const config = deps.config ?? loadServiceDispatchConfig();

  return function resolveServiceItem(
    item: ServiceIntakeItem,
    day: number,
  ): boolean {
    const advisors = staffOrg.currentRoster.filter(
      s => s.role_id === 'service-advisor',
    );
    if (advisors.length === 0) return false;

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

    const rng = createRng(
      deriveSeed(masterSeed, 'service_dispatch', {
        serviceItemId: item.serviceItemId,
        day,
      }),
    );

    if (rng() > autoChance) return false;

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
    return true;
  };
}

export function createServiceDispatch(deps: ServiceDispatchDeps): ServiceDispatch {
  const resolveServiceItem = makeServiceResolver(deps);

  deps.bus.subscribe('service:intake_ready', ({ day, items }) => {
    for (const item of items) {
      resolveServiceItem(
        {
          serviceItemId: item.serviceItemId,
          label: item.label,
          baseRevenue: item.baseRevenue,
        },
        day,
      );
    }
  });

  return {};
}

/**
 * Per-tick floor drain (#101) — the locked #99 `drain` seam for the Service
 * department, FloorSim's per-tick counterpart to `createServiceDispatch`'s
 * legacy once-per-intake path. A per-day instance; the composition root wires
 * one (or the legacy path, never both) per FloorSim day. It captures intake
 * payloads (and sweeps any already-queued items, which carry `baseRevenue` since
 * #303) without resolving them, then each tick resolves up to a skill-scaled
 * number via the **same resolver**
 * as the legacy path — identical outcomes, only the cadence differs. Service
 * has no exception channel, so `escalated` is always 0.
 */
export function createServiceFloorDrain(deps: ServiceDispatchDeps): DeptDrain {
  const { bus, staffOrg } = deps;
  const config = deps.config ?? loadServiceDispatchConfig();
  const resolveServiceItem = makeServiceResolver({ ...deps, config });

  const pending: Array<{ item: ServiceIntakeItem; day: number }> = [];
  const seen = new Set<string>();

  function enqueue(item: ServiceIntakeItem, day: number): void {
    if (seen.has(item.serviceItemId)) return;
    seen.add(item.serviceItemId);
    pending.push({ item, day });
  }

  function fromQueuedServiceItem(item: QueueItem): { item: ServiceIntakeItem; day: number } | null {
    if (item.dept !== 'service' || item.type !== 'routine') return null;
    // The enriched intake carries baseRevenue onto the queue item (#303), so a
    // restored (post-load) item resolves at its real revenue without the retired
    // flat intake table.
    return {
      item: {
        serviceItemId: item.id,
        label: item.label,
        baseRevenue: item.baseRevenue ?? 0,
      },
      day: item.createdDay,
    };
  }

  function captureQueuedServiceItems(): void {
    for (const item of deps.queue.getQueue('service')) {
      const pendingItem = fromQueuedServiceItem(item);
      if (pendingItem) enqueue(pendingItem.item, pendingItem.day);
    }
  }

  bus.subscribe('service:intake_ready', ({ day, items }) => {
    for (const item of items) {
      enqueue({
        serviceItemId: item.serviceItemId,
        label: item.label,
        baseRevenue: item.baseRevenue,
      }, day);
    }
  });

  // Fractional per-tick throughput carry-over (deterministic — skill only).
  let acc = 0;

  return {
    drain() {
      let resolved = 0;
      captureQueuedServiceItems();
      if (pending.length === 0) return { resolved, escalated: 0 };

      const advisors = staffOrg.currentRoster.filter(
        s => s.role_id === 'service-advisor',
      );
      if (advisors.length === 0) return { resolved, escalated: 0 };

      const bestEff = advisors.reduce(
        (m, s) => (s.effectiveness > m ? s.effectiveness : m),
        0,
      );
      acc += lerp(config.minDrainPerTick, config.maxDrainPerTick, bestEff);
      let budget = Math.floor(acc);
      acc -= budget;

      while (budget > 0 && pending.length > 0) {
        const next = pending.shift() as { item: ServiceIntakeItem; day: number };
        budget -= 1;
        if (resolveServiceItem(next.item, next.day)) resolved += 1;
      }
      return { resolved, escalated: 0 };
    },
  };
}

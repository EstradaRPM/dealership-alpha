import type { EventBus } from '../EventBus';
import { loadServiceQueueConfig, type ServiceQueueConfig } from './serviceQueueData';

export interface ServiceQueueDeps {
  bus: EventBus;
  initialTier?: number;
  config?: ServiceQueueConfig;
}

/**
 * Save/load blob (#193). The module holds no generated intake — the day's
 * tickets flow live from ServiceDemand and regenerate deterministically from
 * `masterSeed + day` (#303). The only carried state is the tier gate; restoring
 * it keeps the Tier 2+ unlock honored after a load without waiting for the next
 * `career:tier_up`.
 */
export interface ServiceQueueSnapshot {
  readonly schemaVersion: 1;
  readonly currentTier: number;
}

// Near-autonomous: only the tier gate is carried state (see snapshot/restore).
export interface ServiceQueue {
  snapshot(): ServiceQueueSnapshot;
  restore(snap: ServiceQueueSnapshot): void;
}

/**
 * ServiceQueue (#80, rewired #303 parent #297) — the Tier-2 gate on the Service
 * profit center's daily intake. It no longer synthesizes intake from a flat
 * `seed × day` table; instead it subscribes to ServiceDemand's enriched,
 * NPC-bound stream (`serviceDemand:intake_ready`), applies the tier gate, and
 * re-publishes it as `service:intake_ready` for DepartmentQueue (Service lane)
 * + ServiceDispatch. Each item carries the customer + vehicle identity, the due
 * job/parts category, the base ticket revenue, and a display label.
 */
export function createServiceQueue(deps: ServiceQueueDeps): ServiceQueue {
  const { bus } = deps;
  const config = deps.config ?? loadServiceQueueConfig();

  let currentTier = deps.initialTier ?? 1;

  bus.subscribe('career:tier_up', ({ toTier }) => {
    currentTier = toTier;
  });

  bus.subscribe('serviceDemand:intake_ready', ({ day, intake }) => {
    if (currentTier < config.minTierRequired) return;

    const items = intake.map((entry) => ({
      serviceItemId: entry.ticketId,
      source: entry.source,
      customerId: entry.customerId,
      vehicleId: entry.vehicleId,
      category: entry.category,
      powertrain: entry.powertrain,
      jobCategory: entry.jobCategory,
      baseRevenue: entry.baseRevenue,
      label: config.jobLabels[entry.jobCategory],
    }));

    bus.publish('service:intake_ready', { day, items });
  });

  return {
    snapshot(): ServiceQueueSnapshot {
      return { schemaVersion: 1, currentTier };
    },
    restore(snap) {
      currentTier = snap.currentTier;
    },
  };
}

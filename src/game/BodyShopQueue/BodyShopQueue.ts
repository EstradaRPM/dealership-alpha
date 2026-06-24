import type { EventBus } from '../EventBus';
import {
  loadBodyShopQueueConfig,
  type BodyShopQueueConfig,
} from './bodyShopQueueData';

export interface BodyShopQueueDeps {
  bus: EventBus;
  initialTier?: number;
  config?: BodyShopQueueConfig;
}

/**
 * Save/load blob (#193 pattern). The module holds no generated intake — the day's
 * tickets flow live from CollisionStream (#313) and regenerate deterministically
 * from `masterSeed + day`. The only carried state is the tier gate; restoring it
 * keeps the Tier 3+ unlock honored after a load without waiting for the next
 * `career:tier_up`.
 */
export interface BodyShopQueueSnapshot {
  readonly schemaVersion: 1;
  readonly currentTier: number;
}

// Near-autonomous: only the tier gate is carried state (see snapshot/restore).
export interface BodyShopQueue {
  snapshot(): BodyShopQueueSnapshot;
  restore(snap: BodyShopQueueSnapshot): void;
}

/**
 * BodyShopQueue (#312, parent #297) — the Tier-3 gate on the Body-Shop profit
 * center's daily intake, and the Body-Shop instantiation of the shared department
 * assembly line (`docs/planning/shared-department-structure.md`, LOCKED). It is
 * the direct Tier-3 mirror of `ServiceQueue`: it subscribes to CollisionStream's
 * enriched, NPC-bound stream (`bodyshop:demand_ready`, #313), applies the tier
 * gate, and re-publishes it as `bodyshop:intake_ready` for the Body-Shop lane +
 * drain. Each item carries the customer + vehicle identity, the due collision
 * job/parts category, the base ticket revenue, the demand channel (`source`:
 * insurance DRP vs retail), and a display label.
 *
 * The Body Shop is **dark below Tier 3** — the queue does nothing until the
 * dealership reaches the showroom tier (Service unlocks one tier earlier, at 2).
 * Tier is followed off the bus (`career:tier_up`) and seeded by `initialTier`.
 */
export function createBodyShopQueue(deps: BodyShopQueueDeps): BodyShopQueue {
  const { bus } = deps;
  const config = deps.config ?? loadBodyShopQueueConfig();

  let currentTier = deps.initialTier ?? 1;

  bus.subscribe('career:tier_up', ({ toTier }) => {
    currentTier = toTier;
  });

  bus.subscribe('bodyshop:demand_ready', ({ day, intake }) => {
    if (currentTier < config.minTierRequired) return;

    const items = intake.map((entry) => ({
      bodyShopItemId: entry.ticketId,
      source: entry.source,
      customerId: entry.customerId,
      vehicleId: entry.vehicleId,
      category: entry.category,
      powertrain: entry.powertrain,
      jobCategory: entry.jobCategory,
      baseRevenue: entry.baseRevenue,
      label: config.jobLabels[entry.jobCategory],
    }));

    bus.publish('bodyshop:intake_ready', { day, items });
  });

  return {
    snapshot(): BodyShopQueueSnapshot {
      return { schemaVersion: 1, currentTier };
    },
    restore(snap) {
      currentTier = snap.currentTier;
    },
  };
}

import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadServiceQueueConfig, type ServiceQueueConfig } from './serviceQueueData';

export interface ServiceQueueDeps {
  bus: EventBus;
  masterSeed: number;
  initialTier?: number;
  config?: ServiceQueueConfig;
}

/**
 * Save/load blob (#193). The module regenerates its daily intake
 * deterministically from `masterSeed + day`, so the only carried state is the
 * tier gate — restoring it keeps the Tier 2+ unlock honored after a load
 * without waiting for the next `career:tier_up`.
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

export function createServiceQueue(deps: ServiceQueueDeps): ServiceQueue {
  const { bus, masterSeed } = deps;
  const config = deps.config ?? loadServiceQueueConfig();

  let currentTier = deps.initialTier ?? 1;

  bus.subscribe('career:tier_up', ({ toTier }) => {
    currentTier = toTier;
  });

  bus.subscribe('clock:day_started', ({ day }) => {
    if (currentTier < config.minTierRequired) return;

    const rng = createRng(deriveSeed(masterSeed, 'service_queue', { day }));

    const count =
      config.dailyIntakeMin +
      Math.floor(rng() * (config.dailyIntakeMax - config.dailyIntakeMin + 1));

    const items: Array<{
      serviceItemId: string;
      type: string;
      label: string;
      baseRevenue: number;
    }> = [];

    for (let slot = 0; slot < count; slot++) {
      const idx = Math.floor(rng() * config.intakeItems.length);
      const def = config.intakeItems[idx];
      items.push({
        serviceItemId: `svc:${def.id}:${day}:${slot}`,
        type: def.id,
        label: def.label,
        baseRevenue: def.baseRevenue,
      });
    }

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

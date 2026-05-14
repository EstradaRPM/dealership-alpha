import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadServiceQueueConfig, type ServiceQueueConfig } from './serviceQueueData';

export interface ServiceQueueDeps {
  bus: EventBus;
  masterSeed: number;
  initialTier?: number;
  config?: ServiceQueueConfig;
}

// Intentionally empty — ServiceQueue is fully autonomous.
export interface ServiceQueue {}

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

  return {};
}

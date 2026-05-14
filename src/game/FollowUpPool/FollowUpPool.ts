import type { EventBus } from '../EventBus';
import type { CustomerPool } from '../CustomerPool';
import type { FollowUpEntry, ArchivedEntry, FollowUpPool } from './types';

export interface FollowUpTunables {
  initialHeatBase: number;
  decayPerNight: number;
}

export function createFollowUpPool(deps: {
  bus: EventBus;
  pool: CustomerPool;
  tunables: FollowUpTunables;
}): FollowUpPool {
  const { bus, pool, tunables } = deps;
  const active = new Map<string, FollowUpEntry>();
  const archived: ArchivedEntry[] = [];

  bus.subscribe('customer:resolved', ({ customerId, outcome }) => {
    if (outcome !== 'walk') return;
    const session = pool.getSession(customerId);
    if (!session) return;

    const patience = session.bundle.visit.kind === 'sales'
      ? session.bundle.visit.resources.patience
      : 0.5;

    const initialHeat = Math.max(1, Math.round(tunables.initialHeatBase * patience));

    active.set(customerId, {
      customerId,
      walkedDay: session.day,
      bundle: session.bundle,
      initialHeat,
      heat: initialHeat,
    });
  });

  bus.subscribe('clock:overnight_followup_decay', ({ day }) => {
    for (const entry of active.values()) {
      entry.heat -= tunables.decayPerNight;
      if (entry.heat <= 0) {
        archived.push({
          customerId: entry.customerId,
          walkedDay: entry.walkedDay,
          bundle: entry.bundle,
          initialHeat: entry.initialHeat,
          archivedDay: day,
        });
        active.delete(entry.customerId);
        bus.publish('followup:customer_archived', { customerId: entry.customerId, day });
      }
    }
  });

  return {
    getFollowUps() { return [...active.values()]; },
    getFollowUp(customerId) { return active.get(customerId); },
    getArchived() { return [...archived]; },
  };
}

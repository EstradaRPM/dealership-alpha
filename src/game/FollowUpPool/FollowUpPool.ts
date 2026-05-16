import type { EventBus } from '../EventBus';
import type { CustomerPool } from '../CustomerPool';
import type { FollowUpEntry, ArchivedEntry, FollowUpPool, CallbackOutcome } from './types';

export interface FollowUpTunables {
  /** Heat lost per night. Walk heat ∈ [0,1] arrives from customer:resolved. */
  decayPerNight: number;
  /** Extra heat lost on a failed callback. Defaults to 0. */
  callbackFailurePenalty?: number;
  /** Max BDC task entries surfaced each morning. Defaults to 1. */
  maxBdcTasksPerMorning?: number;
}

export function createFollowUpPool(deps: {
  bus: EventBus;
  pool: CustomerPool;
  tunables: FollowUpTunables;
}): FollowUpPool {
  const { bus, pool, tunables } = deps;
  const active = new Map<string, FollowUpEntry>();
  const archived: ArchivedEntry[] = [];
  let currentDay = 0;

  function archiveEntry(entry: FollowUpEntry, day: number): void {
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

  bus.subscribe('customer:resolved', ({ customerId, outcome, heat }) => {
    if (outcome !== 'walk') return;
    const session = pool.getSession(customerId);
    if (!session) return;

    if (heat <= 0) return;
    const initialHeat = heat;

    active.set(customerId, {
      customerId,
      walkedDay: session.day,
      bundle: session.bundle,
      archetypeLabel: session.archetypeLabel,
      initialHeat,
      heat: initialHeat,
    });
  });

  bus.subscribe('clock:overnight_followup_decay', ({ day }) => {
    for (const entry of [...active.values()]) {
      entry.heat -= tunables.decayPerNight;
      if (entry.heat <= 0) {
        archiveEntry(entry, day);
      }
    }
  });

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;
    if (active.size === 0) return;

    const maxTasks = tunables.maxBdcTasksPerMorning ?? 1;
    const sorted = [...active.values()].sort((a, b) => b.heat - a.heat);
    const entries = sorted.slice(0, maxTasks).map(e => ({
      customerId: e.customerId,
      heat: e.heat,
      archetypeLabel: e.archetypeLabel,
    }));

    bus.publish('followup:bdc_tasks_ready', { day, entries });
  });

  return {
    getFollowUps() { return [...active.values()]; },
    getFollowUp(customerId) { return active.get(customerId); },
    getArchived() { return [...archived]; },

    attemptCallback(customerId, roll) {
      const entry = active.get(customerId);
      if (!entry) throw new Error(`No active follow-up for "${customerId}"`);

      const successProbability = entry.heat / entry.initialHeat;
      const outcome: CallbackOutcome = roll < successProbability ? 'success' : 'failure';

      if (outcome === 'success') {
        active.delete(customerId);
        bus.publish('bdc:callback_succeeded', {
          customerId,
          day: currentDay,
          archetypeLabel: entry.archetypeLabel,
        });
      } else {
        const penalty = tunables.callbackFailurePenalty ?? 0;
        if (penalty > 0) {
          entry.heat = Math.max(0, entry.heat - penalty);
          if (entry.heat <= 0) {
            archiveEntry(entry, currentDay);
          }
        }
      }

      return outcome;
    },
  };
}

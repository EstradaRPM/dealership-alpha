import type { EventBus } from '../EventBus';
import type { CompetitorCatalog } from './Competitor';

export interface CompetitorMarket {
  dispose: () => void;
}

/**
 * Wires CompetitorMarket into the EventBus (ADR-0001 §10):
 * subscribes to `clock:day_started` and republishes today's competitor set as
 * `market:competitive_pressure`. CustomerPool will consume this when rolling
 * today's customers.
 *
 * v1 carries the static competitor list on every tick; v2 (drift, brand
 * dynamics) thickens the payload without changing the event name.
 */
export function createCompetitorMarket(deps: {
  bus: EventBus;
  competitors: CompetitorCatalog;
}): CompetitorMarket {
  const { bus, competitors } = deps;

  const onDayStarted = (payload: { day: number }): void => {
    bus.publish('market:competitive_pressure', {
      day: payload.day,
      competitors,
    });
  };

  bus.subscribe('clock:day_started', onDayStarted);

  return {
    dispose: () => bus.unsubscribe('clock:day_started', onDayStarted),
  };
}

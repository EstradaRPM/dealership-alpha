/**
 * Central registry of every event flowing through the EventBus.
 *
 * Adding a new event = adding one line here. Subscribers and publishers
 * are then statically type-checked against this map.
 *
 * Keep event names namespaced ("domain:verb") and payloads plain data.
 */
import type { Competitor } from '../CompetitorMarket/Competitor';

export interface EventMap {
  // Placeholder. Real events land as their owning modules are built
  // (GameClock, DealEngine, etc.). Kept non-empty so `keyof EventMap`
  // is never `never`, which would make the EventBus generics useless.
  'bus:ready': { at: number };

  // GameClock day boundary. Owning module not yet built; the typed
  // contract lives here so subscribers can wire against it today.
  'clock:day_tick': { day: number };

  // CompetitorMarket → CustomerPool (ADR-0001 §10). Published each
  // day-tick; consumed when rolling today's customers.
  'market:competitive_pressure': {
    day: number;
    competitors: ReadonlyArray<Competitor>;
  };
}

export type EventName = keyof EventMap;
export type EventPayload<K extends EventName> = EventMap[K];
export type EventListener<K extends EventName> = (payload: EventPayload<K>) => void;

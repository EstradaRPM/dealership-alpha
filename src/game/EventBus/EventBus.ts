import type { EventListener, EventName, EventPayload } from './events';

export interface EventBus {
  subscribe<K extends EventName>(event: K, listener: EventListener<K>): void;
  unsubscribe<K extends EventName>(event: K, listener: EventListener<K>): void;
  publish<K extends EventName>(event: K, payload: EventPayload<K>): void;
}

export function createEventBus(): EventBus {
  const listeners = new Map<EventName, Set<EventListener<EventName>>>();

  return {
    subscribe(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as EventListener<EventName>);
    },

    unsubscribe(event, listener) {
      listeners.get(event)?.delete(listener as EventListener<EventName>);
    },

    publish(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      // Copy before iterating so a listener that unsubscribes itself
      // (or another listener) during dispatch doesn't corrupt the walk.
      for (const listener of [...set]) {
        (listener as EventListener<typeof event>)(payload);
      }
    },
  };
}

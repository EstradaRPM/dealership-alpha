import type { EventListener, EventMap, EventName, EventPayload } from './events';

export type TapListener = (event: EventName, payload: EventMap[EventName]) => void;

export interface EventBus {
  subscribe<K extends EventName>(event: K, listener: EventListener<K>): void;
  unsubscribe<K extends EventName>(event: K, listener: EventListener<K>): void;
  publish<K extends EventName>(event: K, payload: EventPayload<K>): void;
  tap(listener: TapListener): void;
  untap(listener: TapListener): void;
}

export function createEventBus(): EventBus {
  const listeners = new Map<EventName, Set<EventListener<EventName>>>();
  const tapListeners = new Set<TapListener>();

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
      if (set) {
        // Copy before iterating so a listener that unsubscribes itself
        // (or another listener) during dispatch doesn't corrupt the walk.
        for (const listener of [...set]) {
          (listener as EventListener<typeof event>)(payload);
        }
      }
      for (const tap of tapListeners) {
        tap(event, payload as EventMap[EventName]);
      }
    },

    tap(listener) {
      tapListeners.add(listener);
    },

    untap(listener) {
      tapListeners.delete(listener);
    },
  };
}

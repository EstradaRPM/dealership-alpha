import { createEventBus } from '../src/game/EventBus';

describe('EventBus', () => {
  it('delivers a published event to a subscriber', () => {
    const bus = createEventBus();
    const received: number[] = [];
    bus.subscribe('bus:ready', (p) => received.push(p.at));

    bus.publish('bus:ready', { at: 1 });

    expect(received).toEqual([1]);
  });

  it('delivers to multiple subscribers of the same event', () => {
    const bus = createEventBus();
    const a: number[] = [];
    const b: number[] = [];
    bus.subscribe('bus:ready', (p) => a.push(p.at));
    bus.subscribe('bus:ready', (p) => b.push(p.at));

    bus.publish('bus:ready', { at: 7 });

    expect(a).toEqual([7]);
    expect(b).toEqual([7]);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus();
    const received: number[] = [];
    const listener = (p: { at: number }) => received.push(p.at);

    bus.subscribe('bus:ready', listener);
    bus.publish('bus:ready', { at: 1 });
    bus.unsubscribe('bus:ready', listener);
    bus.publish('bus:ready', { at: 2 });

    expect(received).toEqual([1]);
  });

  it('publishing an event with no subscribers is a no-op', () => {
    const bus = createEventBus();
    expect(() => bus.publish('bus:ready', { at: 0 })).not.toThrow();
  });

  it('unsubscribing a listener that was never subscribed is a no-op', () => {
    const bus = createEventBus();
    const listener = () => {};
    expect(() => bus.unsubscribe('bus:ready', listener)).not.toThrow();
  });

  it('a listener that unsubscribes itself during dispatch does not break iteration', () => {
    const bus = createEventBus();
    const order: string[] = [];

    const first = () => {
      order.push('first');
      bus.unsubscribe('bus:ready', first);
    };
    const second = () => {
      order.push('second');
    };

    bus.subscribe('bus:ready', first);
    bus.subscribe('bus:ready', second);
    bus.publish('bus:ready', { at: 0 });

    expect(order).toEqual(['first', 'second']);

    bus.publish('bus:ready', { at: 1 });
    expect(order).toEqual(['first', 'second', 'second']);
  });
});

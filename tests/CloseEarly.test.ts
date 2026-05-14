import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createCloseEarly } from '../src/game/CloseEarly';
import type { QueueItem } from '../src/game/DepartmentQueue';

function makeSetup(initialDay = 1) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const queue = createDepartmentQueue({ bus });
  const closeEarly = createCloseEarly({ bus, queue, clock });
  return { bus, clock, queue, closeEarly };
}

function pushItem(bus: ReturnType<typeof createEventBus>, item: Partial<QueueItem> & { dept: QueueItem['dept'] }) {
  // Inject items via events that DepartmentQueue subscribes to
  if (item.type === 'workspace' || item.type === undefined) {
    bus.publish('capacity:customer_admitted', {
      day: 1,
      customerId: item.customerId ?? `c-${Math.random()}`,
      label: item.label ?? 'Test Customer',
    });
  } else if (item.type === 'callback') {
    bus.publish('followup:bdc_tasks_ready', {
      day: 1,
      entries: [{
        customerId: item.customerId ?? `c-${Math.random()}`,
        heat: 80,
        archetypeLabel: item.label ?? 'Test Callback',
      }],
    });
  }
}

describe('CloseEarly — previewCost', () => {
  it('returns zero cost when all queues are empty', () => {
    const { closeEarly } = makeSetup();
    expect(closeEarly.previewCost()).toEqual({ walkCount: 0, reputationHit: 0 });
  });

  it('counts workspace customers as walks', () => {
    const { bus, closeEarly } = makeSetup();
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c1', label: 'Customer A' });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c2', label: 'Customer B' });
    expect(closeEarly.previewCost().walkCount).toBe(2);
  });

  it('counts callback (BDC) customers as walks', () => {
    const { bus, closeEarly } = makeSetup();
    bus.publish('followup:bdc_tasks_ready', {
      day: 1,
      entries: [
        { customerId: 'c1', heat: 80, archetypeLabel: 'Follow-up A' },
        { customerId: 'c2', heat: 60, archetypeLabel: 'Follow-up B' },
      ],
    });
    expect(closeEarly.previewCost().walkCount).toBe(2);
  });

  it('does not count missed_opportunity items as walks', () => {
    const { bus, closeEarly } = makeSetup();
    bus.publish('capacity:missed_opportunity', { day: 1, customerId: 'c1', label: 'Turned Away' });
    expect(closeEarly.previewCost().walkCount).toBe(0);
  });

  it('does not count routine items as walks', () => {
    const { bus, clock, closeEarly } = makeSetup(1);
    clock.advanceDay(); // triggers clock:day_started → office routine item
    expect(closeEarly.previewCost().walkCount).toBe(0);
  });

  it('computes reputationHit as walkCount × 5 (default tunable)', () => {
    const { bus, closeEarly } = makeSetup();
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c1', label: 'A' });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c2', label: 'B' });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c3', label: 'C' });
    const cost = closeEarly.previewCost();
    expect(cost.walkCount).toBe(3);
    expect(cost.reputationHit).toBe(15);
  });

  it('does not mutate queue state', () => {
    const { bus, queue, closeEarly } = makeSetup();
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c1', label: 'A' });
    closeEarly.previewCost();
    expect(queue.getBadgeCount('sales')).toBe(1);
  });
});

describe('CloseEarly — execute', () => {
  it('advances the clock by one day', () => {
    const { clock, closeEarly } = makeSetup(5);
    expect(clock.currentDay).toBe(5);
    closeEarly.execute();
    expect(clock.currentDay).toBe(6);
  });

  it('drains all queues (pre-drain items are gone; overnight may add new ones)', () => {
    const { bus, queue, closeEarly } = makeSetup();
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c1', label: 'A' });
    bus.publish('capacity:missed_opportunity', { day: 1, customerId: 'c2', label: 'B' });
    closeEarly.execute();
    // sales/service/bdc/lot had only pre-drain items — all gone
    expect(queue.getBadgeCount('sales')).toBe(0);
    expect(queue.getBadgeCount('service')).toBe(0);
    expect(queue.getBadgeCount('bdc')).toBe(0);
    expect(queue.getBadgeCount('lot')).toBe(0);
    // office gets one routine item from clock:day_started fired by advanceDay()
    expect(queue.getBadgeCount('office')).toBe(1);
  });

  it('publishes customer:resolved walk for each workspace customer', () => {
    const { bus, closeEarly } = makeSetup();
    const resolved: string[] = [];
    bus.subscribe('customer:resolved', ({ customerId, outcome }) => {
      if (outcome === 'walk') resolved.push(customerId);
    });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c1', label: 'A' });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c2', label: 'B' });
    closeEarly.execute();
    expect(resolved).toEqual(expect.arrayContaining(['c1', 'c2']));
    expect(resolved).toHaveLength(2);
  });

  it('publishes customer:resolved walk for BDC callback customers', () => {
    const { bus, closeEarly } = makeSetup();
    const resolved: string[] = [];
    bus.subscribe('customer:resolved', ({ customerId, outcome }) => {
      if (outcome === 'walk') resolved.push(customerId);
    });
    bus.publish('followup:bdc_tasks_ready', {
      day: 1,
      entries: [{ customerId: 'bdc1', heat: 80, archetypeLabel: 'Follow-up' }],
    });
    closeEarly.execute();
    expect(resolved).toContain('bdc1');
  });

  it('does not publish customer:resolved for routine or missed_opportunity items', () => {
    const { bus, clock, closeEarly } = makeSetup(1);
    clock.advanceDay(); // adds routine office item
    bus.publish('capacity:missed_opportunity', { day: 2, customerId: 'missed1', label: 'Missed' });
    const resolved: string[] = [];
    bus.subscribe('customer:resolved', ({ customerId }) => resolved.push(customerId));
    closeEarly.execute();
    expect(resolved).toHaveLength(0);
  });

  it('publishes reputation:satisfaction_hit when customers walk', () => {
    const { bus, closeEarly } = makeSetup();
    let hitAmount = 0;
    bus.subscribe('reputation:satisfaction_hit', ({ amount }) => { hitAmount = amount; });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c1', label: 'A' });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'c2', label: 'B' });
    closeEarly.execute();
    expect(hitAmount).toBe(10); // 2 walks × 5 rep hit each
  });

  it('does not publish reputation:satisfaction_hit when no walks', () => {
    const { bus, closeEarly } = makeSetup();
    let hitFired = false;
    bus.subscribe('reputation:satisfaction_hit', () => { hitFired = true; });
    closeEarly.execute();
    expect(hitFired).toBe(false);
  });

  it('publishes player:close_early with correct payload', () => {
    const { bus, closeEarly } = makeSetup(3);
    let payload: { day: number; walkCount: number; reputationHit: number } | null = null;
    bus.subscribe('player:close_early', (p) => { payload = p; });
    bus.publish('capacity:customer_admitted', { day: 3, customerId: 'c1', label: 'A' });
    closeEarly.execute();
    expect(payload).toEqual({ day: 3, walkCount: 1, reputationHit: 5 });
  });

  it('player:close_early fires before overnight events', () => {
    const { bus, closeEarly } = makeSetup();
    const order: string[] = [];
    bus.subscribe('player:close_early', () => order.push('close_early'));
    bus.subscribe('clock:day_ended', () => order.push('day_ended'));
    closeEarly.execute();
    expect(order.indexOf('close_early')).toBeLessThan(order.indexOf('day_ended'));
  });
});

describe('CloseEarly — mixed queue fixture', () => {
  it('correctly handles queues with multiple item types', () => {
    const { bus, clock, queue, closeEarly } = makeSetup(1);
    clock.advanceDay(); // routine office item on day 2
    bus.publish('capacity:customer_admitted', { day: 2, customerId: 'c1', label: 'Sales A' });
    bus.publish('capacity:missed_opportunity', { day: 2, customerId: 'c2', label: 'Missed' });
    bus.publish('followup:bdc_tasks_ready', {
      day: 2,
      entries: [{ customerId: 'bdc1', heat: 70, archetypeLabel: 'Callback' }],
    });

    const cost = closeEarly.previewCost();
    expect(cost.walkCount).toBe(2); // c1 (workspace) + bdc1 (callback)
    expect(cost.reputationHit).toBe(10);

    const walked: string[] = [];
    bus.subscribe('customer:resolved', ({ customerId, outcome }) => {
      if (outcome === 'walk') walked.push(customerId);
    });

    closeEarly.execute();

    expect(walked).toEqual(expect.arrayContaining(['c1', 'bdc1']));
    expect(walked).not.toContain('c2');
    // Non-office queues are empty; office gets one routine item from overnight day_started
    expect(queue.getBadgeCount('sales')).toBe(0);
    expect(queue.getBadgeCount('bdc')).toBe(0);
    expect(queue.getBadgeCount('service')).toBe(0);
    expect(queue.getBadgeCount('lot')).toBe(0);
    expect(queue.getBadgeCount('office')).toBe(1);
  });
});

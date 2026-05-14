import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';

function makeSetup(initialDay = 1) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const queue = createDepartmentQueue({ bus });
  return { bus, clock, queue };
}

describe('DepartmentQueue — initial state', () => {
  it('all queues start empty', () => {
    const { queue } = makeSetup();
    for (const dept of ['sales', 'service', 'bdc', 'office', 'lot'] as const) {
      expect(queue.getQueue(dept)).toHaveLength(0);
      expect(queue.getBadgeCount(dept)).toBe(0);
    }
  });

  it('getBadges returns zero for all depts', () => {
    const { queue } = makeSetup();
    expect(queue.getBadges()).toEqual({ sales: 0, service: 0, bdc: 0, office: 0, lot: 0 });
  });
});

describe('DepartmentQueue — routine item generation', () => {
  it('clock:day_started adds one routine item to the office queue', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay(); // triggers day_started for day 2
    expect(queue.getBadgeCount('office')).toBe(1);
  });

  it('generated item has correct shape', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    const items = queue.getQueue('office');
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('routine');
    expect(items[0].dept).toBe('office');
    expect(items[0].label).toBe('Receptionist phone question');
    expect(items[0].createdDay).toBe(2);
  });

  it('only office queue receives the morning item', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    expect(queue.getBadgeCount('sales')).toBe(0);
    expect(queue.getBadgeCount('service')).toBe(0);
    expect(queue.getBadgeCount('bdc')).toBe(0);
    expect(queue.getBadgeCount('lot')).toBe(0);
  });

  it('each day advance adds another routine item', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    clock.advanceDay();
    clock.advanceDay();
    expect(queue.getBadgeCount('office')).toBe(3);
  });

  it('createdDay matches the new day on each advance', () => {
    const { clock, queue } = makeSetup(5);
    clock.advanceDay(); // day becomes 6
    clock.advanceDay(); // day becomes 7
    const items = queue.getQueue('office');
    expect(items[0].createdDay).toBe(6);
    expect(items[1].createdDay).toBe(7);
  });
});

describe('DepartmentQueue — resolveItem', () => {
  it('resolveItem by id removes the item', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    const id = queue.getQueue('office')[0].id;
    queue.resolveItem(id);
    expect(queue.getBadgeCount('office')).toBe(0);
  });

  it('resolving an unknown id is a no-op', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    queue.resolveItem('nonexistent-id');
    expect(queue.getBadgeCount('office')).toBe(1);
  });

  it('resolving one item from multiple leaves the rest', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    clock.advanceDay();
    const id = queue.getQueue('office')[0].id;
    queue.resolveItem(id);
    expect(queue.getBadgeCount('office')).toBe(1);
  });
});

describe('DepartmentQueue — resolveTop', () => {
  it('resolveTop removes the first item in the dept queue', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    queue.resolveTop('office');
    expect(queue.getBadgeCount('office')).toBe(0);
  });

  it('resolveTop on an empty dept queue is a no-op', () => {
    const { queue } = makeSetup(1);
    expect(() => queue.resolveTop('office')).not.toThrow();
    expect(queue.getBadgeCount('office')).toBe(0);
  });
});

describe('DepartmentQueue — getBadges', () => {
  it('reflects office badge count after day advance', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    expect(queue.getBadges()).toEqual({ sales: 0, service: 0, bdc: 0, office: 1, lot: 0 });
  });

  it('decrements office badge after resolution', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    queue.resolveTop('office');
    expect(queue.getBadges()).toEqual({ sales: 0, service: 0, bdc: 0, office: 0, lot: 0 });
  });
});

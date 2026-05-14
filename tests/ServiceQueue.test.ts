import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createServiceQueue, type ServiceQueueConfig } from '../src/game/ServiceQueue';

const MASTER_SEED = 42;

const FIXED_CONFIG: ServiceQueueConfig = {
  intakeItems: [
    { id: 'oil_change', label: 'Oil change', baseRevenue: 75 },
    { id: 'brake_job', label: 'Brake job', baseRevenue: 280 },
    { id: 'recall', label: 'Recall inspection', baseRevenue: 0 },
    { id: 'diagnostic', label: 'Diagnostic check', baseRevenue: 125 },
  ],
  dailyIntakeMin: 1,
  dailyIntakeMax: 3,
  minTierRequired: 2,
};

function makeSetup(initialTier = 1, initialDay = 1) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const queue = createDepartmentQueue({ bus });
  createServiceQueue({ bus, masterSeed: MASTER_SEED, initialTier, config: FIXED_CONFIG });
  return { bus, clock, queue };
}

// ── Tier gate ────────────────────────────────────────────────────────────────

describe('ServiceQueue — tier gate', () => {
  it('generates no service items at Tier 1', () => {
    const { clock, queue } = makeSetup(1);
    clock.advanceDay();
    expect(queue.getBadgeCount('service')).toBe(0);
  });

  it('generates service items at Tier 2', () => {
    const { clock, queue } = makeSetup(2);
    clock.advanceDay();
    expect(queue.getBadgeCount('service')).toBeGreaterThanOrEqual(1);
  });

  it('generates service items at Tier 3', () => {
    const { clock, queue } = makeSetup(3);
    clock.advanceDay();
    expect(queue.getBadgeCount('service')).toBeGreaterThanOrEqual(1);
  });

  it('activates when tier_up event fires', () => {
    const { bus, clock, queue } = makeSetup(1);
    bus.publish('career:tier_up', { fromTier: 1, toTier: 2, day: 1 });
    clock.advanceDay();
    expect(queue.getBadgeCount('service')).toBeGreaterThanOrEqual(1);
  });
});

// ── Daily intake count ───────────────────────────────────────────────────────

describe('ServiceQueue — daily intake count', () => {
  it('generates between 1 and 3 items per day at Tier 2', () => {
    const { clock, queue } = makeSetup(2);
    clock.advanceDay();
    const count = queue.getBadgeCount('service');
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('accumulates items across multiple days', () => {
    const { clock, queue } = makeSetup(2);
    clock.advanceDay();
    clock.advanceDay();
    clock.advanceDay();
    expect(queue.getBadgeCount('service')).toBeGreaterThanOrEqual(3);
  });
});

// ── Queue item shape ─────────────────────────────────────────────────────────

describe('ServiceQueue — queue item shape', () => {
  it('items land in the service queue with correct dept and type', () => {
    const { clock, queue } = makeSetup(2);
    clock.advanceDay();
    const items = queue.getQueue('service');
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.dept).toBe('service');
      expect(item.type).toBe('routine');
    }
  });

  it('item labels are drawn from defined intake items', () => {
    const validLabels = FIXED_CONFIG.intakeItems.map(i => i.label);
    const { clock, queue } = makeSetup(2);
    clock.advanceDay();
    const items = queue.getQueue('service');
    for (const item of items) {
      expect(validLabels).toContain(item.label);
    }
  });

  it('item id is prefixed with svc:', () => {
    const { clock, queue } = makeSetup(2);
    clock.advanceDay();
    const items = queue.getQueue('service');
    for (const item of items) {
      expect(item.id).toMatch(/^svc:/);
    }
  });

  it('items are resolvable by id', () => {
    const { clock, queue } = makeSetup(2);
    clock.advanceDay();
    const items = queue.getQueue('service');
    const firstId = items[0].id;
    queue.resolveItem(firstId);
    expect(queue.getQueue('service').find(i => i.id === firstId)).toBeUndefined();
  });
});

// ── service:intake_ready event ───────────────────────────────────────────────

describe('ServiceQueue — service:intake_ready event', () => {
  it('publishes service:intake_ready on day_started at Tier 2', () => {
    const { bus, clock } = makeSetup(2);
    const events: unknown[] = [];
    bus.subscribe('service:intake_ready', e => events.push(e));
    clock.advanceDay();
    expect(events).toHaveLength(1);
  });

  it('does not publish service:intake_ready at Tier 1', () => {
    const { bus, clock } = makeSetup(1);
    const events: unknown[] = [];
    bus.subscribe('service:intake_ready', e => events.push(e));
    clock.advanceDay();
    expect(events).toHaveLength(0);
  });

  it('event payload has correct day', () => {
    const { bus, clock } = makeSetup(2, 5);
    const events: Array<{ day: number }> = [];
    bus.subscribe('service:intake_ready', e => events.push(e));
    clock.advanceDay(); // advances to day 6
    expect(events[0].day).toBe(6);
  });

  it('config loading returns valid schema', () => {
    const { loadServiceQueueConfig } = require('../src/game/ServiceQueue');
    const cfg = loadServiceQueueConfig();
    expect(cfg.intakeItems.length).toBeGreaterThan(0);
    expect(cfg.dailyIntakeMin).toBeGreaterThanOrEqual(1);
    expect(cfg.dailyIntakeMax).toBeGreaterThanOrEqual(cfg.dailyIntakeMin);
    expect(cfg.minTierRequired).toBeGreaterThanOrEqual(2);
  });
});

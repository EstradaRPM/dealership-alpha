import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createServiceDispatch, type ServiceDispatchConfig } from '../src/game/ServiceDispatch';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';

const MASTER_SEED = 42;

function makeAdvisor(
  effectiveness: number,
  upsell = 50,
  id = `svc-advisor:${effectiveness}`,
): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id: 'service-advisor',
    trait_ids: [],
    skills: { upsell },
    resources: { stamina: 80 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
  Object.defineProperty(plain, 'effectiveness', {
    get: () => effectiveness,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(plain, 'trustworthiness', {
    get: () => 0,
    enumerable: false,
    configurable: true,
  });
  return plain as StaffWithComposites;
}

function makeStaffOrg(roster: StaffWithComposites[]): StaffOrg {
  return {
    get currentRoster() { return roster; },
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
  };
}

const ALWAYS_RESOLVE_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 1.0,
  maxAutoResolveRate: 1.0,
  minRevenueMultiplier: 1.0,
  maxRevenueMultiplier: 1.0,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
};

const NEVER_RESOLVE_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 0.0,
  maxAutoResolveRate: 0.0,
  minRevenueMultiplier: 1.0,
  maxRevenueMultiplier: 1.0,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
};

const NORMAL_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 0.40,
  maxAutoResolveRate: 0.92,
  minRevenueMultiplier: 0.80,
  maxRevenueMultiplier: 1.30,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
};

function makeIntakePayload(day: number, count = 2) {
  return {
    day,
    items: Array.from({ length: count }, (_, i) => ({
      serviceItemId: `svc:oil_change:${day}:${i}`,
      type: 'oil_change',
      label: 'Oil change',
      baseRevenue: 75,
    })),
  };
}

function makeSetup(roster: StaffWithComposites[], config: ServiceDispatchConfig = NORMAL_CONFIG) {
  const bus = createEventBus();
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
  const queue = createDepartmentQueue({ bus });
  const staffOrg = makeStaffOrg(roster);
  createServiceDispatch({ bus, staffOrg, queue, economy, masterSeed: MASTER_SEED, config });
  return { bus, economy, queue };
}

// ── No advisor → no auto-resolve ─────────────────────────────────────────────

describe('ServiceDispatch — no advisor on roster', () => {
  it('leaves all service items in queue when no advisor is hired', () => {
    const { bus, queue } = makeSetup([]);
    bus.publish('service:intake_ready', makeIntakePayload(1, 2));
    expect(queue.getBadgeCount('service')).toBe(2);
  });

  it('emits no service:ticket_closed events when roster has no advisor', () => {
    const { bus } = makeSetup([]);
    const events: unknown[] = [];
    bus.subscribe('service:ticket_closed', e => events.push(e));
    bus.publish('service:intake_ready', makeIntakePayload(1, 2));
    expect(events).toHaveLength(0);
  });
});

// ── Always-resolve ───────────────────────────────────────────────────────────

describe('ServiceDispatch — always auto-resolve', () => {
  it('removes all items from service queue', () => {
    const { bus, queue } = makeSetup([makeAdvisor(0.8)], ALWAYS_RESOLVE_CONFIG);
    bus.publish('service:intake_ready', makeIntakePayload(1, 2));
    expect(queue.getBadgeCount('service')).toBe(0);
  });

  it('emits service:ticket_closed for each item', () => {
    const { bus } = makeSetup([makeAdvisor(0.8)], ALWAYS_RESOLVE_CONFIG);
    const events: unknown[] = [];
    bus.subscribe('service:ticket_closed', e => events.push(e));
    bus.publish('service:intake_ready', makeIntakePayload(1, 3));
    expect(events).toHaveLength(3);
  });

  it('posts revenue for items with baseRevenue > 0', () => {
    const { bus, economy } = makeSetup([makeAdvisor(0.8)], ALWAYS_RESOLVE_CONFIG);
    const cashBefore = economy.cash;
    bus.publish('service:intake_ready', makeIntakePayload(1, 2)); // oil_change $75 each
    expect(economy.cash).toBeGreaterThan(cashBefore);
  });

  it('posts no revenue for recall items (baseRevenue 0)', () => {
    const { bus, economy } = makeSetup([makeAdvisor(0.8)], ALWAYS_RESOLVE_CONFIG);
    const cashBefore = economy.cash;
    bus.publish('service:intake_ready', {
      day: 1,
      items: [{ serviceItemId: 'svc:recall:1:0', type: 'recall', label: 'Recall inspection', baseRevenue: 0 }],
    });
    expect(economy.cash).toBe(cashBefore);
  });
});

// ── Never-resolve ─────────────────────────────────────────────────────────────

describe('ServiceDispatch — never auto-resolve', () => {
  it('leaves all items in queue for player', () => {
    const { bus, queue } = makeSetup([makeAdvisor(0.8)], NEVER_RESOLVE_CONFIG);
    bus.publish('service:intake_ready', makeIntakePayload(1, 2));
    expect(queue.getBadgeCount('service')).toBe(2);
  });

  it('emits no service:ticket_closed events', () => {
    const { bus } = makeSetup([makeAdvisor(0.8)], NEVER_RESOLVE_CONFIG);
    const events: unknown[] = [];
    bus.subscribe('service:ticket_closed', e => events.push(e));
    bus.publish('service:intake_ready', makeIntakePayload(1, 2));
    expect(events).toHaveLength(0);
  });
});

// ── Ticket closed event payload ───────────────────────────────────────────────

describe('ServiceDispatch — ticket_closed payload', () => {
  it('event carries correct serviceItemId, day, and advisorId', () => {
    const advisor = makeAdvisor(0.9, 50, 'svc-advisor:test');
    const { bus } = makeSetup([advisor], ALWAYS_RESOLVE_CONFIG);
    const events: Array<{ serviceItemId: string; day: number; advisorId: string; revenue: number }> = [];
    bus.subscribe('service:ticket_closed', e => events.push(e));
    bus.publish('service:intake_ready', {
      day: 7,
      items: [{ serviceItemId: 'svc:oil_change:7:0', type: 'oil_change', label: 'Oil change', baseRevenue: 75 }],
    });
    expect(events).toHaveLength(1);
    expect(events[0].serviceItemId).toBe('svc:oil_change:7:0');
    expect(events[0].day).toBe(7);
    expect(events[0].advisorId).toBe('svc-advisor:test');
    expect(events[0].revenue).toBeGreaterThan(0);
  });
});

// ── Skill-based resolve rate ──────────────────────────────────────────────────

describe('ServiceDispatch — advisor skill affects resolve rate', () => {
  function countResolved(effectiveness: number, n: number): number {
    let resolved = 0;
    for (let i = 0; i < n; i++) {
      const bus = createEventBus();
      const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
      const queue = createDepartmentQueue({ bus });
      const staffOrg = makeStaffOrg([makeAdvisor(effectiveness)]);
      createServiceDispatch({ bus, staffOrg, queue, economy, masterSeed: MASTER_SEED, config: NORMAL_CONFIG });
      bus.subscribe('service:ticket_closed', () => { resolved++; });
      bus.publish('service:intake_ready', {
        day: i + 1,
        items: [{ serviceItemId: `svc:oil_change:${i}:0`, type: 'oil_change', label: 'Oil change', baseRevenue: 75 }],
      });
    }
    return resolved;
  }

  it('high-skill advisor resolves more tickets than low-skill', () => {
    const n = 200;
    expect(countResolved(0.95, n)).toBeGreaterThan(countResolved(0.05, n));
  });
});

// ── Config loading ────────────────────────────────────────────────────────────

describe('ServiceDispatch — config', () => {
  it('loadServiceDispatchConfig returns valid tunables', () => {
    const { loadServiceDispatchConfig } = require('../src/game/ServiceDispatch');
    const cfg = loadServiceDispatchConfig();
    expect(cfg.minAutoResolveRate).toBeGreaterThanOrEqual(0);
    expect(cfg.maxAutoResolveRate).toBeLessThanOrEqual(1);
    expect(cfg.minRevenueMultiplier).toBeGreaterThan(0);
    expect(cfg.maxRevenueMultiplier).toBeGreaterThanOrEqual(cfg.minRevenueMultiplier);
  });
});

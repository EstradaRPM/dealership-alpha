import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import {
  createServiceDispatch,
  createServiceFloorDrain,
  type ServiceDispatchConfig,
} from '../src/game/ServiceDispatch';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';
import type { PartCategory } from '../src/game/PartsInventory';

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
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  };
}

const ALWAYS_RESOLVE_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 1.0,
  maxAutoResolveRate: 1.0,
  minRevenueMultiplier: 1.0,
  maxRevenueMultiplier: 1.0,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
  rushUnlockTier: 3,
  missCsiHit: 4,
};

const NEVER_RESOLVE_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 0.0,
  maxAutoResolveRate: 0.0,
  minRevenueMultiplier: 1.0,
  maxRevenueMultiplier: 1.0,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
  rushUnlockTier: 3,
  missCsiHit: 4,
};

const NORMAL_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 0.40,
  maxAutoResolveRate: 0.92,
  minRevenueMultiplier: 0.80,
  maxRevenueMultiplier: 1.30,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
  rushUnlockTier: 3,
  missCsiHit: 4,
};

function makeItem(over: Partial<{
  serviceItemId: string;
  source: 'return' | 'conquest';
  customerId: string;
  vehicleId: string;
  category: string;
  powertrain: 'ice' | 'hybrid' | 'ev';
  jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
  baseRevenue: number;
  label: string;
}> = {}) {
  return {
    serviceItemId: 'svc:return:1:0',
    source: 'return' as const,
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    category: 'sedan',
    powertrain: 'ice' as const,
    jobCategory: 'oil_filters' as const,
    baseRevenue: 75,
    label: 'Oil & filter service',
    ...over,
  };
}

function makeIntakePayload(day: number, count = 2) {
  return {
    day,
    items: Array.from({ length: count }, (_, i) =>
      makeItem({ serviceItemId: `svc:return:${day}:${i}` }),
    ),
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

function makeDrainSetup(roster: StaffWithComposites[], config: ServiceDispatchConfig = NORMAL_CONFIG) {
  const bus = createEventBus();
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
  const queue = createDepartmentQueue({ bus });
  const staffOrg = makeStaffOrg(roster);
  const drain = createServiceFloorDrain({
    bus,
    staffOrg,
    queue,
    economy,
    masterSeed: MASTER_SEED,
    config,
  });
  return { bus, economy, queue, drain };
}

function drainTicks(
  drain: ReturnType<typeof createServiceFloorDrain>,
  count: number,
): { resolved: number; escalated: number } {
  let resolved = 0;
  let escalated = 0;
  for (let tick = 1; tick <= count; tick++) {
    const out = drain.drain({ day: 1, tick });
    resolved += out.resolved;
    escalated += out.escalated;
  }
  return { resolved, escalated };
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
      items: [makeItem({ serviceItemId: 'svc:return:1:0', baseRevenue: 0 })],
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
      items: [makeItem({ serviceItemId: 'svc:return:7:0' })],
    });
    expect(events).toHaveLength(1);
    expect(events[0].serviceItemId).toBe('svc:return:7:0');
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
        items: [makeItem({ serviceItemId: `svc:return:${i}:0` })],
      });
    }
    return resolved;
  }

  it('high-skill advisor resolves more tickets than low-skill', () => {
    const n = 200;
    expect(countResolved(0.95, n)).toBeGreaterThan(countResolved(0.05, n));
  });
});

// ── Per-tick floor drain ─────────────────────────────────────────────────────

describe('ServiceDispatch — floor drain', () => {
  it('drains captured service intake across ticks with no exception channel', () => {
    const { bus, queue, drain } = makeDrainSetup(
      [makeAdvisor(0.8)],
      ALWAYS_RESOLVE_CONFIG,
    );
    const events: unknown[] = [];
    bus.subscribe('service:ticket_closed', e => events.push(e));

    bus.publish('service:intake_ready', makeIntakePayload(1, 3));

    const totals = drainTicks(drain, 8);

    expect(totals).toEqual({ resolved: 3, escalated: 0 });
    expect(queue.getBadgeCount('service')).toBe(0);
    expect(events).toHaveLength(3);
  });

  it('bootstraps service items already queued before the day drain exists', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg([makeAdvisor(0.8)]);
    const events: unknown[] = [];
    bus.subscribe('service:ticket_closed', e => events.push(e));

    bus.publish('service:intake_ready', makeIntakePayload(2, 2));
    expect(queue.getBadgeCount('service')).toBe(2);

    const drain = createServiceFloorDrain({
      bus,
      staffOrg,
      queue,
      economy,
      masterSeed: MASTER_SEED,
      config: ALWAYS_RESOLVE_CONFIG,
    });

    const totals = drainTicks(drain, 6);

    expect(totals).toEqual({ resolved: 2, escalated: 0 });
    expect(queue.getBadgeCount('service')).toBe(0);
    expect(events).toHaveLength(2);
  });

  it('returns zero resolved/escalated and leaves work queued without an advisor', () => {
    const { bus, queue, drain } = makeDrainSetup([], ALWAYS_RESOLVE_CONFIG);
    bus.publish('service:intake_ready', makeIntakePayload(1, 2));

    const totals = drainTicks(drain, 6);

    expect(totals).toEqual({ resolved: 0, escalated: 0 });
    expect(queue.getBadgeCount('service')).toBe(2);
  });
});

// ── #304 parts gate ──────────────────────────────────────────────────────────

/**
 * Minimal PartsInventory stub exposing only what the parts gate touches
 * (`consume` / `rushOrder`). Tracks per-category stock and records rush orders,
 * so the tests assert ServiceDispatch's behaviour on its public interface
 * without coupling to PartsInventory internals.
 */
function makeStubParts(initial: Partial<Record<PartCategory, number>> = {}) {
  const stock: Record<PartCategory, number> = {
    oil_filters: 0,
    tires_brakes: 0,
    drivetrain: 0,
    electronics: 0,
    ...initial,
  };
  const rushed: PartCategory[] = [];
  return {
    consume(cat: PartCategory): boolean {
      if (stock[cat] > 0) {
        stock[cat] -= 1;
        return true;
      }
      return false;
    },
    rushOrder(cat: PartCategory, _qty = 1): void {
      rushed.push(cat);
    },
    stock,
    rushed,
  };
}

describe('ServiceDispatch — parts gate consume-on-complete', () => {
  it('consumes one matching-category part and emits parts_consumed + ticket_closed', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg([makeAdvisor(0.8)]);
    const parts = makeStubParts({ oil_filters: 2 });
    createServiceDispatch({
      bus, staffOrg, queue, economy, masterSeed: MASTER_SEED,
      config: ALWAYS_RESOLVE_CONFIG, partsInventory: parts,
    });
    const consumed: Array<{ jobCategory: string }> = [];
    const closed: unknown[] = [];
    bus.subscribe('service:parts_consumed', e => consumed.push(e));
    bus.subscribe('service:ticket_closed', e => closed.push(e));

    const cashBefore = economy.cash;
    bus.publish('service:intake_ready', {
      day: 1,
      items: [makeItem({ serviceItemId: 'svc:1', jobCategory: 'oil_filters' })],
    });

    expect(parts.stock.oil_filters).toBe(1);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].jobCategory).toBe('oil_filters');
    expect(closed).toHaveLength(1);
    expect(economy.cash).toBeGreaterThan(cashBefore);
    expect(queue.getBadgeCount('service')).toBe(0);
    expect(parts.rushed).toHaveLength(0);
  });

  it('does not consume a part when the advisor fails to auto-resolve', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg([makeAdvisor(0.8)]);
    const parts = makeStubParts({ oil_filters: 2 });
    createServiceDispatch({
      bus, staffOrg, queue, economy, masterSeed: MASTER_SEED,
      config: NEVER_RESOLVE_CONFIG, partsInventory: parts,
    });
    bus.publish('service:intake_ready', {
      day: 1,
      items: [makeItem({ serviceItemId: 'svc:1' })],
    });
    expect(parts.stock.oil_filters).toBe(2);
  });
});

describe('ServiceDispatch — parts gate miss (rush locked)', () => {
  it('turns the job away: job_missed with lost revenue + CSI hit, no ticket_closed, no revenue', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg([makeAdvisor(0.8)]);
    const parts = makeStubParts({ oil_filters: 0 });
    createServiceDispatch({
      bus, staffOrg, queue, economy, masterSeed: MASTER_SEED,
      config: ALWAYS_RESOLVE_CONFIG, partsInventory: parts,
      isRushUnlocked: () => false,
    });
    const missed: Array<{ lostRevenue: number; csiHit: number; jobCategory: string; customerId: string }> = [];
    const closed: unknown[] = [];
    bus.subscribe('service:job_missed', e => missed.push(e));
    bus.subscribe('service:ticket_closed', e => closed.push(e));

    const cashBefore = economy.cash;
    bus.publish('service:intake_ready', {
      day: 1,
      items: [makeItem({ serviceItemId: 'svc:1', baseRevenue: 75, customerId: 'cust-9' })],
    });

    expect(missed).toHaveLength(1);
    expect(missed[0].lostRevenue).toBe(75);
    expect(missed[0].csiHit).toBe(ALWAYS_RESOLVE_CONFIG.missCsiHit);
    expect(missed[0].jobCategory).toBe('oil_filters');
    expect(missed[0].customerId).toBe('cust-9');
    expect(closed).toHaveLength(0);
    expect(economy.cash).toBe(cashBefore);
    // The turned-away ticket is cleared from the queue (not left lingering).
    expect(queue.getBadgeCount('service')).toBe(0);
    expect(parts.rushed).toHaveLength(0);
  });
});

describe('ServiceDispatch — parts gate rush (unlocked)', () => {
  it('rush-orders the part and completes the job at full revenue', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg([makeAdvisor(0.8)]);
    const parts = makeStubParts({ tires_brakes: 0 });
    createServiceDispatch({
      bus, staffOrg, queue, economy, masterSeed: MASTER_SEED,
      config: ALWAYS_RESOLVE_CONFIG, partsInventory: parts,
      isRushUnlocked: () => true,
    });
    const rushed: Array<{ revenue: number; jobCategory: string }> = [];
    const missed: unknown[] = [];
    const closed: unknown[] = [];
    bus.subscribe('service:job_rushed', e => rushed.push(e));
    bus.subscribe('service:job_missed', e => missed.push(e));
    bus.subscribe('service:ticket_closed', e => closed.push(e));

    const cashBefore = economy.cash;
    bus.publish('service:intake_ready', {
      day: 1,
      items: [makeItem({ serviceItemId: 'svc:1', jobCategory: 'tires_brakes', baseRevenue: 120 })],
    });

    expect(parts.rushed).toEqual(['tires_brakes']);
    expect(rushed).toHaveLength(1);
    expect(rushed[0].revenue).toBe(120);
    expect(missed).toHaveLength(0);
    expect(closed).toHaveLength(1);
    expect(economy.cash).toBeGreaterThan(cashBefore);
    expect(queue.getBadgeCount('service')).toBe(0);
  });
});

describe('ServiceDispatch — parts gate cadence-invariance', () => {
  // Three oil-filter jobs against a stock of 2, rush locked: the first two
  // consume a part and close, the third misses. Legacy once-per-intake path and
  // per-tick floor drain must produce the identical (event, ticketId) sequence.
  function intakeOf(day: number) {
    return {
      day,
      items: [0, 1, 2].map(i =>
        makeItem({ serviceItemId: `svc:${i}`, jobCategory: 'oil_filters', baseRevenue: 75 }),
      ),
    };
  }

  function recordLog(bus: ReturnType<typeof createEventBus>): Array<[string, string]> {
    const log: Array<[string, string]> = [];
    bus.subscribe('service:parts_consumed', e => log.push(['consumed', e.serviceItemId]));
    bus.subscribe('service:job_missed', e => log.push(['missed', e.serviceItemId]));
    bus.subscribe('service:ticket_closed', e => log.push(['closed', e.serviceItemId]));
    return log;
  }

  it('legacy path and per-tick drain yield identical outcomes', () => {
    // Legacy path.
    const busA = createEventBus();
    const econA = createEconomy({ bus: busA, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const queueA = createDepartmentQueue({ bus: busA });
    const partsA = makeStubParts({ oil_filters: 2 });
    createServiceDispatch({
      bus: busA, staffOrg: makeStaffOrg([makeAdvisor(0.8)]), queue: queueA, economy: econA,
      masterSeed: MASTER_SEED, config: ALWAYS_RESOLVE_CONFIG, partsInventory: partsA, isRushUnlocked: () => false,
    });
    const logA = recordLog(busA);
    busA.publish('service:intake_ready', intakeOf(1));

    // Per-tick drain path.
    const busB = createEventBus();
    const econB = createEconomy({ bus: busB, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const queueB = createDepartmentQueue({ bus: busB });
    const partsB = makeStubParts({ oil_filters: 2 });
    const drainB = createServiceFloorDrain({
      bus: busB, staffOrg: makeStaffOrg([makeAdvisor(0.8)]), queue: queueB, economy: econB,
      masterSeed: MASTER_SEED, config: ALWAYS_RESOLVE_CONFIG, partsInventory: partsB, isRushUnlocked: () => false,
    });
    const logB = recordLog(busB);
    busB.publish('service:intake_ready', intakeOf(1));
    drainTicks(drainB, 12);

    expect(logA).toEqual([
      ['consumed', 'svc:0'], ['closed', 'svc:0'],
      ['consumed', 'svc:1'], ['closed', 'svc:1'],
      ['missed', 'svc:2'],
    ]);
    expect(logB).toEqual(logA);
    expect(partsA.stock.oil_filters).toBe(0);
    expect(partsB.stock.oil_filters).toBe(0);
    expect(econA.cash).toBe(econB.cash);
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

import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { readOnlyFacility } from './helpers/facility';
import {
  createServiceDispatch,
  createServiceFloorDrain,
  createServiceReadModel,
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
    headcountCap: Infinity,
    getSlots: (roleId: string) => ({ roleId, filled: 0, total: Infinity }),
    getSlotBoard: () => [],
    dailyPayroll: 0,
    getPayBoard: () => [],
    getSkillGrowth: () => [],
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
    getRaiseRequests: () => [],
    getRaiseRequest: () => null,
    acceptRaise: () => {},
    refuseRaise: () => {},
    getPromotionOptions: () => [],
    promote: () => {},
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  };
}

// competitive==premium==1.0 so per-ticket revenue == baseRevenue regardless of
// posture; maxWaitTicks high so capacity-starvation eviction never fires in the
// throughput/parts tests. An unwired `bays` dep is one bay, so a single advisor
// = 1 slot,
// reproducing the pre-#305 single-rate throughput.
const ALWAYS_RESOLVE_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 1.0,
  maxAutoResolveRate: 1.0,
  competitivePriceMultiplier: 1.0,
  premiumPriceMultiplier: 1.0,
  minPerSlotThroughput: 0.15,
  maxPerSlotThroughput: 0.60,
  maxWaitTicks: 9999,
  unservedCsiHit: 3,
  rushUnlockTier: 3,
  missCsiHit: 4,
};

const NEVER_RESOLVE_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 0.0,
  maxAutoResolveRate: 0.0,
  competitivePriceMultiplier: 1.0,
  premiumPriceMultiplier: 1.0,
  minPerSlotThroughput: 0.15,
  maxPerSlotThroughput: 0.60,
  maxWaitTicks: 9999,
  unservedCsiHit: 3,
  rushUnlockTier: 3,
  missCsiHit: 4,
};

const NORMAL_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 0.40,
  maxAutoResolveRate: 0.92,
  competitivePriceMultiplier: 1.0,
  premiumPriceMultiplier: 1.0,
  minPerSlotThroughput: 0.15,
  maxPerSlotThroughput: 0.60,
  maxWaitTicks: 9999,
  unservedCsiHit: 3,
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
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
  const queue = createDepartmentQueue({ bus });
  const staffOrg = makeStaffOrg(roster);
  createServiceDispatch({ bus, staffOrg, queue, economy, masterSeed: MASTER_SEED, config });
  return { bus, economy, queue };
}

function makeDrainSetup(roster: StaffWithComposites[], config: ServiceDispatchConfig = NORMAL_CONFIG) {
  const bus = createEventBus();
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
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
      const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
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
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
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
    windows_glass: 0,
    doors_panels: 0,
    interior_trim: 0,
    paint: 0,
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
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
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
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
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
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
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
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
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
    const econA = createEconomy({ bus: busA, startingCash: 50_000, config: { weeklyRent: 0 } });
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
    const econB = createEconomy({ bus: busB, startingCash: 50_000, config: { weeklyRent: 0 } });
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

// ── #305 pricing posture / capacity / read-model ─────────────────────────────

function svcConfig(over: Partial<ServiceDispatchConfig> = {}): ServiceDispatchConfig {
  return { ...ALWAYS_RESOLVE_CONFIG, ...over };
}

function makeDrainSetupX(
  roster: StaffWithComposites[],
  opts: {
    config?: ServiceDispatchConfig;
    bays?: number;
    readModel?: ReturnType<typeof createServiceReadModel>;
    getPricingPosture?: () => number;
  } = {},
) {
  const bus = createEventBus();
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
  const queue = createDepartmentQueue({ bus });
  const staffOrg = makeStaffOrg(roster);
  const drain = createServiceFloorDrain({
    bus,
    staffOrg,
    queue,
    economy,
    masterSeed: MASTER_SEED,
    config: opts.config ?? NORMAL_CONFIG,
    bays: opts.bays,
    readModel: opts.readModel,
    getPricingPosture: opts.getPricingPosture,
  });
  return { bus, economy, queue, drain };
}

describe('ServiceDispatch — #305 pricing-posture revenue', () => {
  // competitive 0.5×, premium 1.5× on a $100 ticket.
  const POSTURE_CONFIG = svcConfig({
    competitivePriceMultiplier: 0.5,
    premiumPriceMultiplier: 1.5,
  });

  function revenueAtPosture(posture: number): number {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg([makeAdvisor(0.8)]);
    createServiceDispatch({
      bus, staffOrg, queue, economy, masterSeed: MASTER_SEED,
      config: POSTURE_CONFIG, getPricingPosture: () => posture,
    });
    let revenue = 0;
    bus.subscribe('service:ticket_closed', e => { revenue = e.revenue; });
    bus.publish('service:intake_ready', {
      day: 1,
      items: [makeItem({ serviceItemId: 'svc:1', baseRevenue: 100 })],
    });
    return revenue;
  }

  it('scales per-ticket revenue by the competitive↔premium dial, not flat upsell', () => {
    expect(revenueAtPosture(0)).toBe(50); // competitive end: 100 × 0.5
    expect(revenueAtPosture(1)).toBe(150); // premium end: 100 × 1.5
    expect(revenueAtPosture(0.5)).toBe(100); // midpoint
    expect(revenueAtPosture(1)).toBeGreaterThan(revenueAtPosture(0));
  });

  it('advisor upsell skill no longer changes revenue (posture-only)', () => {
    function revWithUpsell(upsell: number): number {
      const bus = createEventBus();
      const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
      const queue = createDepartmentQueue({ bus });
      createServiceDispatch({
        bus, staffOrg: makeStaffOrg([makeAdvisor(0.8, upsell)]), queue, economy,
        masterSeed: MASTER_SEED, config: POSTURE_CONFIG, getPricingPosture: () => 0.5,
      });
      let revenue = 0;
      bus.subscribe('service:ticket_closed', e => { revenue = e.revenue; });
      bus.publish('service:intake_ready', { day: 1, items: [makeItem({ serviceItemId: 'svc:1', baseRevenue: 100 })] });
      return revenue;
    }
    expect(revWithUpsell(0)).toBe(revWithUpsell(100));
  });
});

describe('ServiceDispatch — #305 capacity = min(bays, advisors on duty)', () => {
  // Flat per-slot rate isolates the slot count from advisor skill.
  const FLAT = svcConfig({ minPerSlotThroughput: 0.5, maxPerSlotThroughput: 0.5 });

  function resolvedWith(roster: StaffWithComposites[], bays: number): number {
    const { bus, drain } = makeDrainSetupX(roster, { config: FLAT, bays });
    bus.publish('service:intake_ready', makeIntakePayload(1, 30));
    return drainTicks(drain, 20).resolved;
  }

  function advisors(n: number): StaffWithComposites[] {
    return Array.from({ length: n }, (_, i) => makeAdvisor(0.8, 50, `adv-${i}`));
  }

  it('adding advisors beyond bays does not raise throughput (bay-bound)', () => {
    // 2 built bays. 2 advisors saturate them; 4 advisors clear no more.
    const twoAdv = resolvedWith(advisors(2), 2);
    const fourAdv = resolvedWith(advisors(4), 2);
    expect(fourAdv).toBe(twoAdv);
    // And both clear strictly more than a single advisor (1 slot).
    expect(twoAdv).toBeGreaterThan(resolvedWith(advisors(1), 2));
  });

  it('adding bays beyond advisors does not raise throughput (advisor-bound)', () => {
    // 1 advisor = 1 slot whether the store has built 2 bays or 6.
    expect(resolvedWith(advisors(1), 6)).toBe(resolvedWith(advisors(1), 2));
  });

  it('no advisors ⇒ no throughput regardless of bays', () => {
    expect(resolvedWith([], 6)).toBe(0);
  });

  // #358 — the bay count comes from the Facility module (the one bay truth),
  // not from a `baysByTier` constant this config used to carry. Driven through
  // a real Facility so the seam the Service package uses is the seam under test.
  it('takes its bay count from the facility provider', () => {
    const atTier = (tier: number) =>
      readOnlyFacility(() => tier).getBuilt().serviceBays;
    // The provider is what the numbers move with: a bigger store, built out,
    // clears strictly more with the same four advisors.
    expect(atTier(3)).toBeGreaterThan(atTier(1));
    expect(resolvedWith(advisors(4), atTier(3))).toBeGreaterThan(
      resolvedWith(advisors(4), atTier(1)),
    );
    // And it is the SAME number the Service package hands the engine — the
    // count is bay-bound at the provider's value, not at some tier lookup.
    expect(resolvedWith(advisors(4), atTier(1))).toBe(
      resolvedWith(advisors(2), atTier(1)),
    );
  });
});

describe('ServiceDispatch — #305 per-slot throughput scales with advisor skill', () => {
  function resolvedAtSkill(eff: number): number {
    const { bus, drain } = makeDrainSetupX([makeAdvisor(eff)], {
      config: svcConfig(), // min 0.15 / max 0.60 per-slot
      bays: 2,
    });
    bus.publish('service:intake_ready', makeIntakePayload(1, 30));
    return drainTicks(drain, 30).resolved;
  }

  it('a sharper advisor clears more jobs over the same ticks', () => {
    expect(resolvedAtSkill(0.95)).toBeGreaterThan(resolvedAtSkill(0.05));
  });
});

describe('ServiceDispatch — #305 overflow → wait → unserved + CSI', () => {
  it('jobs backed up past maxWaitTicks leave unserved with a CSI hit and no ticket_closed', () => {
    const config = svcConfig({
      minPerSlotThroughput: 0.5,
      maxPerSlotThroughput: 0.5,
      maxWaitTicks: 5,
    });
    const { bus, economy, drain } = makeDrainSetupX([makeAdvisor(0.8)], {
      config,
      bays: 2,
    });
    const closed: Array<{ serviceItemId: string }> = [];
    const unserved: Array<{ serviceItemId: string; csiHit: number; waitTicks: number }> = [];
    bus.subscribe('service:ticket_closed', e => closed.push(e));
    bus.subscribe('service:job_unserved', e => unserved.push(e));

    const cashBefore = economy.cash;
    bus.publish('service:intake_ready', makeIntakePayload(1, 8));
    drainTicks(drain, 40);

    // Every job is terminal exactly once — served or unserved, never both.
    expect(closed.length).toBeGreaterThan(0);
    expect(unserved.length).toBeGreaterThan(0);
    expect(closed.length + unserved.length).toBe(8);
    const closedIds = new Set(closed.map(e => e.serviceItemId));
    expect(unserved.every(e => !closedIds.has(e.serviceItemId))).toBe(true);

    // Each unserved job carries the configured CSI hit and waited past the cap.
    for (const e of unserved) {
      expect(e.csiHit).toBe(config.unservedCsiHit);
      expect(e.waitTicks).toBeGreaterThan(config.maxWaitTicks);
    }
    // Revenue only posts for served jobs (the backlog earns nothing).
    expect(economy.cash).toBeGreaterThan(cashBefore);
  });
});

describe('ServiceDispatch — #305 live capacity read-model', () => {
  it('reports waiting / in-progress / avg-wait / utilization accurately', () => {
    const readModel = createServiceReadModel();
    // Fresh model before any tick: zeros (closed shop).
    expect(readModel.read()).toEqual({
      slots: 0, inProgress: 0, waiting: 0, avgWaitTicks: 0, utilization: 0,
    });

    const config = svcConfig({ minPerSlotThroughput: 0.5, maxPerSlotThroughput: 0.5 });
    const { bus, drain } = makeDrainSetupX([makeAdvisor(0.8)], {
      config,
      bays: 2, // 2 bays, 1 advisor → 1 slot
      readModel,
    });
    bus.publish('service:intake_ready', makeIntakePayload(1, 5));

    // Tick 1: 1 slot busy, full backlog still waiting (rate 0.5 ⇒ 0 served yet).
    drain.drain({ day: 1, tick: 1 });
    let load = readModel.read();
    expect(load.slots).toBe(1);
    expect(load.inProgress).toBe(1);
    expect(load.utilization).toBe(1);
    expect(load.waiting).toBe(5);
    expect(load.avgWaitTicks).toBe(1);

    // Drain it down; the backlog shrinks.
    drainTicks(drain, 30);
    load = readModel.read();
    expect(load.waiting).toBe(0);
    expect(load.inProgress).toBe(0);
    expect(load.utilization).toBe(0);
  });

  it('utilization is partial when jobs are fewer than slots', () => {
    const readModel = createServiceReadModel();
    const { bus, drain } = makeDrainSetupX(
      [makeAdvisor(0.8, 50, 'a'), makeAdvisor(0.8, 50, 'b'), makeAdvisor(0.8, 50, 'c'), makeAdvisor(0.8, 50, 'd')],
      { config: svcConfig(), bays: 2, readModel }, // 2 bays, 4 advisors → 2 slots
    );
    bus.publish('service:intake_ready', makeIntakePayload(1, 1)); // a single job
    drain.drain({ day: 1, tick: 1 });
    const load = readModel.read();
    expect(load.slots).toBe(2);
    expect(load.inProgress).toBe(1);
    expect(load.utilization).toBe(0.5);
  });

  it('with no advisors slots is 0, utilization 0, and the backlog grows', () => {
    const readModel = createServiceReadModel();
    const { bus, drain } = makeDrainSetupX([], { config: svcConfig(), bays: 2, readModel });
    bus.publish('service:intake_ready', makeIntakePayload(1, 3));
    drain.drain({ day: 1, tick: 1 });
    const load = readModel.read();
    expect(load.slots).toBe(0);
    expect(load.utilization).toBe(0);
    expect(load.inProgress).toBe(0);
    expect(load.waiting).toBe(3);
  });
});

// ── Config loading ────────────────────────────────────────────────────────────

describe('ServiceDispatch — config', () => {
  it('loadServiceDispatchConfig returns valid tunables', () => {
    const { loadServiceDispatchConfig } = require('../src/game/ServiceDispatch');
    const cfg = loadServiceDispatchConfig();
    expect(cfg.minAutoResolveRate).toBeGreaterThanOrEqual(0);
    expect(cfg.maxAutoResolveRate).toBeLessThanOrEqual(1);
    expect(cfg.competitivePriceMultiplier).toBeGreaterThan(0);
    expect(cfg.premiumPriceMultiplier).toBeGreaterThanOrEqual(cfg.competitivePriceMultiplier);
    expect(cfg.maxPerSlotThroughput).toBeGreaterThanOrEqual(cfg.minPerSlotThroughput);
    expect(cfg.maxWaitTicks).toBeGreaterThan(0);
  });
});

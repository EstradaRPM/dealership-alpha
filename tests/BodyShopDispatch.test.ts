import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createBodyShopDepartment } from '../src/bodyShopDepartment';
import { loadTunables } from '../src/game/data';
import type { BodyShopDispatchConfig } from '../src/bodyShopDispatchConfig';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';
import type { PartsInventory, PartCategory } from '../src/game/PartsInventory';
import type { Reputation } from '../src/game/Reputation';
import type { Weather } from '../src/game/Weather';
import type { TierManager } from '../src/game/CareerProgression';

const MASTER_SEED = 42;

// ── Stubs ────────────────────────────────────────────────────────────────────

function makeAdvisor(
  effectiveness: number,
  id = `bs-advisor:${effectiveness}`,
): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id: 'body-shop-advisor',
    trait_ids: [],
    skills: {},
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
    get currentRoster() {
      return roster;
    },
    headcountCap: Infinity,
    getSlots: (roleId: string) => ({ roleId, filled: 0, total: Infinity }),
    getSlotBoard: () => [],
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
    getPromotionOptions: () => [],
    promote: () => {},
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  } as unknown as StaffOrg;
}

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
  const parts = {
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
  return parts;
}

// Fully-stocked parts room (all categories) — the default for tests that aren't
// exercising the parts gate, so every resolved job closes rather than missing on
// an empty shelf. Parts-gate tests pass their own controlled stub instead.
function stockedParts() {
  return makeStubParts({
    oil_filters: 9999,
    tires_brakes: 9999,
    drivetrain: 9999,
    electronics: 9999,
    windows_glass: 9999,
    doors_panels: 9999,
    interior_trim: 9999,
    paint: 9999,
  });
}

const stubReputation = { reviewScore: 80 } as unknown as Reputation;
const stubWeather = {
  weatherForDay: () => ({ conditionId: 'clear', season: 'summer' }),
} as unknown as Weather;

function stubTier(currentTier: number): TierManager {
  return { currentTier } as unknown as TierManager;
}

// competitive baseline: insurance pass-through 1.0×, retail floor..ceil 1.0..1.4.
// always-resolve + high maxWaitTicks so capacity-starvation never fires unless a
// test sets it; bays at Tier 3 generous.
function bsConfig(over: Partial<BodyShopDispatchConfig> = {}): BodyShopDispatchConfig {
  return {
    minAutoResolveRate: 1.0,
    maxAutoResolveRate: 1.0,
    minPerSlotThroughput: 0.15,
    maxPerSlotThroughput: 0.6,
    baysByTier: { '1': 0, '2': 0, '3': 6, '4': 8, '5': 10 },
    maxWaitTicks: 9999,
    unservedCsiHit: 3,
    rushUnlockTier: 4,
    missCsiHit: 4,
    insuranceRateMultiplier: 1.0,
    retailFloorMultiplier: 1.0,
    retailCeilMultiplier: 1.4,
    ...over,
  };
}

function makeDept(
  roster: StaffWithComposites[],
  opts: {
    config?: BodyShopDispatchConfig;
    tier?: number;
    parts?: ReturnType<typeof makeStubParts>;
  } = {},
) {
  const bus = createEventBus();
  const economy = createEconomy({
    bus,
    startingCash: 50_000,
    config: { weeklyRent: 0, weeklyPayrollStub: 0 },
  });
  const queue = createDepartmentQueue({ bus });
  const dept = createBodyShopDepartment({
    bus,
    masterSeed: MASTER_SEED,
    economy,
    staffOrg: makeStaffOrg(roster),
    tierManager: stubTier(opts.tier ?? 3),
    departmentQueue: queue,
    reputation: stubReputation,
    weather: stubWeather,
    partsInventory: (opts.parts ?? stockedParts()) as unknown as PartsInventory,
    managerGates: loadTunables().managerGates,
    config: opts.config ?? bsConfig(),
  });
  return { bus, economy, queue, dept };
}

function bsItem(
  over: Partial<{
    bodyShopItemId: string;
    source: 'insurance' | 'retail';
    customerId: string;
    vehicleId: string;
    category: string;
    powertrain: 'ice' | 'hybrid' | 'ev';
    jobCategory: 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';
    baseRevenue: number;
    label: string;
  }> = {},
) {
  return {
    bodyShopItemId: 'bs:retail:1:0',
    source: 'retail' as const,
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    category: 'sedan',
    powertrain: 'ice' as const,
    jobCategory: 'paint' as const,
    baseRevenue: 1000,
    label: 'Paint & refinish',
    ...over,
  };
}

function intakePayload(day: number, count: number, over: Parameters<typeof bsItem>[0] = {}) {
  return {
    day,
    items: Array.from({ length: count }, (_, i) =>
      bsItem({ bodyShopItemId: `bs:retail:${day}:${i}`, ...over }),
    ),
  };
}

function drainTicks(drain: { drain: (c: { day: number; tick: number }) => { resolved: number; escalated: number } }, count: number) {
  let resolved = 0;
  let escalated = 0;
  for (let tick = 1; tick <= count; tick++) {
    const out = drain.drain({ day: 1, tick });
    resolved += out.resolved;
    escalated += out.escalated;
  }
  return { resolved, escalated };
}

// ── Collision-intake resolution through the shared dispatch ──────────────────

describe('BodyShopDispatch — collision-intake resolution', () => {
  it('resolves bodyshop intake through the shared drain and posts revenue', () => {
    const { bus, economy, queue, dept } = makeDept([makeAdvisor(0.8)]);
    const closed: Array<{ bodyShopItemId: string; revenue: number }> = [];
    bus.subscribe('bodyshop:ticket_closed', (e) => closed.push(e));
    const drain = dept.createFloorDrain();

    const cashBefore = economy.cash;
    bus.publish('bodyshop:intake_ready', intakePayload(1, 3));
    const totals = drainTicks(drain, 12);

    expect(totals).toEqual({ resolved: 3, escalated: 0 });
    expect(closed).toHaveLength(3);
    expect(queue.getBadgeCount('bodyshop')).toBe(0);
    expect(economy.cash).toBeGreaterThan(cashBefore);
  });

  it('resolves nothing without a body-shop advisor on the roster', () => {
    const { bus, queue, dept } = makeDept([]);
    const drain = dept.createFloorDrain();
    bus.publish('bodyshop:intake_ready', intakePayload(1, 3));
    const totals = drainTicks(drain, 12);
    expect(totals).toEqual({ resolved: 0, escalated: 0 });
    expect(queue.getBadgeCount('bodyshop')).toBe(3);
  });

  it('end-to-end: CollisionStream → BodyShopQueue → drain at Tier 3 closes collision jobs', () => {
    // Drive the real demand spine across days; deterministic from masterSeed+day.
    const { bus, economy, dept } = makeDept([makeAdvisor(0.9)], { tier: 3 });
    const closed: unknown[] = [];
    const intakeReady: unknown[] = [];
    bus.subscribe('bodyshop:ticket_closed', (e) => closed.push(e));
    bus.subscribe('bodyshop:intake_ready', (e) => intakeReady.push(e));

    // Reach Tier 3 the way real play does — the BodyShopQueue arms off the
    // career:tier_up event (it's dark below the showroom tier).
    bus.publish('career:tier_up', { fromTier: 2, toTier: 3, day: 0 });

    const cashBefore = economy.cash;
    let totalResolved = 0;
    for (let day = 1; day <= 20; day++) {
      bus.publish('clock:day_started', { day });
      const drain = dept.createFloorDrain();
      totalResolved += drainTicks(drain, 30).resolved;
    }

    // Some collision demand was gated through to the lane and resolved.
    expect(intakeReady.length).toBeGreaterThan(0);
    expect(totalResolved).toBeGreaterThan(0);
    expect(closed.length).toBe(totalResolved);
    expect(economy.cash).toBeGreaterThan(cashBefore);
  });
});

// ── Parts gate over Body-Shop categories ─────────────────────────────────────

describe('BodyShopDispatch — parts gate over collision categories', () => {
  it('consumes one matching collision-category part and emits parts_consumed', () => {
    const parts = makeStubParts({ paint: 2 });
    const { bus, queue, dept } = makeDept([makeAdvisor(0.8)], { parts });
    const consumed: Array<{ jobCategory: string }> = [];
    bus.subscribe('bodyshop:parts_consumed', (e) => consumed.push(e));
    const drain = dept.createFloorDrain();

    bus.publish('bodyshop:intake_ready', {
      day: 1,
      items: [bsItem({ bodyShopItemId: 'bs:1', jobCategory: 'paint' })],
    });
    drainTicks(drain, 4);

    expect(parts.stock.paint).toBe(1);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].jobCategory).toBe('paint');
    expect(queue.getBadgeCount('bodyshop')).toBe(0);
    expect(parts.rushed).toHaveLength(0);
  });

  it('miss (rush locked, below rush tier): job_missed, no ticket_closed, no revenue', () => {
    const parts = makeStubParts({ doors_panels: 0 });
    // Tier 3 < rushUnlockTier 4 ⇒ rush locked.
    const { bus, economy, queue, dept } = makeDept([makeAdvisor(0.8)], {
      parts,
      tier: 3,
    });
    const missed: Array<{ lostRevenue: number; csiHit: number; jobCategory: string }> = [];
    const closed: unknown[] = [];
    bus.subscribe('bodyshop:job_missed', (e) => missed.push(e));
    bus.subscribe('bodyshop:ticket_closed', (e) => closed.push(e));
    const drain = dept.createFloorDrain();

    const cashBefore = economy.cash;
    bus.publish('bodyshop:intake_ready', {
      day: 1,
      items: [bsItem({ bodyShopItemId: 'bs:1', jobCategory: 'doors_panels', baseRevenue: 1500 })],
    });
    drainTicks(drain, 4);

    expect(missed).toHaveLength(1);
    expect(missed[0].jobCategory).toBe('doors_panels');
    expect(missed[0].csiHit).toBe(4);
    expect(closed).toHaveLength(0);
    expect(economy.cash).toBe(cashBefore);
    expect(queue.getBadgeCount('bodyshop')).toBe(0);
    expect(parts.rushed).toHaveLength(0);
  });

  it('rush (unlocked at the rush tier): rush-orders the part and completes', () => {
    const parts = makeStubParts({ windows_glass: 0 });
    const { bus, economy, dept } = makeDept([makeAdvisor(0.8)], {
      parts,
      tier: 4, // >= rushUnlockTier 4
    });
    const rushed: Array<{ jobCategory: string }> = [];
    const closed: unknown[] = [];
    bus.subscribe('bodyshop:job_rushed', (e) => rushed.push(e));
    bus.subscribe('bodyshop:ticket_closed', (e) => closed.push(e));
    const drain = dept.createFloorDrain();

    const cashBefore = economy.cash;
    bus.publish('bodyshop:intake_ready', {
      day: 1,
      items: [bsItem({ bodyShopItemId: 'bs:1', jobCategory: 'windows_glass', baseRevenue: 800 })],
    });
    drainTicks(drain, 4);

    expect(parts.rushed).toEqual(['windows_glass']);
    expect(rushed).toHaveLength(1);
    expect(closed).toHaveLength(1);
    expect(economy.cash).toBeGreaterThan(cashBefore);
  });
});

// ── Capacity bound min(bays, advisors) ───────────────────────────────────────

describe('BodyShopDispatch — capacity = min(bays, advisors on duty)', () => {
  // Flat per-slot rate isolates slot count from skill; 2 bays at Tier 3.
  const FLAT = bsConfig({
    minPerSlotThroughput: 0.5,
    maxPerSlotThroughput: 0.5,
    baysByTier: { '1': 0, '2': 0, '3': 2, '4': 8, '5': 10 },
  });

  function advisors(n: number): StaffWithComposites[] {
    return Array.from({ length: n }, (_, i) => makeAdvisor(0.8, `adv-${i}`));
  }

  function resolvedWith(roster: StaffWithComposites[]): number {
    const { bus, dept } = makeDept(roster, { config: FLAT, tier: 3 });
    const drain = dept.createFloorDrain();
    bus.publish('bodyshop:intake_ready', intakePayload(1, 30));
    return drainTicks(drain, 20).resolved;
  }

  it('adding advisors beyond bays does not raise throughput (bay-bound)', () => {
    const twoAdv = resolvedWith(advisors(2)); // saturates 2 bays
    const fourAdv = resolvedWith(advisors(4));
    expect(fourAdv).toBe(twoAdv);
    expect(twoAdv).toBeGreaterThan(resolvedWith(advisors(1)));
  });

  it('no advisors ⇒ no throughput regardless of bays', () => {
    expect(resolvedWith([])).toBe(0);
  });

  it('throughput scales with advisor skill', () => {
    function resolvedAtSkill(eff: number): number {
      const { bus, dept } = makeDept([makeAdvisor(eff)], { config: bsConfig(), tier: 3 });
      const drain = dept.createFloorDrain();
      bus.publish('bodyshop:intake_ready', intakePayload(1, 40));
      return drainTicks(drain, 30).resolved;
    }
    expect(resolvedAtSkill(0.95)).toBeGreaterThan(resolvedAtSkill(0.05));
  });
});

// ── Channel-posture revenue (insurance rate-capped vs retail player-priced) ──

describe('BodyShopDispatch — insurance/retail channel-posture revenue', () => {
  function revenueOf(
    source: 'insurance' | 'retail',
    posture: number,
    baseRevenue = 1000,
  ): number {
    const { bus, dept } = makeDept([makeAdvisor(0.8)], { config: bsConfig() });
    dept.setBodyShopChannelPosture(posture);
    let revenue = 0;
    bus.subscribe('bodyshop:ticket_closed', (e) => {
      revenue = e.revenue;
    });
    const drain = dept.createFloorDrain();
    bus.publish('bodyshop:intake_ready', {
      day: 1,
      items: [bsItem({ bodyShopItemId: 'bs:1', source, baseRevenue })],
    });
    drainTicks(drain, 4);
    return revenue;
  }

  it('insurance jobs are rate-capped: revenue == baseRevenue, posture-independent', () => {
    // insuranceRateMultiplier 1.0 → the already-capped baseRevenue passes through.
    expect(revenueOf('insurance', 0)).toBe(1000);
    expect(revenueOf('insurance', 1)).toBe(1000);
  });

  it('retail jobs are player-priced: posture lifts revenue floor→ceiling', () => {
    expect(revenueOf('retail', 0)).toBe(1000); // floor 1.0×
    expect(revenueOf('retail', 1)).toBe(1400); // ceiling 1.4×
    expect(revenueOf('retail', 0.5)).toBe(1200); // midpoint
    expect(revenueOf('retail', 1)).toBeGreaterThan(revenueOf('retail', 0));
  });

  it('channel posture getter/setter clamps to [0,1]', () => {
    const { dept } = makeDept([makeAdvisor(0.8)]);
    expect(dept.getBodyShopChannelPosture()).toBe(0.5);
    dept.setBodyShopChannelPosture(1.7);
    expect(dept.getBodyShopChannelPosture()).toBe(1);
    dept.setBodyShopChannelPosture(-0.3);
    expect(dept.getBodyShopChannelPosture()).toBe(0);
  });
});

// ── Live read-model ──────────────────────────────────────────────────────────

describe('BodyShopDispatch — live read-model', () => {
  it('reports slots / in-progress / waiting / avg-wait / utilization accurately', () => {
    const config = bsConfig({
      minPerSlotThroughput: 0.5,
      maxPerSlotThroughput: 0.5,
      baysByTier: { '1': 0, '2': 0, '3': 1, '4': 8, '5': 10 },
    });
    const { bus, dept } = makeDept([makeAdvisor(0.8)], { config, tier: 3 });
    const readModel = dept.bodyShopReadModel;

    const drain = dept.createFloorDrain();
    bus.publish('bodyshop:intake_ready', intakePayload(1, 5));

    // Tick 1: 1 slot busy, full backlog still waiting (rate 0.5 ⇒ 0 served yet).
    drain.drain({ day: 1, tick: 1 });
    let load = readModel.read();
    expect(load.slots).toBe(1);
    expect(load.inProgress).toBe(1);
    expect(load.utilization).toBe(1);
    expect(load.waiting).toBe(5);
    expect(load.avgWaitTicks).toBe(1);

    // Drain it down; the backlog clears.
    drainTicks(drain, 30);
    load = readModel.read();
    expect(load.waiting).toBe(0);
    expect(load.inProgress).toBe(0);
    expect(load.utilization).toBe(0);
  });

  it('jobs that wait past maxWaitTicks leave unserved with a CSI hit', () => {
    const config = bsConfig({
      minPerSlotThroughput: 0.5,
      maxPerSlotThroughput: 0.5,
      baysByTier: { '1': 0, '2': 0, '3': 1, '4': 8, '5': 10 },
      maxWaitTicks: 5,
    });
    const { bus, dept } = makeDept([makeAdvisor(0.8)], { config, tier: 3 });
    const closed: Array<{ bodyShopItemId: string }> = [];
    const unserved: Array<{ bodyShopItemId: string; csiHit: number; waitTicks: number }> = [];
    bus.subscribe('bodyshop:ticket_closed', (e) => closed.push(e));
    bus.subscribe('bodyshop:job_unserved', (e) => unserved.push(e));
    const drain = dept.createFloorDrain();

    bus.publish('bodyshop:intake_ready', intakePayload(1, 8));
    drainTicks(drain, 40);

    expect(closed.length).toBeGreaterThan(0);
    expect(unserved.length).toBeGreaterThan(0);
    expect(closed.length + unserved.length).toBe(8);
    const closedIds = new Set(closed.map((e) => e.bodyShopItemId));
    expect(unserved.every((e) => !closedIds.has(e.bodyShopItemId))).toBe(true);
    for (const e of unserved) {
      expect(e.csiHit).toBe(config.unservedCsiHit);
      expect(e.waitTicks).toBeGreaterThan(config.maxWaitTicks);
    }
  });
});

// ── Config loading ────────────────────────────────────────────────────────────

describe('BodyShopDispatch — config', () => {
  it('loadBodyShopDispatchConfig returns valid tunables', () => {
    const { loadBodyShopDispatchConfig } = require('../src/bodyShopDispatchConfig');
    const cfg = loadBodyShopDispatchConfig();
    expect(cfg.minAutoResolveRate).toBeGreaterThanOrEqual(0);
    expect(cfg.maxAutoResolveRate).toBeLessThanOrEqual(1);
    expect(cfg.maxPerSlotThroughput).toBeGreaterThanOrEqual(cfg.minPerSlotThroughput);
    // Body Shop is dark below Tier 3 — no bays until the showroom tier.
    expect(cfg.baysByTier['1']).toBe(0);
    expect(cfg.baysByTier['3']).toBeGreaterThan(0);
    expect(cfg.insuranceRateMultiplier).toBeGreaterThan(0);
    expect(cfg.retailCeilMultiplier).toBeGreaterThanOrEqual(cfg.retailFloorMultiplier);
  });
});

import { createEventBus } from '../src/game/EventBus';
import type { EventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createStaffFloorDrain } from '../src/game/StaffDispatch';
import type {
  StaffDispatchConfig,
  StaffDispatchCustomerSession,
} from '../src/game/StaffDispatch';
import type { DeptDrain } from '../src/game/FloorSim';
import type { Inventory, LotVehicle } from '../src/game/Inventory';
import { createDealEngine, loadCreditTiers } from '../src/game/DealEngine';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff, Person, SalesVisit } from '../src/game/NPC';

// ──────────────────────────────────────────────────────────────────────────
// The legacy `createStaffDispatch` path (admit ⇒ resolve-now) is exercised by
// StaffDispatch.test.ts. This file covers the *other* public entry — the #99
// per-tick `createStaffFloorDrain` seam (#101): skill-scaled throughput, FIFO
// drain ordering across ticks, the attempted-set dedup, and the salesperson
// role filter. Public surface only: the `drain()` return shape + emitted events
// + resulting queue state. No source under test is modified.
// ──────────────────────────────────────────────────────────────────────────

const MASTER_SEED = 42;

/** A drain config with a flat per-tick budget (min == max ⇒ effectiveness-
 *  independent) so per-tick throughput is exact and deterministic. */
const DISCOUNT_EVENT_CFG = {
  escalationRate: 1,
  minCounterAttempts: 1,
  maxCounterAttempts: 3,
  missPenalty: 0.15,
} as const;

function flatBudget(perTick: number): StaffDispatchConfig {
  return {
    minDrainPerTick: perTick,
    maxDrainPerTick: perTick,
    discountEvent: DISCOUNT_EVENT_CFG,
  };
}

/** A skill-scaled budget: lerp(min,max,bestEffectiveness). */
function skillBudget(min: number, max: number): StaffDispatchConfig {
  return {
    minDrainPerTick: min,
    maxDrainPerTick: max,
    discountEvent: DISCOUNT_EVENT_CFG,
  };
}

// ── Roster + bundle factories (mirrors StaffDispatch.test.ts) ────────────────

function makeStaff(
  effectiveness: number,
  id = `staff:mock:${effectiveness}`,
  roleId = 'salesperson',
): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id: roleId,
    trait_ids: [],
    skills: {},
    resources: { stamina: 80 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
  Object.defineProperty(plain, 'effectiveness', { get: () => effectiveness, enumerable: false, configurable: true });
  Object.defineProperty(plain, 'trustworthiness', { get: () => 0.5, enumerable: false, configurable: true });
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

function makePerson(id: string): Person {
  return {
    id,
    trait_ids: [],
    wealth: 60_000,
    credit: 720,
    annualIncome: 60_000,
    int: 50,
    agreeableness: 60,
    brand_affinity: {},
    counters: { prior_visits: 0, prior_deals: 0, days_since_last_visit: 0 },
  } as Person;
}

function makeFinanceVisit(personId: string): SalesVisit {
  return {
    kind: 'sales',
    person_id: personId,
    preferences: {
      safety: 0.2, performance: 0.2, appearance: 0.2,
      comfort: 0.2, economy: 0.2, dependability: 0.2,
    },
    resources: { trust: 0.7, patience: 1.0 },
    paymentMethod: 'finance',
    downPaymentBehavior: 0.2,
  };
}

function makeSession(personId: string): StaffDispatchCustomerSession {
  return {
    bundle: { person: makePerson(personId), visit: makeFinanceVisit(personId) },
    visitArchetypeId: 'family_vehicle_search',
    archetypeLabel: 'Young Family',
  };
}

function makeLotVehicle(id: string): LotVehicle {
  return {
    id,
    templateId: 'base_sedan',
    brand: 'generic',
    year: 2020,
    make: 'generic',
    model: 'Sedan',
    trim: 'LX',
    mileage: 30_000,
    condition: 'clean',
    conditionReport: 'clean',
    purchasePrice: 8_000,
    reconCost: 500,
    category: 'sedan',
    arrivalDay: 0,
    frontlineDay: 0,
    daysInInventory: 0,
    carryingCostToDate: 0,
    dailyCarryingCost: 0,
    aged: false,
    suggestedRetail: 10_625,
    askingPrice: 10_625,
    reconStatus: 'complete',
    reconEstimate: 500,
    reconRealizedCost: 500,
    reconDaysRemaining: 0,
    reconDaysTotal: 3,
    reconBucket: 'within',
  };
}

interface Wired {
  bus: EventBus;
  queue: ReturnType<typeof createDepartmentQueue>;
  drain: DeptDrain;
  sessions: Map<string, StaffDispatchCustomerSession>;
  events: Array<{ outcome: string; reason?: string; customerId: string }>;
  closedDeals: Array<{ customerId: string }>;
  inventorySold: string[];
}

function setup(
  roster: StaffWithComposites[],
  config: StaffDispatchConfig,
  lot: LotVehicle[] = [makeLotVehicle('veh:1')],
): Wired {
  const bus = createEventBus();
  createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
  const queue = createDepartmentQueue({ bus });
  const lotMap = new Map(lot.map(v => [v.id, v]));
  const sold: string[] = [];
  const inventoryStub = {
    getLotVehicles: () => [...lotMap.values()],
    getLotVehicle: (id: string) => lotMap.get(id),
    sellVehicle: (id: string) => {
      const v = lotMap.get(id);
      if (!v) throw new Error(`no veh ${id}`);
      lotMap.delete(id);
      sold.push(id);
      return v;
    },
  } satisfies Pick<Inventory, 'getLotVehicles' | 'getLotVehicle' | 'sellVehicle'>;

  const dealEngine = createDealEngine({ bus, inventory: inventoryStub, economy });
  const sessions = new Map<string, StaffDispatchCustomerSession>();

  const events: Wired['events'] = [];
  bus.subscribe('staff:auto_resolved', (e) => events.push(e));
  const closedDeals: Wired['closedDeals'] = [];
  bus.subscribe('deal:closed', (e) => closedDeals.push(e as { customerId: string }));

  const drain = createStaffFloorDrain({
    bus,
    staffOrg: makeStaffOrg(roster),
    queue,
    masterSeed: MASTER_SEED,
    config,
    inventory: inventoryStub,
    dealEngine,
    creditTiers: loadCreditTiers(),
    getCustomerSession: (id) => sessions.get(id),
    fniRng: () => 1.0,
  });

  return { bus, queue, drain, sessions, events, closedDeals, inventorySold: sold };
}

/** Enqueue a Sales workspace item by routing an admit through DepartmentQueue. */
function admit(w: Wired, customerId: string, day = 1): void {
  w.sessions.set(customerId, makeSession(customerId));
  w.bus.publish('capacity:customer_admitted', { day, customerId, label: 'Test' });
}

function tick(w: Wired, day = 1, t = 0) {
  return w.drain.drain({ day, tick: t });
}

// ── Roster / role gating ─────────────────────────────────────────────────────

describe('createStaffFloorDrain — roster & role gating', () => {
  it('an empty roster drains nothing and leaves the queue intact', () => {
    const w = setup([], flatBudget(5));
    admit(w, 'cust:1');
    admit(w, 'cust:2');

    expect(tick(w)).toEqual({ resolved: 0, escalated: 0 });
    expect(w.events).toHaveLength(0);
    expect(w.queue.getQueue('sales')).toHaveLength(2);
  });

  it('only salespeople drive the drain — a non-sales-only roster drains nothing', () => {
    const w = setup([makeStaff(1.0, 'svc:1', 'service-advisor')], flatBudget(5));
    admit(w, 'cust:1');

    expect(tick(w)).toEqual({ resolved: 0, escalated: 0 });
    expect(w.events).toHaveLength(0);
    expect(w.queue.getQueue('sales')).toHaveLength(1);
  });

  it('a salesperson mixed in with non-sales staff still drains', () => {
    const w = setup(
      [makeStaff(1.0, 'svc:1', 'service-advisor'), makeStaff(0.9, 'sales:1')],
      flatBudget(5),
    );
    admit(w, 'cust:1');

    const out = tick(w);
    expect(out.resolved).toBe(1);
    expect(w.events.filter(e => e.outcome === 'closed')).toHaveLength(1);
  });
});

// ── Skill-scaled throughput (assignment selection by best effectiveness) ─────

describe('createStaffFloorDrain — skill-scaled per-tick budget', () => {
  // The budget = lerp(min,max,bestEffectiveness) governs how many queued ups are
  // *attempted* per tick; each attempt resolves (closed/no-sale) or escalates
  // (e.g. a weak closer holding a below-floor discount for the player), so the
  // budget shows up as attempts = resolved + escalated.
  const attempts = (o: { resolved: number; escalated: number }) =>
    o.resolved + o.escalated;
  const lotOf = (n: number) =>
    Array.from({ length: n }, (_, i) => makeLotVehicle(`veh:${i}`));

  it('a more effective floor attempts more items in a single tick', () => {
    const weak = setup([makeStaff(0.25)], skillBudget(0, 4), lotOf(8));
    const strong = setup([makeStaff(1.0)], skillBudget(0, 4), lotOf(8));
    for (let i = 0; i < 6; i++) { admit(weak, `c:${i}`); admit(strong, `c:${i}`); }

    const weakOut = tick(weak); // budget = lerp(0,4,0.25) = 1
    const strongOut = tick(strong); // budget = lerp(0,4,1.0) = 4

    expect(attempts(weakOut)).toBe(1);
    expect(attempts(strongOut)).toBe(4);
    expect(attempts(strongOut)).toBeGreaterThan(attempts(weakOut));
  });

  it('the best on-roster salesperson sets the budget, not the weakest', () => {
    // Weakest is 0.25, but the 1.0 closer lifts bestEffectiveness ⇒ budget 4.
    const w = setup([makeStaff(0.25, 's:a'), makeStaff(1.0, 's:b')], skillBudget(0, 4), lotOf(8));
    for (let i = 0; i < 6; i++) admit(w, `c:${i}`);

    expect(attempts(tick(w))).toBe(4);
  });

  it('a sub-1.0 fractional rate accumulates and drains on a later tick', () => {
    const w = setup([makeStaff(1.0)], flatBudget(0.5));
    admit(w, 'cust:1');

    // 0.5/tick: tick 1 floors to 0 (nothing drains), tick 2 reaches 1.0.
    expect(tick(w, 1, 0)).toEqual({ resolved: 0, escalated: 0 });
    expect(w.events).toHaveLength(0);
    expect(tick(w, 1, 1).resolved).toBe(1);
    expect(w.events.filter(e => e.outcome === 'closed')).toHaveLength(1);
  });
});

// ── FIFO drain ordering across ticks ─────────────────────────────────────────

describe('createStaffFloorDrain — FIFO ordering across ticks', () => {
  it('drains queued ups in admit order, one per tick at budget 1', () => {
    // Single lot vehicle: the first up closes it, the second then finds no fit —
    // so the resolution *order* is observable in the emitted outcomes.
    const w = setup([makeStaff(0.9)], flatBudget(1), [makeLotVehicle('veh:1')]);
    admit(w, 'cust:first');
    admit(w, 'cust:second');

    const t1 = tick(w, 1, 0);
    expect(t1.resolved).toBe(1);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({ customerId: 'cust:first', outcome: 'closed' });
    expect(w.inventorySold).toEqual(['veh:1']);

    const t2 = tick(w, 1, 1);
    expect(w.events).toHaveLength(2);
    expect(w.events[1].customerId).toBe('cust:second');
    expect(w.events[1].outcome).toBe('no_sale');
    expect(t2.escalated).toBe(0);
  });
});

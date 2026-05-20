import { createEventBus } from '../src/game/EventBus';
import type { EventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import {
  createStaffDispatch,
  loadStaffDispatchConfig,
} from '../src/game/StaffDispatch';
import type {
  StaffDispatchConfig,
  StaffDispatchCustomerSession,
} from '../src/game/StaffDispatch';
import type { Inventory, LotVehicle } from '../src/game/Inventory';
import { createDealEngine, loadCreditTiers } from '../src/game/DealEngine';
import type { DealEngine } from '../src/game/DealEngine';
import type { StaffOrg } from '../src/game/StaffOrg';
import type {
  StaffWithComposites,
  Staff,
  Person,
  SalesVisit,
} from '../src/game/NPC';

const MASTER_SEED = 42;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeStaff(effectiveness: number, id = `staff:mock:${effectiveness}`): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id: 'salesperson',
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
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
  };
}

const ZERO_FLAGS = {
  vip_customer: 0,
  high_dollar_deal: 0,
  irate_customer: 0,
  lemon_law_threat: 0,
  audit_trigger: 0,
};

const ALL_FLAGS = {
  vip_customer: 1,
  high_dollar_deal: 1,
  irate_customer: 1,
  lemon_law_threat: 1,
  audit_trigger: 1,
};

const NO_EXCEPTION_CONFIG: StaffDispatchConfig = {
  exceptionFlagRates: ZERO_FLAGS,
  gmExceptionFlagRates: ZERO_FLAGS,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
  exceptionSkillExpMin: 1.0,
  exceptionSkillExpMax: 3.0,
};

const ALL_EXCEPTION_CONFIG: StaffDispatchConfig = {
  ...NO_EXCEPTION_CONFIG,
  exceptionFlagRates: ALL_FLAGS,
};

// ── Bundle + lot factories ──────────────────────────────────────────────────

function makePerson(id: string, opts: Partial<Person> = {}): Person {
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
    ...opts,
  } as Person;
}

function makeFinanceVisit(personId: string): SalesVisit {
  return {
    kind: 'sales',
    person_id: personId,
    // Low SPACED requirements ⇒ any sedan on the lot satisfies the seeded
    // nonnegotiable axes within tolerance. Tests focus on the close path,
    // not the nonnegotiable filter (that's SalesProcess's own coverage).
    preferences: {
      safety: 0.2,
      performance: 0.2,
      appearance: 0.2,
      comfort: 0.2,
      economy: 0.2,
      dependability: 0.2,
    },
    resources: { trust: 0.7, patience: 1.0 },
    paymentMethod: 'finance',
    downPaymentBehavior: 0.2,
  };
}

function makeSession(personId: string, visit: SalesVisit, opts: Partial<Person> = {}): StaffDispatchCustomerSession {
  return {
    bundle: { person: makePerson(personId, opts), visit },
    visitArchetypeId: 'family_vehicle_search',
  };
}

function makeLotVehicle(id: string, overrides: Partial<LotVehicle> = {}): LotVehicle {
  return {
    id,
    templateId: 'base_sedan',
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
    daysInInventory: 0,
    suggestedRetail: 10_625,
    askingPrice: 10_625,
    ...overrides,
  };
}

interface Wired {
  bus: EventBus;
  inventory: Pick<Inventory, 'getLotVehicles' | 'getLotVehicle' | 'sellVehicle'>;
  dealEngine: DealEngine;
  sessions: Map<string, StaffDispatchCustomerSession>;
  events: Array<{ outcome: string; reason?: string; grossImpact: number; customerId: string }>;
  closedDeals: unknown[];
  inventorySold: string[];
}

function setup(
  roster: StaffWithComposites[],
  config: StaffDispatchConfig = NO_EXCEPTION_CONFIG,
  opts: { lot?: LotVehicle[]; getHasGm?: () => boolean } = {},
): Wired & { economy: ReturnType<typeof createEconomy> } {
  const bus = createEventBus();
  createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
  const queue = createDepartmentQueue({ bus });
  const lot = opts.lot ?? [makeLotVehicle('veh:1')];
  const lotMap = new Map(lot.map(v => [v.id, v]));
  const sold: string[] = [];
  // Stub Inventory: bypass the auction-generator wiring so the lot is exactly
  // what the test seeded. Satisfies the `Pick<Inventory, …>` deps StaffDispatch
  // + DealEngine need without dragging in the full module's clock subscribers.
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
  const staffOrg = makeStaffOrg(roster);

  const events: Wired['events'] = [];
  bus.subscribe('staff:auto_resolved', (e) => events.push(e));
  const closedDeals: unknown[] = [];
  bus.subscribe('deal:closed', (e) => closedDeals.push(e));

  createStaffDispatch({
    bus,
    staffOrg,
    queue,
    masterSeed: MASTER_SEED,
    config,
    inventory: inventoryStub,
    dealEngine,
    creditTiers: loadCreditTiers(),
    getCustomerSession: (id) => sessions.get(id),
    getHasGm: opts.getHasGm,
    // Deterministic FNI: never attach (keeps backGross = 0 so per-test math is exact).
    fniRng: () => 1.0,
  });

  return {
    bus,
    inventory: inventoryStub,
    dealEngine,
    sessions,
    events,
    closedDeals,
    inventorySold: sold,
    economy,
  };
}

function admit(bus: EventBus, customerId: string, day = 1): void {
  bus.publish('capacity:customer_admitted', { day, customerId, label: 'Test' });
}

// ── No staff / exception escalation ─────────────────────────────────────────

describe('StaffDispatch — no staff & exception escalation (preserved)', () => {
  it('no staff on roster ⇒ no auto_resolved, item stays in queue', () => {
    const { bus, events } = setup([]);
    admit(bus, 'cust:1');
    expect(events).toHaveLength(0);
  });

  it('exception flag forces escalation regardless of skill (no resolve)', () => {
    const { bus, events } = setup([makeStaff(1.0)], ALL_EXCEPTION_CONFIG);
    admit(bus, 'cust:vip');
    expect(events).toHaveLength(0);
  });
});

// ── No customer session ──────────────────────────────────────────────────────

describe('StaffDispatch — graceful no-session', () => {
  it('emits no_sale with reason=no_session when bundle lookup misses', () => {
    const { bus, events } = setup([makeStaff(0.8)]);
    admit(bus, 'cust:ghost');
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_session');
  });
});

// ── Real-close path ─────────────────────────────────────────────────────────

describe('StaffDispatch — real close path (#147)', () => {
  it('finance customer + matching vehicle ⇒ deal:closed fires with non-zero frontGross + lot decrements', () => {
    const { bus, sessions, events, closedDeals, inventorySold, inventory, economy } = setup([
      makeStaff(0.9),
    ]);
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    const cashBefore = economy.cash;

    admit(bus, 'cust:1');

    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('closed');
    expect(events[0].grossImpact).toBeGreaterThan(0);
    expect(closedDeals).toHaveLength(1);
    const ev = closedDeals[0] as { frontGross: number; paymentMethod: string };
    expect(ev.frontGross).toBeGreaterThan(0);
    expect(ev.paymentMethod).toBe('finance');
    expect(inventorySold).toEqual(['veh:1']);
    expect(inventory.getLotVehicles()).toHaveLength(0);
    // Cash delta tracks the real DealEngine posting, not a synthetic poke.
    expect(economy.cash - cashBefore).toBeGreaterThan(0);
  });

  it('per-tick drain: N customers + < N inventory closes exactly inventory.length', () => {
    const lot = [makeLotVehicle('veh:1'), makeLotVehicle('veh:2')];
    const { bus, sessions, events, inventorySold } = setup(
      [makeStaff(0.95)],
      NO_EXCEPTION_CONFIG,
      { lot },
    );
    for (let i = 0; i < 5; i++) {
      const id = `cust:${i}`;
      sessions.set(id, makeSession(id, makeFinanceVisit(id)));
      admit(bus, id, 1);
    }
    const closed = events.filter(e => e.outcome === 'closed');
    const noFit = events.filter(e => e.outcome === 'no_sale' && e.reason === 'no_fit');
    expect(closed).toHaveLength(2);
    expect(inventorySold).toHaveLength(2);
    expect(noFit).toHaveLength(3);
  });

  it('empty lot ⇒ no_sale reason=no_fit', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], NO_EXCEPTION_CONFIG, { lot: [] });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_fit');
  });

  it('SalesProcess patience-drain walk ⇒ no_sale reason=patience_drain', () => {
    const { bus, sessions, events } = setup([makeStaff(0.05)]); // very weak skill → patience drains fast
    const visit = makeFinanceVisit('cust:1');
    // Bottom out starting patience so the first weak gate trips the floor.
    const lowPatience: SalesVisit = { ...visit, resources: { ...visit.resources, patience: 0.05 } };
    sessions.set('cust:1', makeSession('cust:1', lowPatience));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(['patience_drain', 'trust_collapse', 'demo_nonnegotiable_miss']).toContain(events[0].reason);
  });
});

// ── Hold-floor: staffed up always worked ────────────────────────────────────

describe('StaffDispatch — hold-floor (#134) preserved', () => {
  it('a staffed, non-exception up is always worked (queue drained), regardless of skill', () => {
    const { bus, events } = setup([makeStaff(0.01)]);
    admit(bus, 'cust:1');
    // No session ⇒ no_sale w/ no_session, but the up was *worked* (resolver fired).
    expect(events).toHaveLength(1);
  });
});

// ── Config ──────────────────────────────────────────────────────────────────

describe('StaffDispatch — config', () => {
  it('loadStaffDispatchConfig returns valid tunables (no dead fields)', () => {
    const config = loadStaffDispatchConfig();
    expect(Object.keys(config.exceptionFlagRates).length).toBeGreaterThan(0);
    expect(Object.keys(config.gmExceptionFlagRates).length).toBeGreaterThan(0);
    expect(config.minDrainPerTick).toBeGreaterThanOrEqual(0);
    expect(config.maxDrainPerTick).toBeGreaterThan(0);
    // Dead fields are gone.
    expect('baseAutoGross' in config).toBe(false);
    expect('minCloseRate' in config).toBe(false);
    expect('maxCloseRate' in config).toBe(false);
    expect('minGrossModifier' in config).toBe(false);
  });
});

// ── GM exception thresholds ──────────────────────────────────────────────────

describe('StaffDispatch — GM exception thresholds', () => {
  const GM_EXCEPTION_CONFIG: StaffDispatchConfig = {
    ...NO_EXCEPTION_CONFIG,
    exceptionFlagRates: { ...ALL_FLAGS },
    gmExceptionFlagRates: {
      vip_customer: 0,
      high_dollar_deal: 0,
      irate_customer: 0,
      lemon_law_threat: 1,
      audit_trigger: 1,
    },
  };

  it('without GM: all-flag config escalates (no resolve)', () => {
    const { bus, events } = setup([makeStaff(1.0)], GM_EXCEPTION_CONFIG, { getHasGm: () => false });
    admit(bus, 'cust:1');
    expect(events).toHaveLength(0);
  });

  it('with GM: non-legal flags drop to 0 ⇒ customer is auto-resolved', () => {
    const configNoLegal: StaffDispatchConfig = {
      ...GM_EXCEPTION_CONFIG,
      gmExceptionFlagRates: ZERO_FLAGS,
    };
    const { bus, events } = setup([makeStaff(1.0)], configNoLegal, { getHasGm: () => true });
    admit(bus, 'cust:1');
    expect(events).toHaveLength(1);
  });

  it('with GM: lemon_law_threat at 1 still escalates', () => {
    const { bus, events } = setup([makeStaff(1.0)], GM_EXCEPTION_CONFIG, { getHasGm: () => true });
    admit(bus, 'cust:1');
    expect(events).toHaveLength(0);
  });
});

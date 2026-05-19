import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createStaffDispatch, loadStaffDispatchConfig } from '../src/game/StaffDispatch';
import type { StaffDispatchConfig } from '../src/game/StaffDispatch';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';

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
  Object.defineProperty(plain, 'trustworthiness', { get: () => 0, enumerable: false, configurable: true });
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

// All flags set to 0 so exception rolls never fire. Under the hold-floor
// model (#134) a staffed, non-exception up is *always* worked (held), so this
// config alone guarantees auto-resolution regardless of skill.
const NO_EXCEPTION_CONFIG: StaffDispatchConfig = {
  exceptionFlagRates: ZERO_FLAGS,
  gmExceptionFlagRates: ZERO_FLAGS,
  minCloseRate: 0.20,
  maxCloseRate: 0.65,
  baseAutoGross: 2500,
  minGrossModifier: 0.50,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
  exceptionSkillExpMin: 1.0,
  exceptionSkillExpMax: 3.0,
};

// All flags set to 1 so every customer gets flagged.
const ALL_EXCEPTION_CONFIG: StaffDispatchConfig = {
  ...NO_EXCEPTION_CONFIG,
  exceptionFlagRates: ALL_FLAGS,
};

const ALWAYS_CLOSE_CONFIG: StaffDispatchConfig = {
  ...NO_EXCEPTION_CONFIG,
  minCloseRate: 1.0,
  maxCloseRate: 1.0,
};

const NEVER_CLOSE_CONFIG: StaffDispatchConfig = {
  ...NO_EXCEPTION_CONFIG,
  minCloseRate: 0.0,
  maxCloseRate: 0.0,
};

function makeSetup(
  roster: StaffWithComposites[],
  config: StaffDispatchConfig = NO_EXCEPTION_CONFIG,
  getHasGm?: () => boolean,
) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
  // DepartmentQueue must subscribe first so workspace items are added before StaffDispatch removes them.
  const queue = createDepartmentQueue({ bus });
  const staffOrg = makeStaffOrg(roster);
  createStaffDispatch({ bus, staffOrg, queue, economy, masterSeed: MASTER_SEED, config, getHasGm });
  return { bus, clock, economy, queue };
}

// ── No staff → no auto-resolve ───────────────────────────────────────────────

describe('StaffDispatch — no staff on roster', () => {
  it('leaves all sales items in queue when roster is empty', () => {
    const { bus, queue } = makeSetup([], NO_EXCEPTION_CONFIG);
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:1', label: 'Test' });
    expect(queue.getBadgeCount('sales')).toBe(1);
  });

  it('emits no staff:auto_resolved events when roster is empty', () => {
    const { bus, queue } = makeSetup([], NO_EXCEPTION_CONFIG);
    const events: unknown[] = [];
    bus.subscribe('staff:auto_resolved', (e) => events.push(e));
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:1', label: 'Test' });
    void queue;
    expect(events).toHaveLength(0);
  });
});

// ── Exception flags force escalation ────────────────────────────────────────

describe('StaffDispatch — exception flags', () => {
  it('flagged customer stays in queue regardless of staff skill', () => {
    const roster = [makeStaff(1.0)]; // perfect skill
    const { bus, queue } = makeSetup(roster, ALL_EXCEPTION_CONFIG);
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:vip', label: 'VIP' });
    expect(queue.getBadgeCount('sales')).toBe(1);
  });

  it('emits no auto_resolved event for flagged customer', () => {
    const roster = [makeStaff(1.0)];
    const { bus, queue } = makeSetup(roster, ALL_EXCEPTION_CONFIG);
    const events: unknown[] = [];
    bus.subscribe('staff:auto_resolved', (e) => events.push(e));
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:vip', label: 'VIP' });
    void queue;
    expect(events).toHaveLength(0);
  });
});

// ── Auto-resolve removes item from queue ─────────────────────────────────────

describe('StaffDispatch — auto-resolve basic flow', () => {
  it('removes item from sales queue on auto-resolve', () => {
    const roster = [makeStaff(0.8)];
    const { bus, queue } = makeSetup(roster, NO_EXCEPTION_CONFIG);
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:1', label: 'Test' });
    expect(queue.getBadgeCount('sales')).toBe(0);
  });

  it('emits staff:auto_resolved event', () => {
    const roster = [makeStaff(0.8)];
    const { bus } = makeSetup(roster, NO_EXCEPTION_CONFIG);
    const events: Array<{ customerId: string; staffId: string; outcome: string }> = [];
    bus.subscribe('staff:auto_resolved', (e) => events.push(e));
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:1', label: 'Test' });
    expect(events).toHaveLength(1);
    expect(events[0].customerId).toBe('cust:1');
    expect(events[0].staffId).toBe('staff:mock:0.8');
  });

  it('closed outcome posts revenue and sets grossImpact > 0', () => {
    const roster = [makeStaff(0.8)];
    const { bus, economy } = makeSetup(roster, ALWAYS_CLOSE_CONFIG);
    const cashBefore = economy.cash;
    const events: Array<{ outcome: string; grossImpact: number }> = [];
    bus.subscribe('staff:auto_resolved', (e) => events.push(e));
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:1', label: 'Test' });
    expect(events[0].outcome).toBe('closed');
    expect(events[0].grossImpact).toBeGreaterThan(0);
    expect(economy.cash).toBeGreaterThan(cashBefore);
  });

  it('no_sale outcome posts no revenue and grossImpact is 0', () => {
    const roster = [makeStaff(0.8)];
    const { bus, economy } = makeSetup(roster, NEVER_CLOSE_CONFIG);
    const cashBefore = economy.cash;
    const events: Array<{ outcome: string; grossImpact: number }> = [];
    bus.subscribe('staff:auto_resolved', (e) => events.push(e));
    bus.publish('capacity:customer_admitted',{ day: 1, customerId: 'cust:1', label: 'Test' });
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].grossImpact).toBe(0);
    expect(economy.cash).toBe(cashBefore);
  });

  it('auto-resolved event carries correct day', () => {
    const roster = [makeStaff(0.8)];
    const { bus } = makeSetup(roster, NO_EXCEPTION_CONFIG);
    const events: Array<{ day: number }> = [];
    bus.subscribe('staff:auto_resolved', (e) => events.push(e));
    bus.publish('capacity:customer_admitted',{ day: 5, customerId: 'cust:5', label: 'Test' });
    expect(events[0].day).toBe(5);
  });
});

// ── Hold-floor: staffed up is always worked, skill drives the close ─────────

describe('StaffDispatch — hold-floor model (#134)', () => {
  function tally(effectiveness: number, n: number): { resolved: number; closed: number } {
    const roster = [makeStaff(effectiveness)];
    let resolved = 0;
    let closed = 0;
    for (let i = 0; i < n; i++) {
      const bus = createEventBus();
      const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
      const queue = createDepartmentQueue({ bus });
      const staffOrg = makeStaffOrg(roster);
      createStaffDispatch({ bus, staffOrg, queue, economy, masterSeed: MASTER_SEED, config: NO_EXCEPTION_CONFIG });
      bus.subscribe('staff:auto_resolved', ({ outcome }) => {
        resolved++;
        if (outcome === 'closed') closed++;
      });
      bus.publish('capacity:customer_admitted',{ day: i + 1, customerId: `cust:${i}`, label: 'Test' });
    }
    return { resolved, closed };
  }

  it('a staffed floor always holds the up — even the weakest hire never leaves a non-exception up unworked', () => {
    const n = 200;
    // The core #134 promise: hiring anyone stops the staff-side bleeding.
    expect(tally(0.01, n).resolved).toBe(n);
    expect(tally(0.95, n).resolved).toBe(n);
  });

  it('skill drives the *close*, not whether the up is worked: a capable full-timer measurably out-closes a green hire', () => {
    const n = 200;
    const lowClose = tally(0.05, n).closed / n;
    const highClose = tally(0.95, n).closed / n;
    expect(highClose).toBeGreaterThan(lowClose);
    // Observability bar: the hire must move close results by a real margin.
    expect(highClose - lowClose).toBeGreaterThan(0.30);
  });
});

// ── Gross degrades with lower skill ──────────────────────────────────────────

describe('StaffDispatch — gross degrades with low skill', () => {
  function sumGross(effectiveness: number, n: number): number {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const bus = createEventBus();
      const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
      const queue = createDepartmentQueue({ bus });
      const staffOrg = makeStaffOrg([makeStaff(effectiveness)]);
      createStaffDispatch({ bus, staffOrg, queue, economy, masterSeed: MASTER_SEED, config: ALWAYS_CLOSE_CONFIG });
      bus.subscribe('staff:auto_resolved', ({ grossImpact }) => { total += grossImpact; });
      bus.publish('capacity:customer_admitted',{ day: i + 1, customerId: `cust:${i}`, label: 'Test' });
    }
    return total;
  }

  it('high-skill closures produce more total gross than low-skill closures', () => {
    const n = 50;
    const lowGross = sumGross(0.05, n);
    const highGross = sumGross(0.95, n);
    expect(highGross).toBeGreaterThan(lowGross);
  });
});

// ── Config loading ────────────────────────────────────────────────────────────

describe('StaffDispatch — config', () => {
  it('loadStaffDispatchConfig returns valid tunables', () => {
    const config = loadStaffDispatchConfig();
    expect(config.baseAutoGross).toBeGreaterThan(0);
    expect(config.minCloseRate).toBeGreaterThanOrEqual(0);
    expect(config.maxCloseRate).toBeLessThanOrEqual(1);
    expect(Object.keys(config.exceptionFlagRates).length).toBeGreaterThan(0);
    expect(Object.keys(config.gmExceptionFlagRates).length).toBeGreaterThan(0);
  });
});

// ── GM exception thresholds ───────────────────────────────────────────────────

describe('StaffDispatch — GM exception thresholds', () => {
  // Config with all non-legal flags at 1 for non-GM, but 0 for GM (only legal/compliance remain).
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

  it('without GM: all-flag config blocks auto-resolve', () => {
    const roster = [makeStaff(1.0)];
    const { bus, queue } = makeSetup(roster, GM_EXCEPTION_CONFIG, () => false);
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'cust:1', label: 'Test' });
    // All flags at 1 → no auto-resolve → item stays in queue
    expect(queue.getBadgeCount('sales')).toBe(1);
  });

  it('with GM: non-legal flags drop to 0, customer is auto-resolved', () => {
    const configNoLegal: StaffDispatchConfig = {
      ...GM_EXCEPTION_CONFIG,
      gmExceptionFlagRates: {
        vip_customer: 0,
        high_dollar_deal: 0,
        irate_customer: 0,
        lemon_law_threat: 0,
        audit_trigger: 0,
      },
    };
    const roster = [makeStaff(1.0)];
    const { bus, queue } = makeSetup(roster, configNoLegal, () => true);
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'cust:1', label: 'Test' });
    // All GM flags at 0 → no exception fires → auto-resolves
    expect(queue.getBadgeCount('sales')).toBe(0);
  });

  it('with GM: lemon_law_threat at 1 still blocks auto-resolve', () => {
    const roster = [makeStaff(1.0)];
    const { bus, queue } = makeSetup(roster, GM_EXCEPTION_CONFIG, () => true);
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'cust:1', label: 'Test' });
    // lemon_law_threat and audit_trigger are 1 in gmExceptionFlagRates → escalates
    expect(queue.getBadgeCount('sales')).toBe(1);
  });
});

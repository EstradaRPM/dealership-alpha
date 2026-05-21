import { createEventBus } from '../src/game/EventBus';
import type { EventBus } from '../src/game/EventBus';
import { createFloorSim, type DayContext } from '../src/game/FloorSim';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createEconomy } from '../src/game/Economy';
import {
  createStaffFloorDrain,
  type StaffDispatchConfig,
} from '../src/game/StaffDispatch';
import { createDealEngine, loadCreditTiers } from '../src/game/DealEngine';
import type { Inventory } from '../src/game/Inventory';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';

const MASTER_SEED = 42;

const baseCtx: DayContext = {
  day: 1,
  reputation: 0.5,
  marketShare: 0.1,
  season: 'spring',
};

function makeStaff(effectiveness: number): StaffWithComposites {
  const plain: Staff = {
    id: `staff:sp:${effectiveness}`,
    role_id: 'salesperson',
    trait_ids: [],
    skills: { upsell: 50 },
    resources: { stamina: 80 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
  Object.defineProperty(plain, 'effectiveness', {
    get: () => effectiveness,
    enumerable: false,
  });
  Object.defineProperty(plain, 'trustworthiness', {
    get: () => 0,
    enumerable: false,
  });
  return plain as StaffWithComposites;
}

function makeStaffOrg(roster: StaffWithComposites[]): StaffOrg {
  return {
    get currentRoster() {
      return roster;
    },
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
  };
}

const BASE_CONFIG: StaffDispatchConfig = {
  exceptionFlagRates: {
    vip_customer: 0,
    high_dollar_deal: 0,
    irate_customer: 0,
    lemon_law_threat: 0,
    audit_trigger: 0,
  },
  gmExceptionFlagRates: {
    vip_customer: 0,
    high_dollar_deal: 0,
    irate_customer: 0,
    lemon_law_threat: 0,
    audit_trigger: 0,
  },
  minDrainPerTick: 0.6,
  maxDrainPerTick: 0.6,
  exceptionSkillExpMin: 1.0,
  exceptionSkillExpMax: 3.0,
};

const emptyInventory: Pick<Inventory, 'getLotVehicles'> = { getLotVehicles: () => [] };

// Every designated dramatic case is forced (rate 1.0). rate^exp == 1 for any
// exponent, so these escalate regardless of staff skill.
const ALWAYS_EXCEPTION: StaffDispatchConfig = {
  ...BASE_CONFIG,
  exceptionFlagRates: {
    vip_customer: 1,
    high_dollar_deal: 1,
    irate_customer: 1,
    lemon_law_threat: 1,
    audit_trigger: 1,
  },
};

// A sub-1.0 rate so the f(skill × role tier) threshold is observable: higher
// effectiveness ⇒ larger exponent ⇒ rarer escalation.
const SOFT_EXCEPTION: StaffDispatchConfig = {
  ...BASE_CONFIG,
  exceptionFlagRates: {
    vip_customer: 0.5,
    high_dollar_deal: 0,
    irate_customer: 0,
    lemon_law_threat: 0,
    audit_trigger: 0,
  },
};

function setup(config: StaffDispatchConfig, effectiveness: number, n: number) {
  const bus = createEventBus();
  const queue = createDepartmentQueue({ bus });
  const economy = createEconomy({
    bus,
    startingCash: 50_000,
    config: { weeklyRent: 0, weeklyPayrollStub: 0 },
  });
  for (let i = 0; i < n; i++) {
    bus.publish('capacity:customer_admitted', {
      day: baseCtx.day,
      customerId: `cust:${i}`,
      label: `Customer ${i}`,
    });
  }
  const drain = createStaffFloorDrain({
    bus,
    staffOrg: makeStaffOrg([makeStaff(effectiveness)]),
    queue,
    masterSeed: MASTER_SEED,
    config,
    inventory: emptyInventory,
    dealEngine: createDealEngine({ bus }),
    creditTiers: loadCreditTiers(),
    getCustomerSession: () => undefined,
  });
  void economy;
  const sim = createFloorSim({
    bus,
    seed: MASTER_SEED,
    ctx: baseCtx,
    drains: [drain],
  });
  return { bus, sim };
}

describe('FloorSim — forced-exception channel (#103)', () => {
  it('no drains seam ⇒ totalEscalated stays 0, no event (skeleton preserved)', () => {
    const bus = createEventBus();
    const raised: unknown[] = [];
    bus.subscribe('floor:exception_raised', e => raised.push(e));
    const sim = createFloorSim({ bus, seed: MASTER_SEED, ctx: baseCtx });
    sim.runDay();
    expect(sim.totalEscalated).toBe(0);
    expect(raised).toHaveLength(0);
  });

  it('designated dramatic cases escalate into a grabbable exception ref', () => {
    const { bus, sim } = setup(ALWAYS_EXCEPTION, 0.8, 15);
    const raised: Array<{ customerId: string; department: string }> = [];
    bus.subscribe('floor:exception_raised', e => raised.push(e));
    sim.runDay();

    expect(sim.totalEscalated).toBe(15);
    expect(sim.totalResolved).toBe(0);
    expect(raised).toHaveLength(15);

    const grabbable = sim.grabbableCustomers();
    const exceptions = grabbable.filter(c => c.source === 'exception');
    expect(exceptions).toHaveLength(15);
    for (const ref of exceptions) {
      expect(ref.mustHandle).toBe(true);
      expect(ref.department).toBe('sales');
    }
    // The heartbeat ids match the grabbable roster exactly.
    expect(new Set(raised.map(r => r.customerId))).toEqual(
      new Set(exceptions.map(c => c.id)),
    );
  });

  it('floor:exception_raised precedes that tick\'s floor:tick', () => {
    const { bus, sim } = setup(ALWAYS_EXCEPTION, 0.8, 5);
    const log: Array<{ type: 'exc' | 'tick'; tick: number }> = [];
    bus.subscribe('floor:exception_raised', e =>
      log.push({ type: 'exc', tick: e.tick }),
    );
    bus.subscribe('floor:tick', e => log.push({ type: 'tick', tick: e.tick }));
    sim.runDay();

    const excs = log.filter(l => l.type === 'exc');
    expect(excs.length).toBeGreaterThan(0);
    for (let i = 0; i < log.length; i++) {
      if (log[i].type !== 'exc') continue;
      const tickIdx = log.findIndex(
        (l, j) => j > i && l.type === 'tick' && l.tick === log[i].tick,
      );
      // The same-tick heartbeat exists and comes strictly after the escalation.
      expect(tickIdx).toBeGreaterThan(i);
    }
  });

  it('threshold tightens as staff skill rises (rarer escalations at scale)', () => {
    const lowSkill = setup(SOFT_EXCEPTION, 0.05, 60);
    lowSkill.sim.runDay();
    const highSkill = setup(SOFT_EXCEPTION, 0.95, 60);
    highSkill.sim.runDay();

    expect(highSkill.sim.totalEscalated).toBeLessThan(
      lowSkill.sim.totalEscalated,
    );
  });

  it('is deterministic under seed (same escalation ids)', () => {
    function run(): string[] {
      const { bus, sim } = setup(SOFT_EXCEPTION, 0.4, 40);
      const ids: string[] = [];
      bus.subscribe('floor:exception_raised', e => ids.push(e.customerId));
      sim.runDay();
      return ids;
    }
    const a = run();
    expect(a.length).toBeGreaterThan(0);
    expect(run()).toEqual(a);
  });
});

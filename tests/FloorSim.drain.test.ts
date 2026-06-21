import { createEventBus } from '../src/game/EventBus';
import type { EventBus } from '../src/game/EventBus';
import { createFloorSim, type DayContext } from '../src/game/FloorSim';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createEconomy } from '../src/game/Economy';
import {
  createStaffDispatch,
  createStaffFloorDrain,
  type StaffDispatchConfig,
  type StaffDispatchDeps,
} from '../src/game/StaffDispatch';
import { createDealEngine, loadCreditTiers } from '../src/game/DealEngine';
import type { Inventory } from '../src/game/Inventory';
import {
  createServiceFloorDrain,
  type ServiceDispatchConfig,
} from '../src/game/ServiceDispatch';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';

const MASTER_SEED = 42;

const baseCtx: DayContext = {
  day: 1,
  reputation: 0.5,
  marketShare: 0.1,
  season: 'spring',
};

function makeStaff(
  effectiveness: number,
  role_id: string,
  id = `staff:${role_id}:${effectiveness}`,
): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id,
    trait_ids: [],
    skills: { upsell: 50 },
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
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  };
}

const STAFF_CONFIG: StaffDispatchConfig = {
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.6,
  discountEvent: {
    escalationRate: 1,
    minCounterAttempts: 1,
    maxCounterAttempts: 3,
    missPenalty: 0.15,
  },
};

// Empty-lot Inventory stub — drain tests focus on cadence, not closes.
const emptyInventory: Pick<Inventory, 'getLotVehicles'> = {
  getLotVehicles: () => [],
};

/** Extras the #147-rewired StaffDispatch needs (cadence-only tests don't care
 *  about real closes — empty lot + empty bundle lookup ⇒ every up resolves
 *  with `no_sale`, which still counts as `resolved` for cadence assertions). */
function staffExtras(bus: import('../src/game/EventBus').EventBus): Pick<
  StaffDispatchDeps,
  'inventory' | 'dealEngine' | 'creditTiers' | 'getCustomerSession'
> {
  return {
    inventory: emptyInventory,
    dealEngine: createDealEngine({ bus }),
    creditTiers: loadCreditTiers(),
    getCustomerSession: () => undefined,
  };
}

const SERVICE_CONFIG: ServiceDispatchConfig = {
  minAutoResolveRate: 1.0,
  maxAutoResolveRate: 1.0,
  minRevenueMultiplier: 1.0,
  maxRevenueMultiplier: 1.0,
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.6,
  rushUnlockTier: 3,
  missCsiHit: 4,
};

function seedSalesQueue(bus: EventBus, n: number, day = baseCtx.day) {
  for (let i = 0; i < n; i++) {
    bus.publish('capacity:customer_admitted', {
      day,
      customerId: `cust:${i}`,
      label: `Customer ${i}`,
    });
  }
}

describe('FloorSim — per-tick staff routine draining (#101)', () => {
  it('no drains seam ⇒ totalResolved stays 0 (skeleton preserved)', () => {
    const bus = createEventBus();
    const sim = createFloorSim({ bus, seed: MASTER_SEED, ctx: baseCtx });
    sim.runDay();
    expect(sim.totalResolved).toBe(0);
  });

  it('drains the sales queue across ticks, not once at day start', () => {
    const bus = createEventBus();
    const queue = createDepartmentQueue({ bus });
    const economy = createEconomy({
      bus,
      startingCash: 50_000,
      config: { weeklyRent: 0, weeklyPayrollStub: 0 },
    });
    const staffOrg = makeStaffOrg([makeStaff(0.8, 'salesperson')]);
    seedSalesQueue(bus, 10);

    const drain = createStaffFloorDrain({
      bus,
      staffOrg,
      queue,
      masterSeed: MASTER_SEED,
      config: STAFF_CONFIG,
      ...staffExtras(bus),
    });
    void economy;
    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      drains: [drain],
    });

    const resolvedAt: number[] = [];
    let prev = 0;
    for (let i = 0; i < sim.ticksPerDay; i++) {
      sim.step();
      if (sim.totalResolved > prev) {
        resolvedAt.push(sim.currentTick);
        prev = sim.totalResolved;
      }
    }

    expect(sim.totalResolved).toBe(10);
    expect(queue.getBadgeCount('sales')).toBe(0);
    // Spread across multiple distinct ticks, none on tick 1 (sub-1.0 rate).
    expect(new Set(resolvedAt).size).toBeGreaterThan(1);
    expect(resolvedAt[0]).toBeGreaterThan(1);
  });

  it('drains at a skill-scaled throughput (high skill empties sooner)', () => {
    function ticksToDrain(effectiveness: number): number {
      const bus = createEventBus();
      const queue = createDepartmentQueue({ bus });
      const economy = createEconomy({
        bus,
        startingCash: 50_000,
        config: { weeklyRent: 0, weeklyPayrollStub: 0 },
      });
      const staffOrg = makeStaffOrg([makeStaff(effectiveness, 'salesperson')]);
      seedSalesQueue(bus, 12);
      const drain = createStaffFloorDrain({
        bus,
        staffOrg,
        queue,
        masterSeed: MASTER_SEED,
        config: STAFF_CONFIG,
        ...staffExtras(bus),
      });
      void economy;
      const sim = createFloorSim({
        bus,
        seed: MASTER_SEED,
        ctx: baseCtx,
        drains: [drain],
      });
      for (let i = 0; i < sim.ticksPerDay; i++) {
        sim.step();
        if (sim.totalResolved === 12) return sim.currentTick;
      }
      return sim.ticksPerDay + 1;
    }
    expect(ticksToDrain(0.95)).toBeLessThan(ticksToDrain(0.05));
  });

  it('resolution outcome is unchanged vs the legacy once-per-admit path', () => {
    type Resolved = { customerId: string; outcome: string; grossImpact: number };

    // Legacy path: StaffDispatch resolves immediately on admit.
    const legacyBus = createEventBus();
    const legacyEvents: Resolved[] = [];
    legacyBus.subscribe('staff:auto_resolved', e => legacyEvents.push(e));
    const legacyQueue = createDepartmentQueue({ bus: legacyBus });
    const legacyEconomy = createEconomy({
      bus: legacyBus,
      startingCash: 50_000,
      config: { weeklyRent: 0, weeklyPayrollStub: 0 },
    });
    createStaffDispatch({
      bus: legacyBus,
      staffOrg: makeStaffOrg([makeStaff(0.7, 'salesperson')]),
      queue: legacyQueue,
      masterSeed: MASTER_SEED,
      config: STAFF_CONFIG,
      ...staffExtras(legacyBus),
    });
    void legacyEconomy;
    seedSalesQueue(legacyBus, 15);

    // Floor-drain path: same customers, resolved across FloorSim ticks.
    const floorBus = createEventBus();
    const floorEvents: Resolved[] = [];
    floorBus.subscribe('staff:auto_resolved', e => floorEvents.push(e));
    const floorQueue = createDepartmentQueue({ bus: floorBus });
    const floorEconomy = createEconomy({
      bus: floorBus,
      startingCash: 50_000,
      config: { weeklyRent: 0, weeklyPayrollStub: 0 },
    });
    seedSalesQueue(floorBus, 15);
    const drain = createStaffFloorDrain({
      bus: floorBus,
      staffOrg: makeStaffOrg([makeStaff(0.7, 'salesperson')]),
      queue: floorQueue,
      masterSeed: MASTER_SEED,
      config: STAFF_CONFIG,
      ...staffExtras(floorBus),
    });
    void floorEconomy;
    const sim = createFloorSim({
      bus: floorBus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      drains: [drain],
    });
    sim.runDay();

    const key = (e: Resolved) => e.customerId;
    const sortById = (a: Resolved[]) =>
      [...a].sort((x, y) => key(x).localeCompare(key(y)));

    expect(floorEvents.length).toBe(legacyEvents.length);
    expect(sortById(floorEvents)).toEqual(sortById(legacyEvents));
    expect(floorEconomy.cash).toBe(legacyEconomy.cash);
  });

  it('is deterministic under seed (same resolved sequence)', () => {
    function run(): number[] {
      const bus = createEventBus();
      const queue = createDepartmentQueue({ bus });
      const economy = createEconomy({
        bus,
        startingCash: 50_000,
        config: { weeklyRent: 0, weeklyPayrollStub: 0 },
      });
      seedSalesQueue(bus, 12);
      const drain = createStaffFloorDrain({
        bus,
        staffOrg: makeStaffOrg([makeStaff(0.6, 'salesperson')]),
        queue,
        masterSeed: MASTER_SEED,
        config: STAFF_CONFIG,
        ...staffExtras(bus),
      });
      void economy;
      const sim = createFloorSim({
        bus,
        seed: MASTER_SEED,
        ctx: baseCtx,
        drains: [drain],
      });
      const perTick: number[] = [];
      let prev = 0;
      for (let i = 0; i < sim.ticksPerDay; i++) {
        sim.step();
        perTick.push(sim.totalResolved - prev);
        prev = sim.totalResolved;
      }
      return perTick;
    }
    expect(run()).toEqual(run());
  });
});

describe('FloorSim — per-tick service routine draining (#101)', () => {
  it('drains captured service intake across ticks via the floor drain', () => {
    const bus = createEventBus();
    const queue = createDepartmentQueue({ bus });
    const economy = createEconomy({
      bus,
      startingCash: 50_000,
      config: { weeklyRent: 0, weeklyPayrollStub: 0 },
    });
    const closed: unknown[] = [];
    bus.subscribe('service:ticket_closed', e => closed.push(e));

    const drain = createServiceFloorDrain({
      bus,
      staffOrg: makeStaffOrg([makeStaff(0.8, 'service-advisor')]),
      queue,
      economy,
      masterSeed: MASTER_SEED,
      config: SERVICE_CONFIG,
    });
    bus.publish('service:intake_ready', {
      day: baseCtx.day,
      items: Array.from({ length: 8 }, (_, i) => ({
        serviceItemId: `svc:return:${i}`,
        source: 'return' as const,
        customerId: `cust-${i}`,
        vehicleId: `veh-${i}`,
        category: 'sedan',
        powertrain: 'ice' as const,
        jobCategory: 'oil_filters' as const,
        baseRevenue: 75,
        label: 'Oil & filter service',
      })),
    });

    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      drains: [drain],
    });

    const resolvedAt: number[] = [];
    let prev = 0;
    for (let i = 0; i < sim.ticksPerDay; i++) {
      sim.step();
      if (sim.totalResolved > prev) {
        resolvedAt.push(sim.currentTick);
        prev = sim.totalResolved;
      }
    }

    expect(sim.totalResolved).toBe(8);
    expect(closed).toHaveLength(8);
    expect(new Set(resolvedAt).size).toBeGreaterThan(1);
  });
});

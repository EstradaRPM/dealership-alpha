import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createCustomerPool, SALES_ARCHETYPES } from '../src/game/CustomerPool';
import { createEconomy } from '../src/game/Economy';
import { createCapacityManager } from '../src/game/CapacityManager';
import { createStaffFloorDrain } from '../src/game/StaffDispatch';
import { createInventory } from '../src/game/Inventory';
import { createDealEngine, loadCreditTiers } from '../src/game/DealEngine';
import {
  createDayLoopController,
  type FloorSeamProvider,
} from '../src/game/DayLoopController';
import type { CustomerSource, CustomerRef } from '../src/game/FloorSim';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';

const MASTER_SEED = 42;

const emptyStaffOrg: StaffOrg = {
  get currentRoster() {
    return [];
  },
  getCandidates: () => [],
  hire: () => {},
  fire: () => {},
    assessCondition: () => null,
};

/** Mirrors App.tsx's #114 composition root: CapacityManager / StaffDispatch /
 *  CustomerPool injected behind FloorSim's locked #99 seams, DayLoopController
 *  owning the day, all legacy live-day paths off. */
function composeApp(opts: { staffOrg?: StaffOrg } = {}) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const departmentQueue = createDepartmentQueue({ bus });
  const customerPool = createCustomerPool({
    bus,
    legacyDailyArrivals: false,
    npcDeps: {
      masterSeed: MASTER_SEED,
      personArchetypes: loadPersonArchetypes(),
      visitArchetypes: loadVisitArchetypes(),
      traits: loadTraitTaxonomy(),
    },
  });
  const economy = createEconomy({ bus, startingCash: 50_000 });
  const inventory = createInventory({ bus, masterSeed: MASTER_SEED, economy });
  const dealEngine = createDealEngine({ bus, inventory, economy });
  const staffOrg = opts.staffOrg ?? emptyStaffOrg;
  const capacityManager = createCapacityManager({
    bus,
    staffOrg,
    facilityTier: 1,
    legacyAdmitGate: false,
  });

  // #135: composition root publishes capacity:customer_admitted per admitted
  // sales ref so DepartmentQueue enqueues `workspace` items and the staff
  // floor drain has someone to hold. Mirrors createWorld.ts.
  const customerSource: CustomerSource = {
    spawn({ day, tick, count }): readonly CustomerRef[] {
      const refs: CustomerRef[] = [];
      for (let i = 0; i < count; i++) {
        const a = SALES_ARCHETYPES[(day + tick + i) % SALES_ARCHETYPES.length];
        const id = customerPool.spawnCustomer(a.personId, a.visitId, a.label);
        const ref: CustomerRef = { id, source: 'ambient', mustHandle: false, department: 'sales' };
        refs.push(ref);
        if (ref.department === 'sales') {
          bus.publish('capacity:customer_admitted', { day, customerId: id, label: a.label });
        }
      }
      return refs;
    },
  };

  const floorSeams: FloorSeamProvider = () => ({
    capacity: capacityManager.createFloorGate(),
    drains: [
      createStaffFloorDrain({
        bus,
        staffOrg,
        queue: departmentQueue,
        masterSeed: MASTER_SEED,
        inventory,
        dealEngine,
        creditTiers: loadCreditTiers(),
        getCustomerSession: (id) => {
          const s = customerPool.getSession(id);
          return s ? { bundle: s.bundle, visitArchetypeId: s.visitArchetypeId } : undefined;
        },
      }),
    ],
    customerSource,
  });

  const dayLoop = createDayLoopController({
    bus,
    seed: MASTER_SEED,
    clock,
    floorSeams,
  });

  return { bus, clock, customerPool, capacityManager, dayLoop };
}

function makeSalesperson(effectiveness: number, id: string): StaffWithComposites {
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
    assessCondition: () => null,
  };
}

describe('#114 composition root — composed day through the seams', () => {
  it('boots MANAGERIAL "night before Day 1"', () => {
    const { dayLoop } = composeApp();
    const s = dayLoop.state();
    expect(s.phase).toBe('MANAGERIAL');
    expect(s.day).toBe(1);
    expect(s.hasRecap).toBe(false);
    expect(s.ownershipUnlocked).toBe(true);
  });

  it('runs a full Day 1 end-to-end through CapacityManager + CustomerPool seams', () => {
    const { dayLoop, customerPool, capacityManager } = composeApp();

    const floor = dayLoop.nextDay();
    expect(dayLoop.state().phase).toBe('FLOOR_OPEN');

    floor.runDay();

    // FloorSim's own arrival RNG drove arrivals; the capacity gate saw every
    // one of them (potentialTraffic == totalArrivals); the customer-source
    // seam minted exactly one CustomerPool session per *admitted* customer
    // (the #99 spawn seam individuates the admitted count, not all arrivals).
    expect(floor.dayComplete).toBe(true);
    expect(floor.totalArrivals).toBeGreaterThan(0);

    const funnel = capacityManager.getDayFunnel();
    expect(funnel.potentialTraffic).toBe(floor.totalArrivals);
    expect(funnel.walkedIn).toBeGreaterThan(0);
    expect(funnel.walkedIn).toBeLessThanOrEqual(funnel.potentialTraffic);
    expect(customerPool.getSessions()).toHaveLength(funnel.walkedIn);

    // floor:day_complete flipped the controller back to MANAGERIAL.
    const s = dayLoop.state();
    expect(s.phase).toBe('MANAGERIAL');
    expect(s.hasRecap).toBe(true);
    expect(s.day).toBe(1);
  });

  it('the next "Next Day" advances the clock (Day 1 not skipped)', () => {
    const { dayLoop } = composeApp();

    dayLoop.nextDay().runDay();
    expect(dayLoop.state().day).toBe(1);

    dayLoop.nextDay().runDay();
    expect(dayLoop.state().day).toBe(2);
    expect(dayLoop.state().phase).toBe('MANAGERIAL');
  });

  it('#135: a staffed day with admits produces ≥1 staff:auto_resolved', () => {
    const staffOrg = makeStaffOrg([makeSalesperson(0.8, 'staff:sp:1')]);
    const { bus, dayLoop, capacityManager } = composeApp({ staffOrg });

    const autoResolved: unknown[] = [];
    bus.subscribe('staff:auto_resolved', (p) => autoResolved.push(p));

    const floor = dayLoop.nextDay();
    floor.runDay();

    const funnel = capacityManager.getDayFunnel();
    expect(funnel.walkedIn).toBeGreaterThan(0);
    expect(funnel.staffEngaged).toBeGreaterThan(0);
    expect(autoResolved.length).toBeGreaterThan(0);
  });

  it('legacy live-day path is gone: no clock-driven arrivals', () => {
    const { bus, clock, customerPool } = composeApp();
    // Advancing the clock directly must not auto-generate customers anymore
    // (legacyDailyArrivals:false) — only the floor seam mints them.
    clock.advanceDay();
    expect(customerPool.getSessions()).toHaveLength(0);
    // sanity: bus is the shared channel, no admit fan-out happened.
    expect(bus).toBeDefined();
  });
});

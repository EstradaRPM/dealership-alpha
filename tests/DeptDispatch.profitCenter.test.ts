import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createDeptFloorDrain } from '../src/game/ServiceDispatch';
import type {
  DeptCapacityConfig,
  DeptDispatchProfile,
  DeptIntakeItem,
} from '../src/game/ServiceDispatch';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { Staff, StaffWithComposites } from '../src/game/NPC';
import type { ProfitCenter } from '../src/game/Economy';

/**
 * #375 — Service and Body Shop run on ONE dispatch engine, and their revenue
 * still lands in two different profit centers. The attribution rides the
 * department's `DeptDispatchProfile`, exactly as its pricing, its RNG namespace
 * and its event family already do; the engine never names a department.
 *
 * The two profiles here differ ONLY in the fields a department owns, so a
 * regression that hard-coded "service" inside the engine fails the body-shop
 * half while every Service test still passed.
 */

const MASTER_SEED = 42;

const ALWAYS_RESOLVE: DeptCapacityConfig = {
  minAutoResolveRate: 1.0,
  maxAutoResolveRate: 1.0,
  minPerSlotThroughput: 1.0,
  maxPerSlotThroughput: 1.0,
  maxWaitTicks: 9999,
  unservedCsiHit: 0,
  missCsiHit: 0,
};

function makeAdvisor(roleId: string): StaffWithComposites {
  const plain: Staff = {
    id: `${roleId}:1`,
    role_id: roleId,
    trait_ids: [],
    skills: {},
    resources: { stamina: 80 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
  Object.defineProperty(plain, 'effectiveness', { get: () => 1, enumerable: false });
  Object.defineProperty(plain, 'trustworthiness', { get: () => 0, enumerable: false });
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

const noopEmit = {
  ticketClosed: () => {},
  partsConsumed: () => {},
  jobMissed: () => {},
  jobRushed: () => {},
  jobUnserved: () => {},
};

/**
 * A department: the profile plus the handle its `subscribeIntake` hands back.
 * Capturing `enqueue` rather than publishing an intake event keeps the test on
 * the one thing it is about — the engine's posting — instead of two intake
 * feeds' payload shapes.
 */
function makeDepartment(
  advisorRole: string,
  queueDept: 'service' | 'bodyshop',
  profitCenter: ProfitCenter,
  labelPrefix: string,
) {
  let enqueue: ((item: DeptIntakeItem, day: number) => void) | null = null;
  const profile: DeptDispatchProfile = {
    advisorRole,
    queueDept,
    rngKey: `${queueDept}_dispatch`,
    rngSeedInput: (itemId, day) => ({ itemId, day }),
    priceTicket: (item) => item.baseRevenue,
    revenueLabel: (item) => `${labelPrefix} — ${item.label}`,
    profitCenter,
    subscribeIntake: (_bus, enq) => { enqueue = enq; },
    fromQueuedItem: () => null,
    emit: noopEmit,
  };
  return { profile, push: (item: DeptIntakeItem) => enqueue!(item, 1) };
}

function makeItem(itemId: string, baseRevenue: number, label: string): DeptIntakeItem {
  return {
    itemId,
    label,
    baseRevenue,
    jobCategory: 'oil_filters',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
  };
}

describe('the shared dispatch engine — one engine, two departments (#375)', () => {
  it('posts each department its own profit center, with no hard-coded name', () => {
    const bus = createEventBus();
    const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
    const queue = createDepartmentQueue({ bus });

    const service = makeDepartment('service-advisor', 'service', 'service', 'Service');
    const body = makeDepartment('body-shop-advisor', 'bodyshop', 'bodyshop', 'Body Shop');

    const shared = { bus, queue, economy, masterSeed: MASTER_SEED, config: ALWAYS_RESOLVE };
    const serviceDrain = createDeptFloorDrain({
      ...shared,
      staffOrg: makeStaffOrg([makeAdvisor('service-advisor')]),
      profile: service.profile,
    });
    const bodyDrain = createDeptFloorDrain({
      ...shared,
      staffOrg: makeStaffOrg([makeAdvisor('body-shop-advisor')]),
      profile: body.profile,
    });

    service.push(makeItem('svc:1', 900, 'Brake job'));
    body.push(makeItem('bs:1', 2_400, 'Bumper respray'));
    serviceDrain.drain({ day: 1, tick: 1 });
    bodyDrain.drain({ day: 1, tick: 1 });

    const summary = economy.getDepartmentPnL(1, 1);
    const grossOf = (c: ProfitCenter) => summary.departments.find((d) => d.center === c)!;
    expect(grossOf('service')).toMatchObject({ revenue: 900, gross: 900, active: true });
    expect(grossOf('bodyshop')).toMatchObject({ revenue: 2_400, gross: 2_400, active: true });
    // Neither department's ticket leaked into the other's line or into overhead.
    expect(grossOf('sales').active).toBe(false);
    expect(summary.overhead).toBe(0);
  });
});

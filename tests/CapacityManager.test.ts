import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createCapacityManager, type CapacityConfig } from '../src/game/CapacityManager';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStaff(id: string, roleId: string): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id: roleId,
    trait_ids: [],
    skills: {},
    resources: { stamina: 80 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
  Object.defineProperty(plain, 'effectiveness', { get: () => 0.5, enumerable: false, configurable: true });
  Object.defineProperty(plain, 'trustworthiness', { get: () => 0.5, enumerable: false, configurable: true });
  return plain as StaffWithComposites;
}

function makeStaffOrg(roster: StaffWithComposites[]): StaffOrg {
  return {
    get currentRoster() { return roster; },
    headcountCap: Infinity,
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
    getPromotionOptions: () => [],
    promote: () => {},
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  };
}

const BASE_CONFIG: CapacityConfig = {
  facilityTierBaseCapacity: { '1': 2, '2': 4, '3': 8 },
  staffContributionByTier: { worker: 0, 'customer-facing': 1, manager: 1, gm: 0 },
  missedOpportunitySatisfactionHit: -5,
};

// Zero-base config: capacity = 0 + staff bonus only
const ZERO_BASE_CONFIG: CapacityConfig = {
  ...BASE_CONFIG,
  facilityTierBaseCapacity: { '1': 0, '2': 0, '3': 0 },
};

function makeSetup(
  roster: StaffWithComposites[] = [],
  config: CapacityConfig = BASE_CONFIG,
  facilityTier: 1 | 2 | 3 = 1,
) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const queue = createDepartmentQueue({ bus });
  const staffOrg = makeStaffOrg(roster);
  const capacity = createCapacityManager({ bus, staffOrg, facilityTier, config });
  return { bus, clock, queue, capacity };
}

function fireCustomerArrived(
  bus: ReturnType<typeof createEventBus>,
  customerId: string,
  day = 1,
  label = 'Test Customer',
) {
  bus.publish('customer:arrived', { day, customerId, label });
}

// ── Capacity calculation ──────────────────────────────────────────────────────

describe('CapacityManager — capacity calculation', () => {
  it('returns base capacity for tier 1 with no staff', () => {
    const { capacity } = makeSetup([], BASE_CONFIG, 1);
    expect(capacity.getDailyCapacity()).toBe(2);
  });

  it('returns base capacity for tier 2', () => {
    const { capacity } = makeSetup([], BASE_CONFIG, 2);
    expect(capacity.getDailyCapacity()).toBe(4);
  });

  it('returns base capacity for tier 3', () => {
    const { capacity } = makeSetup([], BASE_CONFIG, 3);
    expect(capacity.getDailyCapacity()).toBe(8);
  });

  it('adds customer-facing staff contribution', () => {
    const roster = [makeStaff('s1', 'salesperson')];
    const { capacity } = makeSetup(roster, BASE_CONFIG, 1);
    expect(capacity.getDailyCapacity()).toBe(3); // 2 base + 1 salesperson
  });

  it('adds multiple staff contributions', () => {
    const roster = [
      makeStaff('s1', 'salesperson'),
      makeStaff('s2', 'salesperson'),
      makeStaff('s3', 'used-car-manager'),
    ];
    const { capacity } = makeSetup(roster, BASE_CONFIG, 1);
    expect(capacity.getDailyCapacity()).toBe(5); // 2 + 1 + 1 + 1
  });

  it('worker roles contribute 0', () => {
    const roster = [makeStaff('p1', 'lot-porter')];
    const { capacity } = makeSetup(roster, BASE_CONFIG, 1);
    expect(capacity.getDailyCapacity()).toBe(2); // base only
  });

  it('gm roles contribute 0', () => {
    const roster = [makeStaff('g1', 'gm')];
    const { capacity } = makeSetup(roster, BASE_CONFIG, 1);
    expect(capacity.getDailyCapacity()).toBe(2); // base only
  });

  it('zero base with no staff yields capacity of 0', () => {
    const { capacity } = makeSetup([], ZERO_BASE_CONFIG, 1);
    expect(capacity.getDailyCapacity()).toBe(0);
  });

  it('recomputes capacity each day as roster changes', () => {
    const roster: StaffWithComposites[] = [];
    const { clock, capacity } = makeSetup(roster, BASE_CONFIG, 1);
    expect(capacity.getDailyCapacity()).toBe(2);
    roster.push(makeStaff('s1', 'salesperson'));
    clock.advanceDay();
    expect(capacity.getDailyCapacity()).toBe(3);
  });
});

// ── Admitted vs missed ────────────────────────────────────────────────────────

describe('CapacityManager — customer gating', () => {
  it('customer within capacity emits capacity:customer_admitted', () => {
    const { bus } = makeSetup([], BASE_CONFIG, 1); // capacity = 2
    const admitted: string[] = [];
    bus.subscribe('capacity:customer_admitted', ({ customerId }) => admitted.push(customerId));

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');

    expect(admitted).toEqual(['c1', 'c2']);
  });

  it('customer over capacity emits capacity:missed_opportunity', () => {
    const { bus } = makeSetup([], BASE_CONFIG, 1); // capacity = 2
    const missed: string[] = [];
    bus.subscribe('capacity:missed_opportunity', ({ customerId }) => missed.push(customerId));

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');
    fireCustomerArrived(bus, 'c3'); // over capacity

    expect(missed).toEqual(['c3']);
  });

  it('all customers missed when capacity is 0', () => {
    const { bus } = makeSetup([], ZERO_BASE_CONFIG, 1); // capacity = 0
    const admitted: string[] = [];
    const missed: string[] = [];
    bus.subscribe('capacity:customer_admitted', ({ customerId }) => admitted.push(customerId));
    bus.subscribe('capacity:missed_opportunity', ({ customerId }) => missed.push(customerId));

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');

    expect(admitted).toHaveLength(0);
    expect(missed).toEqual(['c1', 'c2']);
  });

  it('getMissedCount tracks missed opportunities', () => {
    const { bus, capacity } = makeSetup([], ZERO_BASE_CONFIG, 1);

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');

    expect(capacity.getMissedCount()).toBe(2);
  });

  it('getDailyArrivals counts all customer:arrived events', () => {
    const { bus, capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');
    fireCustomerArrived(bus, 'c3');

    expect(capacity.getDailyArrivals()).toBe(3);
  });

  it('counters reset each day', () => {
    const { bus, clock, capacity } = makeSetup([], ZERO_BASE_CONFIG, 1);

    fireCustomerArrived(bus, 'c1');
    expect(capacity.getDailyArrivals()).toBe(1);
    expect(capacity.getMissedCount()).toBe(1);

    clock.advanceDay();

    expect(capacity.getDailyArrivals()).toBe(0);
    expect(capacity.getMissedCount()).toBe(0);
  });
});

// ── Day funnel read-model ─────────────────────────────────────────────────────

function fireAutoResolved(
  bus: ReturnType<typeof createEventBus>,
  customerId: string,
  outcome: 'closed' | 'no_sale',
  day = 1,
) {
  bus.publish('staff:auto_resolved', {
    customerId,
    staffId: 's1',
    day,
    outcome,
    grossImpact: outcome === 'closed' ? 1000 : 0,
  });
}

describe('CapacityManager — day funnel', () => {
  it('starts empty with leakCause none', () => {
    const { capacity } = makeSetup([], BASE_CONFIG, 1);
    expect(capacity.getDayFunnel()).toEqual({
      potentialTraffic: 0,
      walkedIn: 0,
      gated: 0,
      staffEngaged: 0,
      sold: 0,
      leakCause: 'none',
    });
  });

  it('tracks the full funnel across a representative day', () => {
    const { bus, capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2'); // both within capacity → walked-in
    fireAutoResolved(bus, 'c1', 'closed');
    fireAutoResolved(bus, 'c2', 'no_sale');

    expect(capacity.getDayFunnel()).toEqual({
      potentialTraffic: 2,
      walkedIn: 2,
      gated: 0,
      staffEngaged: 2,
      sold: 1,
      leakCause: 'closing', // only drop: 2 engaged → 1 sold
    });
  });

  it('flags capacity as the leak when most traffic is turned away', () => {
    const { bus, capacity } = makeSetup([], ZERO_BASE_CONFIG, 1); // capacity = 0

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');
    fireCustomerArrived(bus, 'c3');

    const f = capacity.getDayFunnel();
    expect(f.potentialTraffic).toBe(3);
    expect(f.walkedIn).toBe(0);
    expect(f.leakCause).toBe('capacity');
  });

  it('flags engagement when admitted customers go unworked', () => {
    const { bus, capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');
    // nobody engaged

    const f = capacity.getDayFunnel();
    expect(f).toMatchObject({
      potentialTraffic: 2,
      walkedIn: 2,
      staffEngaged: 0,
      sold: 0,
      leakCause: 'engagement',
    });
  });

  it('reports none when the funnel is clean (everyone sold)', () => {
    const { bus, capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');
    fireAutoResolved(bus, 'c1', 'closed');
    fireAutoResolved(bus, 'c2', 'closed');

    expect(capacity.getDayFunnel().leakCause).toBe('none');
  });

  it('ties break toward the earliest stage', () => {
    const { bus, capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2

    // potential 4, walkedIn 2 (capacity drop 2), engaged 0 (engagement drop 2)
    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');
    fireCustomerArrived(bus, 'c3');
    fireCustomerArrived(bus, 'c4');

    expect(capacity.getDayFunnel().leakCause).toBe('capacity');
  });

  it('derives the funnel from the per-tick floor gate too', () => {
    const { capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2
    const gate = capacity.createFloorGate();

    gate.admit(3, { day: 1, tick: 1 }); // 2 admitted, 1 walked

    expect(capacity.getDayFunnel()).toMatchObject({
      potentialTraffic: 3,
      walkedIn: 2,
      // nobody engaged the 2 admitted → engagement drop (2) > capacity drop (1)
      leakCause: 'engagement',
    });
  });

  it('does not let returning callbacks make engagement negative', () => {
    const { bus, capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2

    fireCustomerArrived(bus, 'c1');
    // c1 plus a BDC callback both get engaged: engaged (2) > walkedIn (1)
    fireAutoResolved(bus, 'c1', 'closed');
    fireAutoResolved(bus, 'cb', 'closed');

    const f = capacity.getDayFunnel();
    expect(f.staffEngaged).toBe(2);
    expect(f.sold).toBe(2);
    expect(f.leakCause).toBe('none');
  });

  it('resets the funnel each day', () => {
    const { bus, clock, capacity } = makeSetup([], BASE_CONFIG, 1);

    fireCustomerArrived(bus, 'c1');
    fireAutoResolved(bus, 'c1', 'closed');
    expect(capacity.getDayFunnel().potentialTraffic).toBe(1);

    clock.advanceDay();

    expect(capacity.getDayFunnel()).toEqual({
      potentialTraffic: 0,
      walkedIn: 0,
      gated: 0,
      staffEngaged: 0,
      sold: 0,
      leakCause: 'none',
    });
  });

  it('classifies floor-gate overflow as gated, not walked-in (#128b)', () => {
    const { capacity } = makeSetup([], BASE_CONFIG, 1); // capacity = 2
    const gate = capacity.createFloorGate();

    gate.admit(5, { day: 1, tick: 1 }); // 2 admitted, 3 turned away

    const f = capacity.getDayFunnel();
    expect(f.potentialTraffic).toBe(5);
    expect(f.walkedIn).toBe(2);
    expect(f.gated).toBe(3);
  });

  it('a closed lot (gate created but never driven) reports zero funnel (#128b)', () => {
    const { capacity } = makeSetup([], BASE_CONFIG, 1);
    capacity.createFloorGate(); // floor never opens → gate never admits

    expect(capacity.getDayFunnel()).toEqual({
      potentialTraffic: 0,
      walkedIn: 0,
      gated: 0,
      staffEngaged: 0,
      sold: 0,
      leakCause: 'none',
    });
  });

  it('resets the gated bucket each day', () => {
    const { clock, capacity } = makeSetup([], ZERO_BASE_CONFIG, 1); // cap 0
    capacity.createFloorGate().admit(3, { day: 1, tick: 1 });
    expect(capacity.getDayFunnel().gated).toBe(3);

    clock.advanceDay();

    expect(capacity.getDayFunnel().gated).toBe(0);
  });
});

// ── Reputation hit ───────────────────────────────────────────────────────────

describe('CapacityManager — reputation satisfaction hit', () => {
  it('emits reputation:satisfaction_hit for each missed opportunity', () => {
    const { bus } = makeSetup([], ZERO_BASE_CONFIG, 1);
    const hits: Array<{ amount: number; reason: string }> = [];
    bus.subscribe('reputation:satisfaction_hit', ({ amount, reason }) => hits.push({ amount, reason }));

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');

    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ amount: -5, reason: 'missed_opportunity' });
    expect(hits[1]).toEqual({ amount: -5, reason: 'missed_opportunity' });
  });

  it('does not emit satisfaction hit for admitted customers', () => {
    const { bus } = makeSetup([], BASE_CONFIG, 1); // capacity = 2
    const hits: unknown[] = [];
    bus.subscribe('reputation:satisfaction_hit', (p) => hits.push(p));

    fireCustomerArrived(bus, 'c1');
    fireCustomerArrived(bus, 'c2');

    expect(hits).toHaveLength(0);
  });

  it('floor-gate gated customers take NO reputation hit but DO signal missed opportunity (#128b)', () => {
    const { bus, capacity } = makeSetup([], ZERO_BASE_CONFIG, 1); // cap 0
    const hits: unknown[] = [];
    const missed: unknown[] = [];
    bus.subscribe('reputation:satisfaction_hit', (p) => hits.push(p));
    bus.subscribe('capacity:missed_opportunity', (p) => missed.push(p));

    capacity.createFloorGate().admit(4, { day: 1, tick: 1 });

    expect(hits).toHaveLength(0); // gated ≠ walk → no bad review
    expect(missed).toHaveLength(4); // still opportunity cost (KPI signal)
  });
});

// ── DepartmentQueue integration ───────────────────────────────────────────────

describe('CapacityManager — queue integration', () => {
  it('admitted customer adds workspace item to sales queue', () => {
    const { bus, queue } = makeSetup([], BASE_CONFIG, 1);

    fireCustomerArrived(bus, 'c1', 1, 'Young Family');

    const items = queue.getQueue('sales');
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('workspace');
    expect(items[0].label).toBe('Young Family');
    expect(items[0].customerId).toBe('c1');
  });

  it('missed customer adds missed_opportunity item to sales queue', () => {
    const { bus, queue } = makeSetup([], ZERO_BASE_CONFIG, 1);

    fireCustomerArrived(bus, 'c1', 1, 'Commuter');

    const items = queue.getQueue('sales');
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('missed_opportunity');
    expect(items[0].label).toBe('Commuter');
    expect(items[0].customerId).toBe('c1');
  });

  it('mixed arrivals produce correct item types in order', () => {
    const { bus, queue } = makeSetup([], BASE_CONFIG, 1); // capacity = 2

    fireCustomerArrived(bus, 'c1', 1, 'A');
    fireCustomerArrived(bus, 'c2', 1, 'B');
    fireCustomerArrived(bus, 'c3', 1, 'C'); // missed

    const items = queue.getQueue('sales');
    expect(items).toHaveLength(3);
    expect(items[0].type).toBe('workspace');
    expect(items[1].type).toBe('workspace');
    expect(items[2].type).toBe('missed_opportunity');
  });

  it('missed_opportunity items can be resolved from queue', () => {
    const { bus, queue } = makeSetup([], ZERO_BASE_CONFIG, 1);

    fireCustomerArrived(bus, 'c1', 1, 'Retiree');
    expect(queue.getBadgeCount('sales')).toBe(1);

    const id = queue.getQueue('sales')[0].id;
    queue.resolveItem(id);
    expect(queue.getBadgeCount('sales')).toBe(0);
  });
});

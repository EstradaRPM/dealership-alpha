import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createCustomerPool, IllegalTransitionError } from '../src/game/CustomerPool';
import { createCapacityManager, type CapacityConfig } from '../src/game/CapacityManager';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import { makeSalespersonProfile } from '../src/game/SalesProcess';
import type { StaffOrg } from '../src/game/StaffOrg';

// Guaranteed-close salesperson: effectiveness=1, trustworthiness=1 across all gates.
const PERFECT_SKILL = makeSalespersonProfile({}, { effectiveness: 1, trustworthiness: 1 });

const npcDeps = {
  masterSeed: 42,
  personArchetypes: loadPersonArchetypes(),
  visitArchetypes: loadVisitArchetypes(),
  traits: loadTraitTaxonomy(),
};

// High capacity so no customers are ever missed in these tests.
const OPEN_CAPACITY_CONFIG: CapacityConfig = {
  facilityTierBaseCapacity: { '1': 999 },
  staffContributionByTier: {},
  missedOpportunitySatisfactionHit: -5,
};

const emptyStaffOrg: StaffOrg = {
  get currentRoster() { return []; },
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

function makeSetup(initialDay = 0, skill?: Parameters<typeof createCustomerPool>[0]['skill']) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const queue = createDepartmentQueue({ bus });
  const pool = createCustomerPool({ bus, npcDeps, skill });
  createCapacityManager({ bus, staffOrg: emptyStaffOrg, config: OPEN_CAPACITY_CONFIG });
  return { bus, clock, queue, pool };
}

// ── Customer generation ───────────────────────────────────────────────────────

describe('CustomerPool — customer generation', () => {
  it('no sessions before day starts', () => {
    const { pool } = makeSetup();
    expect(pool.getSessions()).toHaveLength(0);
  });

  it('one session is created on clock:day_started', () => {
    const { clock, pool } = makeSetup();
    clock.advanceDay();
    expect(pool.getSessions()).toHaveLength(1);
  });

  it('session starts in UNGREETED stage', () => {
    const { clock, pool } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    expect(session.stage).toBe('UNGREETED');
  });

  it('session has a customerId, day, bundle, archetypeLabel', () => {
    const { clock, pool } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    expect(session.customerId).toBeTruthy();
    expect(session.day).toBe(1);
    expect(session.bundle.person).toBeTruthy();
    expect(session.bundle.visit.kind).toBe('sales');
    expect(session.archetypeLabel).toBeTruthy();
  });

  it('getSession returns the same session by id', () => {
    const { clock, pool } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    expect(pool.getSession(session.customerId)).toBe(session);
  });

  it('each day advance adds one more session', () => {
    const { clock, pool } = makeSetup();
    clock.advanceDay();
    clock.advanceDay();
    clock.advanceDay();
    expect(pool.getSessions()).toHaveLength(3);
  });
});

// ── DepartmentQueue integration ───────────────────────────────────────────────

describe('CustomerPool — adds workspace item to sales queue', () => {
  it('sales queue has one item after day starts', () => {
    const { clock, queue } = makeSetup();
    clock.advanceDay();
    expect(queue.getBadgeCount('sales')).toBe(1);
  });

  it('queue item has type workspace, dept sales, customerId', () => {
    const { clock, queue } = makeSetup();
    clock.advanceDay();
    const [item] = queue.getQueue('sales');
    expect(item.type).toBe('workspace');
    expect(item.dept).toBe('sales');
    expect(item.customerId).toBeTruthy();
  });

  it('queue item customerId matches the session customerId', () => {
    const { clock, queue, pool } = makeSetup();
    clock.advanceDay();
    const [item] = queue.getQueue('sales');
    const [session] = pool.getSessions();
    expect(item.customerId).toBe(session.customerId);
  });
});

// ── dispatch — EventBus events ────────────────────────────────────────────────

describe('CustomerPool — dispatch publishes events', () => {
  it('publishes customer:state_changed with from/to on valid dispatch', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();

    const events: Array<{ from: string; to: string }> = [];
    bus.subscribe('customer:state_changed', (e) => events.push(e));
    pool.dispatch(session.customerId, 'GREET');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ customerId: session.customerId, from: 'UNGREETED', to: 'GREETED' });
  });

  it('publishes customer:resolved with outcome closed on CLOSE (perfect skill)', () => {
    // PERFECT_SKILL ensures SalesProcess returns buy so the test outcome is deterministic.
    const { clock, pool, bus } = makeSetup(0, PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const resolved: Array<{ outcome: string }> = [];
    bus.subscribe('customer:resolved', (e) => resolved.push(e));

    pool.dispatch(session.customerId, 'GREET');
    pool.dispatch(session.customerId, 'QUALIFY');
    pool.dispatch(session.customerId, 'DEMO');
    pool.dispatch(session.customerId, 'NEGOTIATE');
    pool.dispatch(session.customerId, 'CLOSE');

    expect(resolved).toHaveLength(1);
    expect(resolved[0].outcome).toBe('closed');
  });

  it('publishes customer:resolved with outcome walk on WALK_CUSTOMER', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    const resolved: Array<{ outcome: string }> = [];
    bus.subscribe('customer:resolved', (e) => resolved.push(e));

    pool.dispatch(session.customerId, 'WALK_CUSTOMER');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].outcome).toBe('walk');
  });

  it('throws IllegalTransitionError on illegal dispatch', () => {
    const { clock, pool } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    expect(() => pool.dispatch(session.customerId, 'CLOSE')).toThrow(IllegalTransitionError);
  });

  it('throws on unknown customerId', () => {
    const { pool } = makeSetup();
    expect(() => pool.dispatch('no-such-id', 'GREET')).toThrow();
  });
});

// ── Full forward path ─────────────────────────────────────────────────────────

describe('CustomerPool — full forward path', () => {
  it('stage advances through all states to CLOSED (perfect skill)', () => {
    const { clock, pool } = makeSetup(0, PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const id = session.customerId;

    expect(pool.getSession(id)?.stage).toBe('UNGREETED');
    pool.dispatch(id, 'GREET');
    expect(pool.getSession(id)?.stage).toBe('GREETED');
    pool.dispatch(id, 'QUALIFY');
    expect(pool.getSession(id)?.stage).toBe('QUALIFIED');
    pool.dispatch(id, 'DEMO');
    expect(pool.getSession(id)?.stage).toBe('DEMOED');
    pool.dispatch(id, 'NEGOTIATE');
    expect(pool.getSession(id)?.stage).toBe('NEGOTIATING');
    pool.dispatch(id, 'CLOSE');
    expect(pool.getSession(id)?.stage).toBe('CLOSED');
  });
});

// ── SalesProcess-driven customer:resolved payload ─────────────────────────────

describe('CustomerPool — extended customer:resolved payload (#91)', () => {
  it('customer:resolved on CLOSE carries all 6 scalar fields', () => {
    const { clock, pool, bus } = makeSetup(0, PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const payloads: unknown[] = [];
    bus.subscribe('customer:resolved', (e) => payloads.push(e));

    pool.dispatch(session.customerId, 'GREET');
    pool.dispatch(session.customerId, 'QUALIFY');
    pool.dispatch(session.customerId, 'DEMO');
    pool.dispatch(session.customerId, 'NEGOTIATE');
    pool.dispatch(session.customerId, 'CLOSE');

    expect(payloads).toHaveLength(1);
    const p = payloads[0] as Record<string, unknown>;
    expect(typeof p['receptivity']).toBe('number');
    expect(typeof p['satisfaction']).toBe('number');
    expect(typeof p['retentionSeed']).toBe('number');
    expect(typeof p['heat']).toBe('number');
    expect(typeof p['agreedPrice']).toBe('number');
    expect(typeof p['frontGross']).toBe('number');
  });

  it('closed outcome: agreedPrice > 0, heat === 0', () => {
    const { clock, pool, bus } = makeSetup(0, PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    type Payload = { outcome: string; agreedPrice: number; frontGross: number; heat: number };
    const payloads: Payload[] = [];
    bus.subscribe('customer:resolved', (e) => payloads.push(e as Payload));

    pool.dispatch(session.customerId, 'GREET');
    pool.dispatch(session.customerId, 'QUALIFY');
    pool.dispatch(session.customerId, 'DEMO');
    pool.dispatch(session.customerId, 'NEGOTIATE');
    pool.dispatch(session.customerId, 'CLOSE');

    const p = payloads[0];
    expect(p.outcome).toBe('closed');
    expect(p.agreedPrice).toBeGreaterThan(0);
    expect(p.frontGross).toBeGreaterThan(0);
    expect(p.heat).toBe(0);
  });

  it('walk outcome (WALK_CUSTOMER): heat > 0, agreedPrice === 0, frontGross === 0', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    type Payload = { outcome: string; agreedPrice: number; frontGross: number; heat: number };
    const payloads: Payload[] = [];
    bus.subscribe('customer:resolved', (e) => payloads.push(e as Payload));

    pool.dispatch(session.customerId, 'WALK_CUSTOMER');

    const p = payloads[0];
    expect(p.outcome).toBe('walk');
    expect(p.heat).toBeGreaterThan(0);
    expect(p.agreedPrice).toBe(0);
    expect(p.frontGross).toBe(0);
  });

  it('scalar values are all unit-scaled or within expected ranges', () => {
    const { clock, pool, bus } = makeSetup(0, PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    type Payload = { receptivity: number; satisfaction: number; retentionSeed: number; heat: number };
    const payloads: Payload[] = [];
    bus.subscribe('customer:resolved', (e) => payloads.push(e as Payload));

    pool.dispatch(session.customerId, 'GREET');
    pool.dispatch(session.customerId, 'QUALIFY');
    pool.dispatch(session.customerId, 'DEMO');
    pool.dispatch(session.customerId, 'NEGOTIATE');
    pool.dispatch(session.customerId, 'CLOSE');

    const p = payloads[0];
    expect(p.receptivity).toBeGreaterThanOrEqual(0);
    expect(p.receptivity).toBeLessThanOrEqual(1);
    expect(p.satisfaction).toBeGreaterThanOrEqual(-1);
    expect(p.satisfaction).toBeLessThanOrEqual(1);
    expect(p.retentionSeed).toBeGreaterThanOrEqual(0);
    expect(p.retentionSeed).toBeLessThanOrEqual(1);
    expect(p.heat).toBeGreaterThanOrEqual(0);
    expect(p.heat).toBeLessThanOrEqual(1);
  });
});

// ── The live-floor bridges (#363) ─────────────────────────────────────────────

describe('CustomerPool — a close reports the close that actually happened (#363)', () => {
  it('close scalars come from the live close', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    type Payload = {
      outcome: string;
      receptivity: number;
      satisfaction: number;
      retentionSeed: number;
      agreedPrice: number;
    };
    const payloads: Payload[] = [];
    bus.subscribe('customer:resolved', (e) => payloads.push(e as Payload));
    // The stub re-run this replaces publishes one gate event per gate; the live
    // close ran its gates elsewhere, so none should be synthesized here.
    let gateEvents = 0;
    bus.subscribe('customer:gate_evaluated', () => {
      gateEvents += 1;
    });

    // A DealEngine-driven close carrying the closing flow's own measurement —
    // the shape StaffDispatch publishes off the unit the customer was shown.
    bus.publish('deal:closed', {
      customerId: session.customerId,
      vehicleId: 'v1',
      agreedPrice: 19_500,
      frontGross: 2_200,
      backGross: 900,
      productGross: 900,
      reserveGross: 0,
      daysInInventory: 12,
      paymentMethod: 'finance',
      downPayment: 2_000,
      loanAmount: 17_500,
      term: 60,
      apr: 0.09,
      salesQuality: {
        receptivity: 0.81,
        satisfaction: -1,
        retentionSeed: 0.42,
      },
    });

    expect(payloads).toHaveLength(1);
    const p = payloads[0];
    expect(p.outcome).toBe('closed');
    expect(p.receptivity).toBe(0.81);
    expect(p.satisfaction).toBe(-1);
    expect(p.retentionSeed).toBe(0.42);
    expect(p.agreedPrice).toBe(19_500);
    expect(gateEvents).toBe(0);
  });

  it('a close with no measurement still falls back to the local evaluation', () => {
    const { clock, pool, bus } = makeSetup(0, PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    type Payload = { outcome: string; satisfaction: number; retentionSeed: number };
    const payloads: Payload[] = [];
    bus.subscribe('customer:resolved', (e) => payloads.push(e as Payload));
    let gateEvents = 0;
    bus.subscribe('customer:gate_evaluated', () => {
      gateEvents += 1;
    });

    bus.publish('deal:closed', {
      customerId: session.customerId,
      vehicleId: 'v1',
      agreedPrice: 19_500,
      frontGross: 2_200,
      backGross: 0,
      productGross: 0,
      reserveGross: 0,
      daysInInventory: 12,
      paymentMethod: 'cash',
      downPayment: 19_500,
      loanAmount: 0,
      term: 0,
      apr: 0,
    });

    expect(payloads).toHaveLength(1);
    // Perfect skill closes happily: the local evaluation is still what speaks.
    expect(payloads[0].satisfaction).toBe(1);
    expect(payloads[0].retentionSeed).toBeGreaterThan(0);
    expect(gateEvents).toBeGreaterThan(0);
  });
});

describe('CustomerPool — the live floor publishes its walks (#363)', () => {
  function liveWalk(
    bus: ReturnType<typeof makeSetup>['bus'],
    customerId: string,
    reason: string,
    heat?: number,
  ): void {
    bus.publish('staff:auto_resolved', {
      customerId,
      staffId: 'sp-1',
      day: 1,
      outcome: 'no_sale',
      grossImpact: 0,
      reason,
      heat,
    });
  }

  it('a worked walk resolves the customer with the heat the floor measured', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    type Payload = { outcome: string; heat: number; agreedPrice: number };
    const payloads: Payload[] = [];
    bus.subscribe('customer:resolved', (e) => payloads.push(e as Payload));

    liveWalk(bus, session.customerId, 'patience_drain', 0.62);

    expect(payloads).toHaveLength(1);
    expect(payloads[0].outcome).toBe('walk');
    expect(payloads[0].heat).toBe(0.62);
    expect(payloads[0].agreedPrice).toBe(0);
    expect(pool.getSession(session.customerId)?.stage).toBe('WALK');
  });

  it('a close does not also publish a walk', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    const outcomes: string[] = [];
    bus.subscribe('customer:resolved', (e) => outcomes.push(e.outcome));

    bus.publish('staff:auto_resolved', {
      customerId: session.customerId,
      staffId: 'sp-1',
      day: 1,
      outcome: 'closed',
      grossImpact: 3_100,
    });

    expect(outcomes).toEqual([]);
  });

  it('an already-resolved customer is not charged twice', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    const outcomes: string[] = [];
    bus.subscribe('customer:resolved', (e) => outcomes.push(e.outcome));

    liveWalk(bus, session.customerId, 'patience_drain', 0.62);
    liveWalk(bus, session.customerId, 'patience_drain', 0.62);

    expect(outcomes).toEqual(['walk']);
  });

  it('a customer BDC brought back can resolve again', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    const outcomes: string[] = [];
    bus.subscribe('customer:resolved', (e) => outcomes.push(e.outcome));

    liveWalk(bus, session.customerId, 'patience_drain', 0.62);
    bus.publish('bdc:callback_succeeded', {
      customerId: session.customerId,
      day: 2,
      archetypeLabel: session.archetypeLabel,
    });
    liveWalk(bus, session.customerId, 'trust_collapse', 0.2);

    expect(outcomes).toEqual(['walk', 'walk']);
  });
});

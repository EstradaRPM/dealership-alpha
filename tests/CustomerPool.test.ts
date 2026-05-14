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
import type { StaffOrg } from '../src/game/StaffOrg';

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
  getCandidates: () => [],
  hire: () => {},
  fire: () => {},
};

function makeSetup(initialDay = 0) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const queue = createDepartmentQueue({ bus });
  const pool = createCustomerPool({ bus, npcDeps });
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

  it('publishes customer:resolved with outcome closed on CLOSE', () => {
    const { clock, pool, bus } = makeSetup();
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
  it('stage advances through all states to CLOSED', () => {
    const { clock, pool } = makeSetup();
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

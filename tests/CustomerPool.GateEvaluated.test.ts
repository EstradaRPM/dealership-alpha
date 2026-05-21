import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createCustomerPool } from '../src/game/CustomerPool';
import { createCapacityManager, type CapacityConfig } from '../src/game/CapacityManager';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import { makeSalespersonProfile, GATES } from '../src/game/SalesProcess';
import type { StaffOrg } from '../src/game/StaffOrg';

// Guaranteed-close salesperson: surviving every gate → all gates emitted, no walk.
const PERFECT_SKILL = makeSalespersonProfile({}, { effectiveness: 1, trustworthiness: 1 });
// Zero-trust salesperson: trust meter collapses at the first gate → early walk.
const ZERO_SKILL = makeSalespersonProfile({}, { effectiveness: 0, trustworthiness: 0 });

const npcDeps = {
  masterSeed: 42,
  personArchetypes: loadPersonArchetypes(),
  visitArchetypes: loadVisitArchetypes(),
  traits: loadTraitTaxonomy(),
};

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
    assessCondition: () => null,
};

type GatePayload = {
  customerId: string;
  day: number;
  gate: string;
  q: number;
  meterDelta: { trustIntegrity: number; value: number };
  walkCause: string | null;
};

function makeSetup(skill?: Parameters<typeof createCustomerPool>[0]['skill']) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const pool = createCustomerPool({ bus, npcDeps, skill });
  createCapacityManager({ bus, staffOrg: emptyStaffOrg, config: OPEN_CAPACITY_CONFIG });
  return { bus, clock, pool };
}

function driveToClose(pool: ReturnType<typeof createCustomerPool>, id: string) {
  pool.dispatch(id, 'GREET');
  pool.dispatch(id, 'QUALIFY');
  pool.dispatch(id, 'DEMO');
  pool.dispatch(id, 'NEGOTIATE');
  pool.dispatch(id, 'CLOSE');
}

describe('CustomerPool — customer:gate_evaluated (#92)', () => {
  it('emits one event per gate in gate order on a SalesProcess-driven resolution', () => {
    const { clock, pool, bus } = makeSetup(PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const events: GatePayload[] = [];
    bus.subscribe('customer:gate_evaluated', (e) => events.push(e as GatePayload));

    driveToClose(pool, session.customerId);

    expect(events.map((e) => e.gate)).toEqual([...GATES]);
  });

  it('payload is well-shaped: customerId, day, q ∈ [0,1], meterDelta numbers', () => {
    const { clock, pool, bus } = makeSetup(PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const events: GatePayload[] = [];
    bus.subscribe('customer:gate_evaluated', (e) => events.push(e as GatePayload));

    driveToClose(pool, session.customerId);

    for (const e of events) {
      expect(e.customerId).toBe(session.customerId);
      expect(e.day).toBe(1);
      expect(e.q).toBeGreaterThanOrEqual(0);
      expect(e.q).toBeLessThanOrEqual(1);
      expect(typeof e.meterDelta.trustIntegrity).toBe('number');
      expect(typeof e.meterDelta.value).toBe('number');
    }
  });

  it('walkCause is null on every gate when the customer reaches close', () => {
    const { clock, pool, bus } = makeSetup(PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const events: GatePayload[] = [];
    bus.subscribe('customer:gate_evaluated', (e) => events.push(e as GatePayload));

    driveToClose(pool, session.customerId);

    expect(events.every((e) => e.walkCause === null)).toBe(true);
  });

  it('all gate events are emitted before customer:resolved', () => {
    const { clock, pool, bus } = makeSetup(PERFECT_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const order: string[] = [];
    bus.subscribe('customer:gate_evaluated', () => order.push('gate'));
    bus.subscribe('customer:resolved', () => order.push('resolved'));

    driveToClose(pool, session.customerId);

    expect(order[order.length - 1]).toBe('resolved');
    expect(order.filter((x) => x === 'gate').length).toBe(GATES.length);
    expect(order.indexOf('resolved')).toBe(order.length - 1);
  });

  it('on a walk, only the final emitted gate carries the walk cause', () => {
    const { clock, pool, bus } = makeSetup(ZERO_SKILL);
    clock.advanceDay();
    const [session] = pool.getSessions();
    const events: GatePayload[] = [];
    bus.subscribe('customer:gate_evaluated', (e) => events.push(e as GatePayload));

    driveToClose(pool, session.customerId);

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(GATES.length);
    const last = events[events.length - 1];
    expect(last.walkCause).not.toBeNull();
    expect(events.slice(0, -1).every((e) => e.walkCause === null)).toBe(true);
  });

  it('forced WALK_CUSTOMER emits no gate events (no SalesProcess evaluation)', () => {
    const { clock, pool, bus } = makeSetup();
    clock.advanceDay();
    const [session] = pool.getSessions();
    const events: GatePayload[] = [];
    bus.subscribe('customer:gate_evaluated', (e) => events.push(e as GatePayload));

    pool.dispatch(session.customerId, 'WALK_CUSTOMER');

    expect(events).toHaveLength(0);
  });
});

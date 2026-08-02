import { createEventBus } from '../src/game/EventBus';
import type { EventBus, EventName, EventPayload } from '../src/game/EventBus';
import { createFloorSim, type DayContext } from '../src/game/FloorSim';
import {
  createCapacityManager,
  type CapacityConfig,
} from '../src/game/CapacityManager';
import type { StaffOrg } from '../src/game/StaffOrg';

const baseCtx: DayContext = {
  day: 1,
  reputation: 1,
  marketShare: 1,
  season: 'summer',
};

const CONFIG: CapacityConfig = {
  facilityTierBaseCapacity: { '1': 0, '2': 0, '3': 0 },
  staffContributionByTier: { worker: 0, 'customer-facing': 1, manager: 1, gm: 0 },
  missedOpportunitySatisfactionHit: -5,
};

const emptyStaffOrg: StaffOrg = {
  get currentRoster() {
    return [];
  },
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

function harness(seed: number, capacityBase: number) {
  const bus: EventBus = createEventBus();
  const order: EventName[] = [];
  const walked: EventPayload<'floor:customer_walked'>[] = [];
  const missed: EventPayload<'capacity:missed_opportunity'>[] = [];
  const hits: EventPayload<'reputation:satisfaction_hit'>[] = [];
  bus.subscribe('floor:customer_walked', (p) => {
    order.push('floor:customer_walked');
    walked.push(p);
  });
  bus.subscribe('floor:tick', () => order.push('floor:tick'));
  bus.subscribe('capacity:missed_opportunity', (p) => missed.push(p));
  bus.subscribe('reputation:satisfaction_hit', (p) => hits.push(p));

  const capacityManager = createCapacityManager({
    bus,
    staffOrg: emptyStaffOrg,
    facilityTier: 1,
    config: { ...CONFIG, facilityTierBaseCapacity: { '1': capacityBase, '2': 0, '3': 0 } },
  });
  const sim = createFloorSim({
    bus,
    seed,
    ctx: baseCtx,
    capacity: capacityManager.createFloorGate(),
  });
  return { bus, sim, order, walked, missed, hits, capacityManager };
}

describe('FloorSim — per-tick admittance + felt walk (#100)', () => {
  it('with zero capacity, every arrival walks during the day', () => {
    const { sim, walked } = harness(42, 0);
    sim.runDay();
    expect(sim.totalWalked).toBe(sim.totalArrivals);
    expect(sim.totalArrivals).toBeGreaterThan(0);
    expect(walked).toHaveLength(sim.totalWalked);
  });

  it('walks are spread across the day, not gated once at day end', () => {
    const { sim, walked } = harness(42, 0);
    sim.runDay();
    const ticksWithWalk = new Set(walked.map((w) => w.tick));
    expect(ticksWithWalk.size).toBeGreaterThan(1);
    expect(walked.some((w) => w.tick > sim.ticksPerDay / 2)).toBe(true);
  });

  it('admits up to the daily budget per-tick, then walks the overflow', () => {
    const budget = 3;
    const { sim, walked } = harness(42, budget);
    sim.runDay();
    const admitted = sim.totalArrivals - sim.totalWalked;
    expect(admitted).toBe(Math.min(budget, sim.totalArrivals));
    expect(sim.totalWalked).toBe(sim.totalArrivals - admitted);
    // First `budget` arrivals admitted ⇒ no walk until budget exhausted.
    if (sim.totalArrivals > budget) {
      expect(walked.length).toBeGreaterThan(0);
    }
  });

  it('floor-gate turn-aways are gated: capacity:missed_opportunity per head, NO reputation hit (#128b)', () => {
    const { sim, walked, missed, hits } = harness(42, 0);
    sim.runDay();
    // The locked taxonomy (#107 reconciliation): an un-admitted up is
    // `gated` — pure opportunity cost (missed_opportunity, the KPI signal),
    // never a walk, so it carries no reputation satisfaction hit. FloorSim
    // still emits its locked #99 floor:customer_walked heartbeat.
    expect(missed).toHaveLength(walked.length);
    expect(hits).toHaveLength(0);
    expect(missed.every((m) => m.day === baseCtx.day)).toBe(true);
  });

  it('emits floor:customer_walked before floor:tick on the same tick', () => {
    const { sim, order } = harness(42, 0);
    sim.runDay();
    const firstWalk = order.indexOf('floor:customer_walked');
    expect(firstWalk).toBeGreaterThanOrEqual(0);
    // The walk immediately precedes its tick heartbeat.
    expect(order[firstWalk + 1]).toBe('floor:tick');
  });

  it('is deterministic under seed (walk sequence stable)', () => {
    const a = harness(777, 0);
    const b = harness(777, 0);
    a.sim.runDay();
    b.sim.runDay();
    expect(a.walked.map((w) => w.tick)).toEqual(b.walked.map((w) => w.tick));
    expect(a.sim.totalWalked).toBe(b.sim.totalWalked);
  });

  it('no capacity seam ⇒ admit-all, zero walks (skeleton behavior preserved)', () => {
    const bus = createEventBus();
    const walked: unknown[] = [];
    bus.subscribe('floor:customer_walked', (p) => walked.push(p));
    const sim = createFloorSim({ bus, seed: 42, ctx: baseCtx });
    sim.runDay();
    expect(sim.totalWalked).toBe(0);
    expect(walked).toHaveLength(0);
  });
});

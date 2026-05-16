import { createEventBus } from '../src/game/EventBus';
import {
  createFloorSim,
  type DayContext,
  type CustomerRef,
  type CustomerSource,
  type FloorSim,
} from '../src/game/FloorSim';
import { makeSalespersonProfile } from '../src/game/SalesProcess';
import { loadTunables } from '../src/game/data';

const MASTER_SEED = 42;

const baseCtx: DayContext = {
  day: 1,
  reputation: 0.5,
  marketShare: 0.1,
  season: 'spring',
};

const hp = loadTunables().handPlay;
const { ticksPerDay } = loadTunables().floorSim;

const competentSkill = makeSalespersonProfile(
  {},
  { effectiveness: 0.9, trustworthiness: 0.9 },
);

// Identity seam minting refs across several departments — the grab verb is
// department-agnostic, so the same hand-play action must span all of them.
const DEPTS = ['service', 'finance', 'sales'];
function multiDeptSource(): CustomerSource {
  return {
    spawn: ({ day, tick, count }): CustomerRef[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `${DEPTS[tick % DEPTS.length]}:${day}:${tick}:${i}`,
        source: 'ambient' as const,
        mustHandle: false,
        department: DEPTS[tick % DEPTS.length],
      })),
  };
}

function stepUntilRoster(sim: FloorSim): void {
  for (
    let i = 0;
    i < sim.ticksPerDay && sim.grabbableCustomers().length === 0;
    i++
  ) {
    sim.step();
  }
  if (sim.grabbableCustomers().length === 0) {
    throw new Error('no customer entered the roster');
  }
}

describe('FloorSim — cross-department cherry-pick (#104)', () => {
  it('grabs a customer in a non-sales department via the same hand-play verb', () => {
    const bus = createEventBus();
    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      customerSource: multiDeptSource(),
      skill: competentSkill,
    });
    let nonSales: CustomerRef | undefined;
    for (let i = 0; i < sim.ticksPerDay && !nonSales; i++) {
      sim.step();
      nonSales = sim
        .grabbableCustomers()
        .find((c) => c.department !== 'sales');
    }
    expect(nonSales).toBeDefined();

    const session = sim.grab(nonSales!.id);
    expect(session.customerId).toBe(nonSales!.id);
    expect(session.currentGate).toBeDefined();

    // Routes through the #102 hand-play path: advance drives to a terminal.
    let r = session.advance('direct');
    while (r.status === 'continue') r = session.advance('direct');
    expect(['closed', 'walk']).toContain(r.status);
  });

  it('cherry-pick is gated by spare tick-budget — no free extra action', () => {
    const bus = createEventBus();
    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      customerSource: multiDeptSource(),
      skill: competentSkill,
    });
    stepUntilRoster(sim);
    const victim = sim.grabbableCustomers()[0].id;

    // Burn the day down until less than one gate's tick-cost remains.
    while (sim.spareTickBudget >= hp.tickCostPerGate) sim.step();

    expect(sim.dayComplete).toBe(false);
    expect(sim.spareTickBudget).toBeLessThan(hp.tickCostPerGate);
    expect(sim.grabbableCustomers().length).toBeGreaterThan(0); // roster non-empty
    expect(sim.canGrab()).toBe(false); // gated purely by tick-budget
    expect(() => sim.grab(victim)).toThrow(/insufficient spare tick-budget/);
  });

  it('spareTickBudget tracks remaining ticks and zeroes once complete', () => {
    const bus = createEventBus();
    const sim = createFloorSim({ bus, seed: MASTER_SEED, ctx: baseCtx });

    expect(sim.spareTickBudget).toBe(ticksPerDay);
    sim.step();
    expect(sim.spareTickBudget).toBe(ticksPerDay - sim.currentTick);
    sim.runDay();
    expect(sim.dayComplete).toBe(true);
    expect(sim.spareTickBudget).toBe(0);
    expect(sim.canGrab()).toBe(false);
  });

  it('cross-dept grab + hand-play is deterministic under seed', () => {
    function run(): string {
      const bus = createEventBus();
      const sim = createFloorSim({
        bus,
        seed: MASTER_SEED,
        ctx: baseCtx,
        customerSource: multiDeptSource(),
        skill: competentSkill,
      });
      stepUntilRoster(sim);
      const target = sim.grabbableCustomers()[0];
      const session = sim.grab(target.id);
      let r = session.advance('rapport');
      while (r.status === 'continue') r = session.advance('rapport');
      return `${r.status}:${r.outcome.evaluations.map((e) => e.q).join(',')}`;
    }
    expect(run()).toBe(run());
  });
});

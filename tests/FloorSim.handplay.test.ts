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

// Deterministic identity seam: one uniquely-id'd ambient ref per admit.
function unitSource(): CustomerSource {
  return {
    spawn: ({ day, tick, count }): CustomerRef[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `t${tick}-${i}`,
        source: 'ambient' as const,
        mustHandle: false,
        department: 'sales',
      })),
  };
}

// Step until a customer is grabbable (deterministic under the fixed seed).
function stepUntilGrabbable(sim: FloorSim): void {
  for (let i = 0; i < sim.ticksPerDay && !sim.canGrab(); i++) sim.step();
  if (!sim.canGrab()) throw new Error('no customer became grabbable');
}

const competentSkill = makeSalespersonProfile(
  {},
  { effectiveness: 0.9, trustworthiness: 0.9 },
);

describe('FloorSim — tick-cost hand-played gate via #85 evaluator (#102)', () => {
  it('default source mints ambient refs; canGrab gates on day/session/roster', () => {
    const bus = createEventBus();
    const sim = createFloorSim({ bus, seed: MASTER_SEED, ctx: baseCtx });

    expect(sim.canGrab()).toBe(false); // empty roster pre-arrival
    stepUntilGrabbable(sim);

    const refs = sim.grabbableCustomers();
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0]).toMatchObject({
      source: 'ambient',
      mustHandle: false,
      department: 'sales',
    });
    expect(refs[0].id).toMatch(/^floor:1:\d+:0$/);

    const session = sim.grab(refs[0].id);
    expect(sim.canGrab()).toBe(false); // session active
    expect(sim.grabbableCustomers().some(c => c.id === refs[0].id)).toBe(false);
    expect(() => sim.grab(refs[0].id)).toThrow(/already active/);
    expect(session.currentGate).toBeDefined();
    expect(session.choices.length).toBe(hp.approachChoices.length);
  });

  it('each advance() burns exactly tickCostPerGate ticks of the day budget', () => {
    const bus = createEventBus();
    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      customerSource: unitSource(),
      skill: competentSkill,
    });
    stepUntilGrabbable(sim);
    const session = sim.grab(sim.grabbableCustomers()[0].id);

    const before = sim.currentTick;
    session.advance('direct');
    expect(sim.currentTick).toBe(before + hp.tickCostPerGate);
  });

  it('drives gates to a close; evaluator fed pick+skill; single-use session', () => {
    const bus = createEventBus();
    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      customerSource: unitSource(),
      skill: competentSkill,
    });
    stepUntilGrabbable(sim);
    const session = sim.grab(sim.grabbableCustomers()[0].id);

    let result = session.advance('direct');
    while (result.status === 'continue') {
      result = session.advance('direct');
    }
    expect(result.status).toBe('closed');
    if (result.status === 'closed') {
      expect(result.outcome.evaluations.length).toBeGreaterThan(0);
      expect(result.outcome.meters.value).toBeGreaterThan(0);
    }
    expect(() => session.advance('direct')).toThrow(/terminal/);
    // Session ended ⇒ roster grabbable again (if any).
    expect(sim.canGrab()).toBe(!sim.dayComplete);
  });

  it('pick feeds the #85 evaluator: different approach ⇒ different qualities', () => {
    function runWith(choiceId: string): number[] {
      const bus = createEventBus();
      const sim = createFloorSim({
        bus,
        seed: MASTER_SEED,
        ctx: baseCtx,
        customerSource: unitSource(),
        skill: competentSkill,
      });
      stepUntilGrabbable(sim);
      const session = sim.grab(sim.grabbableCustomers()[0].id);
      let r = session.advance(choiceId);
      while (r.status === 'continue') r = session.advance(choiceId);
      if (r.status === 'closed' || r.status === 'walk') {
        return r.outcome.evaluations.map(e => e.q);
      }
      return [];
    }
    const rapport = runWith('rapport');
    const pressure = runWith('pressure');
    expect(rapport).not.toEqual(pressure);
    // Determinism: identical inputs ⇒ identical evaluator output.
    expect(runWith('rapport')).toEqual(rapport);
  });

  it('day exhausted mid-session ⇒ terminal walk(day_exhausted), gate still resolved', () => {
    const bus = createEventBus();
    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      customerSource: unitSource(),
      skill: competentSkill,
    });
    stepUntilGrabbable(sim);
    const session = sim.grab(sim.grabbableCustomers()[0].id);
    while (!sim.dayComplete) sim.step();

    const result = session.advance('direct');
    expect(result.status).toBe('walk');
    if (result.status === 'walk') {
      expect(result.outcome.cause).toBe('day_exhausted');
      expect(result.outcome.evaluations.length).toBe(1); // committed gate resolved
    }
    expect(() => session.advance('direct')).toThrow(/terminal/);
  });

  it('unknown approach choice is rejected', () => {
    const bus = createEventBus();
    const sim = createFloorSim({
      bus,
      seed: MASTER_SEED,
      ctx: baseCtx,
      customerSource: unitSource(),
    });
    stepUntilGrabbable(sim);
    const session = sim.grab(sim.grabbableCustomers()[0].id);
    expect(() => session.advance('nope')).toThrow(/unknown approach/);
  });
});

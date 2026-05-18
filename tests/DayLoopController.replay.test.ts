import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import {
  createDayLoopController,
  createStubDemandSource,
  type DayLoopController,
  type DemandSource,
} from '../src/game/DayLoopController';
import type { FloorSim } from '../src/game/FloorSim';

const SEED = 42;

// Replay determinism is independent of traffic volume; scenarios that need
// two separate grab opportunities just need a denser arrival day than the
// flat stub yields. This source projects to reputation=1 + marketShare=1
// (more expected arrivals) while staying fully deterministic.
function busyDemandSource(): DemandSource {
  const stub = createStubDemandSource();
  return {
    slipFor(ctx) {
      const s = stub.slipFor(ctx);
      return {
        ...s,
        reputation: 1,
        marketGrowth: { calendarIndex: ctx.day, yourDrawFeedback: 0, marketCap: 100 },
        demand: { ...s.demand, townPool: { ...s.demand.townPool, headcount: 100 } },
      };
    },
  };
}

function makeController(demandSource?: DemandSource): DayLoopController {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  return createDayLoopController({ bus, seed: SEED, clock, demandSource });
}

/** The full observable FloorSim surface — what "byte-deterministic vs. the
 *  pre-background state" must match exactly (#122). */
function snapshot(f: FloorSim) {
  return {
    ticksPerDay: f.ticksPerDay,
    currentTick: f.currentTick,
    dayComplete: f.dayComplete,
    totalArrivals: f.totalArrivals,
    totalWalked: f.totalWalked,
    totalResolved: f.totalResolved,
    totalEscalated: f.totalEscalated,
    spareTickBudget: f.spareTickBudget,
    grabbable: f.grabbableCustomers().map((c) => ({ ...c })),
  };
}

/** Step until a customer is grabbable, or the day ends. */
function stepToGrabbable(f: FloorSim): boolean {
  while (!f.canGrab() && !f.dayComplete) f.step();
  return f.canGrab();
}

/**
 * Each scenario scripts a representative interleaving of the deterministic
 * `step()` and the two recorded player verbs against a fresh controller's
 * owned FloorSim, then returns the controller so the test can checkpoint it.
 */
// Scenarios needing a dense (multi-arrival) day use the busy source.
const BUSY = new Set(['two sequential grabs in different sessions']);

const SCENARIOS: Record<string, (f: FloorSim) => void> = {
  'pure steps, no player actions': (f) => {
    for (let i = 0; i < 73; i++) f.step();
  },
  'steps → grab → one advance → steps': (f) => {
    expect(stepToGrabbable(f)).toBe(true);
    const target = f.grabbableCustomers()[0];
    const s = f.grab(target.id);
    s.advance(s.choices[0].id);
    for (let i = 0; i < 10; i++) f.step();
  },
  'grab → run a full hand-play to terminal → steps': (f) => {
    expect(stepToGrabbable(f)).toBe(true);
    const target = f.grabbableCustomers()[0];
    const s = f.grab(target.id);
    let r = s.advance(s.choices[0].id);
    while (r.status === 'continue') r = s.advance(r.choices[0].id);
    for (let i = 0; i < 8; i++) f.step();
  },
  'two sequential grabs in different sessions': (f) => {
    expect(stepToGrabbable(f)).toBe(true);
    const s1 = f.grab(f.grabbableCustomers()[0].id);
    let r1 = s1.advance(s1.choices[0].id);
    while (r1.status === 'continue') r1 = s1.advance(r1.choices[0].id);
    expect(stepToGrabbable(f)).toBe(true);
    const s2 = f.grab(f.grabbableCustomers()[0].id);
    let r2 = s2.advance(s2.choices[1 % s2.choices.length].id);
    while (r2.status === 'continue') r2 = s2.advance(r2.choices[0].id);
    for (let i = 0; i < 5; i++) f.step();
  },
};

describe('#122 deterministic cold-start replay', () => {
  for (const [name, script] of Object.entries(SCENARIOS)) {
    it(`replays byte-identically: ${name}`, () => {
      // Reference run: play the script, then snapshot the exact pre-background
      // state and capture the checkpoint at that same instant.
      const ref = makeController(BUSY.has(name) ? busyDemandSource() : undefined);
      const refFloor = ref.nextDay();
      script(refFloor);
      const expected = snapshot(refFloor);
      const cp = ref.checkpoint();
      expect(cp).not.toBeNull();
      expect(cp!.seed).toBe(SEED);
      expect(cp!.day).toBe(1);
      expect(cp!.currentTick).toBe(expected.currentTick);

      // Cold start: a brand-new controller (fresh clock on day 1) resumes
      // purely from the checkpoint payload.
      const cold = makeController();
      const resumed = cold.resume(cp!);

      expect(snapshot(resumed)).toEqual(expected);
      expect(cold.state().phase).toBe('FLOOR_OPEN');
      expect(cold.currentFloor()).toBe(resumed);
    });
  }

  it('resume is idempotent — replaying the same checkpoint twice agrees', () => {
    const ref = makeController();
    SCENARIOS['steps → grab → one advance → steps'](ref.nextDay());
    const cp = ref.checkpoint()!;

    const a = snapshot(makeController().resume(cp));
    const b = snapshot(makeController().resume(cp));
    expect(a).toEqual(b);
  });

  it('a resumed floor keeps recording — a later checkpoint extends the log', () => {
    const ref = makeController(busyDemandSource());
    SCENARIOS['grab → run a full hand-play to terminal → steps'](ref.nextDay());
    const cp1 = ref.checkpoint()!;
    const log1 = cp1.actionLog.length;

    const cold = makeController();
    const f = cold.resume(cp1);
    for (let i = 0; i < 12; i++) f.step();
    expect(stepToGrabbable(f)).toBe(true);
    const s = f.grab(f.grabbableCustomers()[0].id);
    let r = s.advance(s.choices[0].id);
    while (r.status === 'continue') r = s.advance(r.choices[0].id);

    const cp2 = cold.checkpoint()!;
    expect(cp2.actionLog.length).toBeGreaterThan(log1);
    // The resumed controller's later checkpoint is itself replayable.
    expect(snapshot(makeController().resume(cp2))).toEqual(snapshot(f));
  });

  it('checkpoint() is null when there is nothing resumable', () => {
    const c = makeController();
    // MANAGERIAL, no floor yet.
    expect(c.checkpoint()).toBeNull();

    const f = c.nextDay();
    expect(c.checkpoint()).not.toBeNull();

    // Day run to exhaustion → MANAGERIAL, checkpoint obsolete.
    f.runDay();
    expect(f.dayComplete).toBe(true);
    expect(c.state().phase).toBe('MANAGERIAL');
    expect(c.checkpoint()).toBeNull();
  });

  it('resume rejects a checkpoint the clock cannot honor', () => {
    const c = makeController(); // clock on day 1
    const ref = makeController();
    ref.nextDay();
    const cp = ref.checkpoint()!;
    const stale = { ...cp, day: 5 };
    expect(() => c.resume(stale)).toThrow(/clock on day 1/);
  });
});

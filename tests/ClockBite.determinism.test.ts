import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import {
  createDayLoopController,
  type DayLoopController,
} from '../src/game/DayLoopController';
import type { FloorSim } from '../src/game/FloorSim';
import { runBite } from '../src/game/ClockBite';

const SEED = 42;

function makeController(): DayLoopController {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  return createDayLoopController({ bus, seed: SEED, clock });
}

/** The observable FloorSim surface a driven day is judged by (#122 idiom). */
function dayShape(f: FloorSim) {
  return {
    ticksPerDay: f.ticksPerDay,
    currentTick: f.currentTick,
    dayComplete: f.dayComplete,
    totalArrivals: f.totalArrivals,
    totalWalked: f.totalWalked,
    totalResolved: f.totalResolved,
    totalEscalated: f.totalEscalated,
  };
}

// #381 — the runner drives the identical per-day path the player already drives
// by hand. A bite is a "how many times", not a different day, so nothing
// calibrated can move. Scoped to the seeded controller rather than a whole
// world: two fresh same-seed WORLDS are not re-run deterministic (that is what
// #122's checkpoint/resume exists for), and asserting one here would be
// asserting the wrong rule.
describe('ClockBite determinism (#381)', () => {
  it('driving a week through the runner matches seven hand-driven days', () => {
    const byHand = makeController();
    const handShapes: ReturnType<typeof dayShape>[] = [];
    for (let i = 0; i < 7; i += 1) {
      const floor = byHand.nextDay();
      floor.runDay();
      handShapes.push(dayShape(floor));
    }

    const driven = makeController();
    const runShapes: ReturnType<typeof dayShape>[] = [];
    const run = runBite('week', {
      advanceOneDay: () => {
        const floor = driven.nextDay();
        floor.runDay();
        runShapes.push(dayShape(floor));
      },
      checkHalt: () => null,
    });

    expect(run.daysRun).toBe(7);
    expect(runShapes).toEqual(handShapes);
    expect(driven.state().day).toBe(byHand.state().day);
  });

  it('leaves the controller MANAGERIAL, so there is no mid-bite state to persist', () => {
    const driven = makeController();
    runBite('week', {
      advanceOneDay: () => {
        driven.nextDay().runDay();
      },
      checkHalt: () => null,
    });
    // A bite runs to completion or to a halt inside ONE synchronous call;
    // mid-bite checkpointing is not a thing that can exist (#122). Asserted
    // rather than assumed.
    expect(driven.state().phase).toBe('MANAGERIAL');
  });

  it('a halted run also lands MANAGERIAL on the day it stopped', () => {
    const driven = makeController();
    const run = runBite('week', {
      advanceOneDay: () => {
        driven.nextDay().runDay();
      },
      checkHalt: () => (driven.state().day >= 3 ? 'escalation' : null),
    });
    expect(run.daysRun).toBe(3);
    expect(driven.state().day).toBe(3);
    expect(driven.state().phase).toBe('MANAGERIAL');
  });
});

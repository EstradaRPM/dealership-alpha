import { createEventBus } from '../src/game/EventBus';
import type { EventBus, EventPayload } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import {
  createDayLoopController,
  createStubDemandSource,
  type DayLoopControllerDeps,
  type DemandSource,
  type DemandContext,
  type DayDecision,
} from '../src/game/DayLoopController';

function bus(): EventBus {
  return createEventBus();
}

/** Minimal deps with a real clock + private bus, overridable per test. */
function deps(
  over: Partial<DayLoopControllerDeps> = {},
): DayLoopControllerDeps {
  const b = over.bus ?? bus();
  return {
    bus: b,
    seed: 1,
    clock: over.clock ?? createGameClock({ bus: b }),
    ...over,
  };
}

describe('DayLoopController — provider seam wiring', () => {
  it('stub source yields a #125-shaped slip; sales pipeline active', () => {
    const dlc = createDayLoopController(deps());
    dlc.beginDay({ day: 3, department: 'sales' });
    const slip = dlc.currentSlip()!;

    expect(slip.day).toBe(3);
    expect(slip.department).toBe('sales');
    expect(slip.pipelineActive).toBe(true);
    // Every reserved #125 composite stream is present even if stub-filled.
    expect(Object.keys(slip.demand).sort()).toEqual(
      [
        'freshDriveIn',
        'installedBaseReturn',
        'outOfMarketReach',
        'privateBaseline',
        'townPool',
      ].sort(),
    );
    expect(slip.brands).toHaveLength(1);
    expect(slip.stores).toHaveLength(1);
    expect(slip.pricing).toEqual({
      trafficMultiplier: 1,
      closeRateModifier: 0,
    });
    expect(slip.marketGrowth.calendarIndex).toBe(3);
  });

  it('service/bodyshop come back dormant (pipelineActive false)', () => {
    const dlc = createDayLoopController(deps());
    expect(
      dlc.beginDay({ day: 1, department: 'service' }) && dlc.currentSlip()!
        .pipelineActive,
    ).toBe(false);
    dlc.beginDay({ day: 1, department: 'bodyshop' });
    expect(dlc.currentSlip()!.pipelineActive).toBe(false);
  });

  it('defaults department to sales', () => {
    const dlc = createDayLoopController(deps());
    dlc.beginDay({ day: 1 });
    expect(dlc.currentSlip()!.department).toBe('sales');
  });

  it('routes the realized draw to an injected decision sink', () => {
    const recorded: DayDecision[] = [];
    const dlc = createDayLoopController(
      deps({ decisionSink: { record: (d) => recorded.push(d) } }),
    );
    dlc.beginDay({ day: 7, department: 'sales' });
    dlc.endDay({ realizedDraw: 42 });
    expect(recorded).toEqual([
      { day: 7, department: 'sales', outcome: { realizedDraw: 42 } },
    ]);
  });

  it('endDay before beginDay throws', () => {
    const dlc = createDayLoopController(deps());
    expect(() => dlc.endDay({ realizedDraw: 0 })).toThrow(/before beginDay/);
  });

  it('honors a custom demand source and projects it to FloorSim', () => {
    const richSlip: DemandContext = {
      ...createStubDemandSource().slipFor({ day: 2, department: 'sales' }),
      reputation: 0.8,
      marketGrowth: { calendarIndex: 2, yourDrawFeedback: 0, marketCap: 100 },
      demand: {
        ...createStubDemandSource().slipFor({ day: 2, department: 'sales' })
          .demand,
        townPool: {
          headcount: 25,
          segments: createStubDemandSource().slipFor({
            day: 2,
            department: 'sales',
          }).segmentMix,
        },
      },
    };
    const source: DemandSource = { slipFor: () => richSlip };
    const dlc = createDayLoopController(deps({ demandSource: source }));
    const floor = dlc.beginDay({ day: 2, department: 'sales' });

    // FloorSim's #99 4-scalar DayContext is the projection target: market
    // share = townPool draw / cap = 25/100 = 0.25; reputation passes through.
    floor.runDay();
    expect(floor.dayComplete).toBe(true);
    expect(dlc.currentFloor()).toBe(floor);
  });
});

describe('DayLoopController — FloorSim create/own lifecycle', () => {
  it('creates and owns a FloorSim per day via the #99 contract', () => {
    const b = bus();
    const ticks: EventPayload<'floor:tick'>[] = [];
    b.subscribe('floor:tick', (p) => ticks.push(p));
    const dlc = createDayLoopController(deps({ bus: b, seed: 99 }));

    expect(dlc.currentFloor()).toBeUndefined();
    const floor = dlc.beginDay({ day: 1 });
    expect(dlc.currentFloor()).toBe(floor);

    floor.runDay();
    expect(ticks.length).toBe(floor.ticksPerDay);
  });

  it('beginDay replaces the owned FloorSim for the new day', () => {
    const dlc = createDayLoopController(deps({ seed: 5 }));
    const d1 = dlc.beginDay({ day: 1 });
    const d2 = dlc.beginDay({ day: 2 });
    expect(d2).not.toBe(d1);
    expect(dlc.currentFloor()).toBe(d2);
    expect(dlc.currentSlip()!.day).toBe(2);
  });
});

describe('DayLoopController — MANAGERIAL↔FLOOR_OPEN state machine (#112)', () => {
  it('cold start = MANAGERIAL, "night before Day 1", no recap', () => {
    const dlc = createDayLoopController(deps());
    expect(dlc.state()).toEqual({
      phase: 'MANAGERIAL',
      day: 1,
      ownershipUnlocked: true,
      hasRecap: false,
    });
    expect(dlc.currentFloor()).toBeUndefined();
  });

  it('cold-start "Next Day" opens Day 1 WITHOUT advancing the clock', () => {
    const b = bus();
    const clock = createGameClock({ bus: b });
    const dayEnded: number[] = [];
    b.subscribe('clock:day_ended', (p) => dayEnded.push(p.day));
    const dlc = createDayLoopController(deps({ bus: b, clock }));

    const floor = dlc.nextDay();

    expect(clock.currentDay).toBe(1); // not advanced past Day 1
    expect(dayEnded).toEqual([]); // no overnight fired
    expect(dlc.currentFloor()).toBe(floor);
    expect(dlc.currentSlip()!.day).toBe(1);
    expect(dlc.state()).toEqual({
      phase: 'FLOOR_OPEN',
      day: 1,
      ownershipUnlocked: false,
      hasRecap: false,
    });
  });

  it('floor:day_complete returns to MANAGERIAL with a recap available', () => {
    const dlc = createDayLoopController(deps());
    const floor = dlc.nextDay();
    floor.runDay(); // emits floor:day_complete for Day 1

    expect(dlc.state()).toEqual({
      phase: 'MANAGERIAL',
      day: 1,
      ownershipUnlocked: true,
      hasRecap: true,
    });
  });

  it('post-recap "Next Day" performs advanceDay() + opens the next day', () => {
    const b = bus();
    const clock = createGameClock({ bus: b });
    const dayStarted: number[] = [];
    b.subscribe('clock:day_started', (p) => dayStarted.push(p.day));
    const dlc = createDayLoopController(deps({ bus: b, clock }));

    dlc.nextDay().runDay(); // Day 1 played → MANAGERIAL
    const floor2 = dlc.nextDay(); // advances clock → Day 2

    expect(clock.currentDay).toBe(2);
    expect(dayStarted).toEqual([2]); // exactly one overnight advance
    expect(dlc.currentSlip()!.day).toBe(2);
    expect(dlc.state().phase).toBe('FLOOR_OPEN');
    expect(dlc.state().day).toBe(2);
    expect(floor2).toBe(dlc.currentFloor());
  });

  it('runs a clean multi-day cycle, clock tracking the lived days', () => {
    const dlc = createDayLoopController(deps());
    for (let expected = 1; expected <= 4; expected++) {
      const floor = dlc.nextDay();
      expect(dlc.state().day).toBe(expected);
      expect(dlc.currentSlip()!.day).toBe(expected);
      floor.runDay();
      expect(dlc.state().phase).toBe('MANAGERIAL');
    }
  });

  it('rejects "Next Day" while the floor is already open', () => {
    const dlc = createDayLoopController(deps());
    dlc.nextDay();
    expect(() => dlc.nextDay()).toThrow(/requires MANAGERIAL/);
    expect(dlc.state().phase).toBe('FLOOR_OPEN'); // unchanged
  });

  it('ignores a foreign / stale floor:day_complete while FLOOR_OPEN', () => {
    const b = bus();
    const dlc = createDayLoopController(deps({ bus: b }));
    dlc.nextDay(); // Day 1 floor open

    b.publish('floor:day_complete', { day: 99, ticks: 0, totalArrivals: 0 });

    expect(dlc.state().phase).toBe('FLOOR_OPEN'); // wrong-day ⇒ no transition
  });

  it('ignores floor:day_complete arriving while MANAGERIAL', () => {
    const b = bus();
    const dlc = createDayLoopController(deps({ bus: b }));

    b.publish('floor:day_complete', { day: 1, ticks: 0, totalArrivals: 0 });

    expect(dlc.state()).toEqual({
      phase: 'MANAGERIAL',
      day: 1,
      ownershipUnlocked: true,
      hasRecap: false, // no real day was played
    });
  });

  it('cold-start replay is deterministic for the same seed', () => {
    const runOnce = () => {
      const b = bus();
      const ticks: number[] = [];
      b.subscribe('floor:tick', (p) => ticks.push(p.arrivals));
      const dlc = createDayLoopController(deps({ bus: b, seed: 7 }));
      dlc.nextDay().runDay();
      dlc.nextDay().runDay();
      return ticks;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('DayLoopController — hours-of-op day length (#207)', () => {
  // End-to-end: the hours-of-op lever scales the day length by feeding its
  // option ticksPerDay through the floor seam into FloorSim. A longer shift ⇒
  // more logical ticks ⇒ a longer day, observable as the effective ticksPerDay
  // and the count of emitted floor:tick events.
  const SHORT = 120;
  const LONG = 240;

  function lengthForLever(lever: number): { effective: number; emitted: number } {
    const b = bus();
    let emitted = 0;
    b.subscribe('floor:tick', () => {
      emitted++;
    });
    const dlc = createDayLoopController(
      deps({ bus: b, seed: 4, floorSeams: () => ({ ticksPerDay: lever }) }),
    );
    const floor = dlc.nextDay();
    const effective = floor.ticksPerDay;
    floor.runDay();
    return { effective, emitted };
  }

  it('a longer shift runs a longer day (more ticks)', () => {
    const short = lengthForLever(SHORT);
    const long = lengthForLever(LONG);

    expect(short.effective).toBe(SHORT);
    expect(short.emitted).toBe(SHORT);
    expect(long.effective).toBe(LONG);
    expect(long.emitted).toBe(LONG);
    expect(long.effective).toBeGreaterThan(short.effective);
  });

  it('omitting the lever falls back to the FloorSim tunable default', () => {
    const dlc = createDayLoopController(deps({ seed: 4 }));
    const floor = dlc.beginDay({ day: 1 });
    // Bare FloorSim default — not one of the lever options.
    expect(floor.ticksPerDay).not.toBe(SHORT);
    expect(floor.ticksPerDay).not.toBe(LONG);
  });

  it('the lever is replay-stable: same selection ⇒ identical arrival stream', () => {
    const runOnce = () => {
      const b = bus();
      const arrivals: number[] = [];
      b.subscribe('floor:tick', (p) => arrivals.push(p.arrivals));
      const dlc = createDayLoopController(
        deps({ bus: b, seed: 11, floorSeams: () => ({ ticksPerDay: LONG }) }),
      );
      dlc.nextDay().runDay();
      return arrivals;
    };
    const first = runOnce();
    expect(first).toHaveLength(LONG);
    expect(runOnce()).toEqual(first);
  });
});

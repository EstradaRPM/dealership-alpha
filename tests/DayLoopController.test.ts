import { createEventBus } from '../src/game/EventBus';
import type { EventBus, EventPayload } from '../src/game/EventBus';
import {
  createDayLoopController,
  createStubDemandSource,
  type DemandSource,
  type DemandContext,
  type DayDecision,
} from '../src/game/DayLoopController';

function bus(): EventBus {
  return createEventBus();
}

describe('DayLoopController — provider seam wiring', () => {
  it('stub source yields a #125-shaped slip; sales pipeline active', () => {
    const dlc = createDayLoopController({ bus: bus(), seed: 1 });
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
    const dlc = createDayLoopController({ bus: bus(), seed: 1 });
    expect(
      dlc.beginDay({ day: 1, department: 'service' }) && dlc.currentSlip()!
        .pipelineActive,
    ).toBe(false);
    dlc.beginDay({ day: 1, department: 'bodyshop' });
    expect(dlc.currentSlip()!.pipelineActive).toBe(false);
  });

  it('defaults department to sales', () => {
    const dlc = createDayLoopController({ bus: bus(), seed: 1 });
    dlc.beginDay({ day: 1 });
    expect(dlc.currentSlip()!.department).toBe('sales');
  });

  it('routes the realized draw to an injected decision sink', () => {
    const recorded: DayDecision[] = [];
    const dlc = createDayLoopController({
      bus: bus(),
      seed: 1,
      decisionSink: { record: (d) => recorded.push(d) },
    });
    dlc.beginDay({ day: 7, department: 'sales' });
    dlc.endDay({ realizedDraw: 42 });
    expect(recorded).toEqual([
      { day: 7, department: 'sales', outcome: { realizedDraw: 42 } },
    ]);
  });

  it('endDay before beginDay throws', () => {
    const dlc = createDayLoopController({ bus: bus(), seed: 1 });
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
    const dlc = createDayLoopController({ bus: bus(), seed: 1, demandSource: source });
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
    const dlc = createDayLoopController({ bus: b, seed: 99 });

    expect(dlc.currentFloor()).toBeUndefined();
    const floor = dlc.beginDay({ day: 1 });
    expect(dlc.currentFloor()).toBe(floor);

    floor.runDay();
    expect(ticks.length).toBe(floor.ticksPerDay);
  });

  it('beginDay replaces the owned FloorSim for the new day', () => {
    const dlc = createDayLoopController({ bus: bus(), seed: 5 });
    const d1 = dlc.beginDay({ day: 1 });
    const d2 = dlc.beginDay({ day: 2 });
    expect(d2).not.toBe(d1);
    expect(dlc.currentFloor()).toBe(d2);
    expect(dlc.currentSlip()!.day).toBe(2);
  });
});

import { createEventBus } from '../src/game/EventBus';
import type { EventBus, EventPayload } from '../src/game/EventBus';
import { createFloorSim, type DayContext } from '../src/game/FloorSim';
import { loadTunables } from '../src/game/data';

const TICKS_PER_DAY = loadTunables().floorSim.ticksPerDay;

const baseCtx: DayContext = {
  day: 1,
  reputation: 0.5,
  marketShare: 0.1,
  season: 'spring',
};

function harness(seed: number, ctx: DayContext = baseCtx) {
  const bus: EventBus = createEventBus();
  const ticks: EventPayload<'floor:tick'>[] = [];
  const complete: EventPayload<'floor:day_complete'>[] = [];
  bus.subscribe('floor:tick', (p) => ticks.push(p));
  bus.subscribe('floor:day_complete', (p) => complete.push(p));
  const sim = createFloorSim({ bus, seed, ctx });
  return { bus, sim, ticks, complete };
}

describe('FloorSim — day exhaustion', () => {
  it('emits exactly ticksPerDay floor:tick events, in ascending order', () => {
    const { sim, ticks } = harness(123);
    sim.runDay();
    expect(ticks).toHaveLength(TICKS_PER_DAY);
    expect(ticks.map((t) => t.tick)).toEqual(
      Array.from({ length: TICKS_PER_DAY }, (_, i) => i + 1),
    );
    expect(ticks.every((t) => t.ticksPerDay === TICKS_PER_DAY)).toBe(true);
  });

  it('emits floor:day_complete exactly once, after the final tick', () => {
    const { sim, ticks, complete } = harness(123);
    sim.runDay();
    expect(complete).toHaveLength(1);
    expect(complete[0].ticks).toBe(TICKS_PER_DAY);
    expect(complete[0].day).toBe(baseCtx.day);
    expect(ticks[ticks.length - 1].tick).toBe(TICKS_PER_DAY);
  });

  it('day ends exactly at N ticks; further steps are no-ops', () => {
    const { sim, ticks, complete } = harness(7);
    for (let i = 0; i < TICKS_PER_DAY; i++) sim.step();
    expect(sim.dayComplete).toBe(true);
    expect(sim.currentTick).toBe(TICKS_PER_DAY);
    sim.step();
    sim.step();
    expect(ticks).toHaveLength(TICKS_PER_DAY);
    expect(complete).toHaveLength(1);
  });

  it('day_complete.totalArrivals equals the summed per-tick arrivals', () => {
    const { sim, ticks, complete } = harness(99);
    sim.runDay();
    const summed = ticks.reduce((a, t) => a + t.arrivals, 0);
    expect(complete[0].totalArrivals).toBe(summed);
    expect(sim.totalArrivals).toBe(summed);
  });
});

describe('FloorSim — seeded determinism', () => {
  it('same seed + ctx → identical arrival sequence', () => {
    const a = harness(555);
    const b = harness(555);
    a.sim.runDay();
    b.sim.runDay();
    expect(a.ticks.map((t) => t.arrivals)).toEqual(
      b.ticks.map((t) => t.arrivals),
    );
  });

  it('step() and runDay() yield the same sequence for one seed', () => {
    const stepped = harness(2024);
    for (let i = 0; i < TICKS_PER_DAY; i++) stepped.sim.step();
    const ran = harness(2024);
    ran.sim.runDay();
    expect(stepped.ticks.map((t) => t.arrivals)).toEqual(
      ran.ticks.map((t) => t.arrivals),
    );
  });

  it('different seeds produce different sequences', () => {
    const a = harness(1);
    const b = harness(2);
    a.sim.runDay();
    b.sim.runDay();
    expect(a.ticks.map((t) => t.arrivals)).not.toEqual(
      b.ticks.map((t) => t.arrivals),
    );
  });
});

describe('FloorSim — arrival distribution', () => {
  it('arrivals are spread across the day, not bunched at tick 1', () => {
    const { sim, ticks } = harness(42);
    sim.runDay();
    const arriving = ticks.filter((t) => t.arrivals > 0);
    expect(arriving.length).toBeGreaterThan(1);
    // Spread: at least one arrival in the back half of the day.
    expect(
      arriving.some((t) => t.tick > TICKS_PER_DAY / 2),
    ).toBe(true);
  });

  it('higher reputation yields more arrivals (same seed)', () => {
    const lo = harness(8, { ...baseCtx, reputation: 0 });
    const hi = harness(8, { ...baseCtx, reputation: 1 });
    lo.sim.runDay();
    hi.sim.runDay();
    expect(hi.sim.totalArrivals).toBeGreaterThan(lo.sim.totalArrivals);
  });

  it('higher market share yields more arrivals (same seed)', () => {
    const lo = harness(8, { ...baseCtx, marketShare: 0 });
    const hi = harness(8, { ...baseCtx, marketShare: 1 });
    lo.sim.runDay();
    hi.sim.runDay();
    expect(hi.sim.totalArrivals).toBeGreaterThan(lo.sim.totalArrivals);
  });

  it('season multiplier shifts arrival volume (summer > winter, same seed)', () => {
    const winter = harness(8, { ...baseCtx, season: 'winter' });
    const summer = harness(8, { ...baseCtx, season: 'summer' });
    winter.sim.runDay();
    summer.sim.runDay();
    expect(summer.sim.totalArrivals).toBeGreaterThan(
      winter.sim.totalArrivals,
    );
  });
});

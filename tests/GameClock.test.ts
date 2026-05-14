import { createEventBus } from '../src/game/EventBus';
import { createGameClock, DAYS_PER_WEEK, DAYS_PER_SEASON, DAYS_PER_YEAR } from '../src/game/GameClock';

function makeClock(initialDay?: number) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  return { bus, clock };
}

describe('GameClock — initial state', () => {
  it('defaults to day 1', () => {
    const { clock } = makeClock();
    expect(clock.currentDay).toBe(1);
  });

  it('accepts a custom initial day', () => {
    const { clock } = makeClock(42);
    expect(clock.currentDay).toBe(42);
  });

  it('day 1 is Monday (dayOfWeek 0)', () => {
    const { clock } = makeClock(1);
    expect(clock.dayOfWeek).toBe(0);
  });

  it('day 1 is spring', () => {
    const { clock } = makeClock(1);
    expect(clock.currentSeason).toBe('spring');
  });
});

describe('GameClock — advanceDay()', () => {
  it('increments currentDay by 1', () => {
    const { clock } = makeClock();
    clock.advanceDay();
    expect(clock.currentDay).toBe(2);
  });

  it('multiple advances accumulate', () => {
    const { clock } = makeClock();
    clock.advanceDay();
    clock.advanceDay();
    clock.advanceDay();
    expect(clock.currentDay).toBe(4);
  });
});

describe('GameClock — dayOfWeek rollover', () => {
  it('wraps after 7 days', () => {
    const { clock } = makeClock(1);
    for (let i = 0; i < DAYS_PER_WEEK; i++) clock.advanceDay();
    expect(clock.dayOfWeek).toBe(0); // back to Monday
  });

  it('day 7 is Sunday (dayOfWeek 6)', () => {
    const { clock } = makeClock(7);
    expect(clock.dayOfWeek).toBe(6);
  });

  it('day 8 is Monday again', () => {
    const { clock } = makeClock(8);
    expect(clock.dayOfWeek).toBe(0);
  });
});

describe('GameClock — season rollover', () => {
  it('day 91 is still spring', () => {
    const { clock } = makeClock(91);
    expect(clock.currentSeason).toBe('spring');
  });

  it('day 92 is summer', () => {
    const { clock } = makeClock(92);
    expect(clock.currentSeason).toBe('summer');
  });

  it('day 182 is still summer', () => {
    const { clock } = makeClock(182);
    expect(clock.currentSeason).toBe('summer');
  });

  it('day 183 is fall', () => {
    const { clock } = makeClock(183);
    expect(clock.currentSeason).toBe('fall');
  });

  it('day 273 is still fall', () => {
    const { clock } = makeClock(273);
    expect(clock.currentSeason).toBe('fall');
  });

  it('day 274 is winter', () => {
    const { clock } = makeClock(274);
    expect(clock.currentSeason).toBe('winter');
  });

  it('day 364 is still winter', () => {
    const { clock } = makeClock(364);
    expect(clock.currentSeason).toBe('winter');
  });

  it('day 365 wraps back to spring', () => {
    const { clock } = makeClock(365);
    expect(clock.currentSeason).toBe('spring');
  });

  it('season advances on day boundary', () => {
    const { clock } = makeClock(DAYS_PER_SEASON);
    expect(clock.currentSeason).toBe('spring');
    clock.advanceDay();
    expect(clock.currentSeason).toBe('summer');
  });
});

describe('GameClock — overnight event ordering', () => {
  it('publishes events in correct order on advanceDay()', () => {
    const { bus, clock } = makeClock(1);
    const fired: string[] = [];

    bus.subscribe('clock:day_ended', () => fired.push('day_ended'));
    bus.subscribe('clock:overnight_payroll', () => fired.push('overnight_payroll'));
    bus.subscribe('clock:overnight_inventory_arrival', () => fired.push('overnight_inventory_arrival'));
    bus.subscribe('clock:overnight_reputation_drift', () => fired.push('overnight_reputation_drift'));
    bus.subscribe('clock:day_started', () => fired.push('day_started'));

    clock.advanceDay();

    expect(fired).toEqual([
      'day_ended',
      'overnight_payroll',
      'overnight_inventory_arrival',
      'overnight_reputation_drift',
      'day_started',
    ]);
  });

  it('day_ended carries the ending day, day_started carries the new day', () => {
    const { bus, clock } = makeClock(5);
    let endedDay = -1;
    let startedDay = -1;

    bus.subscribe('clock:day_ended', (p) => { endedDay = p.day; });
    bus.subscribe('clock:day_started', (p) => { startedDay = p.day; });

    clock.advanceDay();

    expect(endedDay).toBe(5);
    expect(startedDay).toBe(6);
  });

  it('overnight phases carry the ending day', () => {
    const { bus, clock } = makeClock(10);
    const days: Record<string, number> = {};

    bus.subscribe('clock:overnight_payroll', (p) => { days.payroll = p.day; });
    bus.subscribe('clock:overnight_inventory_arrival', (p) => { days.inventory = p.day; });
    bus.subscribe('clock:overnight_reputation_drift', (p) => { days.reputation = p.day; });

    clock.advanceDay();

    expect(days.payroll).toBe(10);
    expect(days.inventory).toBe(10);
    expect(days.reputation).toBe(10);
  });

  it('publishes exactly one of each event per advance', () => {
    const { bus, clock } = makeClock(1);
    const counts: Record<string, number> = {};
    const track = (name: string) => () => { counts[name] = (counts[name] ?? 0) + 1; };

    bus.subscribe('clock:day_ended', track('day_ended'));
    bus.subscribe('clock:overnight_payroll', track('overnight_payroll'));
    bus.subscribe('clock:overnight_inventory_arrival', track('overnight_inventory_arrival'));
    bus.subscribe('clock:overnight_reputation_drift', track('overnight_reputation_drift'));
    bus.subscribe('clock:day_started', track('day_started'));

    clock.advanceDay();

    for (const key of Object.keys(counts)) {
      expect(counts[key]).toBe(1);
    }
  });
});

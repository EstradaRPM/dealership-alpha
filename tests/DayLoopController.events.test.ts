import { createEventBus } from '../src/game/EventBus';
import type { EventBus, EventName } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import {
  createDayLoopController,
  type DayLoopControllerDeps,
} from '../src/game/DayLoopController';

// ──────────────────────────────────────────────────────────────────────────
// DayLoopController emits no events of its own, but `nextDay()` is the
// composition-root actor that drives `GameClock.advanceDay()` — so the
// controller owns the *order* in which the overnight clock:* sequence fans out
// relative to the day boundary it gates. This file pins that emission ordering
// + the cold-start "no advance" rule. Public surface only; no source changes.
// ──────────────────────────────────────────────────────────────────────────

/** Subscribe to every clock:* event and record names in fire order. */
const CLOCK_EVENTS: EventName[] = [
  'clock:day_ended',
  'clock:overnight_payroll',
  'clock:overnight_inventory_arrival',
  'clock:overnight_reputation_drift',
  'clock:overnight_followup_decay',
  'clock:day_started',
  'clock:week_ended',
  'clock:month_ended',
];

function recordClock(b: EventBus): EventName[] {
  const log: EventName[] = [];
  for (const name of CLOCK_EVENTS) b.subscribe(name, () => log.push(name));
  return log;
}

function deps(over: Partial<DayLoopControllerDeps> = {}): DayLoopControllerDeps {
  const b = over.bus ?? createEventBus();
  return { bus: b, seed: 1, clock: over.clock ?? createGameClock({ bus: b }), ...over };
}

// The documented overnight order for a non-week, non-month boundary.
const OVERNIGHT_ORDER: EventName[] = [
  'clock:day_ended',
  'clock:overnight_payroll',
  'clock:overnight_inventory_arrival',
  'clock:overnight_reputation_drift',
  'clock:overnight_followup_decay',
  'clock:day_started',
];

describe('DayLoopController — overnight event emission order', () => {
  it('the cold-start first "Next Day" emits NO overnight sequence', () => {
    const b = createEventBus();
    const log = recordClock(b);
    const dlc = createDayLoopController(deps({ bus: b }));

    const floor = dlc.nextDay(); // opens Day 1 without advancing the clock

    expect(log).toEqual([]);
    expect(dlc.currentSlip()!.day).toBe(1);
    expect(floor).toBe(dlc.currentFloor());
  });

  it('a post-recap "Next Day" fans out the full overnight sequence in order, exactly once', () => {
    const b = createEventBus();
    const log = recordClock(b);
    const dlc = createDayLoopController(deps({ bus: b }));

    dlc.nextDay().runDay(); // Day 1 played → MANAGERIAL (no advance yet)
    expect(log).toEqual([]);

    dlc.nextDay(); // advances Day 1 → Day 2 (endingDay 1: no week/month close)

    expect(log).toEqual(OVERNIGHT_ORDER);
    expect(dlc.currentSlip()!.day).toBe(2); // the new floor is built for the advanced day
  });

  it('the day floor is created for the post-advance day (day_started precedes the new slip)', () => {
    const b = createEventBus();
    const dlc = createDayLoopController(deps({ bus: b, seed: 5 }));
    let dayAtStart = -1;
    b.subscribe('clock:day_started', (p) => { dayAtStart = p.day; });

    dlc.nextDay().runDay(); // Day 1
    dlc.nextDay(); // → Day 2

    expect(dayAtStart).toBe(2);
    expect(dlc.currentSlip()!.day).toBe(2);
  });

  it('a rejected "Next Day" (floor already open) emits no clock events', () => {
    const b = createEventBus();
    const dlc = createDayLoopController(deps({ bus: b }));
    dlc.nextDay(); // FLOOR_OPEN
    const log = recordClock(b);

    expect(() => dlc.nextDay()).toThrow(/requires MANAGERIAL/);
    expect(log).toEqual([]); // no partial advance
  });

  it('crossing a week boundary slots clock:week_ended after clock:day_started', () => {
    const b = createEventBus();
    const log = recordClock(b);
    const dlc = createDayLoopController(deps({ bus: b }));

    // Play through Day 7, then advance once more (endingDay 7 ⇒ week close).
    for (let d = 1; d <= 7; d++) dlc.nextDay().runDay();
    dlc.nextDay(); // advances Day 7 → Day 8

    const weekIdx = log.indexOf('clock:week_ended');
    const startedIdx = log.lastIndexOf('clock:day_started');
    expect(weekIdx).toBeGreaterThan(-1); // it fired
    expect(weekIdx).toBeGreaterThan(startedIdx); // after the day opened
    expect(dlc.currentSlip()!.day).toBe(8);
  });
});

import {
  createEventBus,
  type EventBus,
  type EventPayload,
} from '../src/game/EventBus';
import { runBite, type BiteHalt } from '../src/game/ClockBite';
import {
  createOwnerInterruptChannel,
  type OwnerInterrupt,
} from '../src/app/ownerInterrupts';

/**
 * #384 — the overnight interrupt channel.
 *
 * A bite runs the store without the player. The tracer (#381) stopped it on
 * things that happen on the FLOOR; the moments that ask the owner a question
 * fire BETWEEN days, and inside a run every one of them would be raised and
 * cleared with nobody there to answer. These drive the channel wired exactly the
 * way the composition root wires it: one latch shared with the floor halts, read
 * through the runner's one `checkHalt` seam.
 */

const ROSTER: Record<string, string> = {
  s1: 'Marcus Webb',
  s2: 'Dana Cole',
};

function raiseRequest(
  overrides: Partial<EventPayload<'staff:raise_requested'>> = {},
): EventPayload<'staff:raise_requested'> {
  return {
    staffId: 's1',
    roleId: 'salesperson',
    day: 3,
    currentWage: 340,
    askedWage: 520,
    paidGrade: 3,
    grade: 4,
    ...overrides,
  };
}

function headline(day: number): EventPayload<'news:headline_published'> {
  return {
    day,
    headlineId: 'auction_premium_1',
    source: 'auction_block',
    sourceLabel: 'Auction block',
    reliability: 'direct',
    text: 'Block report: sedans crossed 4% over book this week.',
    trigger: 'auction_up',
    segment: 'sedan',
    direction: 'up',
  };
}

/** What a scripted morning may do inside a run. */
interface Overnight {
  bus: EventBus;
  day: number;
  /** Latch a floor halt the way the trade/discount escalations do. */
  floorHalt: () => void;
}

/**
 * The composition root's wiring, in miniature: a shared halt latch that only
 * arms while a run is in progress, the channel feeding it, and `advanceOneDay`
 * running whatever the test scripted for that morning.
 */
function harness(overnight: (o: Overnight) => void = () => {}) {
  const bus = createEventBus();
  let running = false;
  let halt: BiteHalt | null = null;
  const raised: OwnerInterrupt[] = [];
  const days: number[] = [];

  const latch = (h: BiteHalt) => {
    if (running && halt === null) halt = h;
  };

  const channel = createOwnerInterruptChannel(
    bus,
    (interrupt) => {
      raised.push(interrupt);
      latch({ id: 'owner_interrupt', subject: interrupt.subject });
    },
    { staffName: (id) => ROSTER[id] ?? null },
  );

  return {
    bus,
    raised,
    days,
    channel,
    run: (biteId: 'day' | 'week' | 'month') => {
      running = true;
      halt = null;
      days.length = 0;
      const result = runBite(biteId, {
        advanceOneDay: () => {
          days.push(days.length + 1);
          overnight({
            bus,
            day: days.length,
            floorHalt: () => latch({ id: 'escalation' }),
          });
        },
        checkHalt: () => halt,
      });
      running = false;
      return result;
    },
  };
}

describe('the overnight interrupt channel (#384)', () => {
  it('a registered moment is the only thing that halts a run', () => {
    // A construction job finishing and a headline landing are both notable and
    // both ask nothing. Neither is declared, so neither can stop a week —
    // halting on everything notable turns a week into seven days with extra
    // steps.
    const quiet = harness(({ bus, day }) => {
      bus.publish('facility:capacity_built', {
        kind: 'serviceBays',
        units: 1,
        built: 3,
        day,
      });
      bus.publish('news:headline_published', headline(day));
    });
    const quietRun = quiet.run('week');
    expect(quietRun.daysRun).toBe(7);
    expect(quietRun.halt).toBeNull();
    expect(quiet.raised).toHaveLength(0);

    // The declared one does stop it, on the same runner and the same seam.
    const asked = harness(({ bus, day }) => {
      if (day === 4) bus.publish('staff:raise_requested', raiseRequest());
    });
    expect(asked.run('week').halt?.id).toBe('owner_interrupt');
  });

  it('a raise demand stops the week that night', () => {
    const h = harness(({ bus, day }) => {
      if (day === 3) bus.publish('staff:raise_requested', raiseRequest());
    });
    const run = h.run('week');
    // `clock:day_started` fires inside the day advance, so the store plays the
    // day the moment was raised on and then stops — the same rule the floor
    // halts follow, and what keeps the run ending MANAGERIAL.
    expect(run.daysRun).toBe(3);
    expect(h.days).toHaveLength(3);
    expect(run.halt?.id).toBe('owner_interrupt');
    expect(run.halt?.sentence).toBe(
      'Marcus Webb asked you for a raise, so the run stopped there.',
    );
  });

  it('a rival offer stops the run and names the rival', () => {
    const h = harness(({ bus, day }) => {
      if (day === 2) {
        bus.publish(
          'staff:raise_requested',
          raiseRequest({
            staffId: 's2',
            rivalName: 'Westside Motors',
            deadlineDay: 5,
          }),
        );
      }
    });
    const run = h.run('week');
    expect(run.daysRun).toBe(2);
    // The poach is the same event family (#357) and a different sentence, so
    // which one a morning is falls out of the payload, not a second event.
    expect(run.halt?.sentence).toBe(
      'Westside Motors made Dana Cole an offer, so the run stopped there.',
    );
  });

  it('a finished build does not stop a run', () => {
    const h = harness(({ bus, day }) => {
      bus.publish('facility:capacity_built', {
        kind: 'lotSpaces',
        units: 2,
        built: 8,
        day,
      });
    });
    const run = h.run('week');
    expect(run.daysRun).toBe(7);
    expect(run.halt).toBeNull();
  });

  it('the interrupted prompt is the shipped prompt', () => {
    // The channel is a pure read: it answers nothing, clears nothing and
    // publishes nothing. The demand stays outstanding on the engine, so the
    // People surface presents it exactly as it does in day-by-day play — there
    // is no second copy of the prompt anywhere in this slice.
    const published: string[] = [];
    const h = harness();
    const realPublish = h.bus.publish.bind(h.bus);
    h.bus.publish = <K extends Parameters<EventBus['publish']>[0]>(
      event: K,
      payload: EventPayload<K>,
    ) => {
      published.push(event);
      realPublish(event, payload);
    };

    h.bus.publish('staff:raise_requested', raiseRequest());
    expect(published).toEqual(['staff:raise_requested']);
  });

  it('a moment it cannot name is not raised at all', () => {
    // Somebody who has already left the roster is not a decision anybody can
    // act on, and a halt sentence naming nobody is worse than no halt.
    const h = harness(({ bus, day }) => {
      if (day === 2) {
        bus.publish('staff:raise_requested', raiseRequest({ staffId: 'gone' }));
      }
    });
    const run = h.run('week');
    expect(run.daysRun).toBe(7);
    expect(run.halt).toBeNull();
  });

  it('the first signal of a run is the one that stopped the clock', () => {
    // ONE latch over both classes, so the floor escalation that lands later the
    // same day does not overwrite the ask that already stopped the week.
    const h = harness(({ bus, day, floorHalt }) => {
      if (day === 2) {
        bus.publish('staff:raise_requested', raiseRequest());
        floorHalt();
      }
    });
    const run = h.run('week');
    expect(run.daysRun).toBe(2);
    expect(run.halt?.id).toBe('owner_interrupt');
  });

  it('day-by-day play is unchanged', () => {
    const h = harness();
    // Raised with no run in progress: the channel reports it, the latch stays
    // empty, and the next run is a clean week.
    h.bus.publish('staff:raise_requested', raiseRequest());
    expect(h.raised).toHaveLength(1);
    const run = h.run('week');
    expect(run.daysRun).toBe(7);
    expect(run.halt).toBeNull();
  });

  it('disposing the channel unsubscribes it', () => {
    const h = harness();
    h.channel.dispose();
    h.bus.publish('staff:raise_requested', raiseRequest());
    expect(h.raised).toHaveLength(0);
  });
});

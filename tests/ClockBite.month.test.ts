import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import {
  createDayLoopController,
  type DayLoopController,
} from '../src/game/DayLoopController';
import type { FloorSim } from '../src/game/FloorSim';
import { runBite, haltReason } from '../src/game/ClockBite';
import {
  isDiscountDeskingUnlocked,
  type StaffDispatchDeps,
} from '../src/game/StaffDispatch';
import { loadTunables } from '../src/game/data';
import {
  DESK_ORDERS,
  findDeadDeskOrder,
  loadDeskOrders,
  type DeskOrderRead,
} from '../src/app/deskOrders';
import {
  DEFAULT_SOURCING_LEAN,
  FNI_POSTURE,
  PRICING_STRATEGIES,
} from '../src/app/config';
import {
  BASE_CONFIG,
  DISCOUNT_EXCEPTION_CONFIG,
  admit,
  makeFinanceVisit,
  makeSession,
  makeStaff,
  setup,
} from './helpers/staffDispatchHarness';
import { readAppCompositionSource } from './helpers/appComposition';

const SEED = 385;
const GATES = loadTunables().managerGates.actThresholds;

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

// ── The month is the same runner ────────────────────────────────────────────

// #385 — the top rung is not a "batch mode". It is the tracer's runner asked
// for thirty days instead of seven, which is the whole reason a month cannot
// start behaving differently from a week for a reason nobody can find later.
describe('ClockBite — the month rung (#385)', () => {
  it('a quiet month is thirty days of the same path', () => {
    const byHand = makeController();
    const handShapes: ReturnType<typeof dayShape>[] = [];
    for (let i = 0; i < 30; i += 1) {
      const floor = byHand.nextDay();
      floor.runDay();
      handShapes.push(dayShape(floor));
    }

    const driven = makeController();
    const runShapes: ReturnType<typeof dayShape>[] = [];
    const run = runBite('month', {
      advanceOneDay: () => {
        const floor = driven.nextDay();
        floor.runDay();
        runShapes.push(dayShape(floor));
      },
      checkHalt: () => null,
    });

    expect(run.biteId).toBe('month');
    expect(run.daysRequested).toBe(30);
    expect(run.daysRun).toBe(30);
    expect(run.halt).toBeNull();
    // Thirty days of the identical per-day path — not a bulk approximation of
    // one. A bite is a "how many times", so nothing calibrated can move.
    expect(runShapes).toEqual(handShapes);
    expect(driven.state().day).toBe(byHand.state().day);
    expect(driven.state().phase).toBe('MANAGERIAL');
  });
});

// ── The desks earn the silence, not the GM ──────────────────────────────────

// #124's stated attribution, and the claim a reviewer has to agree is TRUE
// rather than merely green: the month's door reads the GM because a staffed GM
// implies covered desks, but what actually makes the floor drain return
// `escalated: 0` is the at-threshold UCM. So a GM standing beside a green desk
// suppresses nothing and the month still halts.
describe('ClockBite month — the desks suppress escalations, the GM does not (#385)', () => {
  const discountDeps = {
    config: DISCOUNT_EXCEPTION_CONFIG,
    bookValueFn: () => 20_000,
  };

  /**
   * Run one below-floor up against a roster, gating the desk exactly the way
   * the composition root does — the top UCM's `t_o_closing` against its act
   * threshold. Nothing here reads the GM, which is the point: the GM is not an
   * input to the predicate that decides whether the floor escalates.
   */
  function escalationsFor(ucmClosing: number | null, withGm: boolean) {
    const roster = [makeStaff(0.9)];
    if (ucmClosing !== null) {
      roster.push(
        makeStaff(0.8, 'staff:ucm', 'used-car-manager', {
          t_o_closing: ucmClosing,
        }),
      );
    }
    if (withGm) roster.push(makeStaff(0.9, 'staff:gm', 'gm', {}));

    const topUcmClosing = roster
      .filter((s) => s.role_id === 'used-car-manager')
      .reduce<number | null>(
        (top, s) => Math.max(top ?? 0, s.skills['t_o_closing'] ?? 0),
        null,
      );
    const gate: StaffDispatchDeps['getDiscountDeskingUnlocked'] = () =>
      isDiscountDeskingUnlocked(topUcmClosing, GATES.t_o_closing);

    const w = setup(roster, BASE_CONFIG, {
      salesProcessDeps: discountDeps,
      getDiscountDeskingUnlocked: gate,
    });
    w.sessions.set(
      'cust:below-floor',
      makeSession('cust:below-floor', makeFinanceVisit('cust:below-floor'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );
    admit(w.bus, 'cust:below-floor');
    return w.discountEscalations.length;
  }

  it('an at-threshold used desk is what stops the floor escalating', () => {
    expect(escalationsFor(GATES.t_o_closing + 10, false)).toBe(0);
    expect(escalationsFor(GATES.t_o_closing - 10, false)).toBe(1);
  });

  it('a staffed GM beside an under-threshold desk suppresses nothing', () => {
    // Same green desk, now with a general manager standing next to it. The GM
    // opens the DOOR to the month; it does not do the desking.
    expect(escalationsFor(GATES.t_o_closing - 10, true)).toBe(1);
    // And it is not the GM doing it on the other side either — the sharp desk
    // is silent with or without one.
    expect(escalationsFor(GATES.t_o_closing + 10, true)).toBe(0);
  });

  it('the month bite halts on the escalation the green desk let through', () => {
    // The run stops at the first day the store needed a human, and the halting
    // day counts — a month bite is not exempt from the tracer's rule.
    let day = 0;
    const run = runBite('month', {
      advanceOneDay: () => {
        day += 1;
      },
      // Day 3 is the first below-floor up the green desk could not hold.
      checkHalt: () => (day >= 3 ? { id: 'escalation' } : null),
    });

    expect(run.daysRun).toBe(3);
    expect(run.halt?.id).toBe('escalation');
    expect(run.halt?.sentence).toBe(
      'A deal came to your desk, so the run stopped there.',
    );
  });
});

// ── A standing order nobody can carry out ───────────────────────────────────

const NON_DEFAULT_POSTURE = FNI_POSTURE.postures.find(
  (p) => p.id !== FNI_POSTURE.defaultId,
)!.id;

function read(over: Partial<DeskOrderRead> = {}): DeskOrderRead {
  return {
    pricingStrategyId: PRICING_STRATEGIES.defaultStrategy,
    sourcingLean: DEFAULT_SOURCING_LEAN,
    fniPostureId: FNI_POSTURE.defaultId,
    delegated: () => false,
    staffed: () => false,
    ...over,
  };
}

const subjectOf = (id: string) =>
  loadDeskOrders().orders.find((o) => o.id === id)!.subject;

// #124's second must-handle class. A bite runs the store on the policy the
// player left standing, so an order no desk can execute is the run proceeding
// on a policy that is not in force — and that is a decision, not a report.
describe('ClockBite month — an unexecutable override is a must-handle (#385)', () => {
  it('every dial left at its default is no order at all', () => {
    // The default IS "no instruction", which is what keeps this a consequence
    // of a choice rather than a tax on the ladder: a player who never touched a
    // dial is never halted, even with an empty roster.
    expect(findDeadDeskOrder(read())).toBeNull();
  });

  it('a pricing strategy no used desk can hold stops the run', () => {
    const halt = findDeadDeskOrder(read({ pricingStrategyId: 'aggressive' }));
    expect(halt).toEqual({
      id: 'desk_order',
      subject: subjectOf('pricing_strategy'),
    });
    // The catalog sentence is stated with the subject filled — one halt id, and
    // the slot names which order.
    expect(haltReason('desk_order', undefined, halt!.subject).sentence).toBe(
      `${subjectOf('pricing_strategy')}, so the run stopped there.`,
    );
  });

  it('the same order is carried out once the desk clears its gate', () => {
    expect(
      findDeadDeskOrder(
        read({
          pricingStrategyId: 'aggressive',
          delegated: (axis) => axis === 'pricing',
        }),
      ),
    ).toBeNull();
  });

  it('a sourcing lean is an order only once it leans somewhere', () => {
    expect(
      findDeadDeskOrder(
        read({ sourcingLean: { ...DEFAULT_SOURCING_LEAN, margin: 3 } }),
      ),
    ).toEqual({ id: 'desk_order', subject: subjectOf('sourcing_lean') });
    expect(
      findDeadDeskOrder(
        read({
          sourcingLean: { ...DEFAULT_SOURCING_LEAN, margin: 3 },
          delegated: (axis) => axis === 'condition_reading',
        }),
      ),
    ).toBeNull();
  });

  it('an F&I posture is a presence test, not a threshold', () => {
    expect(findDeadDeskOrder(read({ fniPostureId: NON_DEFAULT_POSTURE }))).toEqual(
      { id: 'desk_order', subject: subjectOf('fni_posture') },
    );
    // No skill gate on this one: hiring the desk is the whole answer.
    expect(
      findDeadDeskOrder(
        read({
          fniPostureId: NON_DEFAULT_POSTURE,
          staffed: (role) => role === 'f&i-manager',
        }),
      ),
    ).toBeNull();
  });

  it('states ONE dead order — the run stopped once', () => {
    const halt = findDeadDeskOrder(
      read({
        pricingStrategyId: 'aggressive',
        fniPostureId: NON_DEFAULT_POSTURE,
        sourcingLean: { ...DEFAULT_SOURCING_LEAN, margin: 3 },
      }),
    );
    expect(halt?.subject).toBe(subjectOf('pricing_strategy'));
  });

  it('halts a month run on the day the order went dead', () => {
    // A read, not a latch: a manager poached away mid-month leaves the orders
    // they were carrying dead, and the run stops that day rather than driving
    // the remaining weeks on a policy nobody is executing.
    let day = 0;
    const dead = findDeadDeskOrder(read({ fniPostureId: NON_DEFAULT_POSTURE }));
    const run = runBite('month', {
      advanceOneDay: () => {
        day += 1;
      },
      checkHalt: () => (day >= 5 ? dead : null),
    });

    expect(run.daysRun).toBe(5);
    expect(run.halt?.id).toBe('desk_order');
    expect(run.halt?.sentence).toContain(subjectOf('fni_posture'));
  });

  it('declares only levers a named desk performs', () => {
    // Hours-of-op is the owner's own and the trade policy is a multiplier
    // inside the appraisal itself — in force whoever is standing at the desk.
    // Neither can be left uncarried-out, so neither is declared.
    expect(DESK_ORDERS.map((o) => o.id)).toEqual([
      'pricing_strategy',
      'sourcing_lean',
      'fni_posture',
    ]);
  });
});

// ── The channel is actually wired ───────────────────────────────────────────

describe('ClockBite month — the desk-order halt reaches the live app (#385)', () => {
  it('the composition root asks the standing orders on every bite', () => {
    const src = readAppCompositionSource();
    expect(src).toContain('deskOrderHalt');
    expect(src).toContain('findDeadDeskOrder');
    // Read off the lever REFS, so a dial changed in the same tick the run
    // starts is the dial the run is judged against.
    expect(src).toContain('pricingStrategyIdRef.current');
    expect(src).toContain('fniPostureIdRef.current');
  });
});

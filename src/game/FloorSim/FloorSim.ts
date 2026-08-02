import type { EventBus } from '../EventBus';
import type { Season } from '../GameClock';
import { createRng, deriveSeed } from '../Rng';
import { loadTunables } from '../data';
import {
  accumulateMeters,
  evaluateGate,
  loadSalesProcessConfig,
  GREEN_SALESPERSON,
  type Gate,
  type GateEvaluation,
  type MeterState,
  type SalespersonSkill,
} from '../SalesProcess';

/**
 * Injected per-day state the arrival model scales against. FloorSim never
 * reaches into Reputation/CompetitorMarket/GameClock — the composition root
 * supplies a snapshot, keeping step() pure w.r.t. injected state.
 */
export interface DayContext {
  readonly day: number;
  /** Normalized reputation signal, [0,1]. */
  readonly reputation: number;
  /** Player market share, [0,1]. */
  readonly marketShare: number;
  readonly season: Season;
  /**
   * Composite controllable-lever traffic multiplier (#128a). Additive #99
   * amendment: a single scalar so inventory/pricing/marketing economics stay
   * behind the locked #125 DemandSource seam and never widen this contract
   * again. Unlike rep/share it can floor traffic at ~0 (empty lot → no draw)
   * and exceed 1 (busy high-volume store). Omitted ⇒ 1 ⇒ pre-#128a behavior,
   * so every existing caller, test, and replay stays byte-identical.
   */
  readonly demandFactor?: number;
}

/**
 * Locked #99 `capacity` seam. FloorSim hands each tick's arrival count to the
 * gate, which admits against the day's remaining budget and returns the count
 * turned away. Domain consequences of a walk (missed-opportunity/reputation)
 * live behind the seam; FloorSim only emits the floor:customer_walked
 * heartbeat. Structurally satisfied by CapacityManager.createFloorGate().
 */
export interface CapacityGate {
  admit(arrivals: number, ctx: { day: number; tick: number }): number;
}

/**
 * Locked #99 per-department `drain` seam. Each tick (after admit/walk, before
 * floor:tick) FloorSim invokes every injected drain so a department auto-
 * resolves its routine queue at a skill-scaled throughput, draining across
 * ticks rather than once-per-day. The department owns its own
 * throughput/threshold (StaffDispatch owns f(skill×tier)); FloorSim only
 * paces the invocation. `resolved` accrues to the routine queue;
 * `escalated` counts dramatic cases the department held for the player (a
 * trade/discount review pending the player's decision via its own
 * trade:escalated / discount:escalated event). FloorSim only tallies the
 * count into `totalEscalated`. Structurally satisfied by
 * StaffDispatch/ServiceDispatch createFloorDrain().
 */
export interface DeptDrain {
  drain(ctx: { day: number; tick: number }): {
    resolved: number;
    escalated: number;
  };
}

/**
 * Locked #99 grab-eligibility ref. Self-describing so the unified grab verb
 * (#104) treats every grabbable customer uniformly. #102 mints
 * `source:'ambient'` / `mustHandle:false`. The `'exception'` source is a
 * reserved ref variant (no live producer since the dead forced-exception
 * channel was removed in #275). FloorSim is department/tier-agnostic —
 * `department` is opaque routing context.
 */
export interface CustomerRef {
  readonly id: string;
  readonly source: 'ambient' | 'exception';
  readonly mustHandle: boolean;
  readonly department: string;
}

/**
 * Locked #99 arrival-identity seam. FloorSim's own seed still decides which
 * ticks have arrivals and how many (the arrival RNG is untouched — #100/#101
 * determinism preserved); the source only mints identities for the admitted
 * count. Omitted ⇒ deterministic default refs derived from (day,tick,index),
 * mirroring the capacity/drains omitted-default pattern.
 */
export interface CustomerSource {
  spawn(ctx: {
    day: number;
    tick: number;
    count: number;
  }): readonly CustomerRef[];
}

/** A tactical approach the player picks before advancing a gate (#102). */
export interface ApproachChoice {
  readonly id: string;
  readonly label: string;
}

/**
 * Discriminated result of `HandPlaySession.advance()` (locked #99 shape).
 * `continue` echoes the next gate + its choice set; `closed`/`walk` are
 * terminal and carry the rolled-up outcome.
 */
export type AdvanceResult =
  | {
      readonly status: 'continue';
      readonly currentGate: Gate;
      readonly choices: readonly ApproachChoice[];
    }
  | {
      readonly status: 'closed';
      readonly outcome: {
        readonly meters: MeterState;
        readonly evaluations: readonly GateEvaluation[];
      };
    }
  | {
      readonly status: 'walk';
      readonly outcome: {
        readonly gate: Gate;
        readonly cause: 'low_quality' | 'day_exhausted';
        readonly meters: MeterState;
        readonly evaluations: readonly GateEvaluation[];
      };
    };

/**
 * Single-use hand-play of one customer through the configured gates. Each
 * `advance()` burns `handPlay.tickCostPerGate` internal ticks of the same
 * per-tick loop (player marked busy — no concurrent grab), then resolves the
 * pending gate via the unchanged #85 evaluator with the picked approach + the
 * injected staff skill. Terminal once it returns `closed`/`walk`.
 */
export interface HandPlaySession {
  readonly customerId: string;
  /** The gate the next advance() will resolve; undefined once terminal. */
  readonly currentGate: Gate | undefined;
  /** Approach choices for the pending gate; empty once terminal. */
  readonly choices: readonly ApproachChoice[];
  advance(choiceId: string): AdvanceResult;
}

function clampUnit(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export interface FloorSim {
  readonly ticksPerDay: number;
  /** 0 before the first step(); rises to ticksPerDay as the day runs. */
  readonly currentTick: number;
  readonly dayComplete: boolean;
  readonly totalArrivals: number;
  /** Cumulative customers turned away (felt in-day walks) so far. */
  readonly totalWalked: number;
  /** Cumulative routine queue items auto-resolved by injected dept drains. */
  readonly totalResolved: number;
  /** Cumulative dramatic cases a drain held for the player (trade/discount
   *  reviews pending a decision via their own escalation events). */
  readonly totalEscalated: number;
  /**
   * Ticks left in the day available to hand-play (#104). 0 once the day is
   * complete. A cherry-pick is only allowed while this covers at least one
   * gate's tick-cost — deep engagement is never a free extra action.
   */
  readonly spareTickBudget: number;
  /**
   * Advance exactly one logical tick: emits floor:tick, and floor:day_complete
   * on the final tick. No-op once the day is complete. Deterministic given the
   * creation seed + DayContext; never reads wall-clock or UI cadence.
   */
  step(): void;
  /** Run the remaining ticks to day exhaustion. Deterministic. */
  runDay(): void;
  /**
   * Admitted, not-yet-grabbed customers across every department (unified ref
   * shape; ambient + #103 exceptions; #104 grab spans all of them via the
   * department-agnostic verb).
   */
  grabbableCustomers(): readonly CustomerRef[];
  /**
   * Precondition for grab(): day live, no active session, roster non-empty,
   * AND spare tick-budget covers at least one gate (#104 — cross-department
   * cherry-pick is gated by available tick-budget, never a free action).
   */
  canGrab(): boolean;
  /**
   * Open a single-use hand-play session for any grabbable customer in any
   * department (#104). Department-agnostic: the roster ref's `department` is
   * opaque routing context, so the same verb spans every unlocked department.
   */
  grab(customerId: string): HandPlaySession;
}

export function createFloorSim(deps: {
  bus: EventBus;
  seed: number;
  ctx: DayContext;
  /** Per-tick admittance gate (#100). Omitted ⇒ admit-all (no walks). */
  capacity?: CapacityGate;
  /** Per-dept routine drains (#101). Omitted ⇒ no auto-resolution. */
  drains?: readonly DeptDrain[];
  /** Arrival-identity seam (#102). Omitted ⇒ deterministic default refs. */
  customerSource?: CustomerSource;
  /** Acting staff skill fed to the #85 evaluator. Omitted ⇒ green profile. */
  skill?: SalespersonSkill;
  /**
   * Day length in logical ticks (#207 hours-of-op lever). Omitted ⇒ the
   * `floorSim.ticksPerDay` tunable default, so every existing caller/test and
   * `(seed,day,ctx)` replay stays byte-identical. The composition root supplies
   * the lever-scaled value (a persisted per-slot selection, stable for the
   * whole day) so determinism/replay is preserved: a longer day ⇒ more ticks ⇒
   * more arrivals; the per-tick arrival probability rescales by it.
   */
  ticksPerDay?: number;
}): FloorSim {
  const { bus, seed, ctx, capacity, drains, customerSource } = deps;
  const cfg = loadTunables().floorSim;
  const hp = loadTunables().handPlay;
  const spConfig = loadSalesProcessConfig();
  const gates = spConfig.gates;
  const skill = deps.skill ?? GREEN_SALESPERSON;
  const ticksPerDay = deps.ticksPerDay ?? cfg.ticksPerDay;

  const demandFactor = ctx.demandFactor ?? 1;
  const expectedArrivals =
    cfg.baseDailyArrivals *
    (1 + cfg.reputationArrivalCoeff * clampUnit(ctx.reputation)) *
    (1 + cfg.marketShareArrivalCoeff * clampUnit(ctx.marketShare)) *
    cfg.seasonArrivalMultiplier[ctx.season] *
    (demandFactor < 0 ? 0 : demandFactor);

  const perTickProb = clampUnit(expectedArrivals / ticksPerDay);

  // One stable RNG stream per simulated day; identical (seed, day) ⇒ identical
  // arrival sequence regardless of step()-vs-runDay() call shape.
  const rng = createRng(
    deriveSeed(seed, 'floor_sim.arrivals', { day: ctx.day }),
  );

  const defaultSource: CustomerSource = {
    spawn: ({ day, tick, count }) =>
      Array.from({ length: count }, (_, i) => ({
        id: `floor:${day}:${tick}:${i}`,
        source: 'ambient' as const,
        mustHandle: false,
        department: 'sales',
      })),
  };
  const source = customerSource ?? defaultSource;

  let tick = 0;
  let totalArrivals = 0;
  let totalWalked = 0;
  let totalResolved = 0;
  let totalEscalated = 0;
  let complete = false;

  const roster: CustomerRef[] = [];
  let activeSession: HandPlaySession | null = null;

  // Canonical per-tick sequence (locked #99): spawn → admit/walk → drain →
  // floor:tick (settled, last) → day-end check. Shared by step() and the
  // advance() tick-cost burst so the interactive path is the same loop.
  function runOneTick(): void {
    tick += 1;
    const arrivals = rng() < perTickProb ? 1 : 0;
    totalArrivals += arrivals;
    const walked = capacity
      ? capacity.admit(arrivals, { day: ctx.day, tick })
      : 0;
    totalWalked += walked;
    for (let i = 0; i < walked; i++) {
      bus.publish('floor:customer_walked', { day: ctx.day, tick });
    }
    const admitted = arrivals - walked;
    if (admitted > 0) {
      roster.push(
        ...source.spawn({ day: ctx.day, tick, count: admitted }),
      );
    }
    if (drains) {
      for (const d of drains) {
        const out = d.drain({ day: ctx.day, tick });
        totalResolved += out.resolved;
        // A drain reports `escalated` for a dramatic case it held for the
        // player (a trade/discount review pending a decision via its own
        // trade:escalated / discount:escalated event). FloorSim only tallies
        // the count; the held deal is surfaced + paused by the composition
        // root's interrupt modals, not by a floor channel.
        totalEscalated += out.escalated;
      }
    }
    bus.publish('floor:tick', {
      day: ctx.day,
      tick,
      ticksPerDay,
      arrivals,
    });
    if (tick >= ticksPerDay) {
      complete = true;
      bus.publish('floor:day_complete', {
        day: ctx.day,
        ticks: tick,
        totalArrivals,
      });
    }
  }

  function choicesView(): ApproachChoice[] {
    return hp.approachChoices.map((c) => ({ id: c.id, label: c.label }));
  }

  function makeSession(customer: CustomerRef): HandPlaySession {
    let gateIdx = 0;
    let terminal = false;
    const evaluations: GateEvaluation[] = [];

    const session: HandPlaySession = {
      customerId: customer.id,
      get currentGate() {
        return terminal ? undefined : gates[gateIdx];
      },
      get choices() {
        return terminal ? [] : choicesView();
      },
      advance(choiceId: string): AdvanceResult {
        if (terminal) {
          throw new Error('hand-play session already terminal');
        }
        const choice = hp.approachChoices.find((c) => c.id === choiceId);
        if (!choice) {
          throw new Error(`unknown approach choice: ${choiceId}`);
        }

        // Tick-cost burst: the same per-tick loop, player marked busy
        // (activeSession blocks concurrent grab). Day may exhaust mid-burst.
        for (let i = 0; i < hp.tickCostPerGate && !complete; i++) {
          runOneTick();
        }

        // The committed gate still resolves even if the day just exhausted
        // (locked #99 derived invariant).
        const gate = gates[gateIdx];
        const ev = evaluateGate(
          {
            masterSeed: seed,
            customerId: customer.id,
            day: ctx.day,
            gate,
            skill,
            customerDifficulty: clampUnit(
              hp.defaultCustomerDifficulty + choice.difficultyModifier,
            ),
            fit: clampUnit(0.5 + choice.fitModifier),
          },
          { config: spConfig },
        );
        evaluations.push(ev);
        gateIdx += 1;

        const meters = accumulateMeters(evaluations, { config: spConfig });

        if (ev.q < hp.walkQualityFloor) {
          terminal = true;
          activeSession = null;
          return {
            status: 'walk',
            outcome: { gate, cause: 'low_quality', meters, evaluations },
          };
        }

        if (complete && gateIdx < gates.length) {
          // Day exhausted with gates remaining: committed gate resolved,
          // floor:day_complete already fired in runOneTick; forfeit the rest.
          terminal = true;
          activeSession = null;
          return {
            status: 'walk',
            outcome: { gate, cause: 'day_exhausted', meters, evaluations },
          };
        }

        if (gateIdx >= gates.length) {
          terminal = true;
          activeSession = null;
          return { status: 'closed', outcome: { meters, evaluations } };
        }

        return {
          status: 'continue',
          currentGate: gates[gateIdx],
          choices: choicesView(),
        };
      },
    };
    return session;
  }

  return {
    ticksPerDay,
    get currentTick() {
      return tick;
    },
    get dayComplete() {
      return complete;
    },
    get totalArrivals() {
      return totalArrivals;
    },
    get totalWalked() {
      return totalWalked;
    },
    get totalResolved() {
      return totalResolved;
    },
    get totalEscalated() {
      return totalEscalated;
    },
    get spareTickBudget() {
      return complete ? 0 : ticksPerDay - tick;
    },

    step() {
      if (complete) return;
      runOneTick();
    },

    runDay() {
      while (!complete) runOneTick();
    },

    grabbableCustomers() {
      return [...roster];
    },

    canGrab() {
      return (
        !complete &&
        activeSession === null &&
        roster.length > 0 &&
        ticksPerDay - tick >= hp.tickCostPerGate
      );
    },

    grab(customerId: string): HandPlaySession {
      if (complete) {
        throw new Error('cannot grab: day is complete');
      }
      if (activeSession !== null) {
        throw new Error('cannot grab: a hand-play session is already active');
      }
      if (ticksPerDay - tick < hp.tickCostPerGate) {
        throw new Error('cannot grab: insufficient spare tick-budget');
      }
      const idx = roster.findIndex((c) => c.id === customerId);
      if (idx === -1) {
        throw new Error(`cannot grab: ${customerId} is not grabbable`);
      }
      const [customer] = roster.splice(idx, 1);
      const session = makeSession(customer);
      activeSession = session;
      return session;
    },
  };
}

import type { EventBus } from '../EventBus';
import type { Season } from '../GameClock';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadTunables } from '../data';

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
 * paces the invocation. `escalated` is part of the locked shape — the
 * forced-exception channel (floor:exception_raised) is wired in #103; #101
 * drains only the routine (`resolved`) path. Structurally satisfied by
 * StaffDispatch/ServiceDispatch createFloorDrain().
 */
export interface DeptDrain {
  drain(ctx: { day: number; tick: number }): {
    resolved: number;
    escalated: number;
  };
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
  /**
   * Advance exactly one logical tick: emits floor:tick, and floor:day_complete
   * on the final tick. No-op once the day is complete. Deterministic given the
   * creation seed + DayContext; never reads wall-clock or UI cadence.
   */
  step(): void;
  /** Run the remaining ticks to day exhaustion. Deterministic. */
  runDay(): void;
}

function clampUnit(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function createFloorSim(deps: {
  bus: EventBus;
  seed: number;
  ctx: DayContext;
  /** Per-tick admittance gate (#100). Omitted ⇒ admit-all (no walks). */
  capacity?: CapacityGate;
  /** Per-dept routine drains (#101). Omitted ⇒ no auto-resolution. */
  drains?: readonly DeptDrain[];
}): FloorSim {
  const { bus, seed, ctx, capacity, drains } = deps;
  const cfg = loadTunables().floorSim;
  const ticksPerDay = cfg.ticksPerDay;

  const expectedArrivals =
    cfg.baseDailyArrivals *
    (1 + cfg.reputationArrivalCoeff * clampUnit(ctx.reputation)) *
    (1 + cfg.marketShareArrivalCoeff * clampUnit(ctx.marketShare)) *
    cfg.seasonArrivalMultiplier[ctx.season];

  const perTickProb = clampUnit(expectedArrivals / ticksPerDay);

  // One stable RNG stream per simulated day; identical (seed, day) ⇒ identical
  // arrival sequence regardless of step()-vs-runDay() call shape.
  const rng = createRng(
    deriveSeed(seed, 'floor_sim.arrivals', { day: ctx.day }),
  );

  let tick = 0;
  let totalArrivals = 0;
  let totalWalked = 0;
  let totalResolved = 0;
  let complete = false;

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

    step() {
      if (complete) return;
      tick += 1;
      // 1 spawn
      const arrivals = rng() < perTickProb ? 1 : 0;
      totalArrivals += arrivals;
      // 2 admit / walk — overflow walks in real in-day time
      const walked = capacity ? capacity.admit(arrivals, { day: ctx.day, tick }) : 0;
      totalWalked += walked;
      for (let i = 0; i < walked; i++) {
        bus.publish('floor:customer_walked', { day: ctx.day, tick });
      }
      // 3 drain — each dept auto-resolves its routine queue at a skill-scaled
      // throughput. Only `resolved` is consumed here; the escalated exception
      // channel (floor:exception_raised) is wired in #103.
      if (drains) {
        for (const d of drains) {
          totalResolved += d.drain({ day: ctx.day, tick }).resolved;
        }
      }
      // 5 floor:tick — settled heartbeat, emitted last in the tick
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
    },

    runDay() {
      while (!complete) this.step();
    },
  };
}

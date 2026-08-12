import type { EventBus } from '../EventBus';
import type { Season, GameClock } from '../GameClock';
import {
  createFloorSim,
  type FloorSim,
  type DayContext,
  type CapacityGate,
  type DeptDrain,
  type CustomerSource,
  type HandPlaySession,
} from '../FloorSim';
import type {
  MidDayCheckpoint,
  CheckpointAction,
  SaveState,
} from '../SaveStore';

// ── DemandContext: the locked #125 "morning slip" ────────────────────────────
//
// Per-day, per-department demand-context payload the economy fills and the
// composition root projects down. The current default fills it with a dumb stub, but the SHAPE
// is fixed by the #125 design record so #114 and the future economy drop in
// without reopening this seam. FloorSim's locked #99 4-scalar `DayContext`
// stays UNTOUCHED — all richness rides this slip; the composition root
// projects it into FloorSim's scalar arrival inputs.

export type CreditTier = 'prime' | 'near_prime' | 'subprime';
export type BuyerSeriousness = 'serious' | 'tire_kicker';

/** A demand stream's resolved buyers as a buyer-segment distribution, never a
 *  bare headcount (#125 decision 2). Mixes are normalized fractions. */
export interface SegmentDistribution {
  readonly creditMix: Readonly<Record<CreditTier, number>>;
  readonly seriousnessMix: Readonly<Record<BuyerSeriousness, number>>;
  /** Brand-fit of this segment, [0,1]. */
  readonly brandFit: number;
}

export interface DemandStream {
  /** Bodies this stream resolves today (already split upstream of FloorSim
   *  for the shared finite townPool). */
  readonly headcount: number;
  readonly segments: SegmentDistribution;
}

/** Composite, pluggable per-department demand streams (#125 decision 2). */
export interface CompositeDemand {
  /** Player's allocated draw of the shared finite town pool (split among
   *  player/competitors upstream of FloorSim). */
  readonly townPool: DemandStream;
  /** Loyal trickle independent of the town pool. */
  readonly privateBaseline: DemandStream;
  /** Poaching factor reaching out-of-market buyers. */
  readonly outOfMarketReach: DemandStream;
  /** Service = vehicles-you-sold returning (retention = f(reputation));
   *  bodyshop = accident/insurance inflow. */
  readonly installedBaseReturn: DemandStream;
  readonly freshDriveIn: DemandStream;
}

/** Dual-path pricing (#125 decision 4): a traffic input AND a segment-aware
 *  close-rate modifier into the deal path. */
export interface PricingContext {
  readonly trafficMultiplier: number;
  readonly closeRateModifier: number;
}

/** Slow calendar curve + success-coupled growth, capped (#125 decision 6). */
export interface MarketGrowthContext {
  /** Calendar/era index position on the slow growth curve. */
  readonly calendarIndex: number;
  /** Player's own draw fed back for success-coupling. */
  readonly yourDrawFeedback: number;
  /** Tunable hard cap on total market size. */
  readonly marketCap: number;
}

/** Brand reshapes both volume and segment mix (#125 decision 9). Collection
 *  is length-1 for now; multibrand is real but career-tier-gated. */
export interface BrandProfile {
  readonly brandId: string;
  readonly volumeBias: number;
  readonly segmentBias: number;
}

export interface StoreProfile {
  readonly storeId: string;
}

export interface DemandContext {
  readonly day: number;
  /** sales | service | bodyshop — one generic engine instanced per
   *  department (#125 decision 1). */
  readonly department: string;
  /** Per-department gate (#125 decision 3): dormant ⇒ internal-only (no
   *  customer pipeline) until a capex/staffing prereq unlocks it. */
  readonly pipelineActive: boolean;
  readonly demand: CompositeDemand;
  /** Aggregate buyer-segment distribution across active streams. */
  readonly segmentMix: SegmentDistribution;
  readonly pricing: PricingContext;
  /** Living-system reputation, READ-only here, [0,1] (#125 decision 5). */
  readonly reputation: number;
  readonly marketGrowth: MarketGrowthContext;
  /** Per-day traffic filter riding FloorSim's season mechanism (#125
   *  decision 7) — NOT market growth. */
  readonly season: Season;
  /** Length-1 for now; multibrand/multi-store career-tier-gated (#125 d9). */
  readonly brands: readonly BrandProfile[];
  readonly stores: readonly StoreProfile[];
  /** Reserved seed-derivation key for the future dealer-group (aligns with #99's
   *  reserved dealershipId). */
  readonly dealershipId: string;
}

// ── Provider seam ────────────────────────────────────────────────────────────

/** Provider side of the seam: yields the day's slip. The real economy
 *  (post-#74) drops in here; marketing-lag/success-coupling math lives
 *  entirely behind this seam (#125 decision 8). */
export interface DemandSource {
  slipFor(ctx: { day: number; department: string }): DemandContext;
}

/**
 * The day's realized result handed back across the seam, consumed behind it
 * for success-coupling + marketing-lag math (#125 decisions 6/8). This is an
 * OBJECT, not a bare scalar, on purpose: it gets the same shape-reservation
 * discipline #125 applied to the slip. The real economy will want richer
 * feedback (e.g. segment-resolved draw) — additive fields here keep
 * `endDay()`'s signature stable so the economy drops in without reopening
 * this HITL seam. `realizedDraw` is the only concrete signal today.
 */
export interface DayOutcome {
  readonly realizedDraw: number;
}

/** What the day hands the decision sink: the outcome plus its day/department
 *  routing context (one decision per department per day). */
export interface DayDecision {
  readonly day: number;
  readonly department: string;
  readonly outcome: DayOutcome;
}

/** Decision side of the seam. */
export interface DecisionSink {
  record(decision: DayDecision): void;
}

function clampUnit(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

const NEUTRAL_SEGMENTS: SegmentDistribution = {
  creditMix: { prime: 0.34, near_prime: 0.33, subprime: 0.33 },
  seriousnessMix: { serious: 0.5, tire_kicker: 0.5 },
  brandFit: 0.5,
};

function stubStream(headcount: number): DemandStream {
  return { headcount, segments: NEUTRAL_SEGMENTS };
}

/**
 * The single dealership the career runs today — the reserved `dealershipId`
 * key (#99/#125 decision 9) that the future dealer-group layer partitions on.
 *
 * One definition, because #385's clock-bite gate reads it too: a store the
 * ladder identifies by a different string than the demand slip stamps is a
 * group whose stores silently stop lining up.
 */
export const DEALERSHIP_ID = 'stub-dealership';

/**
 * Dumb stub provider. Fills every #125 field with neutral placeholders so
 * #111/#114 build against the stable contract while the real economy is
 * deliberately downstream. Sales is the only `pipelineActive` department
 * today; service/bodyshop come back dormant (#125 decision 10).
 */
export function createStubDemandSource(): DemandSource {
  return {
    slipFor: ({ day, department }) => ({
      day,
      department,
      pipelineActive: department === 'sales',
      demand: {
        townPool: stubStream(0),
        privateBaseline: stubStream(0),
        outOfMarketReach: stubStream(0),
        installedBaseReturn: stubStream(0),
        freshDriveIn: stubStream(0),
      },
      segmentMix: NEUTRAL_SEGMENTS,
      pricing: { trafficMultiplier: 1, closeRateModifier: 0 },
      reputation: 0.5,
      marketGrowth: { calendarIndex: day, yourDrawFeedback: 0, marketCap: 0 },
      season: 'spring',
      brands: [{ brandId: 'stub-brand', volumeBias: 0.5, segmentBias: 0.5 }],
      stores: [{ storeId: 'stub-store' }],
      dealershipId: DEALERSHIP_ID,
    }),
  };
}

/** No-op decision sink — the default until the economy is wired (#114). */
export function createNullDecisionSink(): DecisionSink {
  return { record: () => {} };
}

// ── Deterministic replay (#122) ──────────────────────────────────────────────
//
// FloorSim's #99 determinism contract: the auto path is deterministic from
// `(seed, day, ctx)`; the interactive path from that plus the ordered
// player-action log (player actions never draw the arrival/drain RNG). So a
// mid-day floor state is fully reproducible by recreating the FloorSim with
// the same `(seed, day, ctx)` and re-issuing the recorded grab/advance verbs
// at the ticks they were dispatched, then stepping out to `currentTick`.
//
// The controller owns the FloorSim it creates, so it transparently records
// the two player verbs by wrapping the floor it hands out — the UI keeps
// calling `grab`/`advance` unchanged, and the whole replay concern stays
// sealed here. FloorSim / #99 is untouched: we wrap, never modify.

/** One entry in the ordered player-action log. `atTick` is the floor's
 *  `currentTick` at dispatch — `advance()` burns tick-cost ticks *after* this,
 *  so replay steps up to `atTick` then re-issues the verb, reproducing the
 *  same internal burst. */
export type ReplayAction =
  | { readonly type: 'grab'; readonly customerId: string; readonly atTick: number }
  | { readonly type: 'advance'; readonly choiceId: string; readonly atTick: number };

// ── Controller ───────────────────────────────────────────────────────────────

/** The two-state per-day lifecycle (#107 decision 11). MANAGERIAL = lot
 *  closed (recap + leak review, ownership levers unlocked for next-day prep,
 *  primary action "Next Day"); FLOOR_OPEN = live ticking floor (ownership
 *  greyed). The game boots MANAGERIAL = "night before Day 1". */
export type LifecyclePhase = 'MANAGERIAL' | 'FLOOR_OPEN';

/** Headless lifecycle snapshot UI renders from (#112). All fields derive from
 *  `phase` + clock position — no separate ownership/career state here. */
export interface DayLoopState {
  readonly phase: LifecyclePhase;
  /** Day the controller is centered on (clock's current day). */
  readonly day: number;
  /** Ownership/next-day-prep levers are interactable iff MANAGERIAL
   *  (#107 d11: greyed while the floor is live). */
  readonly ownershipUnlocked: boolean;
  /** False only at the cold-start "night before Day 1" (no day has been
   *  played ⇒ no recap to show); true for every MANAGERIAL thereafter. */
  readonly hasRecap: boolean;
}

/**
 * Per-day FloorSim seam set. The composition root (#114) supplies this to
 * inject CapacityManager / StaffDispatch / CustomerPool *behind* FloorSim's
 * locked #99 seams. Invoked once per `beginDay` with that day's slip so each
 * day gets fresh per-day seam instances (the capacity gate snapshots the
 * day's budget; the staff floor drain is a per-day instance). Omitted ⇒ bare
 * FloorSim (the #111/#112 default — same omitted-default discipline). FloorSim
 * / #99 stays untouched: the controller only forwards these into
 * `createFloorSim`.
 */
export type FloorSeamProvider = (slip: DemandContext) => {
  capacity?: CapacityGate;
  drains?: readonly DeptDrain[];
  customerSource?: CustomerSource;
  /**
   * Day length in logical ticks (#207 hours-of-op lever). Omitted ⇒ FloorSim's
   * `floorSim.ticksPerDay` tunable default. Forwarded verbatim into
   * `createFloorSim` on both `beginDay` and `resume`, so a lever-scaled day
   * length is recreated identically on cold-start mid-day resume. The provider
   * must return a value that is stable for the whole day (the lever is greyed
   * during FLOOR_OPEN) for replay determinism.
   */
  ticksPerDay?: number;
};

export interface DayLoopControllerDeps {
  bus: EventBus;
  seed: number;
  /** Drives the player-gated overnight advance on the "Next Day" transition.
   *  The controller is the composition-root actor that owns this call — per
   *  the #99 invariant, FloorSim never advances the clock itself. */
  clock: GameClock;
  /** Omitted ⇒ dumb stub (same omitted-default pattern as FloorSim seams). */
  demandSource?: DemandSource;
  /** Omitted ⇒ no-op sink. */
  decisionSink?: DecisionSink;
  /** Omitted ⇒ bare FloorSim (no injected seams), the #111/#112 default.
   *  The #114 composition root supplies this to wire the real seams. */
  floorSeams?: FloorSeamProvider;
}

export interface DayLoopController {
  /**
   * Pull the day's slip from the provider seam, project it down to FloorSim's
   * locked #99 4-scalar `DayContext`, and create + own a `FloorSim` for the
   * day via the #99 contract. No state machine yet (#111 scope).
   */
  beginDay(ctx: { day: number; department?: string }): FloorSim;
  /** The slip the current day was built from; undefined before `beginDay`. */
  currentSlip(): DemandContext | undefined;
  /** The FloorSim owned for the current day; undefined before `beginDay`. */
  currentFloor(): FloorSim | undefined;
  /** Current lifecycle snapshot (#112). */
  state(): DayLoopState;
  /**
   * The player-gated "Next Day" transition: MANAGERIAL → FLOOR_OPEN. Performs
   * `GameClock.advanceDay()` (skipped only on the cold-start first call, since
   * the clock already sits on Day 1 = "night before Day 1") then creates +
   * owns a FloorSim for the clock's current day. Throws if not MANAGERIAL.
   */
  nextDay(opts?: { department?: string }): FloorSim;
  /** Hand the day's outcome to the decision sink (success-coupling /
   *  marketing-lag math is entirely behind the seam). */
  endDay(outcome: DayOutcome): void;
  /**
   * The current mid-day checkpoint (#122), or `null` when there is nothing
   * resumable (MANAGERIAL, no floor yet, or the day already completed). The
   * payload is the #109 schema: `{ seed, day, dayContext, currentTick,
   * actionLog }` — the substrate `resume()` replays from. Pure read; the
   * composition root decides when to persist it (on background).
   */
  checkpoint(): MidDayCheckpoint | null;
  /**
   * Cold-start mid-day resume (#122): recreate the day's FloorSim from the
   * checkpoint's `(seed, day, dayContext)` via the normal seam path, replay
   * the ordered action log (stepping deterministically to each action's tick,
   * re-issuing the grab/advance verb), then step out to `currentTick` —
   * landing in the byte-exact pre-background state. Headless/instant; no
   * FloorSim/#99 change. Requires the injected clock to already sit on
   * `checkpoint.day` (the composition root positions it from the main save
   * before composing). Leaves the controller FLOOR_OPEN with recording live so
   * a later checkpoint captures the full history.
   */
  resume(checkpoint: MidDayCheckpoint): FloorSim;
}

/**
 * Headless orchestrator. First responsibility only (#111): own the narrow
 * provider seam (slip source + decision sink) and create/own a FloorSim per
 * day. Marketing/economy resolution stays behind the seam (currently a stub).
 */
export function createDayLoopController(
  deps: DayLoopControllerDeps,
): DayLoopController {
  const { bus, seed, clock } = deps;
  const demandSource = deps.demandSource ?? createStubDemandSource();
  const decisionSink = deps.decisionSink ?? createNullDecisionSink();

  let slip: DemandContext | undefined;
  // The unwrapped FloorSim we own; `floor` is the recording wrapper handed to
  // consumers. Recording reads tick off the raw floor so an advance() logs the
  // pre-burst tick (FloorSim.advance burns tick-cost ticks itself).
  let rawFloor: FloorSim | undefined;
  let floor: FloorSim | undefined;
  // The exact #99 ctx the current floor was built with — checkpointed verbatim
  // so resume() rebuilds byte-identically instead of re-deriving from the slip.
  let currentCtx: DayContext | undefined;
  // Ordered player-action log for the live day; reset each beginDay/resume.
  let actionLog: ReplayAction[] = [];
  let phase: LifecyclePhase = 'MANAGERIAL';
  // No day has been played at cold start ⇒ "night before Day 1", no recap.
  let everCompleted = false;

  // FLOOR_OPEN → MANAGERIAL on the owned floor's completion (exhaustion or
  // early close, #99). Idempotent + floor-scoped: a stale or foreign
  // floor:day_complete (e.g. a bare beginDay() primitive used in isolation)
  // never drives the state machine.
  bus.subscribe('floor:day_complete', (p) => {
    if (phase !== 'FLOOR_OPEN' || !slip || p.day !== slip.day) return;
    phase = 'MANAGERIAL';
    everCompleted = true;
    // #136: announce night-before prep for the upcoming day. The clock has
    // not yet advanced (that happens in nextDay()), so upcomingDay is the
    // next day the player is about to play.
    bus.publish('clock:managerial_prep', { upcomingDay: clock.currentDay + 1 });
  });

  // #136: cold-start bootstrap — the world boots in MANAGERIAL "night before
  // Day 1", so emit the prep signal for Day 1 so prep-side consumers (e.g.
  // the auction board) populate immediately, not on the morning of Day 1.
  bus.publish('clock:managerial_prep', { upcomingDay: clock.currentDay });

  /** Project the rich #125 slip down to FloorSim's #99 DayContext. Market
   *  share is the player's town-pool draw against the market cap (stub ⇒ 0 ⇒
   *  neutral). `demandFactor` (#128a additive #99 amendment) rides the
   *  existing locked #125 `pricing.trafficMultiplier` (stub ⇒ 1 ⇒ pre-#128a
   *  behavior) — the composite economics live behind the seam; this is a
   *  pure additive passthrough, #125 and the other projected scalars
   *  unchanged. */
  function project(s: DemandContext): DayContext {
    const cap = s.marketGrowth.marketCap;
    const marketShare =
      cap > 0 ? clampUnit(s.demand.townPool.headcount / cap) : 0;
    const tm = s.pricing.trafficMultiplier;
    return {
      day: s.day,
      reputation: clampUnit(s.reputation),
      marketShare,
      season: s.season,
      demandFactor: tm < 0 ? 0 : tm,
    };
  }

  /** Transparent recording wrapper over a hand-play session: logs each
   *  `advance` with the floor's pre-burst tick, then delegates unchanged. */
  function recordingSession(s: HandPlaySession): HandPlaySession {
    return {
      get customerId() {
        return s.customerId;
      },
      get currentGate() {
        return s.currentGate;
      },
      get choices() {
        return s.choices;
      },
      advance(choiceId) {
        actionLog.push({
          type: 'advance',
          choiceId,
          atTick: rawFloor ? rawFloor.currentTick : 0,
        });
        return s.advance(choiceId);
      },
    };
  }

  /** Transparent recording wrapper over the owned FloorSim: every member
   *  delegates unchanged; only the two player verbs (`grab`, and `advance` via
   *  the wrapped session) append to the action log. FloorSim/#99 untouched. */
  function recordingFloor(f: FloorSim): FloorSim {
    return {
      get ticksPerDay() {
        return f.ticksPerDay;
      },
      get currentTick() {
        return f.currentTick;
      },
      get dayComplete() {
        return f.dayComplete;
      },
      get totalArrivals() {
        return f.totalArrivals;
      },
      get totalWalked() {
        return f.totalWalked;
      },
      get totalResolved() {
        return f.totalResolved;
      },
      get totalEscalated() {
        return f.totalEscalated;
      },
      get spareTickBudget() {
        return f.spareTickBudget;
      },
      step: () => f.step(),
      runDay: () => f.runDay(),
      grabbableCustomers: () => f.grabbableCustomers(),
      canGrab: () => f.canGrab(),
      grab(customerId) {
        actionLog.push({ type: 'grab', customerId, atTick: f.currentTick });
        return recordingSession(f.grab(customerId));
      },
    };
  }

  function beginDay({
    day,
    department = 'sales',
  }: {
    day: number;
    department?: string;
  }): FloorSim {
    slip = demandSource.slipFor({ day, department });
    const seams = deps.floorSeams?.(slip) ?? {};
    currentCtx = project(slip);
    actionLog = [];
    rawFloor = createFloorSim({ bus, seed, ctx: currentCtx, ...seams });
    floor = recordingFloor(rawFloor);
    return floor;
  }

  return {
    beginDay,
    currentSlip: () => slip,
    currentFloor: () => floor,
    state: () => ({
      phase,
      day: clock.currentDay,
      ownershipUnlocked: phase === 'MANAGERIAL',
      hasRecap: everCompleted,
    }),
    nextDay({ department = 'sales' } = {}) {
      if (phase !== 'MANAGERIAL') {
        throw new Error(
          `nextDay requires MANAGERIAL phase (was ${phase})`,
        );
      }
      // Cold start sits on Day 1 already ("night before Day 1"); only advance
      // once a day has actually been played, so we never skip Day 1.
      if (everCompleted) {
        clock.advanceDay();
      }
      const f = beginDay({ day: clock.currentDay, department });
      phase = 'FLOOR_OPEN';
      return f;
    },
    endDay(outcome) {
      if (!slip) {
        throw new Error('endDay called before beginDay');
      }
      decisionSink.record({
        day: slip.day,
        department: slip.department,
        outcome,
      });
    },
    checkpoint() {
      if (
        phase !== 'FLOOR_OPEN' ||
        !rawFloor ||
        !slip ||
        !currentCtx ||
        rawFloor.dayComplete
      ) {
        return null;
      }
      return {
        seed,
        day: slip.day,
        dayContext: currentCtx as unknown as SaveState,
        currentTick: rawFloor.currentTick,
        actionLog: actionLog.slice() as unknown as readonly CheckpointAction[],
      };
    },
    resume(checkpoint) {
      if (clock.currentDay !== checkpoint.day) {
        throw new Error(
          `resume: clock on day ${clock.currentDay}, checkpoint day ` +
            `${checkpoint.day} — position the clock from the main save first`,
        );
      }
      const ctx = checkpoint.dayContext as unknown as DayContext;
      const log = checkpoint.actionLog as unknown as readonly ReplayAction[];
      // Recreate the day's FloorSim via the normal seam path, but with the
      // checkpointed ctx verbatim (byte-determinism: never re-derive it).
      const restoredSlip = demandSource.slipFor({
        day: checkpoint.day,
        department: 'sales',
      });
      const seams = deps.floorSeams?.(restoredSlip) ?? {};
      const f = createFloorSim({ bus, seed, ctx, ...seams });

      // Replay: step deterministically to each action's dispatch tick, then
      // re-issue the verb. grab() doesn't burn ticks; advance() burns its own
      // tick-cost burst, so the next action's atTick already accounts for it.
      let session: HandPlaySession | null = null;
      for (const a of log) {
        while (f.currentTick < a.atTick && !f.dayComplete) f.step();
        if (a.type === 'grab') {
          session = f.grab(a.customerId);
        } else {
          if (!session) {
            throw new Error(
              'resume: advance replayed with no active hand-play session',
            );
          }
          session.advance(a.choiceId);
        }
      }
      while (f.currentTick < checkpoint.currentTick && !f.dayComplete) {
        f.step();
      }

      slip = restoredSlip;
      currentCtx = ctx;
      rawFloor = f;
      floor = recordingFloor(f);
      actionLog = log.slice();
      // A mid-day checkpoint implies the MANAGERIAL→FLOOR_OPEN transition
      // already happened this day; recaps exist for any prior completed day.
      everCompleted = checkpoint.day > 1;
      phase = 'FLOOR_OPEN';
      return floor;
    },
  };
}

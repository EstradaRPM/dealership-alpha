import type { EventBus } from '../EventBus';
import type { Season, GameClock } from '../GameClock';
import { createFloorSim, type FloorSim, type DayContext } from '../FloorSim';

// ── DemandContext: the locked #125 "morning slip" ────────────────────────────
//
// Per-day, per-department demand-context payload the economy fills and the
// composition root projects down. v1 fills it with a dumb stub, but the SHAPE
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
 *  is length-1 in v1; multibrand is real but career-tier-gated. */
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
  /** Length-1 in v1; multibrand/multi-store career-tier-gated (#125 d9). */
  readonly brands: readonly BrandProfile[];
  readonly stores: readonly StoreProfile[];
  /** Reserved seed-derivation key for v2 dealer-group (aligns with #99's
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
 * this HITL seam. `realizedDraw` is the only concrete v1 signal.
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
 * Dumb v1 stub provider. Fills every #125 field with neutral placeholders so
 * #111/#114 build against the stable contract while the real economy is
 * deliberately downstream. Sales is the only `pipelineActive` department in
 * v1; service/bodyshop come back dormant (#125 decision 10).
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
      dealershipId: 'stub-dealership',
    }),
  };
}

/** No-op decision sink — the v1 default until the economy is wired (#114). */
export function createNullDecisionSink(): DecisionSink {
  return { record: () => {} };
}

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

export interface DayLoopControllerDeps {
  bus: EventBus;
  seed: number;
  /** Drives the player-gated overnight advance on the "Next Day" transition.
   *  The controller is the composition-root actor that owns this call — per
   *  the #99 invariant, FloorSim never advances the clock itself. */
  clock: GameClock;
  /** Omitted ⇒ dumb v1 stub (same omitted-default pattern as FloorSim seams). */
  demandSource?: DemandSource;
  /** Omitted ⇒ no-op sink. */
  decisionSink?: DecisionSink;
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
}

/**
 * Headless orchestrator. First responsibility only (#111): own the narrow
 * provider seam (slip source + decision sink) and create/own a FloorSim per
 * day. Marketing/economy resolution stays behind the seam (stub in v1).
 */
export function createDayLoopController(
  deps: DayLoopControllerDeps,
): DayLoopController {
  const { bus, seed, clock } = deps;
  const demandSource = deps.demandSource ?? createStubDemandSource();
  const decisionSink = deps.decisionSink ?? createNullDecisionSink();

  let slip: DemandContext | undefined;
  let floor: FloorSim | undefined;
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
  });

  /** Project the rich #125 slip down to FloorSim's untouched #99 4-scalar
   *  DayContext. Market share is the player's town-pool draw against the
   *  market cap (stub ⇒ 0 ⇒ neutral). */
  function project(s: DemandContext): DayContext {
    const cap = s.marketGrowth.marketCap;
    const marketShare =
      cap > 0 ? clampUnit(s.demand.townPool.headcount / cap) : 0;
    return {
      day: s.day,
      reputation: clampUnit(s.reputation),
      marketShare,
      season: s.season,
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
    floor = createFloorSim({ bus, seed, ctx: project(slip) });
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
  };
}

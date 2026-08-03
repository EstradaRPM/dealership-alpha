import type { EventBus } from '../EventBus';
import { loadTunables } from '../data';
import { loadTierGateConfig, type TierGateConfig } from './tierGateData';
import type {
  FaceProgress,
  FaceVerdict,
  GateBand,
  GateMonthVerdict,
  GateProgress,
  GateTrend,
  LevelSamples,
  TierFaceRequirement,
  TierGateSnapshot,
  TierRequirements,
} from './types';

/**
 * Monthly tier-gate engine (#232).
 *
 * The headline goal object is the multi-dimensional monthly tier GATE
 * (`goals-targets-design.md`, `macro-loop-spine.md` §10): each day's haul
 * *accrues* onto the monthly bars (the day is **counted, not judged** — decision
 * 1), the engine computes honest DMS/CRM projections per face in its native
 * idiom (decision 3) while the *player* reads which face is the wall (decision
 * 2 — no coach), and a single **4-band verdict** fires once at month-end on the
 * gate.
 *
 * Deep module / narrow surface: the engine owns flow accrual, daily level/trend
 * sampling, pace math, trend classification, and banding. Consumers see only
 * `getProgress()` (live readout for the Home strip) + the month-end verdict
 * event + `snapshot`/`restore`. Cross-module signals arrive on the bus
 * (`deal:closed`, the clock cadence); non-flow levels read injected provider
 * closures so the engine never imports Economy/Reputation.
 *
 * ## Faces & signals
 * - **Flow** (`units`, `gross`): accrued from `deal:closed`. Full pace report.
 * - **Level** (`cash`): a `signals[id]` closure sampled nightly → monthly-avg
 *   gauge vs threshold + trend arrow. No catch-up (a balance isn't a flow).
 * - **Trend** (`csi`): a `signals[id]` closure sampled nightly into a rolling
 *   window → climbing/flat/sliding. Not a daily pace.
 * - **Stepped** (`facility`): dormant for now — its teeth re-home onto the T4+ OEM
 *   stream (decision 4); the schema is present, no current tier activates it.
 *
 * The active faces per tier come from `config.tiers[tier]` (progressive unlock —
 * fewer faces lit early, decision 2). Accumulators run every month regardless;
 * activeness only selects what `getProgress`/the verdict surface.
 *
 * ## Determinism & persistence
 * State is month-to-date accruals + rolling samples only; targets and all
 * projections derive live from `(getCurrentDay, getCurrentTier, signals)`. The
 * verdict is a pure function of the month's accrued events, so it is replay-safe
 * (#122) and the snapshot round-trips an in-progress month exactly (#188).
 */

const BAND_ORDER: readonly GateBand[] = ['miss', 'nearMiss', 'meet', 'exceed'];

export interface TierGateDeps {
  bus: EventBus;
  /** Live current-day read (the clock's `currentDay`). */
  getCurrentDay: () => number;
  /** Live current-tier read — selects the active face set + targets. */
  getCurrentTier: () => number;
  /**
   * Provider closures for the non-flow faces, keyed by face id. Sampled once
   * per day on `clock:day_ended`. The composition root passes
   * `{ cash: () => economy.cash, csi: () => reputation.reviewScore }` — the
   * engine never imports those modules.
   */
  signals: Readonly<Record<string, () => number>>;
  /** Test seam; defaults to the bundled tier-gate config. */
  config?: TierGateConfig;
  /** Logical month length in days. Defaults to `tunables.clock.daysPerMonth`. */
  daysPerMonth?: number;
}

export interface TierGate {
  /** The live multi-face gate readout (decision 3 native idioms). */
  getProgress(): GateProgress;
  /**
   * The standing gate spec for any tier (#349) — the bars that tier asks for
   * every month, with no month-to-date state in it. `null` when the tier has no
   * entry in config (i.e. past the top of the built ladder), which is how the
   * Growth board knows there is no next rung to foreshadow.
   */
  getTierRequirements(tier: number): TierRequirements | null;
  /**
   * Every month that has closed, oldest→newest (#351) — how the gate graded it
   * and what each active face scored. The verdict event fires once and the
   * month-to-date accruals reset immediately after, so this is the only record
   * that a past month was ever graded; Finance's month-close results read it.
   */
  getMonthVerdicts(): readonly GateMonthVerdict[];
  /** #188 SaveStore seam: capture/rehydrate the in-progress month. */
  snapshot(): TierGateSnapshot;
  restore(snap: TierGateSnapshot): void;
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

/** ratio → band via the config thresholds (decision 1's 4 bands). */
function bandFor(ratio: number, config: TierGateConfig): GateBand {
  const { exceed, meet, nearMiss } = config.bands;
  if (ratio >= exceed) return 'exceed';
  if (ratio >= meet) return 'meet';
  if (ratio >= nearMiss) return 'nearMiss';
  return 'miss';
}

/** The worst (lowest-ordinal) band — the binding constraint grades the gate. */
function worstBand(bands: readonly GateBand[]): GateBand {
  if (bands.length === 0) return 'meet';
  return bands.reduce((worst, b) =>
    BAND_ORDER.indexOf(b) < BAND_ORDER.indexOf(worst) ? b : worst,
  );
}

/** Recent-half vs earlier-half comparison → trend direction. */
function classifyTrend(samples: readonly number[], epsilon: number): GateTrend {
  if (samples.length < 2) return 'flat';
  const mid = Math.floor(samples.length / 2);
  const delta = mean(samples.slice(mid)) - mean(samples.slice(0, mid));
  if (delta > epsilon) return 'climbing';
  if (delta < -epsilon) return 'sliding';
  return 'flat';
}

function freshLevelSamples(): LevelSamples {
  return { sum: 0, count: 0, monthStart: null };
}

export function createTierGate(deps: TierGateDeps): TierGate {
  const { bus, getCurrentDay, getCurrentTier, signals } = deps;
  const config = deps.config ?? loadTierGateConfig();
  const daysPerMonth = deps.daysPerMonth ?? loadTunables().clock.daysPerMonth;

  // Face ids grouped by kind, derived once from config.
  const flowFaceIds = Object.keys(config.faces).filter(
    (id) => config.faces[id].kind === 'flow',
  );
  const levelFaceIds = Object.keys(config.faces).filter(
    (id) => config.faces[id].kind === 'level',
  );
  const trendFaceIds = Object.keys(config.faces).filter(
    (id) => config.faces[id].kind === 'trend',
  );

  // Month-to-date state. Accumulators run every month; faces select from them.
  let flowAccrual: Record<string, number> = {};
  let levelSamples: Record<string, LevelSamples> = {};
  let trendSamples: Record<string, number[]> = {};
  // Closed months, oldest→newest (#351). Not month-to-date state — this is the
  // gate's own record of how each finished month graded, kept because the
  // verdict event fires once and `resetMonth` erases what produced it.
  let monthVerdicts: GateMonthVerdict[] = [];

  const resetMonth = (): void => {
    flowAccrual = {};
    levelSamples = Object.fromEntries(
      levelFaceIds.map((id) => [id, freshLevelSamples()]),
    );
    trendSamples = Object.fromEntries(trendFaceIds.map((id) => [id, []]));
  };
  resetMonth();

  // Flow accrual: every closed deal ticks the monthly bars (decision 1). Maps
  // the canonical `deal:closed` fields onto the known flow faces present in
  // config — units = count, gross = front + back.
  bus.subscribe('deal:closed', (p) => {
    if (config.faces.units?.kind === 'flow') {
      flowAccrual.units = (flowAccrual.units ?? 0) + 1;
    }
    if (config.faces.gross?.kind === 'flow') {
      flowAccrual.gross = (flowAccrual.gross ?? 0) + p.frontGross + p.backGross;
    }
  });

  // Nightly sampling of the level/trend providers. `clock:day_ended` fires once
  // per day, before `clock:month_ended` in the same advanceDay — so the final
  // day's sample is in before the verdict computes (then resetMonth clears).
  bus.subscribe('clock:day_ended', () => {
    for (const id of levelFaceIds) {
      const provider = signals[id];
      if (!provider) continue;
      const s = (levelSamples[id] ??= freshLevelSamples());
      const v = provider();
      s.sum += v;
      s.count += 1;
      if (s.monthStart === null) s.monthStart = v;
    }
    for (const id of trendFaceIds) {
      const provider = signals[id];
      if (!provider) continue;
      const w = (trendSamples[id] ??= []);
      w.push(provider());
      if (w.length > config.trendWindowDays) w.shift();
    }
  });

  bus.subscribe('clock:month_ended', ({ day }) => {
    const verdict = computeVerdict(day);
    // #351: the gate keeps its own verdicts. The event fires once and is gone,
    // and the month-to-date accruals reset a line later — so nothing else in
    // the world could reconstruct how a past month was graded. Finance's
    // month-close results read this; the financial side of each month is
    // re-derived from the (day-stamped, persisted) deal log and ledger rather
    // than stored twice.
    monthVerdicts.push(verdict);
    bus.publish('tierGate:month_verdict', verdict);
    resetMonth();
  });

  // --- live readout helpers ---------------------------------------------------

  /** Active faces for a tier = the target map keyed by `config.tiers[tier]`. */
  function targetsFor(tier: number): Readonly<Record<string, number>> {
    return config.tiers[String(tier)] ?? {};
  }

  function buildFaceProgress(
    id: string,
    target: number,
    dayOfMonth: number,
    daysRemaining: number,
  ): FaceProgress | null {
    const def = config.faces[id];
    if (!def) return null;
    switch (def.kind) {
      case 'flow': {
        const current = flowAccrual[id] ?? 0;
        const projectedLanding =
          dayOfMonth > 0 ? (current / dayOfMonth) * daysPerMonth : 0;
        const expectedByNow = (target * dayOfMonth) / daysPerMonth;
        const toCatchUp = Math.max(0, target - current);
        const onPaceRateNeeded =
          daysRemaining > 0 ? toCatchUp / daysRemaining : toCatchUp;
        return {
          id,
          label: def.label,
          kind: 'flow',
          current,
          target,
          projectedLanding,
          onPaceRateNeeded,
          toCatchUp,
          expectedByNow,
          cushion: current - expectedByNow,
          onPace: current >= expectedByNow,
        };
      }
      case 'level': {
        const s = levelSamples[id] ?? freshLevelSamples();
        const currentLevel = signals[id]?.() ?? 0;
        const avgLevel = s.count > 0 ? s.sum / s.count : currentLevel;
        const eps = config.levelTrendEpsilon;
        const trend: GateTrend =
          s.monthStart === null
            ? 'flat'
            : currentLevel - s.monthStart > eps
              ? 'climbing'
              : currentLevel - s.monthStart < -eps
                ? 'sliding'
                : 'flat';
        return {
          id,
          label: def.label,
          kind: 'level',
          currentLevel,
          avgLevel,
          threshold: target,
          trend,
          meetsThreshold: avgLevel >= target,
        };
      }
      case 'trend': {
        const w = trendSamples[id] ?? [];
        const rollingAvg = w.length > 0 ? mean(w) : (signals[id]?.() ?? 0);
        return {
          id,
          label: def.label,
          kind: 'trend',
          rollingAvg,
          threshold: target,
          trend: classifyTrend(w, config.trendEpsilon),
          meetsThreshold: rollingAvg >= target,
          recentSamples: [...w],
        };
      }
      case 'stepped':
        // Facility/image is dormant for now (decision 4 re-homes its teeth onto
        // the T4+ OEM stream). No current tier activates it; skip defensively.
        return null;
    }
  }

  function getProgress(): GateProgress {
    const day = getCurrentDay();
    const tier = getCurrentTier();
    const dayOfMonth = ((day - 1) % daysPerMonth) + 1;
    const daysRemaining = daysPerMonth - dayOfMonth;
    const targets = targetsFor(tier);
    const faces: FaceProgress[] = [];
    for (const [id, target] of Object.entries(targets)) {
      const fp = buildFaceProgress(id, target, dayOfMonth, daysRemaining);
      if (fp) faces.push(fp);
    }
    return { day, dayOfMonth, daysInMonth: daysPerMonth, daysRemaining, tier, faces };
  }

  /**
   * The standing spec for a tier (#349). Same source and same filter the
   * month-end verdict uses — only real, non-stepped faces — so the board can
   * never foreshadow a bar the gate does not actually grade. Non-face control
   * tunables in the tier entry (`streak`) are lifted out rather than dropped.
   */
  function getTierRequirements(tier: number): TierRequirements | null {
    const entry = config.tiers[String(tier)];
    if (!entry) return null;
    const faces: TierFaceRequirement[] = Object.entries(entry)
      .filter(([id]) => config.faces[id] && config.faces[id].kind !== 'stepped')
      .map(([id, target]) => ({
        id,
        label: config.faces[id].label,
        kind: config.faces[id].kind,
        target,
      }));
    return { tier, streak: entry.streak ?? 1, faces };
  }

  /** ratio used to band a face at month-end, by kind. */
  function faceRatio(id: string, target: number): number {
    if (target <= 0) return 1;
    const def = config.faces[id];
    switch (def?.kind) {
      case 'flow':
        return (flowAccrual[id] ?? 0) / target;
      case 'level': {
        const s = levelSamples[id] ?? freshLevelSamples();
        const avg = s.count > 0 ? s.sum / s.count : (signals[id]?.() ?? 0);
        return avg / target;
      }
      case 'trend': {
        const w = trendSamples[id] ?? [];
        const avg = w.length > 0 ? mean(w) : (signals[id]?.() ?? 0);
        return avg / target;
      }
      default:
        return 1;
    }
  }

  function computeVerdict(day: number) {
    const tier = getCurrentTier();
    const month = Math.floor((day - 1) / daysPerMonth) + 1;
    const targets = targetsFor(tier);
    const faces: FaceVerdict[] = Object.entries(targets)
      // Only real, non-stepped faces grade the month. A tier entry may carry
      // non-face control tunables (e.g. #250's per-tier `streak`); those have no
      // `config.faces` def and must never leak into the verdict.
      .filter(([id]) => config.faces[id] && config.faces[id].kind !== 'stepped')
      .map(([id, target]) => {
        const ratio = faceRatio(id, target);
        return { id, ratio, band: bandFor(ratio, config) };
      });
    return {
      day,
      month,
      tier,
      overall: worstBand(faces.map((f) => f.band)),
      faces,
    };
  }

  return {
    getProgress,
    getTierRequirements,

    getMonthVerdicts() {
      return monthVerdicts.map((v) => ({ ...v, faces: v.faces.map((f) => ({ ...f })) }));
    },

    snapshot() {
      return {
        schemaVersion: 1 as const,
        monthVerdicts: monthVerdicts.map((v) => ({
          ...v,
          faces: v.faces.map((f) => ({ ...f })),
        })),
        flowAccrual: { ...flowAccrual },
        levelSamples: Object.fromEntries(
          Object.entries(levelSamples).map(([id, s]) => [id, { ...s }]),
        ),
        trendSamples: Object.fromEntries(
          Object.entries(trendSamples).map(([id, w]) => [id, [...w]]),
        ),
      };
    },

    restore(snap) {
      // Pre-#351 snapshots have no verdict history; those careers start their
      // month-close record at the next month to close rather than inventing
      // grades for months whose accruals are gone.
      monthVerdicts = (snap.monthVerdicts ?? []).map((v) => ({
        ...v,
        faces: v.faces.map((f) => ({ ...f })),
      }));
      flowAccrual = { ...snap.flowAccrual };
      levelSamples = Object.fromEntries(
        Object.entries(snap.levelSamples).map(([id, s]) => [id, { ...s }]),
      );
      trendSamples = Object.fromEntries(
        Object.entries(snap.trendSamples).map(([id, w]) => [id, [...w]]),
      );
      // Ensure every configured face id has a slot even if absent from an older
      // snapshot (forward-compatible with a newly-added face).
      for (const id of levelFaceIds) levelSamples[id] ??= freshLevelSamples();
      for (const id of trendFaceIds) trendSamples[id] ??= [];
    },
  };
}

/**
 * The behavior-neutral default snapshot for a fresh month — also the
 * world-snapshot migration default for saves predating the gate (#196).
 */
export function createDefaultTierGateSnapshot(): TierGateSnapshot {
  return { schemaVersion: 1, flowAccrual: {}, levelSamples: {}, trendSamples: {} };
}

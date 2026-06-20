/**
 * Public types for the monthly tier-gate engine (#232).
 *
 * The headline goal object is the multi-dimensional monthly tier GATE
 * (`goals-targets-design.md`, built on `macro-loop-spine.md` §10). Each gate
 * FACE renders in its own native idiom (design decision 3) — a flow reads like a
 * sales-pace report, a balance reads like a balance, CSI reads like a trend — so
 * the progress shapes below are a discriminated union by `kind`, never one
 * uniform bar that would lie about a metric's type.
 */

/** A gate face's metric type — selects which honest readout it produces. */
export type GateFaceKind = 'flow' | 'level' | 'trend' | 'stepped';

/** The single month-end verdict band (design decision 1). */
export type GateBand = 'exceed' | 'meet' | 'nearMiss' | 'miss';

/** Slow-rolling direction for the level/trend faces. */
export type GateTrend = 'climbing' | 'flat' | 'sliding';

/**
 * Flow face (units, gross). The full DMS pace report: current-vs-target, the
 * on-pace rate still needed, the projected month-end landing, and the
 * units/$-to-catch-up. `cushion`/`onPace` let the surface report the cushion +
 * projection when ahead of pace, instead of a meaningless "0 needed" (decision
 * 2). All values are facts the *player* reads; the engine never prescribes.
 */
export interface FlowFaceProgress {
  readonly id: string;
  readonly label: string;
  readonly kind: 'flow';
  /** Accrued so far this month. */
  readonly current: number;
  readonly target: number;
  /** Linear projection of month-end landing from the current pace. */
  readonly projectedLanding: number;
  /** Per *remaining* day still needed to hit target (catch-up ÷ daysRemaining). */
  readonly onPaceRateNeeded: number;
  /** `max(0, target − current)`. */
  readonly toCatchUp: number;
  /** The pro-rata pace line: where you'd be if exactly on track right now. */
  readonly expectedByNow: number;
  /** `current − expectedByNow` (negative ⇒ behind). */
  readonly cushion: number;
  /** `current >= expectedByNow`. */
  readonly onPace: boolean;
}

/**
 * Level/stock face (cash / financial strength). A gauge — monthly-average level
 * against a threshold line plus a trend arrow. No "catch-up": a balance can fall
 * and is not a flow you pace (decision 3).
 */
export interface LevelFaceProgress {
  readonly id: string;
  readonly label: string;
  readonly kind: 'level';
  readonly currentLevel: number;
  /** Mean of the month's daily samples (the gauge needle). */
  readonly avgLevel: number;
  readonly threshold: number;
  readonly trend: GateTrend;
  readonly meetsThreshold: boolean;
}

/**
 * Slow-rolling-average face (CSI). A multi-week trend, not a daily pace
 * (decision 3): the rolling average + its climbing/flat/sliding direction.
 */
export interface TrendFaceProgress {
  readonly id: string;
  readonly label: string;
  readonly kind: 'trend';
  readonly rollingAvg: number;
  readonly threshold: number;
  readonly trend: GateTrend;
  readonly meetsThreshold: boolean;
  /**
   * The rolling window's raw daily samples, oldest→newest — the data points the
   * Home strip plots as the CSI **sparkline** (S3b). Surfaced read-only off the
   * engine's existing internal window; deterministic, so it stays replay-safe.
   */
  readonly recentSamples: readonly number[];
}

/**
 * The live progress for one active gate face. Facility (stepped) is dormant
 * for now (its image-standard teeth re-home onto the T4+ OEM stream, decision 4), so
 * it is absent from the union until that slice lands.
 */
export type FaceProgress =
  | FlowFaceProgress
  | LevelFaceProgress
  | TrendFaceProgress;

/** The full live multi-face gate readout the Home strip (S3b) renders. */
export interface GateProgress {
  readonly day: number;
  /** 1-based day within the current gameplay month. */
  readonly dayOfMonth: number;
  readonly daysInMonth: number;
  /** Whole days left after today (`daysInMonth − dayOfMonth`). */
  readonly daysRemaining: number;
  readonly tier: number;
  readonly faces: readonly FaceProgress[];
}

/** One face's month-end grade. */
export interface FaceVerdict {
  readonly id: string;
  readonly band: GateBand;
  /** achieved ÷ target (or level/threshold) — the banding input. */
  readonly ratio: number;
}

/**
 * The single 4-band month-end verdict (decision 1) — fires once, on the gate.
 * `overall` is the WORST active face: the gate is multi-dimensional and every
 * face must clear, so the binding constraint is what grades the month
 * (`macro-loop-spine.md` §10).
 */
export interface GateMonthVerdict {
  readonly day: number;
  readonly month: number;
  readonly tier: number;
  readonly overall: GateBand;
  readonly faces: readonly FaceVerdict[];
}

/** Per-face accumulated daily samples for a level (stock) face. */
export interface LevelSamples {
  sum: number;
  count: number;
  /** First sample of the current month — the trend-arrow baseline. */
  monthStart: number | null;
}

/**
 * Persistence surface (#232, conforms to the #188 world-snapshot contract).
 * Module-owned `schemaVersion`. The month-to-date accruals + rolling samples are
 * the engine's whole state; everything else (targets, pace) is derived live, so
 * a restored world resumes the in-progress month exactly.
 */
export interface TierGateSnapshot {
  readonly schemaVersion: 1;
  /** Month-to-date flow accruals, keyed by flow face id (`units`, `gross`). */
  readonly flowAccrual: Record<string, number>;
  /** Month-to-date level samples, keyed by level face id (`cash`). */
  readonly levelSamples: Record<string, LevelSamples>;
  /** Rolling trend windows, keyed by trend face id (`csi`). */
  readonly trendSamples: Record<string, number[]>;
}

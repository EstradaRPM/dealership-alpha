import type {
  FaceProgress,
  FlowFaceProgress,
  GateProgress,
  GateTrend,
  LevelFaceProgress,
  SteppedFaceProgress,
  TrendFaceProgress,
} from '../../game/TierGate';
import type { ProgressTone, TrendDirection } from '../kit';
import { compactMoney } from '../kit';

/**
 * Pure read-model builder for the Home **monthly gate-progress strip** (S3b,
 * #233). Turns the TierGate engine's live `GateProgress` into a fully-formatted,
 * presentation-ready model the `GateStrip` component renders verbatim — each gate
 * face in its native idiom (goals-targets-design decision 3): flow faces read as
 * a sales-pace report, the cash level as a gauge vs a threshold, CSI as a trend
 * sparkline. The day is **counted, not judged** (decision 1): no daily letter
 * grade — the 4-band verdict is month-end only, and lives on its own surface.
 *
 * It imports only TierGate *types* (no game logic) and kit *types*, so the pace
 * math stays unit-testable without a React tree or a built world.
 */

/** One flow face (units / gross) — the full pace readout + the bar segments. */
export interface FlowFaceView {
  id: string;
  kind: 'flow';
  label: string;
  /** Total month-to-date fill, clamped [0,1] — the whole bar. */
  fill: number;
  /** Today's haul as a fraction of target, clamped — the reward tick segment. */
  todayFill: number;
  /** Month-to-date *before* today, clamped — the bar's settled portion. */
  priorFill: number;
  /** "32 / 40" (units) or "$48,500 / $60,000" (gross). */
  valueLabel: string;
  /** Honest pace fact (decision 2 — a fact the player reads, never a command). */
  paceLabel: string;
  /** Bar tone: positive when on/ahead of pace, primary when catching up. */
  tone: ProgressTone;
  onPace: boolean;
}

/** The cash / financial-strength level face — a gauge vs the threshold line. */
export interface LevelFaceView {
  id: string;
  kind: 'level';
  label: string;
  /** Monthly-average level ÷ threshold, clamped [0,1] — the gauge needle. */
  fill: number;
  /** "Avg $1,180,000". */
  valueLabel: string;
  /** "vs $800,000". */
  thresholdLabel: string;
  trend: TrendDirection;
  tone: ProgressTone;
  meets: boolean;
}

/** The CSI trend face — a rolling-average trend sparkline. */
export interface TrendFaceView {
  id: string;
  kind: 'trend';
  label: string;
  /** "88". */
  valueLabel: string;
  /** "vs 95". */
  thresholdLabel: string;
  trend: TrendDirection;
  /** Recent samples normalized to [0,1] for the sparkline; oldest→newest. */
  sparkline: number[];
  tone: ProgressTone;
  meets: boolean;
}

/**
 * The facility face (#360) — a standing build-out score against a bar.
 *
 * Deliberately the level face MINUS the trend arrow: a stepped score does not
 * drift, so an arrow would be pointing at nothing on every day the player did
 * not build. The bar reads against the threshold, exactly as the level gauge
 * does, so "how close am I to clearing it" means the same thing on both.
 */
export interface SteppedFaceView {
  id: string;
  kind: 'stepped';
  label: string;
  /** Score ÷ threshold, clamped [0,1] — distance to the bar, not to 100%. */
  fill: number;
  /** "34% built". */
  valueLabel: string;
  /** "vs 50%". */
  thresholdLabel: string;
  tone: ProgressTone;
  meets: boolean;
}

export type GateFaceView =
  | FlowFaceView
  | LevelFaceView
  | TrendFaceView
  | SteppedFaceView;

export interface GateStripModel {
  faces: GateFaceView[];
  /**
   * Single "% on track" quick-stat (S3a-deferred) — the *binding* face's
   * projected attainment (min over faces of projection ÷ target), capped at 100.
   * The gate is multi-dimensional: the worst face is the real status, mirroring
   * the month-end verdict's worst-face rule. `null` when no faces are lit.
   */
  percentOnTrack: number | null;
  /**
   * #250 — the tier-advancement streak line. Advancement is N consecutive
   * meet-or-better months; this surfaces the banked progress ("Track record:
   * month 2 of 3") or, once the top-tier streak is complete, the dossier-ready
   * cue. `null` when no streak status is supplied.
   */
  streakLabel: string | null;
}

/** Tier-advancement streak status for the gate strip's track-record line (#250). */
export interface StreakStatus {
  /** Consecutive meet-or-better months banked at the current tier. */
  current: number;
  /** Months needed to leave the current tier. */
  required: number;
  /** Top-tier streak complete → franchise dossier ready (no auto-advance). */
  dossierReady: boolean;
}

/** Today's haul, keyed by flow face id, for the daily-contribution tick. */
export interface TodayContribution {
  units: number;
  gross: number;
}

function gateTrendToDirection(t: GateTrend): TrendDirection {
  return t === 'climbing' ? 'up' : t === 'sliding' ? 'down' : 'flat';
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Money for the gross face; bare rounded integer otherwise.
 *
 * **Compact** (issue 387): the strip is the HUD's ambient read of where the
 * month stands, and its figures are pace and target rather than anything the
 * player commits against. It is also the widest reading on the Home tab — a
 * flow face states current, target and projection on one row.
 */
function fmt(id: string, n: number): string {
  return id === 'gross' ? compactMoney(n) : `${Math.round(n)}`;
}

function buildFlowView(f: FlowFaceProgress, today: number): FlowFaceView {
  const fill = f.target > 0 ? clamp01(f.current / f.target) : 0;
  const priorFill =
    f.target > 0 ? clamp01((f.current - today) / f.target) : 0;
  const proj = fmt(f.id, f.projectedLanding);
  let paceLabel: string;
  if (f.onPace) {
    // Over/at pace ⇒ report the cushion + projection, never "0 needed".
    const cushion = Math.round(f.cushion);
    paceLabel =
      cushion > 0
        ? `Ahead by ${fmt(f.id, f.cushion)} · proj ${proj}`
        : `On pace · proj ${proj}`;
  } else {
    const rate =
      f.id === 'gross'
        ? `${compactMoney(f.onPaceRateNeeded)}/day`
        : `${f.onPaceRateNeeded.toFixed(1)}/day`;
    paceLabel = `Need ${rate} · proj ${proj}`;
  }
  return {
    id: f.id,
    kind: 'flow',
    label: f.label,
    fill,
    todayFill: f.target > 0 ? clamp01(today / f.target) : 0,
    priorFill,
    valueLabel: `${fmt(f.id, f.current)} / ${fmt(f.id, f.target)}`,
    paceLabel,
    tone: f.onPace ? 'positive' : 'primary',
    onPace: f.onPace,
  };
}

function buildLevelView(f: LevelFaceProgress): LevelFaceView {
  return {
    id: f.id,
    kind: 'level',
    label: f.label,
    fill: f.threshold > 0 ? clamp01(f.avgLevel / f.threshold) : 0,
    valueLabel: `Avg ${compactMoney(f.avgLevel)}`,
    thresholdLabel: `vs ${compactMoney(f.threshold)}`,
    trend: gateTrendToDirection(f.trend),
    tone: f.meetsThreshold ? 'positive' : 'danger',
    meets: f.meetsThreshold,
  };
}

function buildTrendView(f: TrendFaceProgress): TrendFaceView {
  // Normalize the window to [0,1] against its own min/max so the shape reads
  // even when the values sit in a narrow band (e.g. CSI 70–88).
  const xs = f.recentSamples;
  const min = xs.length > 0 ? Math.min(...xs) : 0;
  const max = xs.length > 0 ? Math.max(...xs) : 1;
  const span = max - min;
  const sparkline = xs.map((v) => (span > 0 ? (v - min) / span : 0.5));
  return {
    id: f.id,
    kind: 'trend',
    label: f.label,
    valueLabel: `${Math.round(f.rollingAvg)}`,
    thresholdLabel: `vs ${Math.round(f.threshold)}`,
    trend: gateTrendToDirection(f.trend),
    sparkline,
    tone: f.meetsThreshold ? 'positive' : 'danger',
    meets: f.meetsThreshold,
  };
}

function buildSteppedView(f: SteppedFaceProgress): SteppedFaceView {
  return {
    id: f.id,
    kind: 'stepped',
    label: f.label,
    fill: f.threshold > 0 ? clamp01(f.score / f.threshold) : 0,
    valueLabel: `${Math.round(f.score)}% built`,
    thresholdLabel: `vs ${Math.round(f.threshold)}%`,
    tone: f.meetsThreshold ? 'positive' : 'danger',
    meets: f.meetsThreshold,
  };
}

/** Projected attainment ratio of one face vs its target — the on-track input. */
function faceTrackRatio(f: FaceProgress): number {
  switch (f.kind) {
    case 'flow':
      return f.target > 0 ? f.projectedLanding / f.target : 1;
    case 'level':
      return f.threshold > 0 ? f.avgLevel / f.threshold : 1;
    case 'trend':
      return f.threshold > 0 ? f.rollingAvg / f.threshold : 1;
    case 'stepped':
      // No projection: a stepped face lands exactly where it stands unless the
      // player buys a building, and the strip must not pretend to forecast that.
      return f.threshold > 0 ? f.score / f.threshold : 1;
  }
}

/** The track-record line copy for the streak state (#250). */
function streakLabelFor(streak: StreakStatus): string {
  return streak.dossierReady
    ? 'Track record ready — franchise courtship coming'
    : `Track record: month ${streak.current} of ${streak.required}`;
}

export function buildGateStrip(
  progress: GateProgress,
  today?: TodayContribution,
  streak?: StreakStatus,
): GateStripModel {
  const faces: GateFaceView[] = progress.faces.map((f) => {
    switch (f.kind) {
      case 'flow': {
        const haul =
          f.id === 'units' ? (today?.units ?? 0) : f.id === 'gross' ? (today?.gross ?? 0) : 0;
        return buildFlowView(f, haul);
      }
      case 'level':
        return buildLevelView(f);
      case 'trend':
        return buildTrendView(f);
      case 'stepped':
        return buildSteppedView(f);
    }
  });

  const percentOnTrack =
    progress.faces.length === 0
      ? null
      : Math.round(
          Math.max(
            0,
            Math.min(1, Math.min(...progress.faces.map(faceTrackRatio))),
          ) * 100,
        );

  return {
    faces,
    percentOnTrack,
    streakLabel: streak ? streakLabelFor(streak) : null,
  };
}

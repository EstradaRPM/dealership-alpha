import type {
  FaceProgress,
  GateProgress,
  GateTrend,
  TierRequirements,
} from '../../game/TierGate';
import type { ProgressTone, TrendDirection } from '../kit';
import { compactMoney } from '../kit';

/**
 * Pure read-model builder for the Growth **tier-gate detail board** (#349).
 *
 * The Home strip (`HomeTab/gateStripModel`) is the GLANCE: one compressed line
 * per face plus a "% on track" pill. This is the DETAIL board the locked IA §4
 * gives Growth — every number the engine already computes, spelled out per face
 * in its native idiom (goals-targets decision 3), plus the climb: what the next
 * rung asks for. The two models are deliberately separate rather than one
 * parameterized builder, because "compress to one line" and "show all of it"
 * are different jobs and sharing them would make both worse.
 *
 * Decision 2 holds here too: the board reports facts (pace line, cushion,
 * projection) and never prescribes. There is no "your bottleneck is X" line —
 * the player reads which face is the wall.
 *
 * Imports TierGate *types* only (no game logic) and kit *types*, so it stays
 * unit-testable without a React tree or a built world.
 */

/** One spelled-out fact under a face — a label and its formatted value. */
export interface GateBoardDetail {
  label: string;
  value: string;
}

export interface GateBoardFace {
  id: string;
  kind: 'flow' | 'level' | 'trend' | 'stepped';
  label: string;
  /** The headline read — "5 / 8", "Avg $52,400", "72". */
  valueLabel: string;
  /** Standing status in plain language — "On pace", "Behind pace", "Clearing". */
  statusLabel: string;
  tone: ProgressTone;
  /** Bar fill [0,1] for flow/level faces; absent for the trend face. */
  fill?: number;
  /** Normalized samples oldest→newest for the trend face; absent otherwise. */
  sparkline?: number[];
  /** Direction arrow for level/trend faces; absent for flow. */
  trend?: TrendDirection;
  details: readonly GateBoardDetail[];
}

/** The climb section — the rung above, and what it takes to get onto it. */
export interface GateBoardClimb {
  /** "Next up: Tier 2" — the rung being foreshadowed. */
  title: string;
  /** Every bar the next tier asks for, month after month. */
  requirements: readonly GateBoardDetail[];
  /** "Clear every bar for 2 straight months to move up." */
  ruleLabel: string;
  /** Banked progress toward that rule — "Track record: month 1 of 2". */
  streakLabel: string;
}

export interface GateBoardModel {
  /** "Tier 1 · Day 12 of 30" — where the month stands. */
  periodLabel: string;
  /** "18 days left" / "Last day of the month". */
  remainingLabel: string;
  faces: GateBoardFace[];
  /** `null` at the top of the built ladder (no rung above to show). */
  climb: GateBoardClimb | null;
}

/** Tier-advancement streak status (#250), same shape the Home strip takes. */
export interface GateBoardStreak {
  current: number;
  required: number;
  dossierReady: boolean;
}

/**
 * Money faces vs count faces. `gross` and `cash` are dollars; `units` is a car
 * count and `csi` is a score. Keyed by face id because the KIND doesn't say it —
 * a flow can be either.
 */
const MONEY_FACES: ReadonlySet<string> = new Set(['gross', 'cash']);

function fmtValue(id: string, n: number, decimals = 0): string {
  const rounded =
    decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n);
  // Compact (issue 387): the board is an ambient read of where the store stands
  // against its gate, the same reading the Home strip states — nothing here is
  // committed against.
  return MONEY_FACES.has(id) ? compactMoney(n) : `${rounded}`;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function trendToDirection(t: GateTrend): TrendDirection {
  return t === 'climbing' ? 'up' : t === 'sliding' ? 'down' : 'flat';
}

function trendWord(t: GateTrend): string {
  return t === 'climbing' ? 'Climbing' : t === 'sliding' ? 'Sliding' : 'Holding steady';
}

function buildFace(f: FaceProgress): GateBoardFace {
  switch (f.kind) {
    case 'flow': {
      const behind = -f.cushion;
      return {
        id: f.id,
        kind: 'flow',
        label: f.label,
        valueLabel: `${fmtValue(f.id, f.current)} / ${fmtValue(f.id, f.target)}`,
        statusLabel: f.onPace ? 'On pace' : 'Behind pace',
        tone: f.onPace ? 'positive' : 'primary',
        fill: f.target > 0 ? clamp01(f.current / f.target) : 0,
        details: [
          { label: 'Booked so far', value: fmtValue(f.id, f.current) },
          { label: 'Month target', value: fmtValue(f.id, f.target) },
          {
            label: 'On-pace line today',
            value: fmtValue(f.id, f.expectedByNow, MONEY_FACES.has(f.id) ? 0 : 1),
          },
          {
            label: f.onPace ? 'Ahead by' : 'Behind by',
            value: fmtValue(f.id, Math.abs(f.onPace ? f.cushion : behind), MONEY_FACES.has(f.id) ? 0 : 1),
          },
          { label: 'Still to go', value: fmtValue(f.id, f.toCatchUp) },
          {
            label: 'Needed per day left',
            value: `${fmtValue(f.id, f.onPaceRateNeeded, MONEY_FACES.has(f.id) ? 0 : 1)}/day`,
          },
          { label: 'Projected finish', value: fmtValue(f.id, f.projectedLanding) },
        ],
      };
    }
    case 'level':
      return {
        id: f.id,
        kind: 'level',
        label: f.label,
        valueLabel: `Avg ${fmtValue(f.id, f.avgLevel)}`,
        statusLabel: f.meetsThreshold ? 'Clearing the bar' : 'Under the bar',
        tone: f.meetsThreshold ? 'positive' : 'danger',
        fill: f.threshold > 0 ? clamp01(f.avgLevel / f.threshold) : 0,
        trend: trendToDirection(f.trend),
        details: [
          { label: 'Bar to clear', value: fmtValue(f.id, f.threshold) },
          { label: 'Month average', value: fmtValue(f.id, f.avgLevel) },
          { label: 'Right now', value: fmtValue(f.id, f.currentLevel) },
          { label: 'Direction', value: trendWord(f.trend) },
        ],
      };
    case 'trend': {
      // Normalize against the window's own min/max so the shape reads even in a
      // narrow band (CSI lives in the 70s–80s) — same choice the Home strip makes.
      const xs = f.recentSamples;
      const min = xs.length > 0 ? Math.min(...xs) : 0;
      const max = xs.length > 0 ? Math.max(...xs) : 1;
      const span = max - min;
      return {
        id: f.id,
        kind: 'trend',
        label: f.label,
        valueLabel: fmtValue(f.id, f.rollingAvg),
        statusLabel: f.meetsThreshold ? 'Clearing the bar' : 'Under the bar',
        tone: f.meetsThreshold ? 'positive' : 'danger',
        sparkline: xs.map((v) => (span > 0 ? (v - min) / span : 0.5)),
        trend: trendToDirection(f.trend),
        details: [
          { label: 'Bar to clear', value: fmtValue(f.id, f.threshold) },
          { label: 'Rolling average', value: fmtValue(f.id, f.rollingAvg, 1) },
          { label: 'Days in the window', value: `${xs.length}` },
          { label: 'Direction', value: trendWord(f.trend) },
        ],
      };
    }
    case 'stepped':
      // Two facts and no arrow. The per-kind breakdown ("Lot spaces 12 of 35")
      // is the build surface's job on this same tab (#359's `FacilityBuild`) —
      // repeating it here would give the same numbers two homes that could
      // disagree.
      return {
        id: f.id,
        kind: 'stepped',
        label: f.label,
        valueLabel: `${Math.round(f.score)}% built`,
        statusLabel: f.meetsThreshold ? 'Clearing the bar' : 'Under the bar',
        tone: f.meetsThreshold ? 'positive' : 'danger',
        fill: f.threshold > 0 ? clamp01(f.score / f.threshold) : 0,
        details: [
          { label: 'Bar to clear', value: `${Math.round(f.threshold)}% built` },
          { label: 'Built out now', value: `${Math.round(f.score)}%` },
        ],
      };
  }
}

function buildClimb(
  next: TierRequirements | null,
  streak: GateBoardStreak | undefined,
): GateBoardClimb | null {
  if (!next) return null;
  // The month count is the CURRENT tier's streak — how many meet-or-better
  // months it takes to leave where you are. `next.streak` is what it will take
  // to leave the tier ABOVE, and quoting it here contradicted the track-record
  // line right under it (the web drive read "for 2 straight months" over
  // "month 0 of 1"). With no streak status supplied, the rule states the bar
  // without inventing a count.
  const months =
    streak === undefined
      ? null
      : streak.required === 1
        ? 'one month'
        : `${streak.required} straight months`;
  return {
    title: `Next up: Tier ${next.tier}`,
    requirements: next.faces.map((r) => ({
      label: r.label,
      value:
        r.kind === 'flow'
          ? `${fmtValue(r.id, r.target)} a month`
          : r.kind === 'stepped'
            ? `${Math.round(r.target)}% built`
            : fmtValue(r.id, r.target),
    })),
    ruleLabel: months
      ? `Clear every bar below for ${months} to move up.`
      : 'Clear every bar below to move up.',
    streakLabel: streak
      ? streak.dossierReady
        ? 'Track record ready — franchise courtship coming'
        : `Track record: month ${streak.current} of ${streak.required}`
      : 'No months banked yet.',
  };
}

/**
 * Build the board. `nextTier` is the requirements for the rung ABOVE the current
 * tier (the composition root reads it off `tierGate.getTierRequirements`); pass
 * `null` when there is none, and the climb section simply does not render —
 * rule 3, no grayed foreshadow tile for a rung that doesn't exist.
 */
export function buildGateBoard(
  progress: GateProgress,
  nextTier: TierRequirements | null,
  streak?: GateBoardStreak,
): GateBoardModel {
  return {
    periodLabel: `Tier ${progress.tier} · Day ${progress.dayOfMonth} of ${progress.daysInMonth}`,
    remainingLabel:
      progress.daysRemaining <= 0
        ? 'Last day of the month'
        : progress.daysRemaining === 1
          ? '1 day left'
          : `${progress.daysRemaining} days left`,
    faces: progress.faces.map(buildFace),
    climb: buildClimb(nextTier, streak),
  };
}

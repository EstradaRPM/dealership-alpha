import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import type { GradientToken } from '../theme';
import { GradientSurface } from './Gradient';

export type ProgressTone = 'primary' | 'positive' | 'reward' | 'danger';

export interface ProgressBarProps {
  /** Fill fraction, clamped to [0,1]. */
  value: number;
  /** Fill color role. Default `primary`. */
  tone?: ProgressTone;
  /**
   * Optional second segment appended after the main fill, as its own [0,1]
   * fraction of the track — e.g. today's haul ticking up a month-to-date pace
   * bar. Omit (or 0) for the plain single-fill bar.
   */
  tick?: number;
  /** Color role for the tick segment. Default `reward` (the win accent). */
  tickTone?: ProgressTone;
  /** testID hung on the tick segment, for visibility assertions. */
  tickTestID?: string;
  /**
   * testID hung on the main fill, for *proportion* assertions — the fill's
   * width is the whole information content of a bar (issue 347: the personnel
   * skill bars all rendered identically for years because nothing asserted
   * that two different values produce two different widths).
   */
  fillTestID?: string;
  /**
   * Optional [0,1] reference point drawn as a hairline across the track — where
   * the value STARTED, so the fill beyond it reads as distance travelled
   * (issue 377: a staff card showed the current skill alone, so a climbing
   * rookie and a topped-out veteran drew the same bar). Ignored in `tick` mode.
   */
  mark?: number;
  markTestID?: string;
  /**
   * Optional [0,1] point past which this track cannot be filled — the segment
   * beyond is dimmed, so the bar states a reachable end without rescaling the
   * axis. Rescaling each bar to its own limit was the alternative and it makes
   * two people's bars incomparable, which is the one thing a roster of them is
   * for. Ignored in `tick` mode.
   */
  reach?: number;
  reachTestID?: string;
}

/** Every `ProgressTone` is also a gradient role + flat color role of the same name. */
function roles(tone: ProgressTone): GradientToken {
  return tone;
}

/**
 * Horizontal fill bar — the targets/pace bars from the mockups. An inset track
 * groove holding a gradient fill that glows in its own tone; an optional second
 * `tick` segment rides the end of the fill (the daily-contribution reward
 * beat). Presentation only; the caller computes the ratios.
 */
export function ProgressBar({
  value,
  tone = 'primary',
  tick,
  tickTone = 'reward',
  tickTestID,
  fillTestID,
  mark,
  markTestID,
  reach,
  reachTestID,
}: ProgressBarProps) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const tickPct = Math.max(0, Math.min(1, tick ?? 0)) * 100;

  const track: ViewStyle = {
    height: t.spacing.md,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.base,
    justifyContent: 'center',
    ...t.elevation.inset,
  };

  if (tickPct > 0) {
    // Two-segment mode: settled fill + appended tick run squared inside the
    // track; the track's pill radius clips both ends (glow would be clipped
    // anyway, so the segments skip it).
    const segTrack: ViewStyle = {
      ...track,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      overflow: 'hidden',
    };
    return (
      <View style={segTrack}>
        <GradientSurface
          gradient={roles(tone)}
          style={{ width: `${pct}%`, height: '100%' }}
          testID={fillTestID}
        />
        <GradientSurface
          gradient={roles(tickTone)}
          style={{ width: `${tickPct}%`, height: '100%' }}
          testID={tickTestID}
        />
      </View>
    );
  }

  // Pill-rounded fill carries its own soft glow; the track keeps the groove.
  const fill: ViewStyle = {
    width: `${pct}%`,
    height: '100%',
    borderRadius: t.radius.pill,
    overflow: 'hidden',
    ...t.elevation.glow,
    shadowColor: t.colors[tone],
  };

  // The unreachable tail, laid over the empty groove. Drawn before the fill so
  // it can never dim the filled part of the bar.
  const reachPct = reach == null ? null : Math.max(0, Math.min(1, reach)) * 100;
  // Where the value started. A hairline in the ink color that reads on the
  // fill's own gradient, since the mark is always at or behind the fill's edge.
  const markPct = mark == null ? null : Math.max(0, Math.min(1, mark)) * 100;

  return (
    <View style={track}>
      {reachPct != null && (
        <View
          pointerEvents="none"
          testID={reachTestID}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${reachPct}%`,
            right: 0,
            backgroundColor: t.colors.scrim,
          }}
        />
      )}
      <GradientSurface gradient={roles(tone)} style={fill} testID={fillTestID}>
        {/* Top sheen so the fill reads as a glossy lozenge, not a flat stick. */}
        <GradientSurface
          gradient="gloss"
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }}
        />
      </GradientSurface>
      {markPct != null && (
        <View
          pointerEvents="none"
          testID={markTestID}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${markPct}%`,
            width: t.spacing.xxs,
            backgroundColor: t.colors.onAccent,
          }}
        />
      )}
    </View>
  );
}

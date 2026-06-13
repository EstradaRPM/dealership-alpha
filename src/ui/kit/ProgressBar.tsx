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
        <GradientSurface gradient={roles(tone)} style={{ width: `${pct}%`, height: '100%' }} />
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

  return (
    <View style={track}>
      <GradientSurface gradient={roles(tone)} style={fill}>
        {/* Top sheen so the fill reads as a glossy lozenge, not a flat stick. */}
        <GradientSurface
          gradient="gloss"
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }}
        />
      </GradientSurface>
    </View>
  );
}

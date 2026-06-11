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
}

/**
 * Horizontal fill bar — the targets/pace bars from the mockups. An inset track
 * groove holding a gradient fill that glows in its own tone. Presentation only;
 * the caller computes the ratio.
 */
export function ProgressBar({ value, tone = 'primary' }: ProgressBarProps) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  // Each tone maps to a matching gradient role + glow color; `primary` covers
  // the default and any unlisted tone.
  const gradient: GradientToken =
    tone === 'positive' ? 'positive' : tone === 'reward' ? 'reward' : tone === 'danger' ? 'danger' : 'primary';
  const glow =
    tone === 'positive'
      ? t.colors.positive
      : tone === 'reward'
        ? t.colors.reward
        : tone === 'danger'
          ? t.colors.danger
          : t.colors.primary;

  const track: ViewStyle = {
    height: t.spacing.md,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.base,
    justifyContent: 'center',
    ...t.elevation.inset,
  };
  // Pill-rounded fill carries its own soft glow; the track keeps the groove.
  const fill: ViewStyle = {
    width: `${pct}%`,
    height: '100%',
    borderRadius: t.radius.pill,
    ...t.elevation.glow,
    shadowColor: glow,
  };

  return (
    <View style={track}>
      <GradientSurface gradient={gradient} style={fill} />
    </View>
  );
}

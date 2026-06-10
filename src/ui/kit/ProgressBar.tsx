import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export type ProgressTone = 'primary' | 'positive' | 'reward' | 'danger';

export interface ProgressBarProps {
  /** Fill fraction, clamped to [0,1]. */
  value: number;
  /** Fill color role. Default `primary`. */
  tone?: ProgressTone;
}

/**
 * Horizontal fill bar — the targets/pace bars from the mockups. A themed inset
 * track with a tinted fill. Presentation only; the caller computes the ratio.
 */
export function ProgressBar({ value, tone = 'primary' }: ProgressBarProps) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fillColor =
    tone === 'positive'
      ? t.colors.positive
      : tone === 'reward'
        ? t.colors.reward
        : tone === 'danger'
          ? t.colors.danger
          : t.colors.primary;

  const track: ViewStyle = {
    height: t.spacing.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.base,
    overflow: 'hidden',
    ...t.elevation.inset,
  };
  const fill: ViewStyle = {
    width: `${pct}%`,
    height: '100%',
    borderRadius: t.radius.pill,
    backgroundColor: fillColor,
  };

  return (
    <View style={track}>
      <View style={fill} />
    </View>
  );
}

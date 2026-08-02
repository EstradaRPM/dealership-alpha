import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import type { ProgressTone } from './ProgressBar';

export interface SparklineProps {
  /** Samples normalized to [0,1], oldest→newest. Empty ⇒ the empty label. */
  values: readonly number[];
  /** Bar color role. Default `primary`. */
  tone?: ProgressTone;
  /** Bar-height scale: `sm` for a glance strip, `md` for a detail board. */
  size?: 'sm' | 'md';
  /** Copy shown instead of the bars when there are no samples yet. */
  emptyLabel?: string;
  testID?: string;
}

/**
 * A tiny bar sparkline — the shape of a rolling window, oldest→newest. Extracted
 * to the kit in issue 349 because the tier gate's CSI trend face now renders in
 * two places (the Home glance strip and the Growth detail board) and a second
 * hand-rolled copy would let the two drift. Presentation only; the caller
 * normalizes its own samples to [0,1], since only the caller knows whether the
 * meaningful baseline is zero or the window's own minimum.
 */
export function Sparkline({
  values,
  tone = 'primary',
  size = 'sm',
  emptyLabel,
  testID,
}: SparklineProps) {
  const t = useTheme();
  if (values.length === 0) {
    return emptyLabel ? (
      <Text
        style={{
          ...t.typography.caption,
          color: t.colors.textMuted,
          marginTop: t.spacing.xxs,
        }}
      >
        {emptyLabel}
      </Text>
    ) : null;
  }
  const maxH = size === 'md' ? t.spacing.xxl : t.spacing.lg;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height: maxH,
        marginTop: t.spacing.xs,
      }}
      testID={testID}
    >
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            // A floor of 2px so a window's minimum sample still draws a mark —
            // a zero-height bar reads as missing data, not as a low reading.
            height: Math.max(2, Math.max(0, Math.min(1, v)) * maxH),
            borderRadius: t.radius.sm,
            backgroundColor: t.colors[tone],
          }}
        />
      ))}
    </View>
  );
}

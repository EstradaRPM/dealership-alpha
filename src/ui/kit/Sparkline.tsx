import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import type { ProgressTone } from './ProgressBar';
import { ChartEmpty, useChartWidth } from './ChartParts';
import { areaPath, polylinePath, sparklinePoints } from './chartScale';

export interface SparklineProps {
  /** Samples normalized to [0,1], oldest→newest. Empty ⇒ the empty label. */
  values: readonly number[];
  /** Line color role. Default `primary`. */
  tone?: ProgressTone;
  /** Plot height: `sm` for a glance strip, `md` for a detail board. */
  size?: 'sm' | 'md';
  /** Copy shown instead of the trend when there are no samples yet. */
  emptyLabel?: string;
  /** Fixed plot width. Omit to measure the container (tests should pass it). */
  width?: number;
  testID?: string;
}

/** Trend stroke. Thin enough to stay a mark, thick enough to survive scaling. */
const STROKE = 2;
/** Latest-sample dot. Sized to the marker floor so it reads as a point. */
const DOT_R = 3;

/**
 * A trend sparkline — the shape of a rolling window, oldest→newest, with the
 * newest sample dotted so "where it ended" is readable at a glance. No axes, no
 * gridlines, no labels: this is an inline mark that lives beside a number, and
 * anything more turns it into a chart that wants a caption.
 *
 * Presentation only. The caller normalizes its own samples to [0,1], since only
 * the caller knows whether the meaningful baseline is zero or the window's own
 * minimum — a CSI window reads against its own floor, a unit count against zero.
 *
 * Extracted to the kit in issue 349 (as bars) because the tier gate's CSI trend
 * renders in two places and a second hand-rolled copy would let them drift;
 * rebuilt on `react-native-svg` in issue 350 so it draws a real line and shares
 * one geometry module with the rest of the chart primitives.
 */
export function Sparkline({
  values,
  tone = 'primary',
  size = 'sm',
  emptyLabel,
  width,
  testID,
}: SparklineProps) {
  const t = useTheme();
  const [w, onLayout] = useChartWidth(width);

  if (values.length === 0) {
    return <ChartEmpty label={emptyLabel} testID={testID ? `${testID}-empty` : undefined} />;
  }

  const height = size === 'md' ? t.spacing.xxxl : t.spacing.xl;
  const points = sparklinePoints(values, w, height, DOT_R);
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout} style={{ marginTop: t.spacing.xs }} testID={testID}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Path d={areaPath(points, height)} fill={t.colors[`${tone}Tint`]} />
          <Path
            d={polylinePath(points)}
            stroke={t.colors[tone]}
            strokeWidth={STROKE}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            testID={testID ? `${testID}-line` : undefined}
          />
          {last ? (
            <Circle
              cx={last.x}
              cy={last.y}
              r={DOT_R}
              fill={t.colors[tone]}
              testID={testID ? `${testID}-latest` : undefined}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

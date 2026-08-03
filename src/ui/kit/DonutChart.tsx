import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { ChartEmpty, ChartLegend, type ChartLegendItem } from './ChartParts';
import { arcPath, donutSegments } from './chartScale';

export interface DonutDatum {
  /** Category name — carried into the legend, never color alone. */
  label: string;
  value: number;
}

export interface DonutChartProps {
  /**
   * The parts of a whole, in the order the caller wants them colored. Order is
   * the caller's job: a slot's hue follows the entity, so re-sorting by size
   * every day would repaint the same category a different color every day.
   */
  data: readonly DonutDatum[];
  /** Outer diameter. Default 140. */
  size?: number;
  /** Ring thickness. Default 22. */
  thickness?: number;
  /** Big figure in the hole — e.g. the total the shares add up to. */
  centerValue?: string;
  /** Small caption beneath the center figure. */
  centerLabel?: string;
  /** Legend beneath the ring. Default true — a ring without one is unreadable. */
  showLegend?: boolean;
  /**
   * Legend figure for each slice. Default: the share as a whole percent.
   * Receives the slice's own value and its share of the total.
   */
  formatShare?: (value: number, fraction: number) => string;
  /** Copy shown when nothing positive is left to divide. */
  emptyLabel?: string;
  testID?: string;
}

/** Surface showing between slices, so two arcs never read as one band. */
const GAP_DEG = 2;
/** Label for everything past the palette's last slot. Never a generated hue. */
const OVERFLOW_LABEL = 'Other';

/**
 * Composition — how a total divides between categories, as a ring.
 *
 * Identity is color here (a slice has no axis to name it), so the palette is
 * the theme's ordered `series` slots, assigned in fixed order and never cycled:
 * categories past the last slot fold into one muted "Other" arc rather than
 * wrapping back to slot 1 and claiming to be the first category.
 *
 * Negative values are dropped, not mirrored — a share of a whole has no
 * negative arm, and folding one in would silently overstate every other slice.
 */
export function DonutChart({
  data,
  size = 140,
  thickness = 22,
  centerValue,
  centerLabel,
  showLegend = true,
  formatShare = (_value, fraction) => `${Math.round(fraction * 100)}%`,
  emptyLabel,
  testID,
}: DonutChartProps) {
  const t = useTheme();
  const slots = t.series.length;

  // Fold the tail into one slice before any geometry, so the arcs and the
  // legend can never disagree about how many categories there are.
  const folded: DonutDatum[] =
    data.length > slots
      ? [
          ...data.slice(0, slots - 1),
          {
            label: OVERFLOW_LABEL,
            value: data.slice(slots - 1).reduce((a, d) => a + Math.max(0, d.value), 0),
          },
        ]
      : [...data];

  const segments = donutSegments(
    folded.map((d) => d.value),
    GAP_DEG,
  );

  if (segments.length === 0) {
    return <ChartEmpty label={emptyLabel} testID={testID ? `${testID}-empty` : undefined} />;
  }

  const center = size / 2;
  const outerR = center;
  const innerR = Math.max(0, center - thickness);
  const sliceColor = (index: number): string =>
    folded[index]?.label === OVERFLOW_LABEL && data.length > slots
      ? t.colors.textMuted
      : (t.series[index] ?? t.colors.textMuted);

  const legendItems: ChartLegendItem[] = segments.map((segment) => ({
    label: folded[segment.index]!.label,
    color: sliceColor(segment.index),
    value: formatShare(segment.value, segment.fraction),
  }));

  return (
    <View testID={testID}>
      <View style={{ width: size, height: size, alignSelf: 'center' }}>
        <Svg width={size} height={size}>
          {segments.map((segment) => (
            <Path
              key={segment.index}
              d={arcPath(center, center, outerR, innerR, segment.startDeg, segment.endDeg)}
              fill={sliceColor(segment.index)}
              testID={testID ? `${testID}-mark-${segment.index}` : undefined}
            />
          ))}
        </Svg>
        {centerValue !== undefined || centerLabel !== undefined ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {centerValue !== undefined ? (
              <Text style={{ ...t.typography.statValue, color: t.colors.textPrimary }}>
                {centerValue}
              </Text>
            ) : null}
            {centerLabel !== undefined ? (
              <Text style={{ ...t.typography.caption, color: t.colors.textMuted }}>
                {centerLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {showLegend ? (
        <ChartLegend items={legendItems} testID={testID ? `${testID}-legend` : undefined} />
      ) : null}
    </View>
  );
}

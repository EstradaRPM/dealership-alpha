import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import type { ProgressTone } from './ProgressBar';
import {
  ChartEmpty,
  ChartGrid,
  ChartLegend,
  useChartWidth,
  type ChartGridLine,
  type ChartLegendItem,
} from './ChartParts';
import {
  domainFraction,
  linePoints,
  polylinePath,
  signedDomain,
  signedTicks,
  type ValueDomain,
} from './chartScale';

export interface LineSeries {
  /** Series identity — the legend entry, since a line has no axis to name it. */
  label: string;
  /** Raw values, oldest→newest. Every series shares one length and one axis. */
  values: readonly number[];
  /**
   * Semantic color role. Omit to take the next categorical `series` slot.
   *
   * The kit's default is the categorical palette, because a category usually
   * means nothing but "not the one beside me". A caller passes `tone` when the
   * category genuinely carries the role's meaning — money out really is
   * `danger` — which is the same exception `BarChart` makes per datum.
   */
  tone?: ProgressTone;
}

export interface LineChartProps {
  series: readonly LineSeries[];
  /** Category labels along the time axis, one per sample. */
  labels?: readonly string[];
  /** Plot height. */
  height?: number;
  /** Axis ceiling/floor override. Default: the data's own zero-inclusive domain. */
  domain?: ValueDomain;
  /** Format for value-axis ticks. Default: the raw number. */
  formatTick?: (value: number) => string;
  /** Width of the value-axis gutter — widen for long tick text. */
  axisWidth?: number;
  /** Series legend. Default true — a line has no axis to state its identity. */
  showLegend?: boolean;
  /** Fixed plot width. Omit to measure the container (tests should pass it). */
  width?: number;
  emptyLabel?: string;
  testID?: string;
}

/** Trend stroke. Thin enough to stay a mark, thick enough to survive scaling. */
const STROKE = 2;
/** Latest-sample dot, so "where it ended" is readable without counting. */
const DOT_R = 3;
/** Rows a category label may wrap to before it truncates. */
const LABEL_LINES = 2;
/** Gap between the plot edge and the tick text in the axis gutter. */
const AXIS_PAD = 6;

/**
 * A multi-series trend over time on **one signed value axis** (issue 376).
 *
 * The distinction from `Sparkline` is the axis, and the axis is the whole
 * reason this exists: a sparkline takes pre-normalized samples and has no
 * baseline, so it cannot say whether a dip crossed zero. Charting a P&L means
 * charting a number that can go negative, and a chart that renders a loss at
 * the floor of the plot is telling the player the store broke even.
 * `signedDomain` therefore always contains zero, and the zero tick is drawn as
 * an emphasized rule so a line below it reads as below the line.
 *
 * Presentation only: the caller buckets its own window, formats the ticks, and
 * orders the series.
 */
export function LineChart({
  series,
  labels,
  height = 140,
  domain: explicitDomain,
  formatTick = (v) => String(v),
  axisWidth = 52,
  showLegend = true,
  width,
  emptyLabel,
  testID,
}: LineChartProps) {
  const t = useTheme();
  const [w, onLayout] = useChartWidth(width);

  const drawable = series.filter((s) => s.values.length > 0);
  if (drawable.length === 0) {
    return <ChartEmpty label={emptyLabel} testID={testID ? `${testID}-empty` : undefined} />;
  }

  const all = drawable.flatMap((s) => [...s.values]);
  const dataDomain = explicitDomain ?? signedDomain(all);
  const ticks = signedTicks(dataDomain);
  // The plot spans the tick ladder, not the raw extremes, so every gridline
  // lands inside the box and the zero rule sits exactly on a tick.
  const domain: ValueDomain =
    ticks.length > 1
      ? { min: ticks[0]!, max: ticks[ticks.length - 1]! }
      : dataDomain;

  const plotWidth = Math.max(0, w - axisWidth);
  const yFor = (value: number) => height - domainFraction(value, domain) * height;

  const gridLines: ChartGridLine[] = ticks.map((tick) => ({
    at: yFor(tick),
    label: formatTick(tick),
  }));

  const colorFor = (s: LineSeries, i: number) =>
    s.tone ? t.colors[s.tone] : (t.series[i] ?? t.colors.textMuted);

  const legend: ChartLegendItem[] = drawable.map((s, i) => ({
    label: s.label,
    color: colorFor(s, i),
  }));

  // Every series shares the time axis, so the label row is placed off the
  // longest one — a shorter series is a shorter line, not a different clock.
  const sampleCount = drawable.reduce((n, s) => Math.max(n, s.values.length), 0);
  const stepX = sampleCount > 1 ? (plotWidth - STROKE * 2) / (sampleCount - 1) : 0;
  const labelRow = Math.round((t.typography.caption.lineHeight ?? 14) * LABEL_LINES);

  return (
    <View testID={testID}>
      <View onLayout={onLayout}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            {/* Plot coordinates start at the origin; the tick gutter is a
                translation, so tick text can sit at negative x. */}
            <G x={axisWidth}>
              <ChartGrid
                lines={gridLines}
                orientation="vertical"
                extent={plotWidth}
                labelAt={-AXIS_PAD}
                testID={testID ? `${testID}-grid` : undefined}
              />
              {/* The zero rule, in ink rather than the recessive border role: it
                  is not a reading aid like the other gridlines, it is the line a
                  loss is below. Drawn only when the domain actually crosses it. */}
              {domain.min < 0 ? (
                <Line
                  x1={0}
                  y1={yFor(0)}
                  x2={plotWidth}
                  y2={yFor(0)}
                  stroke={t.colors.textMuted}
                  strokeWidth={STROKE / 2}
                  testID={testID ? `${testID}-zero` : undefined}
                />
              ) : null}
              {drawable.map((s, i) => {
                const points = linePoints(s.values, domain, plotWidth, height, STROKE);
                const last = points[points.length - 1];
                const color = colorFor(s, i);
                return (
                  <React.Fragment key={`${s.label}-${i}`}>
                    <Path
                      d={polylinePath(points)}
                      stroke={color}
                      strokeWidth={STROKE}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      fill="none"
                      testID={testID ? `${testID}-line-${i}` : undefined}
                    />
                    {last ? (
                      <Circle
                        cx={last.x}
                        cy={last.y}
                        r={DOT_R}
                        fill={color}
                        testID={testID ? `${testID}-latest-${i}` : undefined}
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </G>
          </Svg>
        ) : null}
      </View>
      {labels && labels.length > 0 && w > 0 ? (
        <View style={{ height: labelRow, marginTop: t.spacing.xxs }}>
          {labels.map((label, i) => (
            <Text
              key={`${label}-${i}`}
              numberOfLines={LABEL_LINES}
              style={{
                ...t.typography.caption,
                color: t.colors.textSecondary,
                position: 'absolute',
                // Centered on the vertex it names, which is why the box is
                // shifted back half a step rather than starting at it.
                left: axisWidth + STROKE + stepX * i - stepX / 2,
                width: Math.max(stepX, 1),
                textAlign: 'center',
              }}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
      {showLegend ? (
        <ChartLegend items={legend} testID={testID ? `${testID}-legend` : undefined} />
      ) : null}
    </View>
  );
}

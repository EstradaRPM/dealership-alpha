import React, { useCallback, useState } from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import { G, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';

/**
 * Shared chart sub-parts (issue 350) — the pieces `BarChart`, `DonutChart` and
 * `Sparkline` all need and must not each hand-roll: width measurement, the
 * empty state, the gridline/tick ladder, and the legend.
 *
 * Geometry constants live here as named module constants rather than theme
 * roles, the same way `GaugeArc` carries its segment dimensions: they are the
 * shape of the mark, not the skin of it. Everything a theme owns — color,
 * typography, spacing rhythm — still comes from `useTheme()`.
 */

/** Stroke weight for recessive chart furniture: gridlines and axis rules. */
const GRID_STROKE = 1;
/** Legend swatch diameter. Above the 8px marker floor so it reads as a color. */
const SWATCH = 10;

/**
 * A chart needs a pixel width before it can place a single mark, and a kit
 * primitive cannot know its own column width in advance. This measures the
 * container and re-renders once; pass `explicit` to skip measurement entirely
 * (fixed-width call sites, and tests, which get no layout pass).
 */
export function useChartWidth(explicit?: number): [number, (e: LayoutChangeEvent) => void] {
  const [measured, setMeasured] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setMeasured((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  }, []);
  return [explicit ?? measured, onLayout];
}

export interface ChartEmptyProps {
  /** Copy shown in place of the plot. Omit to render nothing at all. */
  label?: string;
  testID?: string;
}

/**
 * The no-data state every primitive shares. A chart with nothing to draw must
 * say so — a blank box is indistinguishable from a broken one.
 */
export function ChartEmpty({ label, testID }: ChartEmptyProps) {
  const t = useTheme();
  if (!label) return null;
  return (
    <Text
      testID={testID}
      style={{
        ...t.typography.caption,
        color: t.colors.textMuted,
        marginTop: t.spacing.xs,
      }}
    >
      {label}
    </Text>
  );
}

export interface ChartGridLine {
  /** Position along the value axis, in plot pixels. */
  at: number;
  /** Optional tick label. Omit for an unlabeled gridline. */
  label?: string;
}

export interface ChartGridProps {
  lines: readonly ChartGridLine[];
  /** Which axis carries the values — the gridlines run across the other one. */
  orientation: 'vertical' | 'horizontal';
  /** Length of each gridline (the category-axis extent). */
  extent: number;
  /** Where a tick label sits, in plot pixels along the gridline. */
  labelAt: number;
  testID?: string;
}

/**
 * Value gridlines with optional tick labels — an SVG fragment, so it must be
 * rendered inside a chart's `<Svg>`. Deliberately recessive: a hairline in the
 * border role and muted tick text, because the grid is a reading aid and the
 * data is the subject.
 */
export function ChartGrid({ lines, orientation, extent, labelAt, testID }: ChartGridProps) {
  const t = useTheme();
  const vertical = orientation === 'vertical';
  return (
    <G testID={testID}>
      {lines.map((line, i) => (
        <G key={i}>
          <Line
            x1={vertical ? 0 : line.at}
            y1={vertical ? line.at : 0}
            x2={vertical ? extent : line.at}
            y2={vertical ? line.at : extent}
            stroke={t.colors.border}
            strokeWidth={GRID_STROKE}
            testID={testID ? `${testID}-line-${i}` : undefined}
          />
          {line.label !== undefined ? (
            <SvgText
              x={vertical ? labelAt : line.at}
              y={vertical ? line.at : labelAt}
              fill={t.colors.textMuted}
              fontSize={t.typography.caption.fontSize}
              textAnchor={vertical ? 'end' : 'middle'}
              alignmentBaseline="middle"
            >
              {line.label}
            </SvgText>
          ) : null}
        </G>
      ))}
    </G>
  );
}

export interface ChartLegendItem {
  label: string;
  /** Resolved swatch color — the caller assigns the series slot. */
  color: string;
  /** Optional trailing figure, e.g. a share or a total. */
  value?: string;
}

export interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  testID?: string;
}

/**
 * Series identity in words next to color, never color alone — the requirement
 * that makes a chart readable to a colorblind reader and in print. The text
 * itself stays in the ink roles: a colored label on a colored swatch doubles
 * the color load and drops below contrast on the dark surface.
 */
export function ChartLegend({ items, testID }: ChartLegendProps) {
  const t = useTheme();
  if (items.length === 0) return null;
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: t.spacing.md,
        rowGap: t.spacing.xs,
        columnGap: t.spacing.lg,
      }}
    >
      {items.map((item, i) => (
        <View
          key={`${item.label}-${i}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}
          testID={testID ? `${testID}-item-${i}` : undefined}
        >
          <View
            style={{
              width: SWATCH,
              height: SWATCH,
              borderRadius: t.radius.pill,
              backgroundColor: item.color,
            }}
            testID={testID ? `${testID}-swatch-${i}` : undefined}
          />
          <Text style={{ ...t.typography.caption, color: t.colors.textSecondary }}>
            {item.label}
          </Text>
          {item.value !== undefined ? (
            <Text style={{ ...t.typography.caption, color: t.colors.textPrimary }}>
              {item.value}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';
import type { ProgressTone } from './ProgressBar';
import { ChartEmpty, ChartGrid, useChartWidth, type ChartGridLine } from './ChartParts';
import { barBands, barPath, niceTicks, type BarBand } from './chartScale';

export interface BarDatum {
  /** Category name — the identity of the bar. */
  label: string;
  value: number;
  /** Per-bar color override, for highlighting one category against the rest. */
  tone?: ProgressTone;
  /** Direct value label. Omit to leave this bar unlabeled. */
  valueLabel?: string;
}

export interface BarChartProps {
  data: readonly BarDatum[];
  /** Color role for every bar without its own `tone`. Default `primary`. */
  tone?: ProgressTone;
  /**
   * `vertical` = columns with labels beneath (short labels, few categories).
   * `horizontal` = rows with a label gutter (long labels, or many categories).
   */
  orientation?: 'vertical' | 'horizontal';
  /** Plot height. Vertical only — a horizontal chart's height follows its rows. */
  height?: number;
  /** Row thickness. Horizontal only. */
  barThickness?: number;
  /** Axis ceiling. Default: the data max rounded up to a round tick. */
  max?: number;
  /** Gridlines behind the bars. Default true. */
  showGrid?: boolean;
  /** Numbers on the value axis. Default false — prefer direct value labels. */
  showValueAxis?: boolean;
  /** Format for value-axis ticks. Default: the raw number. */
  formatTick?: (value: number) => string;
  /** Width of the value-axis gutter (vertical) — widen for long tick text. */
  axisWidth?: number;
  /** Width of the category-label gutter (horizontal). */
  labelWidth?: number;
  /** Fixed plot width. Omit to measure the container (tests should pass it). */
  width?: number;
  emptyLabel?: string;
  testID?: string;
}

/** Surface showing between two fills, so adjacent bars never read as one shape. */
const BAR_GAP = 4;
/** A bar is a mark, not a panel — past this it stops reading as a thin mark. */
const MAX_THICKNESS = 44;
/** Rounded data-end; the baseline end stays square so the bar reads anchored. */
const BAR_RADIUS = 4;
/** Rows the category label may wrap to before it truncates. */
const LABEL_LINES = 2;
/** Gap between a bar's end and its direct value label. */
const VALUE_PAD = 6;
/** Right-hand column reserved for horizontal value labels when any are present. */
const VALUE_COLUMN = 56;

/**
 * Categorical comparison — one bar per category, all on one shared value axis.
 *
 * Bars carry a single hue by default rather than one hue per category: the
 * category axis already states identity, so coloring by category doubles the
 * encoding and burns the palette on nothing. `tone` per datum is the exception
 * that earns its color — the one bar the surface is making a point about.
 *
 * Presentation only: the caller formats every label, picks the ceiling if the
 * data's own max is the wrong one, and orders the series.
 */
export function BarChart({
  data,
  tone = 'primary',
  orientation = 'vertical',
  height = 120,
  barThickness = 18,
  max,
  showGrid = true,
  showValueAxis = false,
  formatTick = (v) => String(v),
  axisWidth = 44,
  labelWidth = 88,
  width,
  emptyLabel,
  testID,
}: BarChartProps) {
  const t = useTheme();
  const [w, onLayout] = useChartWidth(width);
  const vertical = orientation === 'vertical';

  const values = data.map((d) => (Number.isFinite(d.value) ? Math.max(0, d.value) : 0));
  const dataMax = values.reduce((a, b) => Math.max(a, b), 0);
  const ticks = niceTicks(max ?? dataMax);
  const ceiling = max ?? ticks[ticks.length - 1] ?? 0;

  if (data.length === 0) {
    return <ChartEmpty label={emptyLabel} testID={testID ? `${testID}-empty` : undefined} />;
  }

  // The category axis is horizontal for columns and vertical for rows, so the
  // measured width feeds different halves of the layout in each orientation.
  const gutter = vertical ? (showValueAxis ? axisWidth : 0) : labelWidth;
  const hasValueLabels = data.some((d) => d.valueLabel !== undefined);
  const valueColumn = !vertical && hasValueLabels ? VALUE_COLUMN : 0;
  const plotWidth = Math.max(0, w - gutter - valueColumn);
  const categoryExtent = vertical
    ? plotWidth
    : data.length * barThickness + (data.length - 1) * BAR_GAP;
  const plotHeight = vertical ? height : categoryExtent;
  const valueExtent = vertical ? plotHeight : plotWidth;

  const bands = centeredBands(data.length, categoryExtent, BAR_GAP, vertical);
  const scale = (v: number) => (ceiling > 0 ? (v / ceiling) * valueExtent : 0);

  const gridLines: ChartGridLine[] = showGrid
    ? ticks.map((tick) => ({
        // Vertical charts grow upward from the bottom, so a tick's pixel
        // position is measured back from the baseline; horizontal ones grow
        // rightward from the origin and read straight across.
        at: vertical ? plotHeight - scale(tick) : scale(tick),
        label: showValueAxis ? formatTick(tick) : undefined,
      }))
    : [];

  const labelRow = Math.round((t.typography.caption.lineHeight ?? 14) * LABEL_LINES);
  const tickRow = showValueAxis && !vertical ? labelRow : 0;
  const svgHeight = plotHeight + tickRow;

  return (
    <View onLayout={onLayout} testID={testID}>
      {w > 0 ? (
        <Svg width={w} height={svgHeight}>
          {/* Plot coordinates start at the origin; the gutter that holds tick
              or category text is a translation, so every mark below can be
              placed in plot space and labels can sit at negative x. */}
          <G x={gutter}>
          <ChartGrid
            lines={gridLines}
            orientation={orientation}
            extent={vertical ? plotWidth : plotHeight}
            labelAt={vertical ? -VALUE_PAD : plotHeight + VALUE_PAD}
            testID={testID ? `${testID}-grid` : undefined}
          />
          {data.map((datum, i) => {
            const band = bands[i]!;
            const reach = scale(values[i]!);
            const from = vertical ? plotHeight : 0;
            const to = vertical ? plotHeight - reach : reach;
            return (
              <React.Fragment key={`${datum.label}-${i}`}>
                <Path
                  d={barPath(band, from, to, BAR_RADIUS, orientation)}
                  fill={t.colors[datum.tone ?? tone]}
                  testID={testID ? `${testID}-mark-${i}` : undefined}
                />
                {datum.valueLabel !== undefined ? (
                  <SvgText
                    x={vertical ? band.offset + band.thickness / 2 : plotWidth + VALUE_PAD}
                    y={vertical ? to - VALUE_PAD : band.offset + band.thickness / 2}
                    fill={t.colors.textPrimary}
                    fontSize={t.typography.caption.fontSize}
                    textAnchor={vertical ? 'middle' : 'start'}
                    alignmentBaseline="middle"
                  >
                    {datum.valueLabel}
                  </SvgText>
                ) : null}
                {!vertical ? (
                  <SvgText
                    x={-VALUE_PAD}
                    y={band.offset + band.thickness / 2}
                    fill={t.colors.textSecondary}
                    fontSize={t.typography.caption.fontSize}
                    textAnchor="end"
                    alignmentBaseline="middle"
                  >
                    {datum.label}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
          </G>
        </Svg>
      ) : null}
      {vertical && w > 0 ? (
        <View style={{ height: labelRow, marginTop: t.spacing.xxs }}>
          {data.map((datum, i) => (
            <Text
              key={`${datum.label}-${i}`}
              numberOfLines={LABEL_LINES}
              style={{
                ...t.typography.caption,
                color: t.colors.textSecondary,
                position: 'absolute',
                left: gutter + bands[i]!.offset,
                width: bands[i]!.thickness,
                textAlign: 'center',
              }}
            >
              {datum.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Bands, thinned and re-centered when the plot is wide enough that even spacing
 * would inflate three categories into three panels. Thickness is capped, then
 * the whole group is centered in what is left over.
 */
function centeredBands(
  count: number,
  extent: number,
  gap: number,
  center: boolean,
): BarBand[] {
  const bands = barBands(count, extent, gap);
  const first = bands[0];
  if (!center || !first || first.thickness <= MAX_THICKNESS) return bands;
  const used = count * MAX_THICKNESS + (count - 1) * gap;
  const shift = (extent - used) / 2;
  return Array.from({ length: count }, (_, i) => ({
    offset: shift + i * (MAX_THICKNESS + gap),
    thickness: MAX_THICKNESS,
  }));
}

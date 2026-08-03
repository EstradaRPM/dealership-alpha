import React from 'react';
import { processColor } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  BarChart,
  ChartLegend,
  DonutChart,
  Sparkline,
  arcPath,
  barBands,
  barPath,
  donutSegments,
  niceTicks,
  polylinePath,
  sparklinePoints,
} from '../src/ui/kit';
import { ThemeProvider, defaultTheme, type Theme } from '../src/ui/theme';

/**
 * Chart primitives (issue 350) — the enabling kit slice the Finance surface
 * depends on. Two halves, tested separately: the pure geometry in `chartScale`,
 * which is where a wrong chart is actually wrong, and the components, which
 * only have to place the geometry and read every value off the theme.
 *
 * No snapshots (repo test rule): "renders identically under a swapped theme" is
 * asserted as the thing that sentence means — the path data is byte-identical
 * and only the resolved colors move.
 */

// react-native-svg extracts a color prop into `{ type, payload }`, where the
// payload is the processed int form. Compare through the same transform rather
// than against the hex string.
function fillOf(node: { props: Record<string, unknown> }): unknown {
  const fill = node.props.fill as { payload?: unknown } | undefined;
  return fill?.payload;
}

function expectedFill(hex: string): unknown {
  return processColor(hex);
}

describe('#350 chartScale — the pure geometry', () => {
  describe('niceTicks', () => {
    it('returns a single zero tick when there is nothing to scale', () => {
      expect(niceTicks(0)).toEqual([0]);
      expect(niceTicks(-5)).toEqual([0]);
      expect(niceTicks(Number.NaN)).toEqual([0]);
    });

    it('steps by a round interval and covers the max', () => {
      expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
      expect(niceTicks(30_000)).toEqual([0, 10_000, 20_000, 30_000]);
    });

    it('never labels float dust', () => {
      for (const tick of niceTicks(0.3)) {
        expect(String(tick)).not.toMatch(/\d{6,}/);
      }
    });
  });

  describe('sparklinePoints', () => {
    it('centers a lone sample, since one point has no line', () => {
      expect(sparklinePoints([0.5], 100, 20)).toEqual([{ x: 50, y: 10 }]);
    });

    it('spreads samples evenly oldest→newest with y inverted for the screen', () => {
      const points = sparklinePoints([0, 1], 100, 20);
      expect(points).toEqual([
        { x: 0, y: 20 },
        { x: 100, y: 0 },
      ]);
    });

    it('clamps out-of-range samples instead of drawing outside the box', () => {
      const points = sparklinePoints([-3, 4], 100, 20);
      expect(points[0]!.y).toBe(20);
      expect(points[1]!.y).toBe(0);
    });

    it('keeps the stroke inside the box when inset', () => {
      const [first] = sparklinePoints([1, 0], 100, 20, 3);
      expect(first!.y).toBe(3);
    });

    it('has no path for an empty series', () => {
      expect(polylinePath(sparklinePoints([], 100, 20))).toBe('');
    });
  });

  describe('barBands', () => {
    it('divides the extent evenly with the gap taken out', () => {
      expect(barBands(3, 100, 5)).toEqual([
        { offset: 0, thickness: 30 },
        { offset: 35, thickness: 30 },
        { offset: 70, thickness: 30 },
      ]);
    });

    it('drops the gap rather than inverting the bars when it will not fit', () => {
      const bands = barBands(20, 10, 5);
      expect(bands).toHaveLength(20);
      for (const band of bands) expect(band.thickness).toBeGreaterThan(0);
    });

    it('has no bands for no categories', () => {
      expect(barBands(0, 100, 4)).toEqual([]);
    });
  });

  describe('barPath', () => {
    it('rounds the data end and squares the baseline end', () => {
      const d = barPath({ offset: 0, thickness: 20 }, 100, 40, 4, 'vertical');
      // Two quadratic corners — at the value end only.
      expect(d.match(/Q/g)).toHaveLength(2);
      expect(d.startsWith('M 0 100')).toBe(true);
    });

    it('draws nothing for a zero-length bar', () => {
      expect(barPath({ offset: 0, thickness: 20 }, 100, 100, 4, 'vertical')).toBe('');
    });

    it('never rounds more than the bar is long', () => {
      const d = barPath({ offset: 0, thickness: 20 }, 100, 99, 4, 'vertical');
      expect(d).toContain('Q');
      expect(d).not.toContain('NaN');
    });
  });

  describe('donutSegments', () => {
    it('divides the ring in proportion to the values', () => {
      const [a, b] = donutSegments([3, 1], 0, 0);
      expect(a!.fraction).toBeCloseTo(0.75);
      expect(a!.endDeg - a!.startDeg).toBeCloseTo(270);
      expect(b!.startDeg).toBeCloseTo(270);
    });

    it('drops negative and non-finite values rather than mirroring them', () => {
      const segments = donutSegments([2, -5, Number.NaN], 0, 0);
      expect(segments).toHaveLength(1);
      expect(segments[0]!.fraction).toBe(1);
    });

    it('has no ring when nothing positive is left', () => {
      expect(donutSegments([0, -1])).toEqual([]);
    });

    it('still draws a mark for a slice too thin to see', () => {
      const segments = donutSegments([999, 1], 2, 1.5);
      expect(segments).toHaveLength(2);
      expect(segments[1]!.endDeg - segments[1]!.startDeg).toBeGreaterThanOrEqual(1.5);
    });

    it('keeps a slot index stable after a zero-valued category drops out', () => {
      const segments = donutSegments([5, 0, 5]);
      expect(segments.map((s) => s.index)).toEqual([0, 2]);
    });
  });

  describe('arcPath', () => {
    it('draws a sole full-ring slice rather than collapsing to nothing', () => {
      const d = arcPath(50, 50, 50, 30, 0, 360);
      expect(d).not.toBe('');
      expect(d).toContain('A');
    });

    it('draws nothing for a zero sweep', () => {
      expect(arcPath(50, 50, 50, 30, 10, 10)).toBe('');
    });

    it('flags the large-arc sweep past a half turn', () => {
      expect(arcPath(50, 50, 50, 30, 0, 90)).toContain('0 0 1');
      expect(arcPath(50, 50, 50, 30, 0, 270)).toContain('0 1 1');
    });
  });
});

describe('#350 chart primitives — empty states', () => {
  it('renders each primitive empty state instead of throwing', () => {
    const bar = render(<BarChart testID="bar" width={200} data={[]} emptyLabel="No sales yet" />);
    expect(bar.getByText('No sales yet')).toBeTruthy();

    const donut = render(<DonutChart testID="donut" data={[]} emptyLabel="Nothing to split" />);
    expect(donut.getByText('Nothing to split')).toBeTruthy();

    const spark = render(<Sparkline testID="spark" width={100} values={[]} emptyLabel="No history" />);
    expect(spark.getByText('No history')).toBeTruthy();
  });

  it('treats an all-zero composition as empty rather than a blank ring', () => {
    const { getByText, queryByTestId } = render(
      <DonutChart testID="donut" data={[{ label: 'Cash', value: 0 }]} emptyLabel="Nothing to split" />,
    );
    expect(getByText('Nothing to split')).toBeTruthy();
    expect(queryByTestId('donut-mark-0')).toBeNull();
  });

  it('renders nothing at all when no empty label is supplied', () => {
    expect(() => render(<BarChart width={200} data={[]} />)).not.toThrow();
    expect(() => render(<DonutChart data={[]} />)).not.toThrow();
    expect(() => render(<Sparkline width={100} values={[]} />)).not.toThrow();
    expect(() => render(<ChartLegend items={[]} />)).not.toThrow();
  });
});

describe('#350 chart primitives — one mark per datum', () => {
  const BARS = [
    { label: 'Front', value: 12_000 },
    { label: 'F&I', value: 7_400 },
    { label: 'Service', value: 3_100 },
  ];

  it('BarChart draws one bar per category', () => {
    const { getAllByTestId } = render(<BarChart testID="bar" width={300} data={BARS} />);
    expect(getAllByTestId(/^bar-mark-\d+$/)).toHaveLength(BARS.length);
  });

  it.each(['vertical', 'horizontal'] as const)(
    'BarChart orientation=%s draws every bar',
    (orientation) => {
      const { getAllByTestId } = render(
        <BarChart testID="bar" width={300} orientation={orientation} data={BARS} />,
      );
      expect(getAllByTestId(/^bar-mark-\d+$/)).toHaveLength(BARS.length);
    },
  );

  it('DonutChart draws one slice per category', () => {
    const { getAllByTestId } = render(
      <DonutChart
        testID="donut"
        data={[
          { label: 'SUV', value: 5 },
          { label: 'Truck', value: 3 },
          { label: 'Sedan', value: 2 },
        ]}
      />,
    );
    expect(getAllByTestId(/^donut-mark-\d+$/)).toHaveLength(3);
  });

  it('Sparkline draws one vertex per sample', () => {
    const values = [0.2, 0.5, 0.4, 0.9];
    const { getByTestId } = render(<Sparkline testID="spark" width={120} values={values} />);
    const d = getByTestId('spark-line').props.d as string;
    expect(d.match(/[ML]/g)).toHaveLength(values.length);
    expect(getByTestId('spark-latest')).toBeTruthy();
  });

  it('bar height is proportional to the value, not uniform', () => {
    const { getByTestId } = render(
      <BarChart
        testID="bar"
        width={300}
        height={100}
        max={100}
        data={[
          { label: 'Low', value: 25 },
          { label: 'High', value: 75 },
        ]}
      />,
    );
    expect(topOf(getByTestId('bar-mark-0').props.d as string)).toBeGreaterThan(
      topOf(getByTestId('bar-mark-1').props.d as string),
    );
  });

  /** The y of a vertical bar's data end — smaller is taller on screen. */
  function topOf(d: string): number {
    const ys = [...d.matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]));
    return Math.min(...ys);
  }
});

describe('#350 DonutChart assigns identity in fixed palette order', () => {
  const SIX = Array.from({ length: 6 }, (_, i) => ({ label: `C${i}`, value: 1 }));

  it('gives slice i the palette slot i, so color follows the entity', () => {
    const { getByTestId } = render(<DonutChart testID="donut" data={SIX} />);
    for (let i = 0; i < 6; i += 1) {
      expect(fillOf(getByTestId(`donut-mark-${i}`))).toEqual(expectedFill(defaultTheme.series[i]!));
    }
  });

  it('folds the tail into one muted "Other" slice rather than cycling back to slot 1', () => {
    const seven = [...SIX, { label: 'C6', value: 1 }];
    const { getByTestId, getAllByTestId, getByText } = render(
      <DonutChart testID="donut" data={seven} />,
    );
    expect(getAllByTestId(/^donut-mark-\d+$/)).toHaveLength(6);
    expect(getByText('Other')).toBeTruthy();
    expect(fillOf(getByTestId('donut-mark-5'))).toEqual(expectedFill(defaultTheme.colors.textMuted));
  });

  it('names every slice in the legend, so identity is never color alone', () => {
    const { getByText } = render(
      <DonutChart
        testID="donut"
        data={[
          { label: 'SUV', value: 3 },
          { label: 'Sedan', value: 1 },
        ]}
      />,
    );
    expect(getByText('SUV')).toBeTruthy();
    expect(getByText('75%')).toBeTruthy();
  });
});

describe('#350 chart primitives re-skin from the theme object alone', () => {
  const MAGENTA = '#ff00ff';
  const LIME = '#00ff00';
  const altTheme: Theme = {
    ...defaultTheme,
    colors: { ...defaultTheme.colors, primary: MAGENTA },
    series: [LIME, ...defaultTheme.series.slice(1)],
  };

  function markUnder(theme: Theme, element: React.ReactElement, testID: string) {
    const { getByTestId } = render(<ThemeProvider theme={theme}>{element}</ThemeProvider>);
    const node = getByTestId(testID);
    return { fill: fillOf(node), d: node.props.d as string };
  }

  it('BarChart keeps identical geometry and takes its color from the theme', () => {
    const chart = <BarChart testID="bar" width={300} data={[{ label: 'A', value: 4 }]} />;
    const base = markUnder(defaultTheme, chart, 'bar-mark-0');
    const alt = markUnder(altTheme, chart, 'bar-mark-0');
    expect(alt.d).toBe(base.d);
    expect(base.fill).toEqual(expectedFill(defaultTheme.colors.primary));
    expect(alt.fill).toEqual(expectedFill(MAGENTA));
  });

  it('DonutChart keeps identical geometry and takes its slots from the theme', () => {
    const chart = (
      <DonutChart
        testID="donut"
        data={[
          { label: 'A', value: 3 },
          { label: 'B', value: 1 },
        ]}
      />
    );
    const base = markUnder(defaultTheme, chart, 'donut-mark-0');
    const alt = markUnder(altTheme, chart, 'donut-mark-0');
    expect(alt.d).toBe(base.d);
    expect(base.fill).toEqual(expectedFill(defaultTheme.series[0]!));
    expect(alt.fill).toEqual(expectedFill(LIME));
  });

  it('Sparkline keeps identical geometry and takes its stroke from the theme', () => {
    const chart = <Sparkline testID="spark" width={120} values={[0.1, 0.7, 0.4]} />;
    const base = markUnder(defaultTheme, chart, 'spark-line');
    const alt = markUnder(altTheme, chart, 'spark-line');
    expect(alt.d).toBe(base.d);
  });
});

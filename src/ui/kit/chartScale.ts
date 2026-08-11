/**
 * Chart geometry — the pure half of the chart primitives (issue 350).
 *
 * Every number a `Sparkline`, `BarChart` or `DonutChart` draws is computed here,
 * with no React and no theme: scales, tick ladders, bar bands, ring segments and
 * the SVG path strings themselves. Keeping it separate is what makes the shapes
 * testable without rendering — a wrong arc is an assertion on a `d` string, not
 * a screenshot — and lets a future animated or canvas-backed implementation
 * reuse the same math behind the same component props.
 *
 * Angles are degrees clockwise from 12 o'clock. Screen coordinates: y grows
 * downward, so a taller bar has a *smaller* y.
 */

/** Clamp to the unit interval. Non-finite input reads as 0, never NaN geometry. */
export function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** Trim float dust off a computed tick so `0.1 + 0.2` labels as `0.3`. */
function tidy(v: number): number {
  return Number.parseFloat(v.toFixed(10));
}

/**
 * A "nice" ascending tick ladder from 0 through at least `max`, stepping by a
 * 1/2/2.5/5/10 x 10^k interval. `count` is the *target* number of intervals; the
 * ladder may land one over or under it, because a round step matters more than
 * an exact count — "$0 / $5k / $10k / $15k" reads, "$0 / $4.7k / $9.4k" does not.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0 || count < 1) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) *
    magnitude;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let i = 0; tidy(step * i) <= tidy(top); i += 1) out.push(tidy(step * i));
  return out;
}

export interface ValueDomain {
  min: number;
  max: number;
}

/**
 * The value domain a signed series is plotted in — the data's own extremes,
 * **always widened to include zero**.
 *
 * That inclusion is the whole point. A domain of the data alone would put the
 * plot floor at the smallest sample, so a window whose every bucket lost money
 * would draw its least-bad week sitting on the baseline and read as break-even.
 * With zero inside the domain the baseline is a real position on the axis and a
 * loss renders *below the line*, which is the only honest way to chart a number
 * that can go negative (issue 376).
 */
export function signedDomain(values: readonly number[]): ValueDomain {
  let min = 0;
  let max = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/**
 * A "nice" tick ladder spanning a domain that may cross zero, stepping by the
 * same 1/2/2.5/5/10 x 10^k interval `niceTicks` uses. The ends are rounded
 * outward to a whole step, so a domain containing zero always lands a tick
 * exactly on it — the baseline is a gridline, never an interpolated position.
 *
 * A degenerate (zero-span) domain has one tick at zero; the caller draws its
 * flat line against that.
 */
export function signedTicks(domain: ValueDomain, count = 4): number[] {
  const span = domain.max - domain.min;
  if (!Number.isFinite(span) || span <= 0 || count < 1) return [0];
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) *
    magnitude;
  const lo = Math.floor(domain.min / step) * step;
  const steps = Math.round((Math.ceil(domain.max / step) * step - lo) / step);
  // Indexed rather than accumulated: adding `step` in a loop drifts, and a tick
  // ladder that misses zero by float dust stops being a baseline.
  return Array.from({ length: steps + 1 }, (_, i) => tidy(lo + step * i));
}

/**
 * Where a value sits in a domain, 0 at the bottom and 1 at the top. A
 * zero-span domain reads as the middle, so a flat all-zero series draws on its
 * own baseline rather than at an edge.
 */
export function domainFraction(value: number, domain: ValueDomain): number {
  const span = domain.max - domain.min;
  if (!Number.isFinite(span) || span <= 0) return 0.5;
  return clamp01((value - domain.min) / span);
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Vertices for a trend line across `width` x `height`, oldest→newest, from
 * samples already normalized to [0,1]. `inset` keeps the stroke's own width
 * inside the box so a 0 or a 1 sample isn't clipped in half by the edge.
 *
 * A single sample has no line to draw, so it lands centered — the dot the
 * caller paints on the last vertex still marks it.
 */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  inset = 0,
): Point[] {
  if (values.length === 0) return [];
  const top = inset;
  const usableH = Math.max(0, height - inset * 2);
  const usableW = Math.max(0, width - inset * 2);
  if (values.length === 1) {
    return [{ x: width / 2, y: top + (1 - clamp01(values[0]!)) * usableH }];
  }
  const stepX = usableW / (values.length - 1);
  return values.map((v, i) => ({
    x: inset + stepX * i,
    y: top + (1 - clamp01(v)) * usableH,
  }));
}

/**
 * Vertices for a trend line over **raw** values placed in an explicit domain —
 * the axis-bearing sibling of `sparklinePoints`, which takes pre-normalized
 * samples because an inline mark has no axis to normalize against.
 *
 * One shared placement routine on purpose: a chart and the sparkline beside it
 * that computed their vertices differently would disagree about the same
 * window, and the disagreement would be invisible.
 */
export function linePoints(
  values: readonly number[],
  domain: ValueDomain,
  width: number,
  height: number,
  inset = 0,
): Point[] {
  return sparklinePoints(
    values.map((v) => domainFraction(v, domain)),
    width,
    height,
    inset,
  );
}

/** `M x y L x y ...` for a vertex list. Empty list ⇒ empty string, never `M`. */
export function polylinePath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ');
}

/**
 * The trend line closed down to the baseline and back — the translucent area
 * under a sparkline. Needs at least two vertices; one point has no area.
 */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length < 2) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${polylinePath(points)} L ${round(last.x)} ${round(baselineY)} L ${round(first.x)} ${round(
    baselineY,
  )} Z`;
}

export interface BarBand {
  /** Leading edge along the category axis. */
  offset: number;
  /** Thickness along the category axis. */
  thickness: number;
}

/**
 * Even bands across `extent` for `count` categories separated by `gap`. The gap
 * is the 2px-of-surface separator that keeps two adjacent fills from reading as
 * one shape; it is clamped so a dense series still yields a positive thickness
 * rather than an inverted rect.
 */
export function barBands(count: number, extent: number, gap: number): BarBand[] {
  if (count <= 0 || extent <= 0) return [];
  const totalGap = gap * (count - 1);
  const usable = totalGap < extent ? extent - totalGap : extent;
  const appliedGap = totalGap < extent ? gap : 0;
  const thickness = usable / count;
  return Array.from({ length: count }, (_, i) => ({
    offset: i * (thickness + appliedGap),
    thickness,
  }));
}

/**
 * A bar with rounded data-end corners and square baseline corners — the end that
 * carries the value is the end that gets the radius, so the mark still reads as
 * anchored to its axis. `from` is the baseline coordinate, `to` the value
 * coordinate, along whichever axis the bar grows.
 */
export function barPath(
  band: BarBand,
  from: number,
  to: number,
  radius: number,
  orientation: 'vertical' | 'horizontal',
): string {
  const length = Math.abs(to - from);
  if (length <= 0) return '';
  const r = Math.max(0, Math.min(radius, band.thickness / 2, length));
  const a = band.offset;
  const b = band.offset + band.thickness;
  // `dir` is +1 when the value coordinate is greater than the baseline (a
  // downward/rightward bar) and -1 otherwise, so one formula covers both signs.
  const dir = Math.sign(to - from) || 1;
  const cap = to - r * dir;
  if (orientation === 'vertical') {
    return [
      `M ${round(a)} ${round(from)}`,
      `L ${round(a)} ${round(cap)}`,
      `Q ${round(a)} ${round(to)} ${round(a + r)} ${round(to)}`,
      `L ${round(b - r)} ${round(to)}`,
      `Q ${round(b)} ${round(to)} ${round(b)} ${round(cap)}`,
      `L ${round(b)} ${round(from)}`,
      'Z',
    ].join(' ');
  }
  return [
    `M ${round(from)} ${round(a)}`,
    `L ${round(cap)} ${round(a)}`,
    `Q ${round(to)} ${round(a)} ${round(to)} ${round(a + r)}`,
    `L ${round(to)} ${round(b - r)}`,
    `Q ${round(to)} ${round(b)} ${round(cap)} ${round(b)}`,
    `L ${round(from)} ${round(b)}`,
    'Z',
  ].join(' ');
}

export interface DonutSegment {
  /** Index into the input series — the slot a color is assigned from. */
  index: number;
  value: number;
  /** Share of the positive total, [0,1]. */
  fraction: number;
  startDeg: number;
  endDeg: number;
}

/**
 * Ring segments for a composition series, clockwise from 12 o'clock.
 *
 * Negative and non-finite values are dropped rather than mirrored — a share of
 * a whole has no negative arm, and silently rendering `abs(v)` would overstate
 * the total. If nothing positive is left there is no ring, and the caller shows
 * its empty state.
 *
 * `gapDeg` is split across each boundary, and a slice is never thinner than
 * `minSpanDeg`: a 0.3% slice must still draw a mark, because an invisible slice
 * reads as a missing category rather than a tiny one.
 */
export function donutSegments(
  values: readonly number[],
  gapDeg = 2,
  minSpanDeg = 1.5,
): DonutSegment[] {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const drawn = safe.filter((v) => v > 0).length;
  const gap = drawn > 1 ? gapDeg : 0;
  const out: DonutSegment[] = [];
  let cursor = 0;
  safe.forEach((v, index) => {
    const fraction = v / total;
    const span = fraction * 360;
    if (v <= 0) return;
    const inner = Math.max(minSpanDeg, span - gap);
    out.push({
      index,
      value: v,
      fraction,
      startDeg: cursor + (span - inner) / 2,
      endDeg: cursor + (span - inner) / 2 + inner,
    });
    cursor += span;
  });
  return out;
}

function polar(cx: number, cy: number, r: number, deg: number): Point {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * One ring segment as a closed path: outer arc out, inner arc back.
 *
 * A sweep of a full turn is clamped a hair below 360 because an SVG arc whose
 * endpoints coincide draws nothing at all — the sole-category ring would vanish
 * entirely. The residual hairline is well under a pixel at any size we render.
 */
export function arcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = Math.min(359.99, endDeg - startDeg);
  if (sweep <= 0 || outerR <= 0) return '';
  const end = startDeg + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, outerR, startDeg);
  const o2 = polar(cx, cy, outerR, end);
  const i2 = polar(cx, cy, innerR, end);
  const i1 = polar(cx, cy, innerR, startDeg);
  return [
    `M ${round(o1.x)} ${round(o1.y)}`,
    `A ${round(outerR)} ${round(outerR)} 0 ${large} 1 ${round(o2.x)} ${round(o2.y)}`,
    `L ${round(i2.x)} ${round(i2.y)}`,
    `A ${round(innerR)} ${round(innerR)} 0 ${large} 0 ${round(i1.x)} ${round(i1.y)}`,
    'Z',
  ].join(' ');
}

/** Sub-pixel precision is enough for a path string, and keeps `d` readable. */
function round(v: number): number {
  return Math.round(v * 100) / 100;
}

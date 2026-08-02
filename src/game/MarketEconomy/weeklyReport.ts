import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../Rng';
import { loadTunables, type Tunables } from '../data';
import { wholePercent } from './news';
import {
  loadNewsTemplatesConfig,
  type NewsReliability,
  type NewsTemplatesConfig,
  type WeeklyCallKind,
  type WeeklySummaryShape,
} from './schemas';
import type { SegmentHeatBySegmentFn } from './segmentHeat';
import type { ShockPreview } from './shocks';

/**
 * Weekly market report — the trade pub's longer-form column (slice #177,
 * parent #150).
 *
 * The daily wire is a ticker: one line per thing that happened, gone in a
 * scroll. The column is the other half of a news surface — it stops, adds up
 * the week the player just lived through, and puts a name on what the desk
 * thinks happens next. It is deliberately **not** a headline: it never spends
 * the wire's daily budget, never enters the ring buffer, and stands on the Home
 * screen as a card until the next one replaces it.
 *
 * **What it aggregates.** Three things, each already true in the engine:
 * - the week's *heat move* per segment, measured against a baseline the report
 *   itself captured when the week opened (so the number is the week, not the
 *   career);
 * - *how loud the wire was* about each segment — a tally of the headlines
 *   published this week, by trust tier, and per-segment mention counts;
 * - the desk's *forward calls* for the coming week.
 *
 * **Forward calls are deterministic from current state, and fallible.** A
 * `shock` call reads the scheduler's future arrival rolls across
 * `lookaheadDays` — the same pure lookahead the daily rumor uses — and is made
 * only `callHitProb` of the time, so a real setup can pass unremarked. A
 * `drift` call is plain momentum extrapolation off the week's own move: honest
 * about its basis, and wrong exactly as often as momentum is. Neither is ever
 * dressed as fact; both carry the `leading` trust tier the player already
 * learned from the wire.
 *
 * **Cadence.** The report publishes inside the ordinary day tick, on the
 * configured `publishDayOfWeek`, after the wire has had its say. It rides the
 * module's ONE `clock:day_started` subscription rather than adding a second one
 * — the ordering stays a property of the module (#176).
 */
export interface WeeklySegmentMove {
  readonly segment: string;
  readonly label: string;
  readonly startHeat: number;
  readonly endHeat: number;
  /** `endHeat − startHeat` — the week's move, signed. */
  readonly delta: number;
  /** How many wire headlines named this segment during the week. */
  readonly mentions: number;
}

export interface WeeklyForwardCall {
  readonly kind: WeeklyCallKind;
  readonly segment: string;
  readonly segmentLabel: string;
  readonly direction: 'up' | 'down';
  /** Why the desk is saying it — a read of what's coming, or momentum. */
  readonly basis: 'shock' | 'drift';
  readonly text: string;
}

export interface WeeklyWireTally {
  readonly total: number;
  readonly direct: number;
  readonly leading: number;
  readonly lagging: number;
}

/**
 * One published column. Carries only what was *derived* at publish time — the
 * article is frozen, but static chrome (headings, the tally sentence, the
 * subtitle) is filled at render from the live catalog, so a copy retune reaches
 * the standing card instead of being frozen into the save.
 */
export interface WeeklyMarketReport {
  readonly day: number;
  /** 1-based: the first column a career publishes is week 1. */
  readonly weekIndex: number;
  readonly fromDay: number;
  readonly toDay: number;
  readonly source: string;
  readonly sourceLabel: string;
  readonly shape: WeeklySummaryShape;
  readonly summary: string;
  /** Every watched segment, biggest absolute move first. */
  readonly moves: readonly WeeklySegmentMove[];
  readonly forwardCalls: readonly WeeklyForwardCall[];
  readonly wireTally: WeeklyWireTally;
}

export interface WeeklyReportSnapshot {
  readonly schemaVersion: 1;
  /** The standing card. Null until the first column publishes. */
  readonly active: WeeklyMarketReport | null;
  readonly weekIndex: number;
  /** Day the current (unpublished) week opened. Null before the first tick. */
  readonly weekStartDay: number | null;
  /** Per-segment heat when the current week opened. */
  readonly baseline: Readonly<Record<string, number>> | null;
  readonly mentions: Readonly<Record<string, number>>;
  readonly tally: WeeklyWireTally;
}

const EMPTY_TALLY: WeeklyWireTally = { total: 0, direct: 0, leading: 0, lagging: 0 };

export function createDefaultWeeklyReportSnapshot(): WeeklyReportSnapshot {
  return {
    schemaVersion: 1,
    active: null,
    weekIndex: 0,
    weekStartDay: null,
    baseline: null,
    mentions: {},
    tally: EMPTY_TALLY,
  };
}

export interface WeeklyReport {
  /** Called from the module's day tick, after the wire's own step. */
  step(day: number): void;
  /** The standing column, or null before the first one publishes. */
  getActive(): WeeklyMarketReport | null;
  snapshot(): WeeklyReportSnapshot;
  restore(snap: WeeklyReportSnapshot): void;
  dispose(): void;
}

export interface WeeklyReportDeps {
  readonly masterSeed: number;
  readonly bus: EventBus;
  readonly segments: readonly string[];
  readonly heatFor: SegmentHeatBySegmentFn;
  /** Same pure lookahead the daily rumor reads. Omit to run drift calls only. */
  readonly previewShock?: (day: number) => ShockPreview | null;
  readonly catalog?: NewsTemplatesConfig;
  readonly tunables?: Tunables;
}

/** Day-of-week on GameClock's axis: 0 = Monday … 6 = Sunday. */
const DAYS_PER_WEEK = 7;
function dayOfWeek(day: number): number {
  return (day - 1) % DAYS_PER_WEEK;
}

function dominantSegment(
  magnitudes: Readonly<Record<string, number>>,
): { segment: string; magnitude: number } | null {
  let best: { segment: string; magnitude: number } | null = null;
  for (const [segment, magnitude] of Object.entries(magnitudes)) {
    if (!best || Math.abs(magnitude) > Math.abs(best.magnitude)) {
      best = { segment, magnitude };
    }
  }
  return best;
}

export function createWeeklyReport(deps: WeeklyReportDeps): WeeklyReport {
  const catalog = deps.catalog ?? loadNewsTemplatesConfig();
  const copy = catalog.weeklyReport;
  const tunables = deps.tunables ?? loadTunables();
  const {
    publishDayOfWeek,
    lookaheadDays,
    callHitProb,
    driftCallThreshold,
    quietThreshold,
    maxForwardCalls,
  } = tunables.marketEconomy.weeklyReport;

  const sourceLabel = catalog.sourceLabels[copy.source] ?? copy.source;

  let active: WeeklyMarketReport | null = null;
  let weekIndex = 0;
  let weekStartDay: number | null = null;
  let baseline: Map<string, number> | null = null;
  const mentions = new Map<string, number>();
  let tally: WeeklyWireTally = EMPTY_TALLY;

  function segmentLabel(segment: string): string {
    return catalog.segmentLabels[segment] ?? segment;
  }

  function fill(text: string, slots: Readonly<Record<string, string>>): string {
    return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
      Object.prototype.hasOwnProperty.call(slots, key) ? slots[key] : whole,
    );
  }

  /** Deterministic pick from a copy list, seeded on the column + what it's for. */
  function pick(lines: readonly string[], day: number, purpose: string): string {
    const rng = createRng(
      deriveSeed(deps.masterSeed, 'market_economy.weekly_report.copy', {
        day,
        purpose,
      }),
    );
    return lines[Math.floor(rng() * lines.length)];
  }

  // ---- the week's accumulators -------------------------------------------

  const onHeadline = (e: {
    reliability: NewsReliability;
    segment: string | null;
  }): void => {
    tally = {
      total: tally.total + 1,
      direct: tally.direct + (e.reliability === 'direct' ? 1 : 0),
      leading: tally.leading + (e.reliability === 'leading' ? 1 : 0),
      lagging: tally.lagging + (e.reliability === 'lagging' ? 1 : 0),
    };
    if (e.segment !== null) {
      mentions.set(e.segment, (mentions.get(e.segment) ?? 0) + 1);
    }
  };
  deps.bus.subscribe('news:headline_published', onHeadline);

  function openWeek(day: number): void {
    weekStartDay = day;
    baseline = new Map(deps.segments.map((s) => [s, deps.heatFor(s)]));
    mentions.clear();
    tally = EMPTY_TALLY;
  }

  // ---- building the column ------------------------------------------------

  function buildMoves(): WeeklySegmentMove[] {
    const base = baseline;
    // Fixed segment order in, absolute-move order out — never dependent on
    // which segment happened to be touched first.
    const moves = deps.segments.map((segment) => {
      const startHeat = base?.get(segment) ?? 0;
      const endHeat = deps.heatFor(segment);
      return {
        segment,
        label: segmentLabel(segment),
        startHeat,
        endHeat,
        delta: endHeat - startHeat,
        mentions: mentions.get(segment) ?? 0,
      };
    });
    return moves.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  function buildSummary(
    day: number,
    moves: readonly WeeklySegmentMove[],
  ): { shape: WeeklySummaryShape; text: string } {
    const material = moves.filter((m) => Math.abs(m.delta) >= quietThreshold);
    if (material.length === 0) {
      return { shape: 'quiet', text: pick(copy.summaries.quiet, day, 'summary') };
    }
    const top = material[0];
    const counter = material.find((m) => Math.sign(m.delta) !== Math.sign(top.delta));
    const shape: WeeklySummaryShape = counter
      ? 'mixed'
      : top.delta > 0
        ? 'up'
        : 'down';
    return {
      shape,
      text: fill(pick(copy.summaries[shape], day, 'summary'), {
        segment: top.label,
        pct: wholePercent(top.delta),
        counterSegment: counter?.label ?? 'the rest of the lot',
      }),
    };
  }

  /** The desk's read of what the coming week holds, deliberately fallible. */
  function buildForwardCalls(
    day: number,
    moves: readonly WeeklySegmentMove[],
  ): WeeklyForwardCall[] {
    const calls: WeeklyForwardCall[] = [];

    if (deps.previewShock) {
      let upcoming: { preview: ShockPreview; leadDays: number } | null = null;
      for (let d = day + 1; d <= day + lookaheadDays; d += 1) {
        const preview = deps.previewShock(d);
        if (preview) {
          upcoming = { preview, leadDays: d - day };
          break;
        }
      }
      const dominant = upcoming
        ? dominantSegment(upcoming.preview.segmentMagnitudes)
        : null;
      const hit = createRng(
        deriveSeed(deps.masterSeed, 'market_economy.weekly_report.call_hit', { day }),
      )();
      if (upcoming && dominant && hit < callHitProb) {
        const direction = dominant.magnitude >= 0 ? 'up' : 'down';
        const kind: WeeklyCallKind = direction === 'up' ? 'shock_up' : 'shock_down';
        calls.push({
          kind,
          segment: dominant.segment,
          segmentLabel: segmentLabel(dominant.segment),
          direction,
          basis: 'shock',
          text: fill(pick(copy.forwardCalls[kind], day, 'call_shock'), {
            segment: segmentLabel(dominant.segment),
            days: String(upcoming.leadDays),
          }),
        });
      }
    }

    // Momentum call — skipped when the shock call already named that segment,
    // so the column never says the same thing twice with two justifications.
    const mover = moves.find(
      (m) =>
        Math.abs(m.delta) >= driftCallThreshold &&
        !calls.some((c) => c.segment === m.segment),
    );
    if (mover) {
      const direction = mover.delta > 0 ? 'up' : 'down';
      const kind: WeeklyCallKind = direction === 'up' ? 'drift_up' : 'drift_down';
      calls.push({
        kind,
        segment: mover.segment,
        segmentLabel: mover.label,
        direction,
        basis: 'drift',
        text: fill(pick(copy.forwardCalls[kind], day, 'call_drift'), {
          segment: mover.label,
          pct: wholePercent(mover.delta),
        }),
      });
    }

    return calls.slice(0, maxForwardCalls);
  }

  function publishReport(day: number): void {
    const moves = buildMoves();
    const { shape, text } = buildSummary(day, moves);
    const report: WeeklyMarketReport = {
      day,
      weekIndex: weekIndex + 1,
      fromDay: weekStartDay ?? day,
      toDay: day - 1,
      source: copy.source,
      sourceLabel,
      shape,
      summary: text,
      moves,
      forwardCalls: buildForwardCalls(day, moves),
      wireTally: tally,
    };
    weekIndex = report.weekIndex;
    active = report;
    deps.bus.publish('market:weekly_report_published', {
      day,
      weekIndex: report.weekIndex,
      fromDay: report.fromDay,
      toDay: report.toDay,
      shape: report.shape,
      summary: report.summary,
      forwardCallCount: report.forwardCalls.length,
    });
  }

  let disposed = false;
  return {
    step(day: number) {
      // First tick of a career (or the first after a pre-#177 save loads) opens
      // the week silently — there is no baseline to measure a move against yet.
      if (baseline === null || weekStartDay === null) {
        openWeek(day);
        return;
      }
      if (day <= weekStartDay) return;
      if (dayOfWeek(day) !== publishDayOfWeek) return;
      publishReport(day);
      openWeek(day);
    },
    getActive: () => active,
    snapshot: (): WeeklyReportSnapshot => ({
      schemaVersion: 1,
      active,
      weekIndex,
      weekStartDay,
      baseline: baseline ? Object.fromEntries(baseline) : null,
      mentions: Object.fromEntries(mentions),
      tally,
    }),
    restore: (snap: WeeklyReportSnapshot) => {
      active = snap.active;
      weekIndex = snap.weekIndex;
      weekStartDay = snap.weekStartDay;
      baseline = snap.baseline ? new Map(Object.entries(snap.baseline)) : null;
      mentions.clear();
      for (const [segment, count] of Object.entries(snap.mentions)) {
        mentions.set(segment, count);
      }
      tally = snap.tally;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      deps.bus.unsubscribe('news:headline_published', onHeadline);
    },
  };
}

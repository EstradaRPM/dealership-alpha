import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createWeeklyReport,
  loadNewsTemplatesConfig,
  type ShockPreview,
  type WeeklyMarketReport,
  type WeeklyReport,
} from '../src/game/MarketEconomy';
import { loadTunables, type Tunables } from '../src/game/data';

/**
 * Slice #177 — the weekly market report.
 *
 * The column is the other half of a news surface: the wire tells you what
 * happened today, the column adds up the week and says what the desk expects
 * next. Two properties are load-bearing and tested here rather than assumed —
 * it publishes on the configured weekday and stands until replaced, and its
 * forward calls are deterministic from current state while still being allowed
 * to be wrong.
 */

const SEGMENTS = ['sedan', 'truck', 'suv'] as const;

function tunablesWith(
  weekly: Partial<Tunables['marketEconomy']['weeklyReport']>,
  base: Tunables = loadTunables(),
): Tunables {
  return {
    ...base,
    marketEconomy: {
      ...base.marketEconomy,
      weeklyReport: { ...base.marketEconomy.weeklyReport, ...weekly },
    },
  };
}

interface Harness {
  bus: EventBus;
  report: WeeklyReport;
  published: {
    day: number;
    weekIndex: number;
    fromDay: number;
    toDay: number;
    summary: string;
  }[];
  setHeat: (segment: string, heat: number) => void;
}

function harness(
  opts: {
    masterSeed?: number;
    heat?: Record<string, number>;
    previewShock?: (day: number) => ShockPreview | null;
    tunables?: Tunables;
  } = {},
): Harness {
  const bus = createEventBus();
  const heat = new Map<string, number>(Object.entries(opts.heat ?? {}));
  const published: Harness['published'] = [];
  bus.subscribe('market:weekly_report_published', (e) => published.push(e));
  const report = createWeeklyReport({
    masterSeed: opts.masterSeed ?? 4242,
    bus,
    segments: SEGMENTS,
    heatFor: (segment) => heat.get(segment) ?? 0,
    previewShock: opts.previewShock,
    tunables: opts.tunables,
  });
  return {
    bus,
    report,
    published,
    setHeat: (segment, value) => heat.set(segment, value),
  };
}

/** Open the week on day 1 and run the tick through to (and including) `day`. */
function runTo(h: Harness, day: number): void {
  for (let d = 1; d <= day; d += 1) h.report.step(d);
}

const PREVIEW_TRUCK_DOWN: ShockPreview = {
  shockId: 'truck_oem_recall',
  label: 'OEM truck recall',
  segmentMagnitudes: { truck: -0.09, sedan: 0.01 },
};

describe('weekly report cadence (#177)', () => {
  it('opens the first week silently — no column on day 1', () => {
    const h = harness();
    h.report.step(1);
    expect(h.published).toHaveLength(0);
    expect(h.report.getActive()).toBeNull();
  });

  it('publishes on the configured weekday, covering the week just played', () => {
    const h = harness();
    runTo(h, 8);
    expect(h.published).toHaveLength(1);
    const active = h.report.getActive() as WeeklyMarketReport;
    expect(active.day).toBe(8);
    expect(active.weekIndex).toBe(1);
    expect(active.fromDay).toBe(1);
    expect(active.toDay).toBe(7);
  });

  it('publishes nothing on the other six days', () => {
    const h = harness();
    runTo(h, 7);
    expect(h.published).toHaveLength(0);
  });

  it('stands as the active column until the next one replaces it', () => {
    const h = harness();
    runTo(h, 8);
    const first = h.report.getActive();
    for (let d = 9; d <= 14; d += 1) {
      h.report.step(d);
      expect(h.report.getActive()).toBe(first);
    }
    h.report.step(15);
    expect(h.report.getActive()).not.toBe(first);
    expect(h.report.getActive()?.weekIndex).toBe(2);
  });

  it('honors a different configured weekday', () => {
    // A career that opens off-cadence gets a short first column (days 1–4) and
    // then settles onto the configured weekday — the column always covers the
    // days actually played since the last one, never a fabricated seven.
    const h = harness({ tunables: tunablesWith({ publishDayOfWeek: 4 }) });
    runTo(h, 12);
    expect(h.published.map((p) => p.day)).toEqual([5, 12]);
    expect(h.published[0].toDay).toBe(4);
    expect(h.published[1].fromDay).toBe(5);
  });
});

describe('weekly aggregation (#177)', () => {
  it('measures each segment against the heat at the start of the week', () => {
    const h = harness({ heat: { sedan: 0.01, truck: 0.0, suv: -0.02 } });
    h.report.step(1);
    h.setHeat('truck', 0.06);
    h.setHeat('suv', -0.03);
    runTo2(h, 2, 8);

    const active = h.report.getActive() as WeeklyMarketReport;
    const truck = active.moves.find((m) => m.segment === 'truck');
    expect(truck?.startHeat).toBeCloseTo(0);
    expect(truck?.endHeat).toBeCloseTo(0.06);
    expect(truck?.delta).toBeCloseTo(0.06);
    // Biggest absolute mover first, so the column leads with the story.
    expect(active.moves[0].segment).toBe('truck');
  });

  it('re-baselines each week, so the column reports the week and not the career', () => {
    const h = harness();
    h.report.step(1);
    h.setHeat('suv', 0.08);
    runTo2(h, 2, 8);
    // The move is now old news — the second week starts from where the first ended.
    runTo2(h, 9, 15);
    const second = h.report.getActive() as WeeklyMarketReport;
    expect(second.weekIndex).toBe(2);
    expect(second.moves.every((m) => Math.abs(m.delta) < 1e-9)).toBe(true);
    expect(second.shape).toBe('quiet');
  });

  it('reads the week shape from the movers that cleared the bar', () => {
    const up = harness();
    up.report.step(1);
    up.setHeat('suv', 0.05);
    up.setHeat('truck', 0.03);
    runTo2(up, 2, 8);
    expect(up.report.getActive()?.shape).toBe('up');

    const mixed = harness();
    mixed.report.step(1);
    mixed.setHeat('suv', 0.05);
    mixed.setHeat('sedan', -0.04);
    runTo2(mixed, 2, 8);
    expect(mixed.report.getActive()?.shape).toBe('mixed');

    const down = harness();
    down.report.step(1);
    down.setHeat('sedan', -0.06);
    runTo2(down, 2, 8);
    expect(down.report.getActive()?.shape).toBe('down');
  });

  it('reads a sub-threshold week as quiet', () => {
    const h = harness({ tunables: tunablesWith({ quietThreshold: 0.05 }) });
    h.report.step(1);
    h.setHeat('suv', 0.02);
    runTo2(h, 2, 8);
    expect(h.report.getActive()?.shape).toBe('quiet');
  });

  it('tallies the week of wire by trust tier and per-segment mentions', () => {
    const h = harness();
    h.report.step(1);
    const headline = (reliability: 'direct' | 'leading' | 'lagging', segment: string | null) =>
      h.bus.publish('news:headline_published', {
        day: 3,
        headlineId: `3#${reliability}${segment ?? ''}`,
        source: 'auction_report',
        sourceLabel: 'Auction block report',
        reliability,
        text: 'anything',
        trigger: 'auction_up',
        segment,
        direction: 'up',
      });
    headline('direct', 'truck');
    headline('direct', 'truck');
    headline('leading', 'suv');
    headline('lagging', null);
    runTo2(h, 2, 8);

    const active = h.report.getActive() as WeeklyMarketReport;
    expect(active.wireTally).toEqual({ total: 4, direct: 2, leading: 1, lagging: 1 });
    expect(active.moves.find((m) => m.segment === 'truck')?.mentions).toBe(2);
    expect(active.moves.find((m) => m.segment === 'sedan')?.mentions).toBe(0);
  });

  it('clears the tally when the next week opens', () => {
    const h = harness();
    h.report.step(1);
    h.bus.publish('news:headline_published', {
      day: 3,
      headlineId: '3#0',
      source: 'auction_report',
      sourceLabel: 'Auction block report',
      reliability: 'direct',
      text: 'anything',
      trigger: 'auction_up',
      segment: 'truck',
      direction: 'up',
    });
    runTo2(h, 2, 8);
    runTo2(h, 9, 15);
    expect(h.report.getActive()?.wireTally.total).toBe(0);
  });

  it('fills every slot in the published prose', () => {
    const h = harness({ previewShock: (d) => (d === 10 ? PREVIEW_TRUCK_DOWN : null) });
    h.report.step(1);
    h.setHeat('suv', 0.06);
    h.setHeat('sedan', -0.05);
    runTo2(h, 2, 8);
    const active = h.report.getActive() as WeeklyMarketReport;
    expect(active.summary).not.toContain('{');
    for (const call of active.forwardCalls) expect(call.text).not.toContain('{');
  });

  it('stops aggregating after dispose', () => {
    const h = harness();
    h.report.step(1);
    h.report.dispose();
    h.bus.publish('news:headline_published', {
      day: 2,
      headlineId: '2#0',
      source: 'auction_report',
      sourceLabel: 'Auction block report',
      reliability: 'direct',
      text: 'anything',
      trigger: 'auction_up',
      segment: 'truck',
      direction: 'up',
    });
    runTo2(h, 2, 8);
    expect(h.report.getActive()?.wireTally.total).toBe(0);
  });
});

describe('forward calls (#177)', () => {
  it('calls a shock it can see coming inside the lookahead window', () => {
    const h = harness({
      previewShock: (d) => (d === 11 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({ callHitProb: 1 }),
    });
    runTo(h, 8);
    const calls = h.report.getActive()?.forwardCalls ?? [];
    const shockCall = calls.find((c) => c.basis === 'shock');
    expect(shockCall).toBeDefined();
    expect(shockCall?.segment).toBe('truck');
    expect(shockCall?.direction).toBe('down');
    expect(shockCall?.text).toContain('trucks');
  });

  it('does not look past the lookahead window', () => {
    const h = harness({
      previewShock: (d) => (d === 30 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({ callHitProb: 1 }),
    });
    runTo(h, 8);
    expect(
      (h.report.getActive()?.forwardCalls ?? []).some((c) => c.basis === 'shock'),
    ).toBe(false);
  });

  it('lets a real setup pass unremarked when the hit rate says so', () => {
    const h = harness({
      previewShock: (d) => (d === 11 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({ callHitProb: 0 }),
    });
    runTo(h, 8);
    expect(
      (h.report.getActive()?.forwardCalls ?? []).some((c) => c.basis === 'shock'),
    ).toBe(false);
  });

  it('makes a momentum call off the week own move', () => {
    const h = harness({ tunables: tunablesWith({ driftCallThreshold: 0.02 }) });
    h.report.step(1);
    h.setHeat('suv', 0.06);
    runTo2(h, 2, 8);
    const calls = h.report.getActive()?.forwardCalls ?? [];
    const drift = calls.find((c) => c.basis === 'drift');
    expect(drift?.segment).toBe('suv');
    expect(drift?.direction).toBe('up');
  });

  it('never says the same thing twice with two justifications', () => {
    const h = harness({
      previewShock: (d) => (d === 10 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({ callHitProb: 1, driftCallThreshold: 0.02 }),
    });
    h.report.step(1);
    h.setHeat('truck', -0.06);
    runTo2(h, 2, 8);
    const calls = h.report.getActive()?.forwardCalls ?? [];
    expect(calls.filter((c) => c.segment === 'truck')).toHaveLength(1);
  });

  it('declines to bet when nothing is coming and nothing moved', () => {
    const h = harness();
    runTo(h, 8);
    expect(h.report.getActive()?.forwardCalls).toEqual([]);
  });

  it('caps the number of calls', () => {
    const h = harness({
      previewShock: (d) => (d === 10 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({ callHitProb: 1, maxForwardCalls: 1 }),
    });
    h.report.step(1);
    h.setHeat('suv', 0.06);
    runTo2(h, 2, 8);
    expect(h.report.getActive()?.forwardCalls).toHaveLength(1);
  });

  it('runs drift calls with no lookahead wired at all', () => {
    const h = harness();
    h.report.step(1);
    h.setHeat('sedan', -0.06);
    runTo2(h, 2, 8);
    const calls = h.report.getActive()?.forwardCalls ?? [];
    expect(calls).toHaveLength(1);
    expect(calls[0].basis).toBe('drift');
  });
});

describe('determinism + persistence (#177)', () => {
  function playAWeek(masterSeed: number): WeeklyMarketReport {
    const h = harness({
      masterSeed,
      previewShock: (d) => (d === 10 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({ callHitProb: 0.6 }),
    });
    h.report.step(1);
    h.setHeat('suv', 0.06);
    h.setHeat('sedan', -0.05);
    runTo2(h, 2, 8);
    return h.report.getActive() as WeeklyMarketReport;
  }

  it('replays an identical column from identical state', () => {
    expect(playAWeek(99)).toEqual(playAWeek(99));
  });

  it('writes a different column under a different seed', () => {
    const a = playAWeek(1);
    const b = playAWeek(777);
    // Same facts, different prose picks / call luck — at least one must differ.
    expect(
      a.summary !== b.summary || a.forwardCalls.length !== b.forwardCalls.length,
    ).toBe(true);
  });

  it('round-trips the standing column and the in-progress week', () => {
    const h = harness();
    h.report.step(1);
    h.setHeat('suv', 0.06);
    runTo2(h, 2, 8);
    h.bus.publish('news:headline_published', {
      day: 9,
      headlineId: '9#0',
      source: 'auction_report',
      sourceLabel: 'Auction block report',
      reliability: 'direct',
      text: 'anything',
      trigger: 'auction_up',
      segment: 'truck',
      direction: 'up',
    });
    h.report.step(9);
    const snap = h.report.snapshot();

    const restored = harness({ heat: { suv: 0.06 } });
    restored.report.restore(snap);
    expect(restored.report.getActive()).toEqual(h.report.getActive());

    // The half-finished week survives too: the mid-week headline still counts,
    // and the reload does NOT re-open the week (which would zero the baseline).
    restored.setHeat('truck', 0.04);
    runTo2(restored, 10, 15);
    const next = restored.report.getActive() as WeeklyMarketReport;
    expect(next.weekIndex).toBe(2);
    expect(next.wireTally.total).toBe(1);
    expect(next.moves.find((m) => m.segment === 'truck')?.delta).toBeCloseTo(0.04);
  });
});

describe('weekly report copy (#177)', () => {
  const copy = loadNewsTemplatesConfig().weeklyReport;

  it('is attributed to a labeled source', () => {
    expect(loadNewsTemplatesConfig().sourceLabels[copy.source]).toBeTruthy();
  });

  it('carries copy for every week shape and both call bases', () => {
    for (const shape of ['up', 'down', 'mixed', 'quiet'] as const) {
      expect(copy.summaries[shape].length).toBeGreaterThan(0);
    }
    for (const kind of ['shock_up', 'shock_down', 'drift_up', 'drift_down'] as const) {
      expect(copy.forwardCalls[kind].length).toBeGreaterThan(0);
    }
  });

  it('leaves no unfillable slot', () => {
    const KNOWN = new Set([
      'segment',
      'counterSegment',
      'pct',
      'days',
      'fromDay',
      'toDay',
      'total',
      'direct',
      'leading',
      'lagging',
    ]);
    const texts = [
      copy.subtitle,
      copy.noCallsText,
      copy.wireTallyText,
      ...Object.values(copy.summaries).flat(),
      ...Object.values(copy.forwardCalls).flat(),
    ];
    for (const text of texts) {
      for (const [, key] of text.matchAll(/\{(\w+)\}/g)) {
        expect(KNOWN.has(key)).toBe(true);
      }
    }
  });
});

/** Run the tick across an inclusive day range. */
function runTo2(h: Harness, from: number, to: number): void {
  for (let d = from; d <= to; d += 1) h.report.step(d);
}

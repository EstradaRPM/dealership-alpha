import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createMarketNews,
  createSegmentHeatMonitor,
  loadNewsTemplatesConfig,
  NEWS_TRIGGERS,
  type MarketNews,
  type NewsReliability,
  type ShockPreview,
} from '../src/game/MarketEconomy';
import { loadTunables, type Tunables } from '../src/game/data';

/**
 * Slice #176 — the industry wire.
 *
 * Three reliability tiers are the mechanic, not decoration: `direct` reports
 * what already happened, `leading` is the analyst desk's forward call fired
 * ahead of a shock (and allowed to be wrong — hit rate and false-alarm rate are
 * both tunable), `lagging` only confirms a trend the player's own numbers
 * already showed. Everything is deterministic from `(masterSeed, day, slot)`.
 */

interface PublishedHeadline {
  day: number;
  headlineId: string;
  source: string;
  sourceLabel: string;
  reliability: NewsReliability;
  text: string;
  trigger: string;
  segment: string | null;
  direction: 'up' | 'down';
}

const SEGMENTS = ['sedan', 'truck', 'suv'] as const;

function tunablesWith(
  news: Partial<Tunables['marketEconomy']['news']>,
  base: Tunables = loadTunables(),
): Tunables {
  return {
    ...base,
    marketEconomy: {
      ...base.marketEconomy,
      news: { ...base.marketEconomy.news, ...news },
    },
  };
}

function harness(opts: {
  masterSeed?: number;
  previewShock?: (day: number) => ShockPreview | null;
  tunables?: Tunables;
} = {}): {
  bus: EventBus;
  news: MarketNews;
  published: PublishedHeadline[];
} {
  const bus = createEventBus();
  const published: PublishedHeadline[] = [];
  bus.subscribe('news:headline_published', (e) => published.push(e));
  const news = createMarketNews({
    masterSeed: opts.masterSeed ?? 4242,
    bus,
    segments: SEGMENTS,
    previewShock: opts.previewShock,
    tunables: opts.tunables,
  });
  return { bus, news, published };
}

const PREVIEW_TRUCK_DOWN: ShockPreview = {
  shockId: 'truck_oem_recall',
  label: 'OEM truck recall',
  segmentMagnitudes: { truck: -0.09, sedan: 0.01 },
};

describe('news template catalog (#176)', () => {
  const catalog = loadNewsTemplatesConfig();

  it('carries at least 30 templates', () => {
    expect(catalog.templates.length).toBeGreaterThanOrEqual(30);
  });

  it('covers every structural trigger', () => {
    for (const trigger of NEWS_TRIGGERS) {
      expect(catalog.templates.some((t) => t.trigger === trigger)).toBe(true);
    }
  });

  it('spans all three reliability tiers and ships the auction-report source', () => {
    const tiers = new Set(catalog.templates.map((t) => t.reliability));
    expect([...tiers].sort()).toEqual(['direct', 'lagging', 'leading']);
    expect(catalog.templates.some((t) => t.source === 'auction_report')).toBe(true);
  });

  it('labels every source and reliability tier it uses', () => {
    for (const t of catalog.templates) {
      expect(catalog.sourceLabels[t.source]).toBeTruthy();
      expect(catalog.reliabilityLabels[t.reliability]).toBeTruthy();
      expect(catalog.reliabilityNotes[t.reliability]).toBeTruthy();
    }
  });

  it('leaves no unfillable slot in any template', () => {
    const KNOWN = new Set(['segment', 'pct', 'label', 'brand', 'days']);
    for (const t of catalog.templates) {
      for (const [, key] of t.text.matchAll(/\{(\w+)\}/g)) {
        expect(KNOWN.has(key)).toBe(true);
      }
    }
  });
});

describe('direct tier — things that already happened (#176)', () => {
  it('publishes a confirmed headline when a shock starts, tagged to its worst segment', () => {
    const { bus, published } = harness();
    bus.publish('market:shock_started', {
      day: 5,
      shockId: 'fuel_spike',
      instanceId: 'fuel_spike@5',
      label: 'Fuel price spike',
      segmentMagnitudes: { truck: -0.1, sedan: 0.03 },
      expectedEndDay: 30,
    });
    expect(published).toHaveLength(1);
    expect(published[0].reliability).toBe('direct');
    expect(published[0].trigger).toBe('shock_started');
    expect(published[0].segment).toBe('truck');
    expect(published[0].direction).toBe('down');
    expect(published[0].text).toContain('Fuel price spike');
  });

  it('names the shock again when it resolves, from the tag it kept at start', () => {
    const { bus, published } = harness();
    bus.publish('market:shock_started', {
      day: 5,
      shockId: 'fuel_spike',
      instanceId: 'fuel_spike@5',
      label: 'Fuel price spike',
      segmentMagnitudes: { truck: -0.1 },
      expectedEndDay: 30,
    });
    bus.publish('market:shock_resolved', {
      day: 31,
      shockId: 'fuel_spike',
      instanceId: 'fuel_spike@5',
    });
    const resolved = published.find((h) => h.trigger === 'shock_resolved');
    expect(resolved).toBeDefined();
    expect(resolved?.reliability).toBe('direct');
    expect(resolved?.text).toContain('Fuel price spike');
  });

  it('falls back to neutral wording when the shock tag is gone', () => {
    const { bus, published } = harness();
    bus.publish('market:shock_resolved', {
      day: 9,
      shockId: 'ghost',
      instanceId: 'ghost@1',
    });
    expect(published[0].text).not.toContain('{label}');
    expect(published[0].text).toContain('market disruption');
  });

  it('reports a rival price move directionally', () => {
    const { bus, published } = harness();
    bus.publish('competitor:price_changed', {
      day: 3,
      competitorId: 'c1',
      brand: 'Northgate Motors',
      oldPricing: 0.5,
      newPricing: 0.6,
      segmentAffinity: { suv: 1 },
    });
    bus.publish('competitor:price_changed', {
      day: 3,
      competitorId: 'c2',
      brand: 'Valley Auto',
      oldPricing: 0.6,
      newPricing: 0.45,
      segmentAffinity: { sedan: 1 },
    });
    expect(published.map((h) => h.trigger)).toEqual([
      'rival_price_up',
      'rival_price_down',
    ]);
    expect(published[0].text).toContain('Northgate Motors');
    expect(published[1].text).toContain('Valley Auto');
    expect(published.every((h) => h.reliability === 'direct')).toBe(true);
  });

  it('publishes a block report on the day AFTER the comps land, once past both gates', () => {
    const { news, published } = harness();
    news.recordComp({ segment: 'truck', delta: 0.08 });
    news.recordComp({ segment: 'truck', delta: 0.06 });
    news.step(2);

    expect(published).toHaveLength(1);
    expect(published[0].trigger).toBe('auction_up');
    expect(published[0].segment).toBe('truck');
    expect(published[0].reliability).toBe('direct');
    expect(published[0].day).toBe(2);
    // 7% mean → "7%"
    expect(published[0].text).toContain('7%');

    // Accumulator cleared: the next day has nothing to report.
    news.step(3);
    expect(published).toHaveLength(1);
  });

  it('stays quiet below the comp-count gate and below the delta gate', () => {
    const thin = harness();
    thin.news.recordComp({ segment: 'truck', delta: 0.5 });
    thin.news.step(2);
    expect(thin.published).toHaveLength(0);

    const flat = harness();
    flat.news.recordComp({ segment: 'truck', delta: 0.001 });
    flat.news.recordComp({ segment: 'truck', delta: 0.002 });
    flat.news.step(2);
    expect(flat.published).toHaveLength(0);
  });

  it('reports the segment that moved most, regardless of arrival order', () => {
    const { news, published } = harness();
    news.recordComp({ segment: 'suv', delta: -0.2 });
    news.recordComp({ segment: 'suv', delta: -0.2 });
    news.recordComp({ segment: 'sedan', delta: 0.04 });
    news.recordComp({ segment: 'sedan', delta: 0.04 });
    news.step(2);
    expect(published).toHaveLength(1);
    expect(published[0].segment).toBe('suv');
    expect(published[0].trigger).toBe('auction_down');
  });
});

describe('lagging tier — confirming what the player already saw (#176)', () => {
  it('turns a reported heat move into a recap headline', () => {
    const { bus, published } = harness();
    bus.publish('market:segment_heat_updated', {
      day: 7,
      segment: 'suv',
      heat: 0.09,
      previousHeat: 0.02,
      delta: 0.07,
    });
    expect(published).toHaveLength(1);
    expect(published[0].reliability).toBe('lagging');
    expect(published[0].trigger).toBe('heat_up');
    expect(published[0].segment).toBe('suv');
  });

  it('reads down when the segment softened', () => {
    const { bus, published } = harness();
    bus.publish('market:segment_heat_updated', {
      day: 7,
      segment: 'sedan',
      heat: -0.05,
      previousHeat: 0.02,
      delta: -0.07,
    });
    expect(published[0].trigger).toBe('heat_down');
    expect(published[0].direction).toBe('down');
  });
});

describe('leading tier — the analyst desk (#176)', () => {
  it('calls a shock it can see coming, tagged to the segment that shock hits', () => {
    const { news, published } = harness({
      previewShock: (day) => (day === 4 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({ rumorHitProb: 1, falseAlarmProbPerDay: 0 }),
    });
    news.step(2);
    expect(published).toHaveLength(1);
    expect(published[0].reliability).toBe('leading');
    expect(published[0].trigger).toBe('rumor_down');
    expect(published[0].segment).toBe('truck');
  });

  it('lets a real setup pass unremarked when the hit probability is 0', () => {
    const { news, published } = harness({
      previewShock: () => PREVIEW_TRUCK_DOWN,
      tunables: tunablesWith({ rumorHitProb: 0, falseAlarmProbPerDay: 0 }),
    });
    news.step(2);
    expect(published).toHaveLength(0);
  });

  it('does not look past the lead window', () => {
    const { news, published } = harness({
      // The shock is 10 days out; the default window is shorter.
      previewShock: (day) => (day === 12 ? PREVIEW_TRUCK_DOWN : null),
      tunables: tunablesWith({
        rumorLeadDays: 3,
        rumorHitProb: 1,
        falseAlarmProbPerDay: 0,
      }),
    });
    news.step(2);
    expect(published).toHaveLength(0);
  });

  it('respects the false-alarm rate when nothing is coming', () => {
    const always = harness({
      previewShock: () => null,
      tunables: tunablesWith({ falseAlarmProbPerDay: 1 }),
    });
    for (let d = 1; d <= 5; d += 1) always.news.step(d);
    expect(always.published).toHaveLength(5);
    expect(always.published.every((h) => h.reliability === 'leading')).toBe(true);

    const never = harness({
      previewShock: () => null,
      tunables: tunablesWith({ falseAlarmProbPerDay: 0 }),
    });
    for (let d = 1; d <= 5; d += 1) never.news.step(d);
    expect(never.published).toHaveLength(0);
  });

  it('runs the direct and lagging tiers with no lookahead wired at all', () => {
    const { bus, news, published } = harness({ previewShock: undefined });
    bus.publish('market:segment_heat_updated', {
      day: 1,
      segment: 'suv',
      heat: 0.09,
      previousHeat: 0.02,
      delta: 0.07,
    });
    news.step(2);
    expect(published).toHaveLength(1);
    expect(published[0].reliability).toBe('lagging');
  });
});

describe('determinism + volume (#176)', () => {
  it('replays identical headlines from identical state', () => {
    const run = (): string[] => {
      const { bus, news, published } = harness({
        masterSeed: 99,
        previewShock: (day) => (day % 7 === 0 ? PREVIEW_TRUCK_DOWN : null),
      });
      for (let d = 1; d <= 30; d += 1) {
        if (d % 5 === 0) {
          bus.publish('market:segment_heat_updated', {
            day: d,
            segment: 'sedan',
            heat: 0.05,
            previousHeat: 0,
            delta: 0.05,
          });
        }
        news.recordComp({ segment: 'truck', delta: 0.07 });
        news.recordComp({ segment: 'truck', delta: 0.05 });
        news.step(d);
      }
      return published.map((h) => `${h.day}|${h.text}`);
    };
    const a = run();
    const b = run();
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('produces different headlines under a different seed', () => {
    const textsFor = (seed: number): string[] => {
      const { news, published } = harness({
        masterSeed: seed,
        previewShock: () => null,
        tunables: tunablesWith({ falseAlarmProbPerDay: 1 }),
      });
      for (let d = 1; d <= 20; d += 1) news.step(d);
      return published.map((h) => h.text);
    };
    expect(textsFor(1)).not.toEqual(textsFor(2));
  });

  it('caps headlines per day and spends the budget in arrival order', () => {
    const { bus, news, published } = harness({
      previewShock: () => PREVIEW_TRUCK_DOWN,
      tunables: tunablesWith({ maxHeadlinesPerDay: 2, rumorHitProb: 1 }),
    });
    for (let i = 0; i < 4; i += 1) {
      bus.publish('competitor:price_changed', {
        day: 6,
        competitorId: `c${i}`,
        brand: `Rival ${i}`,
        oldPricing: 0.5,
        newPricing: 0.6,
        segmentAffinity: { suv: 1 },
      });
    }
    news.recordComp({ segment: 'truck', delta: 0.09 });
    news.recordComp({ segment: 'truck', delta: 0.09 });
    news.step(6);
    expect(published).toHaveLength(2);
    expect(published.every((h) => h.trigger === 'rival_price_up')).toBe(true);
  });

  it('resets the per-day budget on the next day without any explicit tick', () => {
    const { bus, published } = harness({
      tunables: tunablesWith({ maxHeadlinesPerDay: 1 }),
    });
    const rival = (day: number, i: number): void =>
      bus.publish('competitor:price_changed', {
        day,
        competitorId: `c${i}`,
        brand: `Rival ${i}`,
        oldPricing: 0.5,
        newPricing: 0.6,
        segmentAffinity: { suv: 1 },
      });
    rival(1, 0);
    rival(1, 1);
    rival(2, 2);
    expect(published.map((h) => h.day)).toEqual([1, 2]);
  });

  it('keeps only the last `maxHeadlines`, newest first', () => {
    const { bus, news } = harness({
      tunables: tunablesWith({ maxHeadlines: 3, maxHeadlinesPerDay: 1 }),
    });
    for (let d = 1; d <= 6; d += 1) {
      bus.publish('competitor:price_changed', {
        day: d,
        competitorId: 'c',
        brand: 'Rival',
        oldPricing: 0.5,
        newPricing: 0.6,
        segmentAffinity: { suv: 1 },
      });
    }
    const kept = news.getHeadlines();
    expect(kept).toHaveLength(3);
    expect(kept.map((h) => h.day)).toEqual([6, 5, 4]);
  });

  it('stops publishing after dispose', () => {
    const { bus, news, published } = harness();
    news.dispose();
    bus.publish('competitor:price_changed', {
      day: 1,
      competitorId: 'c',
      brand: 'Rival',
      oldPricing: 0.5,
      newPricing: 0.6,
      segmentAffinity: { suv: 1 },
    });
    expect(published).toHaveLength(0);
  });
});

describe('news persistence (#176)', () => {
  it('round-trips the ring buffer, the day budget and the pending comps', () => {
    const a = harness();
    a.bus.publish('competitor:price_changed', {
      day: 4,
      competitorId: 'c',
      brand: 'Rival',
      oldPricing: 0.5,
      newPricing: 0.6,
      segmentAffinity: { suv: 1 },
    });
    a.news.recordComp({ segment: 'truck', delta: 0.08 });
    a.news.recordComp({ segment: 'truck', delta: 0.06 });

    const b = harness();
    b.news.restore(a.news.snapshot());
    expect(b.news.getHeadlines()).toEqual(a.news.getHeadlines());

    // The un-reported comps survived, so the block report still fires.
    b.news.step(5);
    expect(b.published.some((h) => h.trigger === 'auction_up')).toBe(true);
  });

  it('resolves a shock under its own name across a save/load', () => {
    const a = harness();
    a.bus.publish('market:shock_started', {
      day: 5,
      shockId: 'fuel_spike',
      instanceId: 'fuel_spike@5',
      label: 'Fuel price spike',
      segmentMagnitudes: { truck: -0.1 },
      expectedEndDay: 30,
    });

    const b = harness();
    b.news.restore(a.news.snapshot());
    b.bus.publish('market:shock_resolved', {
      day: 31,
      shockId: 'fuel_spike',
      instanceId: 'fuel_spike@5',
    });
    expect(b.published[0].text).toContain('Fuel price spike');
  });
});

describe('segment-heat monitor (#176)', () => {
  function monitorHarness(threshold: number) {
    const bus = createEventBus();
    const updates: Array<{ segment: string; delta: number; day: number }> = [];
    bus.subscribe('market:segment_heat_updated', (e) => updates.push(e));
    const heat = new Map<string, number>(SEGMENTS.map((s) => [s, 0]));
    const base = loadTunables();
    const monitor = createSegmentHeatMonitor({
      bus,
      segments: SEGMENTS,
      heatFor: (segment) => heat.get(segment) ?? 0,
      tunables: {
        ...base,
        marketEconomy: {
          ...base.marketEconomy,
          heatMonitor: { deltaThreshold: threshold },
        },
      },
    });
    return { monitor, updates, heat };
  }

  it('captures a silent baseline on the first tick', () => {
    const { monitor, updates, heat } = monitorHarness(0.02);
    heat.set('truck', 0.5);
    monitor.step(1);
    expect(updates).toHaveLength(0);
  });

  it('emits only once a segment clears the threshold', () => {
    const { monitor, updates, heat } = monitorHarness(0.05);
    monitor.step(1);
    heat.set('truck', 0.02);
    monitor.step(2);
    expect(updates).toHaveLength(0);
    heat.set('truck', 0.06);
    monitor.step(3);
    expect(updates).toEqual([
      { day: 3, segment: 'truck', heat: 0.06, previousHeat: 0, delta: 0.06 },
    ]);
  });

  it('measures against the last REPORTED heat, so slow drift eventually reports', () => {
    const { monitor, updates, heat } = monitorHarness(0.05);
    monitor.step(1);
    // 15 days of sub-threshold daily drift (0.02/day) totalling 0.30.
    for (let d = 2; d <= 16; d += 1) {
      heat.set('suv', (heat.get('suv') ?? 0) + 0.02);
      monitor.step(d);
    }
    const suv = updates.filter((u) => u.segment === 'suv');
    // Not daily noise — but the accumulated drift does eventually get reported,
    // once per 0.05-plus move (0.30 of drift → 5 reports, not 15).
    expect(suv).toHaveLength(5);
    for (const u of suv) expect(Math.abs(u.delta)).toBeGreaterThanOrEqual(0.05);
  });

  it('emits in fixed segment order and round-trips its baseline', () => {
    const { monitor, updates, heat } = monitorHarness(0.05);
    monitor.step(1);
    heat.set('suv', 0.2);
    heat.set('sedan', 0.2);
    monitor.step(2);
    expect(updates.map((u) => u.segment)).toEqual(['sedan', 'suv']);

    const restored = monitorHarness(0.05);
    restored.monitor.restore(monitor.snapshot());
    restored.heat.set('sedan', 0.2);
    restored.heat.set('suv', 0.2);
    restored.monitor.step(3);
    // Already reported before the save — nothing re-announced after the load.
    expect(restored.updates).toHaveLength(0);
  });
});

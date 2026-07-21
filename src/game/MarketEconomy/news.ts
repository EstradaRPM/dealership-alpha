import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadTunables, type Tunables } from '../data';
import {
  loadNewsTemplatesConfig,
  type NewsReliability,
  type NewsTemplate,
  type NewsTemplatesConfig,
  type NewsTrigger,
} from './schemas';
import type { ShockPreview } from './shocks';

/**
 * MarketNews — the industry wire (slice #176, parent #150).
 *
 * Turns what the market engine is actually doing into narrative the player
 * reads on the Home screen, across three reliability tiers that are the whole
 * point of the sub-system:
 *
 * - **direct** — it already happened and is verifiable: the block report on the
 *   comps the player's own transactions generated, a shock landing or lifting,
 *   a rival visibly moving their prices.
 * - **leading** — a forward call from the analyst desk, fired *ahead* of a shock
 *   by reading the scheduler's future arrival roll (`previewShock`). It is
 *   deliberately fallible: `rumorHitProb` decides whether a real setup gets
 *   called at all, and `falseAlarmProbPerDay` fires calls on days when nothing
 *   is coming. The player learns the desk's precision by living with it.
 * - **lagging** — texture that only confirms a trend already visible in the
 *   player's own numbers (a segment's heat having moved past the reporting
 *   threshold). Never actionable; it makes the world feel populated.
 *
 * **Determinism.** Every roll derives from `(masterSeed, day, slot)` via the
 * shared `deriveSeed`/`createRng` pair, where `slot` is the headline's index
 * within its day. Identical state replays identical headlines.
 *
 * **Volume.** `maxHeadlinesPerDay` is a hard per-day gate applied at publish
 * time. Event-driven headlines (shocks, rivals, heat) arrive first and spend
 * the budget before the day-step's block report + rumor — a shock day is
 * legitimately loud, and a quiet day still leaves room for the desk to talk.
 *
 * **Inventory comps** reach the engine through `recordComp`, not a bus
 * subscription: the MarketEconomy facade already computes each transaction's
 * delta-vs-anchor for the comp window, and re-deriving it here would duplicate
 * the anchor math (and require the anchor config). The block report aggregates
 * a day's comps and publishes on the *next* day's tick — an auction recap is
 * next-morning news.
 */
export type { NewsReliability, NewsTrigger } from './schemas';

export type NewsDirection = 'up' | 'down';

export interface Headline {
  /** Stable within a save: `${day}#${slot}`. */
  readonly id: string;
  readonly day: number;
  readonly templateId: string;
  /** Source id from the catalog ("who is talking"). */
  readonly source: string;
  readonly sourceLabel: string;
  readonly reliability: NewsReliability;
  /** Fully-filled body text. */
  readonly text: string;
  /** Structural tag — what this headline is *about*, for non-prose consumers. */
  readonly trigger: NewsTrigger;
  readonly segment: string | null;
  readonly direction: NewsDirection;
}

export interface NewsSnapshot {
  readonly schemaVersion: 1;
  /** Ring buffer, newest last. */
  readonly headlines: readonly Headline[];
  readonly currentDay: number;
  readonly slotsUsedToday: number;
  /** Un-reported comp deltas per segment, awaiting the next block report. */
  readonly pendingComps: Readonly<Record<string, { sum: number; count: number }>>;
  /** Live shocks the wire has announced, keyed by instanceId, so a shock that
   *  spans a save/load still resolves under its own name. */
  readonly startedShocks: Readonly<
    Record<string, { label: string; segment: string | null }>
  >;
}

export function createDefaultNewsSnapshot(): NewsSnapshot {
  return {
    schemaVersion: 1,
    headlines: [],
    currentDay: 0,
    slotsUsedToday: 0,
    pendingComps: {},
    startedShocks: {},
  };
}

export interface MarketNews {
  /**
   * End-of-tick day work: publish the block report on yesterday's comps, then
   * let the analyst desk make its forward call. Called by the MarketEconomy
   * facade on `clock:day_started`, after the shock scheduler and heat monitor
   * have had their say.
   */
  step(day: number): void;
  /** Record one transaction comp for the pending block report. */
  recordComp(entry: { segment: string; delta: number }): void;
  /** Newest first. */
  getHeadlines(): readonly Headline[];
  snapshot(): NewsSnapshot;
  restore(snap: NewsSnapshot): void;
  dispose(): void;
}

export interface MarketNewsDeps {
  readonly masterSeed: number;
  readonly bus: EventBus;
  /** The vehicle-category axis the wire can talk about. */
  readonly segments: readonly string[];
  /**
   * Lookahead into the shock scheduler's future arrival rolls. Omit to run the
   * wire with no leading tier (the direct + lagging tiers still fire).
   */
  readonly previewShock?: (day: number) => ShockPreview | null;
  readonly catalog?: NewsTemplatesConfig;
  readonly tunables?: Tunables;
}

/** The segment carrying the largest |magnitude| in a shock's effect map. */
function dominantSegment(
  magnitudes: Readonly<Record<string, number>>,
): { segment: string; magnitude: number } | null {
  let best: { segment: string; magnitude: number } | null = null;
  // Object key order on a payload built from the catalog's segmentEffects array
  // is insertion order, which is deterministic per shock definition.
  for (const [segment, magnitude] of Object.entries(magnitudes)) {
    if (!best || Math.abs(magnitude) > Math.abs(best.magnitude)) {
      best = { segment, magnitude };
    }
  }
  return best;
}

export function createMarketNews(deps: MarketNewsDeps): MarketNews {
  const catalog = deps.catalog ?? loadNewsTemplatesConfig();
  const tunables = deps.tunables ?? loadTunables();
  const {
    maxHeadlines,
    maxHeadlinesPerDay,
    rumorLeadDays,
    rumorHitProb,
    falseAlarmProbPerDay,
    blockReportMinComps,
    blockReportDeltaThreshold,
  } = tunables.marketEconomy.news;

  const byTrigger = new Map<NewsTrigger, NewsTemplate[]>();
  for (const tpl of catalog.templates) {
    const list = byTrigger.get(tpl.trigger);
    if (list) list.push(tpl);
    else byTrigger.set(tpl.trigger, [tpl]);
  }

  const headlines: Headline[] = [];
  const pendingComps = new Map<string, { sum: number; count: number }>();
  let currentDay = 0;
  let slotsUsedToday = 0;

  /** Percent slot: whole percent, floored at 1 so a real move never reads "0%". */
  function pct(fraction: number): string {
    return `${Math.max(1, Math.round(Math.abs(fraction) * 100))}%`;
  }

  function segmentLabel(segment: string | null): string {
    if (segment === null) return 'the market';
    return catalog.segmentLabels[segment] ?? segment;
  }

  /**
   * Lazy per-day reset. The day counter can't be reset from a `clock:day_started`
   * handler of our own — the shock scheduler emits from *inside* the facade's
   * day tick, so a shock headline can arrive before any handler of ours would
   * have run. Days only move forward, so resetting on first use of a new day is
   * both correct and independent of bus subscription order.
   */
  function enterDay(day: number): void {
    if (day === currentDay) return;
    currentDay = day;
    slotsUsedToday = 0;
  }

  interface PublishInput {
    readonly day: number;
    readonly trigger: NewsTrigger;
    readonly segment: string | null;
    readonly direction: NewsDirection;
    readonly slots?: Readonly<Record<string, string>>;
  }

  function publish(input: PublishInput): Headline | null {
    enterDay(input.day);
    if (slotsUsedToday >= maxHeadlinesPerDay) return null;
    const candidates = byTrigger.get(input.trigger);
    if (!candidates || candidates.length === 0) return null;

    const slot = slotsUsedToday;
    const rng = createRng(
      deriveSeed(deps.masterSeed, 'market_economy.news.template', {
        day: input.day,
        slot,
        trigger: input.trigger,
      }),
    );
    const tpl = candidates[Math.floor(rng() * candidates.length)];

    const filled = { segment: segmentLabel(input.segment), ...input.slots };
    const text = tpl.text.replace(/\{(\w+)\}/g, (whole, key: string) =>
      Object.prototype.hasOwnProperty.call(filled, key)
        ? (filled as Record<string, string>)[key]
        : whole,
    );

    const headline: Headline = {
      id: `${input.day}#${slot}`,
      day: input.day,
      templateId: tpl.id,
      source: tpl.source,
      sourceLabel: catalog.sourceLabels[tpl.source] ?? tpl.source,
      reliability: tpl.reliability,
      text,
      trigger: input.trigger,
      segment: input.segment,
      direction: input.direction,
    };

    slotsUsedToday += 1;
    headlines.push(headline);
    if (headlines.length > maxHeadlines) headlines.splice(0, headlines.length - maxHeadlines);

    deps.bus.publish('news:headline_published', {
      day: headline.day,
      headlineId: headline.id,
      source: headline.source,
      sourceLabel: headline.sourceLabel,
      reliability: headline.reliability,
      text: headline.text,
      trigger: headline.trigger,
      segment: headline.segment,
      direction: headline.direction,
    });
    return headline;
  }

  // ---- direct tier: things that already happened -------------------------

  // `market:shock_resolved` deliberately carries no label or segments — the
  // scheduler has already dropped the instance. Rather than re-deriving them
  // (which would mean the wire keeping its own copy of scheduler state), each
  // start is tagged here by `instanceId` and the tag is consumed on resolve.
  // The map is persisted, so a shock that spans a save/load still resolves with
  // its own name; a tag that somehow goes missing falls back to neutral wording
  // instead of printing a placeholder.
  const startedTags = new Map<string, { label: string; segment: string | null }>();
  const FALLBACK_SHOCK_LABEL = 'The market disruption';

  const onShockStarted = (e: {
    day: number;
    instanceId: string;
    label: string;
    segmentMagnitudes: Readonly<Record<string, number>>;
  }): void => {
    const dominant = dominantSegment(e.segmentMagnitudes);
    startedTags.set(e.instanceId, {
      label: e.label,
      segment: dominant?.segment ?? null,
    });
    publish({
      day: e.day,
      trigger: 'shock_started',
      segment: dominant?.segment ?? null,
      direction: (dominant?.magnitude ?? 0) >= 0 ? 'up' : 'down',
      slots: { label: e.label },
    });
  };

  const onShockResolved = (e: { day: number; instanceId: string }): void => {
    const tag = startedTags.get(e.instanceId);
    startedTags.delete(e.instanceId);
    publish({
      day: e.day,
      trigger: 'shock_resolved',
      segment: tag?.segment ?? null,
      // A shock lifting is relief regardless of which way it pushed values.
      direction: 'up',
      slots: { label: tag?.label ?? FALLBACK_SHOCK_LABEL },
    });
  };

  const onCompetitorPriceChanged = (e: {
    day: number;
    brand: string;
    oldPricing: number;
    newPricing: number;
  }): void => {
    const up = e.newPricing > e.oldPricing;
    publish({
      day: e.day,
      trigger: up ? 'rival_price_up' : 'rival_price_down',
      segment: null,
      direction: up ? 'up' : 'down',
      slots: { brand: e.brand },
    });
  };

  // ---- lagging tier: confirming what the player can already see -----------

  const onSegmentHeatUpdated = (e: {
    day: number;
    segment: string;
    delta: number;
  }): void => {
    publish({
      day: e.day,
      trigger: e.delta >= 0 ? 'heat_up' : 'heat_down',
      segment: e.segment,
      direction: e.delta >= 0 ? 'up' : 'down',
      slots: { pct: pct(e.delta) },
    });
  };

  deps.bus.subscribe('market:shock_started', onShockStarted);
  deps.bus.subscribe('market:shock_resolved', onShockResolved);
  deps.bus.subscribe('competitor:price_changed', onCompetitorPriceChanged);
  deps.bus.subscribe('market:segment_heat_updated', onSegmentHeatUpdated);

  // ---- day step: block report, then the desk's forward call ---------------

  function stepBlockReport(day: number): void {
    let best: { segment: string; mean: number } | null = null;
    // Fixed segment order so the reported segment never depends on which
    // transaction happened to land first.
    for (const segment of deps.segments) {
      const acc = pendingComps.get(segment);
      if (!acc || acc.count < blockReportMinComps) continue;
      const mean = acc.sum / acc.count;
      if (Math.abs(mean) < blockReportDeltaThreshold) continue;
      if (!best || Math.abs(mean) > Math.abs(best.mean)) best = { segment, mean };
    }
    pendingComps.clear();
    if (!best) return;
    publish({
      day,
      trigger: best.mean >= 0 ? 'auction_up' : 'auction_down',
      segment: best.segment,
      direction: best.mean >= 0 ? 'up' : 'down',
      slots: { pct: pct(best.mean) },
    });
  }

  function stepRumor(day: number): void {
    if (!deps.previewShock) return;

    let upcoming: { preview: ShockPreview; leadDays: number } | null = null;
    for (let d = day + 1; d <= day + rumorLeadDays; d += 1) {
      const preview = deps.previewShock(d);
      if (preview) {
        upcoming = { preview, leadDays: d - day };
        break;
      }
    }

    if (upcoming) {
      const hit = createRng(
        deriveSeed(deps.masterSeed, 'market_economy.news.rumor_hit', { day }),
      )();
      if (hit >= rumorHitProb) return;
      const dominant = dominantSegment(upcoming.preview.segmentMagnitudes);
      if (!dominant) return;
      publish({
        day,
        trigger: dominant.magnitude >= 0 ? 'rumor_up' : 'rumor_down',
        segment: dominant.segment,
        direction: dominant.magnitude >= 0 ? 'up' : 'down',
        slots: { days: String(upcoming.leadDays) },
      });
      return;
    }

    // Nothing is coming — the desk may still call one. This is the false-alarm
    // rate the player calibrates their trust against.
    const alarm = createRng(
      deriveSeed(deps.masterSeed, 'market_economy.news.false_alarm', { day }),
    )();
    if (alarm >= falseAlarmProbPerDay) return;
    if (deps.segments.length === 0) return;
    const pickRng = createRng(
      deriveSeed(deps.masterSeed, 'market_economy.news.false_alarm_pick', { day }),
    );
    const segment = deps.segments[Math.floor(pickRng() * deps.segments.length)];
    const up = pickRng() < 0.5;
    const leadDays = 1 + Math.floor(pickRng() * rumorLeadDays);
    publish({
      day,
      trigger: up ? 'rumor_up' : 'rumor_down',
      segment,
      direction: up ? 'up' : 'down',
      slots: { days: String(leadDays) },
    });
  }

  let disposed = false;
  return {
    step(day: number) {
      enterDay(day);
      stepBlockReport(day);
      stepRumor(day);
    },
    recordComp({ segment, delta }) {
      const acc = pendingComps.get(segment);
      if (acc) {
        acc.sum += delta;
        acc.count += 1;
      } else {
        pendingComps.set(segment, { sum: delta, count: 1 });
      }
    },
    getHeadlines: () => [...headlines].reverse(),
    snapshot: (): NewsSnapshot => ({
      schemaVersion: 1,
      headlines: [...headlines],
      currentDay,
      slotsUsedToday,
      pendingComps: Object.fromEntries(
        [...pendingComps].map(([segment, acc]) => [segment, { ...acc }]),
      ),
      startedShocks: Object.fromEntries(
        [...startedTags].map(([id, tag]) => [id, { ...tag }]),
      ),
    }),
    restore: (snap: NewsSnapshot) => {
      headlines.length = 0;
      headlines.push(...snap.headlines);
      currentDay = snap.currentDay;
      slotsUsedToday = snap.slotsUsedToday;
      pendingComps.clear();
      for (const [segment, acc] of Object.entries(snap.pendingComps)) {
        pendingComps.set(segment, { ...acc });
      }
      startedTags.clear();
      for (const [id, tag] of Object.entries(snap.startedShocks)) {
        startedTags.set(id, { ...tag });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      deps.bus.unsubscribe('market:shock_started', onShockStarted);
      deps.bus.unsubscribe('market:shock_resolved', onShockResolved);
      deps.bus.unsubscribe('competitor:price_changed', onCompetitorPriceChanged);
      deps.bus.unsubscribe('market:segment_heat_updated', onSegmentHeatUpdated);
    },
  };
}

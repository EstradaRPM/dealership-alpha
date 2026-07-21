import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadTunables, type Tunables } from '../data';
import {
  loadNewsTemplatesConfig,
  loadPricingStrategiesConfig,
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
 * **Voices (#177).** Which *source* speaks is a catalog concern, not an engine
 * one: templates carry their own source, so adding the trade press, the factory
 * bulletin and the competitor watch was mostly data. The one structural hook is
 * `PublishInput.source` — a shock declares its announcing voice through the
 * catalog's `shockSources` map (a recall is the factory's news, a fuel story is
 * the trade's), and a filter that matches nothing falls back to the full pool so
 * a copy gap can never swallow a headline about something that really happened.
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

/**
 * The `{pct}` slot: a whole percent, unsigned (the wording carries direction),
 * floored at 1 so a real move never reads "0%". Shared with the weekly report
 * so the column and the ticker round the same way.
 */
export function wholePercent(fraction: number): string {
  return `${Math.max(1, Math.round(Math.abs(fraction) * 100))}%`;
}

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
  /**
   * Maps a competitor's `[0,1]` pricing lean onto a ± band around market — the
   * SAME mapping the pricing screen's comparables panel uses (#175), so the
   * percentage the competitor-watch voice quotes is the percentage the player
   * would see on that rival's window stickers. Defaults to the pricing-strategy
   * config's `competitorSpread`.
   */
  readonly competitorSpread?: number;
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

/** The segment a rival leans hardest into, from the event's affinity map. */
function dominantAffinity(
  affinity: Readonly<Record<string, number>> | undefined,
): string | null {
  if (!affinity) return null;
  let best: { segment: string; weight: number } | null = null;
  for (const [segment, weight] of Object.entries(affinity)) {
    if (weight <= 0) continue;
    if (!best || weight > best.weight) best = { segment, weight };
  }
  return best?.segment ?? null;
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

  const competitorSpread =
    deps.competitorSpread ?? loadPricingStrategiesConfig().competitorSpread;

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

  const pct = wholePercent;

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
    /**
     * Restrict the template pool to one voice (#177) — a recall is announced by
     * the factory, not by the block. A filter that matches nothing falls back
     * to the full pool: a copy gap must never swallow a headline about
     * something that actually happened.
     */
    readonly source?: string | null;
  }

  function publish(input: PublishInput): Headline | null {
    enterDay(input.day);
    if (slotsUsedToday >= maxHeadlinesPerDay) return null;
    const pool = byTrigger.get(input.trigger);
    if (!pool || pool.length === 0) return null;
    const filtered = input.source
      ? pool.filter((tpl) => tpl.source === input.source)
      : null;
    const candidates = filtered && filtered.length > 0 ? filtered : pool;

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

  /**
   * Which voice announces a given shock (#177). A recall or an incentive
   * program is the factory's news; a fuel or credit story is the trade press's.
   * The mapping is catalog data, not shock physics, so it lives next to the
   * copy it selects.
   */
  function shockVoice(shockId: string): string | null {
    return catalog.shockSources[shockId] ?? null;
  }

  const onShockStarted = (e: {
    day: number;
    shockId: string;
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
      source: shockVoice(e.shockId),
      slots: { label: e.label },
    });
  };

  const onShockResolved = (e: {
    day: number;
    shockId: string;
    instanceId: string;
  }): void => {
    const tag = startedTags.get(e.instanceId);
    startedTags.delete(e.instanceId);
    publish({
      day: e.day,
      trigger: 'shock_resolved',
      segment: tag?.segment ?? null,
      // A shock lifting is relief regardless of which way it pushed values.
      direction: 'up',
      // The same voice that announced it closes it out.
      source: shockVoice(e.shockId),
      slots: { label: tag?.label ?? FALLBACK_SHOCK_LABEL },
    });
  };

  const onCompetitorPriceChanged = (e: {
    day: number;
    brand: string;
    oldPricing: number;
    newPricing: number;
    segmentAffinity?: Readonly<Record<string, number>>;
  }): void => {
    const up = e.newPricing > e.oldPricing;
    publish({
      day: e.day,
      trigger: up ? 'rival_price_up' : 'rival_price_down',
      // The rival's move is lot-wide, but naming the segment they lean hardest
      // into is what makes it actionable — that's the shelf you compete with.
      segment: dominantAffinity(e.segmentAffinity),
      direction: up ? 'up' : 'down',
      slots: {
        brand: e.brand,
        // A pricing lean is a position on a ±spread band around market, so a
        // lean move of Δ is an asking-price move of Δ × 2 × spread.
        pct: pct((e.newPricing - e.oldPricing) * 2 * competitorSpread),
      },
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

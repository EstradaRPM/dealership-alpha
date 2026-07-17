import type { EventBus, EventName, EventMap } from '../EventBus';

/**
 * Player-facing history log (#208).
 *
 * A durable, retrospective record of *notable* world events that — unlike the
 * App's per-day `floorEvents` buffer (reset every morning) and the dev-only
 * Telemetry recorder — survives across days and is surfaced to the player. It
 * subscribes to a fixed set of bus events, distils each into a human-readable
 * one-line entry stamped with the in-game day, and keeps the most recent
 * `maxEntries` in reverse-chronological order (newest first).
 *
 * It owns no game state of its own — it is a read-side projection of events
 * other modules already publish. Persisted via `snapshot()/restore()` under the
 * `historyLog` world-snapshot key so the log round-trips through save/load.
 */

export interface HistoryLogConfig {
  readonly schemaVersion: 1;
  /** Hard cap on retained entries; oldest are dropped past this. */
  readonly maxEntries: number;
}

/** The category of a logged event — drives UI grouping/iconography. */
export type HistoryEntryKind = 'sale' | 'escalation' | 'market' | 'tier';

export interface HistoryEntry {
  /** Monotonic id, stable across a session and persisted. */
  readonly id: number;
  /** In-game day the event occurred on. */
  readonly day: number;
  readonly kind: HistoryEntryKind;
  /** One-line, player-facing summary. */
  readonly text: string;
}

/** Save/load blob. Self-versioned per the #188 snapshot contract. */
export interface HistoryLogSnapshot {
  readonly schemaVersion: 1;
  readonly nextId: number;
  readonly currentDay: number;
  readonly entries: ReadonlyArray<HistoryEntry>;
}

export interface HistoryLog {
  /** Newest-first view of the retained entries. */
  getEntries(): ReadonlyArray<HistoryEntry>;
  getEntryCount(): number;
  snapshot(): HistoryLogSnapshot;
  restore(snap: HistoryLogSnapshot): void;
}

function loadConfig(): HistoryLogConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/historyLog.json');
  const cfg = raw as Partial<HistoryLogConfig>;
  return {
    schemaVersion: 1,
    maxEntries: cfg.maxEntries ?? 200,
  };
}

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export function createHistoryLog(deps: { bus: EventBus }): HistoryLog {
  const { bus } = deps;
  const config = loadConfig();

  // Stored newest-first so the UI and `getEntries` need no re-sort; `nextId`
  // is monotonic and persisted so ids stay stable across save/load.
  const entries: HistoryEntry[] = [];
  let nextId = 1;
  let currentDay = 1;

  function append(day: number, kind: HistoryEntryKind, text: string): void {
    entries.unshift({ id: nextId++, day, kind, text });
    if (entries.length > config.maxEntries) {
      entries.length = config.maxEntries;
    }
  }

  // Day cursor: most payloads carry their own `day`, but `clock:day_started`
  // keeps `currentDay` authoritative as a fallback for any that don't.
  bus.subscribe('clock:day_started', (p: EventMap['clock:day_started']) => {
    currentDay = p.day;
  });

  bus.subscribe('deal:closed', (p: EventMap['deal:closed']) => {
    const gross = p.frontGross + p.backGross;
    const terms =
      p.paymentMethod === 'cash' ? 'cash' : 'financed';
    append(
      currentDay,
      'sale',
      `Sold a unit (${terms}) — ${formatMoney(gross)} gross.`,
    );
  });

  bus.subscribe('market:shock_started', (p: EventMap['market:shock_started']) => {
    append(p.day, 'market', `Market shift: ${p.label}.`);
  });

  bus.subscribe('market:shock_resolved', (p: EventMap['market:shock_resolved']) => {
    append(p.day, 'market', `Market settled — ${p.shockId} passed.`);
  });

  // Competitor price moves (#267 / slice #158). `competitor:price_changed`
  // fires only when a rival's pricing crosses `pricingChangeThreshold`, so each
  // event is a discrete, notable shift in the competitive weather — exactly the
  // grain HistoryLog records. The `pricing` stat reads as "how high prices are",
  // so `newPricing > oldPricing` means the rival got *more* expensive (pressure
  // eased); lower means they undercut (pressure rose).
  //
  // The sibling `market:competitive_pressure` heartbeat is deliberately NOT
  // logged here: it republishes the full live roster every single day, so a log
  // entry per fire would flood the capped history and bury everything else. That
  // continuous ambient state belongs to the KPI/market-visibility panel, not the
  // discrete retrospective log.
  bus.subscribe('competitor:price_changed', (p: EventMap['competitor:price_changed']) => {
    const direction = p.newPricing > p.oldPricing ? 'raised' : 'cut';
    append(p.day, 'market', `Rival ${p.brand} ${direction} prices.`);
  });

  bus.subscribe('career:tier_up', (p: EventMap['career:tier_up']) => {
    append(p.day, 'tier', `Promoted to Tier ${p.toTier}.`);
  });

  return {
    getEntries() {
      return entries;
    },
    getEntryCount() {
      return entries.length;
    },
    snapshot() {
      return {
        schemaVersion: 1,
        nextId,
        currentDay,
        entries: entries.map((e) => ({ ...e })),
      };
    },
    restore(snap) {
      entries.length = 0;
      entries.push(...snap.entries.map((e) => ({ ...e })));
      nextId = snap.nextId;
      currentDay = snap.currentDay;
    },
  };
}

/** Behavior-neutral default for migrating pre-#208 saves (empty log). */
export function createDefaultHistoryLogSnapshot(): HistoryLogSnapshot {
  return { schemaVersion: 1, nextId: 1, currentDay: 1, entries: [] };
}

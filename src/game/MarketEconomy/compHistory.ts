import { loadTunables, type Tunables } from '../data';

/**
 * Per-segment rolling window of realized transactions (slice #157). Each
 * stored entry is the *relative* delta — `(realizedPrice / referenceValue) -
 * 1` — so wholesale (vs. anchor) and retail (vs. anchor × markup) comps
 * normalize onto the same axis. The composer turns a weighted mean of those
 * deltas into a segment drift term that layers on top of the per-save
 * personality bias (#156).
 */
export type CompSource = 'wholesale' | 'retail';

export interface CompEntry {
  readonly segment: string;
  readonly delta: number;
  readonly weight: number;
  readonly day: number;
  readonly source: CompSource;
}

export interface CompWindowConfig {
  readonly sizePerSegment: number;
  readonly ageCutoffDays: number;
  readonly retailWeight: number;
  readonly wholesaleWeight: number;
  readonly driftDamping: number;
}

export interface CompHistorySnapshot {
  readonly schemaVersion: 1;
  readonly windows: Readonly<Record<string, readonly CompEntry[]>>;
}

export interface CompHistory {
  recordWholesale(input: { segment: string; delta: number; day: number }): void;
  recordRetail(input: { segment: string; delta: number; day: number }): void;
  /**
   * Returns the damped weighted-mean delta over the window, ignoring entries
   * older than `ageCutoffDays`. Empty window → 0 (the slice AC cold-start
   * contract: providers fall back to personality-only behavior).
   */
  segmentDrift(segment: string, currentDay: number): number;
  /** Number of live (non-aged-out) entries — useful for tests + KPIs. */
  liveCount(segment: string, currentDay: number): number;
  snapshot(): CompHistorySnapshot;
  restore(snap: CompHistorySnapshot): void;
}

export interface CompHistoryDeps {
  readonly config?: CompWindowConfig;
  readonly tunables?: Tunables;
}

function resolveConfig(deps: CompHistoryDeps): CompWindowConfig {
  if (deps.config) return deps.config;
  const t = deps.tunables ?? loadTunables();
  return t.marketEconomy.compWindow;
}

export function createCompHistory(deps: CompHistoryDeps = {}): CompHistory {
  const config = resolveConfig(deps);
  const windows = new Map<string, CompEntry[]>();

  function push(entry: CompEntry): void {
    const w = windows.get(entry.segment) ?? [];
    w.push(entry);
    while (w.length > config.sizePerSegment) w.shift();
    windows.set(entry.segment, w);
  }

  return {
    recordWholesale({ segment, delta, day }) {
      push({
        segment,
        delta,
        weight: config.wholesaleWeight,
        day,
        source: 'wholesale',
      });
    },

    recordRetail({ segment, delta, day }) {
      push({
        segment,
        delta,
        weight: config.retailWeight,
        day,
        source: 'retail',
      });
    },

    segmentDrift(segment, currentDay) {
      const w = windows.get(segment);
      if (!w || w.length === 0) return 0;
      let weightedSum = 0;
      let weightTotal = 0;
      for (const e of w) {
        if (currentDay - e.day > config.ageCutoffDays) continue;
        weightedSum += e.delta * e.weight;
        weightTotal += e.weight;
      }
      if (weightTotal === 0) return 0;
      return (weightedSum / weightTotal) * config.driftDamping;
    },

    liveCount(segment, currentDay) {
      const w = windows.get(segment);
      if (!w) return 0;
      let n = 0;
      for (const e of w) {
        if (currentDay - e.day <= config.ageCutoffDays) n++;
      }
      return n;
    },

    snapshot() {
      const out: Record<string, readonly CompEntry[]> = {};
      for (const [segment, entries] of windows) {
        out[segment] = entries.map((e) => ({ ...e }));
      }
      return { schemaVersion: 1, windows: out };
    },

    restore(snap) {
      windows.clear();
      for (const [segment, entries] of Object.entries(snap.windows)) {
        windows.set(
          segment,
          entries.map((e) => ({ ...e })),
        );
      }
    },
  };
}

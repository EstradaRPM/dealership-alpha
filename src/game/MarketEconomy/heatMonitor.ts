import type { EventBus } from '../EventBus';
import { loadTunables, type Tunables } from '../data';
import type { SegmentHeatBySegmentFn } from './segmentHeat';

/**
 * Segment-heat change monitor (slice #176).
 *
 * `segmentHeat` is a continuously-moving composite (personality + emergent comp
 * drift + active shocks). Republishing it every day would be a heartbeat, not
 * news — the #267 lesson. So this watches the composite once per
 * `clock:day_started` and emits `market:segment_heat_updated` only when a
 * segment has moved `deltaThreshold` or more *since the last time it was
 * reported*. Small daily wobble stays silent; slow, persistent drift eventually
 * accumulates past the threshold and reports once.
 *
 * The baseline is captured on the first tick without emitting — a fresh save's
 * personality bias is the world the player starts in, not a change in it.
 *
 * State is a single per-segment last-reported map, persisted with the rest of
 * the MarketEconomy snapshot so a reload doesn't re-announce moves the player
 * has already read.
 */
export interface HeatMonitorSnapshot {
  readonly schemaVersion: 1;
  readonly lastReported: Readonly<Record<string, number>>;
}

export function createDefaultHeatMonitorSnapshot(): HeatMonitorSnapshot {
  return { schemaVersion: 1, lastReported: {} };
}

export interface SegmentHeatMonitor {
  /** Evaluate every segment; emit for those past the reporting threshold. */
  step(day: number): void;
  snapshot(): HeatMonitorSnapshot;
  restore(snap: HeatMonitorSnapshot): void;
}

export interface SegmentHeatMonitorDeps {
  readonly bus?: EventBus;
  /** The vehicle-category axis to watch. */
  readonly segments: readonly string[];
  readonly heatFor: SegmentHeatBySegmentFn;
  readonly tunables?: Tunables;
}

export function createSegmentHeatMonitor(
  deps: SegmentHeatMonitorDeps,
): SegmentHeatMonitor {
  const tunables = deps.tunables ?? loadTunables();
  const { deltaThreshold } = tunables.marketEconomy.heatMonitor;
  const lastReported = new Map<string, number>();

  function step(day: number): void {
    // Fixed segment order (not Map insertion order) so the emission sequence is
    // identical on replay regardless of which segment moved first.
    for (const segment of deps.segments) {
      const heat = deps.heatFor(segment);
      const previous = lastReported.get(segment);
      if (previous === undefined) {
        lastReported.set(segment, heat);
        continue;
      }
      const delta = heat - previous;
      if (Math.abs(delta) < deltaThreshold) continue;
      lastReported.set(segment, heat);
      deps.bus?.publish('market:segment_heat_updated', {
        day,
        segment,
        heat,
        previousHeat: previous,
        delta,
      });
    }
  }

  return {
    step,
    snapshot: () => ({
      schemaVersion: 1,
      lastReported: Object.fromEntries(lastReported),
    }),
    restore: (snap) => {
      lastReported.clear();
      for (const [segment, heat] of Object.entries(snap.lastReported)) {
        lastReported.set(segment, heat);
      }
    },
  };
}

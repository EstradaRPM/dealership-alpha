/**
 * DemandShaper (#198) — owns the per-day persona-mix weight vector over the
 * existing sales personas and turns it into a deterministic weighted spawn
 * draw. It also records realized arrivals into a trailing window so the
 * MANAGERIAL screen can show "who's been walking in" with trend arrows.
 *
 * Segment / body-style demand stays emergent downstream (persona → preference →
 * pickVehicleFor → segment taxonomy). This module only shapes *which persona*
 * walks in; it never touches the locked #125 DemandContext (volume projection).
 *
 * Determinism (#122-safe): `drawPersona` is a pure function of the injected RNG.
 * The composition root feeds it the existing seeded per-spawn stream, so a
 * replay reproduces the same persona sequence.
 */

/** Normalized or raw persona-weight vector, keyed by persona id. */
export type PersonaMix = Record<string, number>;

export type DemandTrend = 'rising' | 'steady' | 'falling';

export interface ObservedMixEntry {
  persona: string;
  /** Raw arrival count inside the current trailing window. */
  count: number;
  /** Fraction of the window's arrivals (0–1). Sums to ~1 across personas. */
  share: number;
  /** Newer-half vs older-half share comparison within the window. */
  trend: DemandTrend;
}

export interface DemandShaperConfig {
  /** Trailing arrivals retained for the observed-mix readout. */
  windowSize: number;
  /**
   * Share delta (newer half − older half) below which a persona's trend reads
   * 'steady' rather than rising/falling. Damps single-arrival jitter.
   */
  trendEpsilon: number;
}

export interface DemandShaper {
  /** The personas this shaper distributes over, in stable order. */
  readonly personas: readonly string[];
  /** The current per-day mix, normalized to sum 1. */
  getMix(): PersonaMix;
  /**
   * Replace the mix. Weights are stored raw (re-normalized on read/draw); keys
   * must be a subset of `personas`; missing personas default to weight 0.
   * Levers (#211/#212) drive this; the spine ships uniform + behavior-neutral.
   */
  setMix(weights: PersonaMix): void;
  /** Deterministic weighted persona draw from the current mix. */
  drawPersona(rng: () => number): string;
  /** Append a realized arrival to the trailing window. */
  recordArrival(persona: string): void;
  /** Per-persona count + share + trend over the current trailing window. */
  getObservedMix(): readonly ObservedMixEntry[];
}

export function createDemandShaper(deps: {
  personas: readonly string[];
  config: DemandShaperConfig;
  /** Initial weights (raw). Omitted ⇒ uniform (behavior-neutral baseline). */
  initialMix?: PersonaMix;
}): DemandShaper {
  const personas = [...deps.personas];
  if (personas.length === 0) {
    throw new Error('DemandShaper requires at least one persona');
  }
  const personaSet = new Set(personas);
  const { windowSize, trendEpsilon } = deps.config;

  // Raw weights; normalized lazily on read/draw so set/normalize stay consistent.
  let weights: PersonaMix = {};
  const setWeights = (raw: PersonaMix): void => {
    const next: PersonaMix = {};
    for (const p of personas) {
      const w = raw[p] ?? 0;
      if (w < 0) throw new Error(`DemandShaper weight for "${p}" is negative`);
      next[p] = w;
    }
    for (const key of Object.keys(raw)) {
      if (!personaSet.has(key)) {
        throw new Error(`DemandShaper: unknown persona "${key}"`);
      }
    }
    const sum = personas.reduce((s, p) => s + next[p], 0);
    if (sum <= 0) throw new Error('DemandShaper mix sums to 0 — no persona can spawn');
    weights = next;
  };
  setWeights(
    deps.initialMix ?? Object.fromEntries(personas.map((p) => [p, 1])),
  );

  const normalized = (): PersonaMix => {
    const sum = personas.reduce((s, p) => s + weights[p], 0);
    const mix: PersonaMix = {};
    for (const p of personas) mix[p] = weights[p] / sum;
    return mix;
  };

  // Trailing arrival window (oldest first). Capped at windowSize.
  const window: string[] = [];

  const countIn = (slice: readonly string[], persona: string): number =>
    slice.reduce((n, p) => (p === persona ? n + 1 : n), 0);

  const trendFor = (persona: string): DemandTrend => {
    const mid = Math.floor(window.length / 2);
    const older = window.slice(0, mid);
    const newer = window.slice(mid);
    if (older.length === 0 || newer.length === 0) return 'steady';
    const olderShare = countIn(older, persona) / older.length;
    const newerShare = countIn(newer, persona) / newer.length;
    const delta = newerShare - olderShare;
    if (delta > trendEpsilon) return 'rising';
    if (delta < -trendEpsilon) return 'falling';
    return 'steady';
  };

  return {
    personas,
    getMix: () => normalized(),
    setMix: (w) => setWeights(w),
    drawPersona: (rng) => {
      const mix = normalized();
      const r = rng();
      let cum = 0;
      for (const p of personas) {
        cum += mix[p];
        if (r < cum) return p;
      }
      // Floating-point fallthrough: return the last persona.
      return personas[personas.length - 1];
    },
    recordArrival: (persona) => {
      if (!personaSet.has(persona)) {
        throw new Error(`DemandShaper: cannot record unknown persona "${persona}"`);
      }
      window.push(persona);
      if (window.length > windowSize) window.shift();
    },
    getObservedMix: () => {
      const total = window.length;
      return personas.map((persona) => ({
        persona,
        count: countIn(window, persona),
        share: total === 0 ? 0 : countIn(window, persona) / total,
        trend: trendFor(persona),
      }));
    },
  };
}

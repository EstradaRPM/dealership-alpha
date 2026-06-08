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

export interface DemandInfluenceInput {
  readonly id: string;
  readonly label: string;
  readonly producer: 'inventory' | 'reputation' | 'advertising' | 'test';
  /**
   * Target additive persona deltas. Positive values make that persona likelier;
   * negative values lean demand away from that persona. The effective
   * contribution ramps toward this target over lagDays.
   */
  readonly weights: PersonaMix;
  /** Days for a changed target to ramp in. 0 means immediate. */
  readonly lagDays: number;
  /** Days for the lever to ramp out after removal. Defaults to lagDays. */
  readonly decayDays?: number;
}

export interface DemandInfluenceState extends DemandInfluenceInput {
  /** Current effective additive deltas used by getMix/drawPersona/readout. */
  readonly weights: PersonaMix;
  /** Requested target deltas; may differ from weights while lagging/decaying. */
  readonly targetWeights: PersonaMix;
  readonly lagDays: number;
  readonly decayDays: number;
  readonly elapsedDays: number;
  readonly removing: boolean;
}

export interface DemandShaperSnapshot {
  readonly schemaVersion: 1 | 2;
  readonly baselineMix: PersonaMix;
  readonly activeInputs: readonly (DemandInfluenceInput | DemandInfluenceState)[];
  /** Oldest first, capped by config.windowSize on restore. */
  readonly observedHistory: readonly string[];
}

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
   * This is the baseline; active influence inputs are layered on top.
   */
  setMix(weights: PersonaMix): void;
  /** Replace the live influence inputs layered over the baseline mix. */
  setInfluenceInputs(inputs: readonly DemandInfluenceInput[]): void;
  /** Add/update one producer without disturbing other producers. */
  upsertInfluenceInput(input: DemandInfluenceInput): void;
  /** Ramp one producer back to zero, preserving attribution while decaying. */
  removeInfluenceInput(id: string): void;
  /** Advance lag/decay state by whole days. */
  advanceInfluenceDay(days?: number): void;
  /** Live influence inputs with defensive copies for readout attribution. */
  getInfluenceInputs(): readonly DemandInfluenceState[];
  /** Deterministic weighted persona draw from the current mix. */
  drawPersona(rng: () => number): string;
  /** Append a realized arrival to the trailing window. */
  recordArrival(persona: string): void;
  /** Per-persona count + share + trend over the current trailing window. */
  getObservedMix(): readonly ObservedMixEntry[];
  snapshot(): DemandShaperSnapshot;
  restore(snap: DemandShaperSnapshot): void;
}

export function createDefaultDemandShaperSnapshot(
  personas: readonly string[],
): DemandShaperSnapshot {
  return {
    schemaVersion: 2,
    baselineMix: Object.fromEntries(personas.map((p) => [p, 1])),
    activeInputs: [],
    observedHistory: [],
  };
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
  let baselineWeights: PersonaMix = {};
  let activeInputs: DemandInfluenceState[] = [];
  const validateWeights = (raw: PersonaMix): PersonaMix => {
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
    return next;
  };
  const validateInfluenceWeights = (raw: PersonaMix): PersonaMix => {
    const next: PersonaMix = {};
    for (const p of personas) {
      const w = raw[p] ?? 0;
      if (!Number.isFinite(w)) {
        throw new Error(`DemandShaper influence weight for "${p}" is not finite`);
      }
      next[p] = w;
    }
    for (const key of Object.keys(raw)) {
      if (!personaSet.has(key)) {
        throw new Error(`DemandShaper: unknown persona "${key}"`);
      }
    }
    return next;
  };
  const setWeights = (raw: PersonaMix): void => {
    const next = validateWeights(raw);
    baselineWeights = next;
  };
  setWeights(
    deps.initialMix ?? Object.fromEntries(personas.map((p) => [p, 1])),
  );

  const zeroWeights = (): PersonaMix =>
    Object.fromEntries(personas.map((p) => [p, 0]));

  const copyWeights = (weights: PersonaMix): PersonaMix =>
    Object.fromEntries(personas.map((p) => [p, weights[p] ?? 0]));

  const hasDelta = (weights: PersonaMix): boolean =>
    personas.some((p) => Math.abs(weights[p] ?? 0) > 1e-9);

  const sameWeights = (a: PersonaMix, b: PersonaMix): boolean =>
    personas.every((p) => Math.abs((a[p] ?? 0) - (b[p] ?? 0)) <= 1e-9);

  const lerpWeights = (
    from: PersonaMix,
    to: PersonaMix,
    progress: number,
  ): PersonaMix =>
    Object.fromEntries(
      personas.map((p) => [
        p,
        (from[p] ?? 0) + ((to[p] ?? 0) - (from[p] ?? 0)) * progress,
      ]),
    );

  const normalizeDuration = (days: number | undefined, fallback = 0): number => {
    const value = days ?? fallback;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('DemandShaper influence lag/decay days must be nonnegative');
    }
    return Math.floor(value);
  };

  const materializeInput = (
    input: DemandInfluenceInput,
    existing?: DemandInfluenceState,
  ): DemandInfluenceState => {
    const targetWeights = validateInfluenceWeights(input.weights);
    const lagDays = normalizeDuration(input.lagDays);
    const decayDays = normalizeDuration(input.decayDays, lagDays);
    const startWeights = existing ? copyWeights(existing.weights) : zeroWeights();
    const targetUnchanged =
      existing &&
      sameWeights(existing.targetWeights, targetWeights) &&
      existing.label === input.label &&
      existing.producer === input.producer &&
      existing.lagDays === lagDays &&
      existing.decayDays === decayDays &&
      !existing.removing;
    if (targetUnchanged) return existing;

    return {
      id: input.id,
      label: input.label,
      producer: input.producer,
      weights: lagDays === 0 ? copyWeights(targetWeights) : startWeights,
      targetWeights,
      lagDays,
      decayDays,
      elapsedDays: lagDays === 0 ? lagDays : 0,
      removing: false,
    };
  };

  const snapshotInput = (input: DemandInfluenceState): DemandInfluenceState => ({
    id: input.id,
    label: input.label,
    producer: input.producer,
    weights: copyWeights(input.weights),
    targetWeights: copyWeights(input.targetWeights),
    lagDays: input.lagDays,
    decayDays: input.decayDays,
    elapsedDays: input.elapsedDays,
    removing: input.removing,
  });

  const restoreInput = (
    input: DemandInfluenceInput | DemandInfluenceState,
  ): DemandInfluenceState => {
    if ('targetWeights' in input) {
      return {
        id: input.id,
        label: input.label,
        producer: input.producer,
        weights: validateInfluenceWeights(input.weights),
        targetWeights: validateInfluenceWeights(input.targetWeights),
        lagDays: normalizeDuration(input.lagDays),
        decayDays: normalizeDuration(input.decayDays, input.lagDays),
        elapsedDays: normalizeDuration(input.elapsedDays),
        removing: input.removing,
      };
    }
    // v1 snapshots stored already-effective additive weights only.
    return materializeInput({
      id: input.id,
      label: input.label,
      producer: input.producer ?? 'test',
      weights: input.weights,
      lagDays: 0,
      decayDays: 0,
    });
  };

  const upsertInput = (input: DemandInfluenceInput): void => {
    const existing = activeInputs.find((i) => i.id === input.id);
    const next = materializeInput(input, existing);
    activeInputs = existing
      ? activeInputs.map((i) => (i.id === input.id ? next : i))
      : [...activeInputs, next];
  };

  const removeInput = (id: string): void => {
    activeInputs = activeInputs.flatMap((input) => {
      if (input.id !== id) return [input];
      if (!hasDelta(input.weights) && !hasDelta(input.targetWeights)) return [];
      if (input.decayDays === 0) return [];
      return [
        {
          ...input,
          targetWeights: zeroWeights(),
          elapsedDays: 0,
          removing: true,
        },
      ];
    });
  };

  const advanceInfluences = (days = 1): void => {
    const wholeDays = normalizeDuration(days);
    for (let day = 0; day < wholeDays; day++) {
      activeInputs = activeInputs.flatMap((input) => {
        const duration = input.removing ? input.decayDays : input.lagDays;
        const elapsedDays = input.elapsedDays + 1;
        const progress = duration === 0 ? 1 : Math.min(1, elapsedDays / duration);
        const weights = lerpWeights(input.weights, input.targetWeights, progress);
        const next = { ...input, weights, elapsedDays };
        if (next.removing && progress >= 1 && !hasDelta(next.weights)) return [];
        return [next];
      });
    }
  };

  const normalized = (): PersonaMix => {
    const combined: PersonaMix = {};
    for (const p of personas) {
      combined[p] = Math.max(
        0,
        baselineWeights[p] +
          activeInputs.reduce((sum, input) => sum + (input.weights[p] ?? 0), 0),
      );
    }
    const sum = personas.reduce((s, p) => s + combined[p], 0);
    if (sum <= 0) throw new Error('DemandShaper mix sums to 0 — no persona can spawn');
    const mix: PersonaMix = {};
    for (const p of personas) mix[p] = combined[p] / sum;
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
    snapshot: () => ({
      schemaVersion: 2,
      baselineMix: { ...baselineWeights },
      activeInputs: activeInputs.map(snapshotInput),
      observedHistory: [...window],
    }),
    setInfluenceInputs: (inputs) => {
      const incomingIds = new Set(inputs.map((input) => input.id));
      for (const input of inputs) upsertInput(input);
      for (const input of activeInputs) {
        if (!incomingIds.has(input.id)) removeInput(input.id);
      }
    },
    upsertInfluenceInput: upsertInput,
    removeInfluenceInput: removeInput,
    advanceInfluenceDay: advanceInfluences,
    getInfluenceInputs: () => activeInputs.map(snapshotInput),
    restore: (snap) => {
      if (snap.schemaVersion !== 1 && snap.schemaVersion !== 2) {
        throw new Error(
          `DemandShaper snapshot schema ${snap.schemaVersion} is not supported`,
        );
      }
      setWeights(snap.baselineMix);
      activeInputs = snap.activeInputs.map(restoreInput);
      window.length = 0;
      for (const persona of snap.observedHistory) {
        if (!personaSet.has(persona)) {
          throw new Error(`DemandShaper: cannot restore unknown persona "${persona}"`);
        }
        window.push(persona);
      }
      while (window.length > windowSize) window.shift();
    },
  };
}

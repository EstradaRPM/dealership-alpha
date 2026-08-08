/**
 * DemandShaper (#198; re-keyed to vehicle-type segments in #278, Pricing/Demand
 * spine S6) — owns the per-day **segment heat map** (a weight vector over the
 * vehicle-type segments: sedan / truck / suv) and turns it into a deterministic
 * weighted spawn draw. It also records realized arrivals into a trailing window
 * so the MANAGERIAL screen can show "what's hot on the lot" with trend arrows.
 *
 * Segment heat is now the demand driver. Buyer personas demote to per-customer
 * negotiation traits: the composition root rolls a visit archetype *within* the
 * drawn segment (the negotiation flavor), but the segment — which demand is in
 * the market — comes from this heat map, not a persona distribution.
 *
 * Determinism (#122-safe): `drawSegment` is a pure function of the injected RNG.
 * The composition root feeds it the existing seeded per-spawn stream, so a
 * replay reproduces the same segment sequence.
 */

/** Normalized or raw segment-heat weight vector, keyed by segment id. */
export type SegmentMix = Record<string, number>;

/**
 * Additive deltas over the PERSON archetype universe (#372) — the second lane
 * an influence input can pull. Where `SegmentMix` says which kind of car is in
 * demand, this says who is walking in to buy it, and the two are orthogonal:
 * segment heat picks the segment, the person skew bends the within-segment
 * archetype roll the composition root makes inside that segment.
 */
export type PersonMix = Record<string, number>;

export type DemandTrend = 'rising' | 'steady' | 'falling';

export interface DemandInfluenceInput {
  readonly id: string;
  readonly label: string;
  readonly producer: 'inventory' | 'reputation' | 'advertising' | 'pricing' | 'test';
  /**
   * Target additive segment deltas. Positive values make that segment hotter;
   * negative values cool it. The effective contribution ramps toward this
   * target over lagDays.
   */
  readonly weights: SegmentMix;
  /**
   * Target additive person-archetype deltas (#372). Omitted ⇒ no crowd skew,
   * which is what leaves every segment-only producer byte-identical. Ramped by
   * the SAME lag/decay clock as `weights` — a campaign's two lanes are one
   * lever, and letting them ramp on separate clocks would let a push arrive as
   * one crowd and settle as another.
   */
  readonly personWeights?: PersonMix;
  /** Days for a changed target to ramp in. 0 means immediate. */
  readonly lagDays: number;
  /** Days for the lever to ramp out after removal. Defaults to lagDays. */
  readonly decayDays?: number;
}

export interface DemandInfluenceState extends DemandInfluenceInput {
  /** Current effective additive deltas used by getMix/drawSegment/readout. */
  readonly weights: SegmentMix;
  /** Requested target deltas; may differ from weights while lagging/decaying. */
  readonly targetWeights: SegmentMix;
  /** Current effective person-archetype deltas used by getPersonSkew/readout. */
  readonly personWeights: PersonMix;
  /** Requested target person deltas; differs while lagging/decaying. */
  readonly targetPersonWeights: PersonMix;
  readonly lagDays: number;
  readonly decayDays: number;
  readonly elapsedDays: number;
  readonly removing: boolean;
}

export interface DemandShaperSnapshot {
  /** 1|2 are legacy persona-keyed schemas; 3 is the segment-keyed heat map. */
  readonly schemaVersion: 1 | 2 | 3;
  readonly baselineMix: SegmentMix;
  readonly activeInputs: readonly (DemandInfluenceInput | DemandInfluenceState)[];
  /** Oldest first, capped by config.windowSize on restore. */
  readonly observedHistory: readonly string[];
}

export interface ObservedMixEntry {
  segment: string;
  /** Raw arrival count inside the current trailing window. */
  count: number;
  /** Fraction of the window's arrivals (0–1). Sums to ~1 across segments. */
  share: number;
  /** Newer-half vs older-half share comparison within the window. */
  trend: DemandTrend;
}

export interface DemandShaperConfig {
  /** Trailing arrivals retained for the observed-mix readout. */
  windowSize: number;
  /**
   * Share delta (newer half − older half) below which a segment's trend reads
   * 'steady' rather than rising/falling. Damps single-arrival jitter.
   */
  trendEpsilon: number;
}

export interface DemandShaper {
  /** The vehicle-type segments this shaper distributes over, in stable order. */
  readonly segments: readonly string[];
  /** The current per-day heat map, normalized to sum 1. */
  getMix(): SegmentMix;
  /**
   * Replace the heat map. Weights are stored raw (re-normalized on read/draw);
   * keys must be a subset of `segments`; missing segments default to weight 0.
   * This is the baseline; active influence inputs are layered on top.
   */
  setMix(weights: SegmentMix): void;
  /** Replace the live influence inputs layered over the baseline heat map. */
  setInfluenceInputs(inputs: readonly DemandInfluenceInput[]): void;
  /** Add/update one producer without disturbing other producers. */
  upsertInfluenceInput(input: DemandInfluenceInput): void;
  /** Ramp one producer back to zero, preserving attribution while decaying. */
  removeInfluenceInput(id: string): void;
  /** Advance lag/decay state by whole days. */
  advanceInfluenceDay(days?: number): void;
  /** Live influence inputs with defensive copies for readout attribution. */
  getInfluenceInputs(): readonly DemandInfluenceState[];
  /**
   * Summed effective person-archetype deltas across every live input (#372).
   * These are ADDITIVE skews on the within-segment archetype weights, not a
   * distribution — the shaper does not own that table (it belongs to
   * CustomerPool, whose `skewSegmentArchetypes` is the one place the skew is
   * applied). Every declared archetype is present, absent ones as 0.
   */
  getPersonSkew(): PersonMix;
  /** Deterministic weighted segment draw from the current heat map. */
  drawSegment(rng: () => number): string;
  /** Append a realized arrival (by segment) to the trailing window. */
  recordArrival(segment: string): void;
  /** Per-segment count + share + trend over the current trailing window. */
  getObservedMix(): readonly ObservedMixEntry[];
  snapshot(): DemandShaperSnapshot;
  restore(snap: DemandShaperSnapshot): void;
}

export function createDefaultDemandShaperSnapshot(
  segments: readonly string[],
): DemandShaperSnapshot {
  return {
    schemaVersion: 3,
    baselineMix: Object.fromEntries(segments.map((s) => [s, 1])),
    activeInputs: [],
    observedHistory: [],
  };
}

export function createDemandShaper(deps: {
  segments: readonly string[];
  config: DemandShaperConfig;
  /** Initial weights (raw). Omitted ⇒ uniform (behavior-neutral baseline). */
  initialMix?: SegmentMix;
  /**
   * The person-archetype id universe an input may skew (#372). Passed in by the
   * composition root off `SALES_ARCHETYPES`, the same way `segments` is passed
   * in off the tunables — the shaper stays free of a CustomerPool dep. Omitted
   * ⇒ the lane is closed and any person weight is refused by key, which is a
   * louder failure than silently skewing a crowd nobody declared.
   */
  personArchetypes?: readonly string[];
}): DemandShaper {
  const segments = [...deps.segments];
  if (segments.length === 0) {
    throw new Error('DemandShaper requires at least one segment');
  }
  const segmentSet = new Set(segments);
  const personArchetypes = [...(deps.personArchetypes ?? [])];
  const personSet = new Set(personArchetypes);
  const { windowSize, trendEpsilon } = deps.config;

  // Raw weights; normalized lazily on read/draw so set/normalize stay consistent.
  let baselineWeights: SegmentMix = {};
  let activeInputs: DemandInfluenceState[] = [];
  const validateWeights = (raw: SegmentMix): SegmentMix => {
    const next: SegmentMix = {};
    for (const s of segments) {
      const w = raw[s] ?? 0;
      if (w < 0) throw new Error(`DemandShaper weight for "${s}" is negative`);
      next[s] = w;
    }
    for (const key of Object.keys(raw)) {
      if (!segmentSet.has(key)) {
        throw new Error(`DemandShaper: unknown segment "${key}"`);
      }
    }
    const sum = segments.reduce((acc, s) => acc + next[s], 0);
    if (sum <= 0) throw new Error('DemandShaper mix sums to 0 — no segment can spawn');
    return next;
  };
  const validateInfluenceWeights = (raw: SegmentMix): SegmentMix => {
    const next: SegmentMix = {};
    for (const s of segments) {
      const w = raw[s] ?? 0;
      if (!Number.isFinite(w)) {
        throw new Error(`DemandShaper influence weight for "${s}" is not finite`);
      }
      next[s] = w;
    }
    for (const key of Object.keys(raw)) {
      if (!segmentSet.has(key)) {
        throw new Error(`DemandShaper: unknown segment "${key}"`);
      }
    }
    return next;
  };
  const validatePersonWeights = (raw: PersonMix | undefined): PersonMix => {
    const next: PersonMix = {};
    for (const p of personArchetypes) {
      const w = raw?.[p] ?? 0;
      if (!Number.isFinite(w)) {
        throw new Error(`DemandShaper person weight for "${p}" is not finite`);
      }
      next[p] = w;
    }
    for (const key of Object.keys(raw ?? {})) {
      if (!personSet.has(key)) {
        throw new Error(`DemandShaper: unknown person archetype "${key}"`);
      }
    }
    return next;
  };
  const setWeights = (raw: SegmentMix): void => {
    const next = validateWeights(raw);
    baselineWeights = next;
  };
  setWeights(
    deps.initialMix ?? Object.fromEntries(segments.map((s) => [s, 1])),
  );

  // Vector helpers are keyed by an explicit key list so the segment lane and the
  // #372 person lane share ONE set of them. Two hand-copied sets is how the two
  // lanes would start lagging on different arithmetic.
  const zeroOver = (keys: readonly string[]): Record<string, number> =>
    Object.fromEntries(keys.map((k) => [k, 0]));

  const copyOver = (
    keys: readonly string[],
    weights: Record<string, number>,
  ): Record<string, number> =>
    Object.fromEntries(keys.map((k) => [k, weights[k] ?? 0]));

  const hasDeltaOver = (
    keys: readonly string[],
    weights: Record<string, number>,
  ): boolean => keys.some((k) => Math.abs(weights[k] ?? 0) > 1e-9);

  const sameOver = (
    keys: readonly string[],
    a: Record<string, number>,
    b: Record<string, number>,
  ): boolean => keys.every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) <= 1e-9);

  const lerpOver = (
    keys: readonly string[],
    from: Record<string, number>,
    to: Record<string, number>,
    progress: number,
  ): Record<string, number> =>
    Object.fromEntries(
      keys.map((k) => [
        k,
        (from[k] ?? 0) + ((to[k] ?? 0) - (from[k] ?? 0)) * progress,
      ]),
    );

  const zeroWeights = (): SegmentMix => zeroOver(segments);
  const copyWeights = (weights: SegmentMix): SegmentMix =>
    copyOver(segments, weights);
  const hasDelta = (weights: SegmentMix): boolean =>
    hasDeltaOver(segments, weights);
  const sameWeights = (a: SegmentMix, b: SegmentMix): boolean =>
    sameOver(segments, a, b);
  const lerpWeights = (
    from: SegmentMix,
    to: SegmentMix,
    progress: number,
  ): SegmentMix => lerpOver(segments, from, to, progress);

  const zeroPersons = (): PersonMix => zeroOver(personArchetypes);
  const copyPersons = (weights: PersonMix): PersonMix =>
    copyOver(personArchetypes, weights);
  const hasPersonDelta = (weights: PersonMix): boolean =>
    hasDeltaOver(personArchetypes, weights);
  const samePersons = (a: PersonMix, b: PersonMix): boolean =>
    sameOver(personArchetypes, a, b);
  const lerpPersons = (
    from: PersonMix,
    to: PersonMix,
    progress: number,
  ): PersonMix => lerpOver(personArchetypes, from, to, progress);

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
    const targetPersonWeights = validatePersonWeights(input.personWeights);
    const lagDays = normalizeDuration(input.lagDays);
    const decayDays = normalizeDuration(input.decayDays, lagDays);
    const startWeights = existing ? copyWeights(existing.weights) : zeroWeights();
    const startPersons = existing
      ? copyPersons(existing.personWeights)
      : zeroPersons();
    const targetUnchanged =
      existing &&
      sameWeights(existing.targetWeights, targetWeights) &&
      samePersons(existing.targetPersonWeights, targetPersonWeights) &&
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
      personWeights: lagDays === 0 ? copyPersons(targetPersonWeights) : startPersons,
      targetPersonWeights,
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
    personWeights: copyPersons(input.personWeights),
    targetPersonWeights: copyPersons(input.targetPersonWeights),
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
        // Optional on the wire (#372): a pre-#372 schema-3 blob carries neither
        // key and restores as "this lever skews nobody", which is exactly what
        // it meant. That is why the snapshot schema did NOT need a version bump.
        personWeights: validatePersonWeights(input.personWeights),
        targetPersonWeights: validatePersonWeights(input.targetPersonWeights),
        lagDays: normalizeDuration(input.lagDays),
        decayDays: normalizeDuration(input.decayDays, input.lagDays),
        elapsedDays: normalizeDuration(input.elapsedDays),
        removing: input.removing,
      };
    }
    // Legacy snapshots stored already-effective additive weights only.
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
      const carriesDelta =
        hasDelta(input.weights) ||
        hasDelta(input.targetWeights) ||
        hasPersonDelta(input.personWeights) ||
        hasPersonDelta(input.targetPersonWeights);
      if (!carriesDelta) return [];
      if (input.decayDays === 0) return [];
      return [
        {
          ...input,
          targetWeights: zeroWeights(),
          targetPersonWeights: zeroPersons(),
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
        const personWeights = lerpPersons(
          input.personWeights,
          input.targetPersonWeights,
          progress,
        );
        const next = { ...input, weights, personWeights, elapsedDays };
        if (
          next.removing &&
          progress >= 1 &&
          !hasDelta(next.weights) &&
          !hasPersonDelta(next.personWeights)
        ) {
          return [];
        }
        return [next];
      });
    }
  };

  const normalized = (): SegmentMix => {
    const combined: SegmentMix = {};
    for (const s of segments) {
      combined[s] = Math.max(
        0,
        baselineWeights[s] +
          activeInputs.reduce((sum, input) => sum + (input.weights[s] ?? 0), 0),
      );
    }
    const sum = segments.reduce((acc, s) => acc + combined[s], 0);
    if (sum <= 0) throw new Error('DemandShaper mix sums to 0 — no segment can spawn');
    const mix: SegmentMix = {};
    for (const s of segments) mix[s] = combined[s] / sum;
    return mix;
  };

  // Trailing arrival window (oldest first). Capped at windowSize.
  const window: string[] = [];

  const countIn = (slice: readonly string[], segment: string): number =>
    slice.reduce((n, s) => (s === segment ? n + 1 : n), 0);

  const trendFor = (segment: string): DemandTrend => {
    const mid = Math.floor(window.length / 2);
    const older = window.slice(0, mid);
    const newer = window.slice(mid);
    if (older.length === 0 || newer.length === 0) return 'steady';
    const olderShare = countIn(older, segment) / older.length;
    const newerShare = countIn(newer, segment) / newer.length;
    const delta = newerShare - olderShare;
    if (delta > trendEpsilon) return 'rising';
    if (delta < -trendEpsilon) return 'falling';
    return 'steady';
  };

  return {
    segments,
    getMix: () => normalized(),
    setMix: (w) => setWeights(w),
    drawSegment: (rng) => {
      const mix = normalized();
      const r = rng();
      let cum = 0;
      for (const s of segments) {
        cum += mix[s];
        if (r < cum) return s;
      }
      // Floating-point fallthrough: return the last segment.
      return segments[segments.length - 1];
    },
    recordArrival: (segment) => {
      if (!segmentSet.has(segment)) {
        throw new Error(`DemandShaper: cannot record unknown segment "${segment}"`);
      }
      window.push(segment);
      if (window.length > windowSize) window.shift();
    },
    getObservedMix: () => {
      const total = window.length;
      return segments.map((segment) => ({
        segment,
        count: countIn(window, segment),
        share: total === 0 ? 0 : countIn(window, segment) / total,
        trend: trendFor(segment),
      }));
    },
    snapshot: () => ({
      schemaVersion: 3,
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
    getPersonSkew: () => {
      const skew: PersonMix = {};
      for (const p of personArchetypes) {
        skew[p] = activeInputs.reduce(
          (sum, input) => sum + (input.personWeights[p] ?? 0),
          0,
        );
      }
      return skew;
    },
    restore: (snap) => {
      // Legacy persona-keyed snapshots (#198 schemas 1|2) cannot be re-keyed to
      // segments cleanly, so they migrate to the behavior-neutral default
      // (uniform segment baseline, no inputs, empty history) — same discipline
      // as the original v1→v2 migration. Only schema 3 round-trips exactly.
      if (snap.schemaVersion === 1 || snap.schemaVersion === 2) {
        setWeights(Object.fromEntries(segments.map((s) => [s, 1])));
        activeInputs = [];
        window.length = 0;
        return;
      }
      if (snap.schemaVersion !== 3) {
        throw new Error(
          `DemandShaper snapshot schema ${snap.schemaVersion} is not supported`,
        );
      }
      setWeights(snap.baselineMix);
      activeInputs = snap.activeInputs.map(restoreInput);
      window.length = 0;
      for (const segment of snap.observedHistory) {
        if (!segmentSet.has(segment)) {
          throw new Error(`DemandShaper: cannot restore unknown segment "${segment}"`);
        }
        window.push(segment);
      }
      while (window.length > windowSize) window.shift();
    },
  };
}

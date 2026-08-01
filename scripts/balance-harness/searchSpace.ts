/**
 * The tunable manifest (#344) — the declared surface a balance search is allowed
 * to touch, and the guard that keeps it there.
 *
 * This is what stops an optimizer from wandering out of *balance numbers* and
 * into *design decisions*. Every dimension below names a file, a path, a legal
 * range (or discrete set), and one line on why that key is a magnitude someone
 * guessed rather than a choice someone made. **Keys not named here are frozen**,
 * and that is asserted by `tests/balanceHarness.searchSpace.test.ts` — a byte
 * comparison of every registered file before, during, and after a candidate —
 * rather than trusted.
 *
 * The manifest lives in the harness, next to `policies.ts`, and NOT under
 * `data/`: `data/**` is game content read by schema-validated loaders, and this
 * is tooling config that no game module reads. Same reasoning that keeps the
 * policy bots' strategy numbers out of `data/`.
 *
 * Deliberately absent, with reasons — these are the boundary the freeze draws:
 *   - `data/tier-pacing-targets.json` isn't even a registered file: the pacing
 *     targets are the director's to author (#343), so no search can reach them.
 *   - `tier-gate` `streak` — the campaign rule (an unbroken run of good months),
 *     not a magnitude.
 *   - `inventory.frontlineHoldDays` — the uniform ~2-day hold is a locked design
 *     decision (#295), and a search that shortened it would be changing the game.
 *   - `news-progression-gating` `minTier` / copy, `intel-precision`
 *     `heatGranularity` — progression and presentation choices.
 *   - `starting-inventory` `candidateTrials` — generation quality, not balance.
 *
 * Inspect the live space with `npm run balance -- space`.
 */
import {
  applyOverride,
  knownFiles,
  positionalPath,
  readTunable,
  registeredFile,
  restoreOverride,
} from './overrides';

export interface DimensionRange {
  readonly min: number;
  readonly max: number;
  /** Grid resolution for sweeps; a proposal need not land on it. */
  readonly step: number;
}

export interface Dimension {
  /** Stable id used by candidates, reports, and the resumable study file. */
  readonly id: string;
  /** A file registered in `overrides.ts`. */
  readonly file: string;
  /** Dotted path into that file; may use `name[field=value]` selectors. */
  readonly path: string;
  /** Why this is a balance number rather than a design decision. */
  readonly why: string;
  readonly range?: DimensionRange;
  /** Discrete alternative to `range` — the only legal values. */
  readonly values?: readonly number[];
}

/** Floating-point slack for range/set membership. */
const EPS = 1e-9;

export const SEARCH_SPACE: readonly Dimension[] = [
  // ── Tier gates: the thresholds the whole campaign is paced against ─────────
  {
    id: 'gate.t1.units',
    file: 'tier-gate',
    path: 'tiers.1.units',
    why: 'Monthly retail units to clear Tier 1 — a first-pass magnitude, never tuned against a run.',
    range: { min: 4, max: 14, step: 1 },
  },
  {
    id: 'gate.t1.cash',
    file: 'tier-gate',
    path: 'tiers.1.cash',
    why: 'Cash on hand to clear Tier 1; the face the un-tuned bot fails first.',
    range: { min: 30000, max: 120000, step: 5000 },
  },
  {
    id: 'gate.t2.units',
    file: 'tier-gate',
    path: 'tiers.2.units',
    why: 'Tier 2 unit face — sets T2 dwell, which the pacing targets grade.',
    range: { min: 10, max: 24, step: 1 },
  },
  {
    id: 'gate.t2.gross',
    file: 'tier-gate',
    path: 'tiers.2.gross',
    why: 'Tier 2 gross face; a magnitude, not a rule about which faces exist.',
    range: { min: 15000, max: 60000, step: 2500 },
  },
  {
    id: 'gate.t2.cash',
    file: 'tier-gate',
    path: 'tiers.2.cash',
    why: 'Tier 2 cash face — the balance between reinvesting and banking.',
    range: { min: 80000, max: 260000, step: 10000 },
  },
  {
    id: 'gate.t3.units',
    file: 'tier-gate',
    path: 'tiers.3.units',
    why: 'Tier 3 unit face; paced against a showroom-scale floor, never measured.',
    range: { min: 18, max: 40, step: 1 },
  },
  {
    id: 'gate.t3.gross',
    file: 'tier-gate',
    path: 'tiers.3.gross',
    why: 'Tier 3 gross face — a magnitude on the same axis as T2, guessed the same way.',
    range: { min: 40000, max: 120000, step: 5000 },
  },
  {
    id: 'gate.t3.cash',
    file: 'tier-gate',
    path: 'tiers.3.cash',
    why: 'Tier 3 cash face; scales with the facility step, but the number is a guess.',
    range: { min: 250000, max: 650000, step: 10000 },
  },

  // ── Channel-desk manager gates (#289–#292): explicit "calibrate in #286" ───
  {
    id: 'ucm.act.pricing',
    file: 'tunables',
    path: 'managerGates.actThresholds.pricing',
    why: 'Skill a UCM needs to own auto-pricing; the ladder is design, the number is a placeholder.',
    range: { min: 40, max: 85, step: 5 },
  },
  {
    id: 'ucm.act.toClosing',
    file: 'tunables',
    path: 'managerGates.actThresholds.t_o_closing',
    why: 'Skill a UCM needs to desk below-floor discounts — placeholder pending the S14 pass.',
    range: { min: 40, max: 85, step: 5 },
  },
  {
    id: 'ucm.act.conditionReading',
    file: 'tunables',
    path: 'managerGates.actThresholds.condition_reading',
    why: 'Skill a UCM needs to auto-approve escalated trades — placeholder pending the S14 pass.',
    range: { min: 40, max: 85, step: 5 },
  },
  {
    id: 'ucm.drift.pricing',
    file: 'tunables',
    path: 'managerGates.executionDrift.pricing.maxDriftFraction',
    why: 'How far a green UCM mis-prices against the setpoint; the drift model is design, its width is not.',
    range: { min: 0.02, max: 0.2, step: 0.01 },
  },
  {
    id: 'ucm.drift.toClosing',
    file: 'tunables',
    path: 'managerGates.executionDrift.t_o_closing.maxDriftFraction',
    why: 'How much gross a green desk gives away versus the setpoint — a magnitude only.',
    range: { min: 0.05, max: 0.45, step: 0.05 },
  },
  {
    id: 'ucm.drift.conditionReading',
    file: 'tunables',
    path: 'managerGates.executionDrift.condition_reading.maxDriftFraction',
    why: 'How far a green appraisal misses; one-sided-worse by design, this is only its width.',
    range: { min: 0.02, max: 0.3, step: 0.02 },
  },

  // ── Fixed-ops automation ladders (#310, #316) ─────────────────────────────
  {
    id: 'sm.act.par',
    file: 'tunables',
    path: 'managerGates.serviceManager.actThresholds.par',
    why: 'First rung of the service-manager ladder; the ORDER is design, the rung heights are placeholders.',
    range: { min: 35, max: 70, step: 5 },
  },
  {
    id: 'sm.act.pricing',
    file: 'tunables',
    path: 'managerGates.serviceManager.actThresholds.pricing',
    why: 'Service pricing rung — placeholder magnitude pending #286.',
    range: { min: 40, max: 75, step: 5 },
  },
  {
    id: 'sm.act.marketing',
    file: 'tunables',
    path: 'managerGates.serviceManager.actThresholds.marketing',
    why: 'Service marketing rung — placeholder magnitude pending #286.',
    range: { min: 45, max: 80, step: 5 },
  },
  {
    id: 'sm.act.rush',
    file: 'tunables',
    path: 'managerGates.serviceManager.actThresholds.rush',
    why: 'Rush-authority rung — placeholder magnitude pending #286.',
    range: { min: 50, max: 85, step: 5 },
  },
  {
    id: 'sm.act.capacity',
    file: 'tunables',
    path: 'managerGates.serviceManager.actThresholds.capacity',
    why: 'Top rung (capacity) — placeholder magnitude pending #286.',
    range: { min: 60, max: 95, step: 5 },
  },
  {
    id: 'bsm.act.par',
    file: 'tunables',
    path: 'managerGates.bodyShopManager.actThresholds.par',
    why: 'Body-shop mirror of the par rung; same placeholder status as its Service twin.',
    range: { min: 35, max: 70, step: 5 },
  },
  {
    id: 'bsm.act.channel',
    file: 'tunables',
    path: 'managerGates.bodyShopManager.actThresholds.channel',
    why: 'Skill to own insurance/retail channel posture — a placeholder magnitude.',
    range: { min: 40, max: 80, step: 5 },
  },
  {
    id: 'bsm.act.rush',
    file: 'tunables',
    path: 'managerGates.bodyShopManager.actThresholds.rush',
    why: 'Body-shop rush rung — placeholder magnitude pending #286.',
    range: { min: 50, max: 85, step: 5 },
  },
  {
    id: 'bsm.act.capacity',
    file: 'tunables',
    path: 'managerGates.bodyShopManager.actThresholds.capacity',
    why: 'Body-shop capacity rung — placeholder magnitude pending #286.',
    range: { min: 60, max: 95, step: 5 },
  },

  // ── Carrying cost: the bleed that decides whether a lot is survivable ──────
  {
    id: 'inventory.carrying.insurancePerDay',
    file: 'tunables',
    path: 'inventory.carrying.insurancePerDay',
    why: 'Per-unit daily insurance; a real cost with a guessed magnitude, and a prime cash-bleed suspect.',
    range: { min: 2, max: 15, step: 1 },
  },
  {
    id: 'inventory.carrying.overheadPerDay',
    file: 'tunables',
    path: 'inventory.carrying.overheadPerDay',
    why: 'Per-unit daily lot overhead — same class as insurance, same guess.',
    range: { min: 3, max: 20, step: 1 },
  },
  {
    id: 'inventory.carrying.baselineApr',
    file: 'tunables',
    path: 'inventory.carrying.baselineApr',
    why: 'Floorplan APR before tier discounts; a market rate we picked, not a rule.',
    range: { min: 0.05, max: 0.15, step: 0.01 },
  },
  {
    id: 'inventory.carrying.agedThresholdDays',
    file: 'tunables',
    path: 'inventory.carrying.agedThresholdDays',
    why: 'Days before a unit reads as aged; the industry number is a convention, not a law.',
    range: { min: 30, max: 75, step: 5 },
  },
  {
    id: 'inventory.inspection.daysToComplete',
    file: 'tunables',
    path: 'inventory.inspection.daysToComplete',
    why: 'Pre-buy inspection turnaround — a whole number of days, so a set rather than a range.',
    values: [0, 1, 2, 3],
  },

  // ── UCM sourcing auto-fill (#293) ─────────────────────────────────────────
  {
    id: 'sourcing.buyThreshold',
    file: 'sourcing',
    path: 'buyThreshold',
    why: 'Score a lot candidate must clear to be auto-bought; sets how picky the desk is.',
    range: { min: 0.25, max: 0.7, step: 0.05 },
  },
  {
    id: 'sourcing.marginReference',
    file: 'sourcing',
    path: 'marginReference',
    why: 'Margin that scores 1.0 — the normalizer for the margin term, a guessed anchor.',
    range: { min: 0.1, max: 0.4, step: 0.05 },
  },
  {
    id: 'sourcing.demandFitGain',
    file: 'sourcing',
    path: 'demandFitGain',
    why: 'Weight on demand fit versus margin; the lean model is design, the gain is a magnitude.',
    range: { min: 0.5, max: 2, step: 0.1 },
  },
  {
    id: 'sourcing.cashReserve',
    file: 'sourcing',
    path: 'cashReserve',
    why: 'Cash the auto-buyer refuses to spend down past — a cushion size, not a rule.',
    range: { min: 0, max: 20000, step: 1000 },
  },

  // ── Market-intel precision (#178) ─────────────────────────────────────────
  {
    id: 'intel.coarse.suggestionBandPct',
    file: 'intel-precision',
    path: 'coarse.suggestionBandPct',
    why: 'Width of the price band with no UCM; that unaided reads vaguer is design, how vague is not.',
    range: { min: 0.05, max: 0.25, step: 0.01 },
  },
  {
    id: 'intel.sharp.suggestionBandPct',
    file: 'intel-precision',
    path: 'sharp.suggestionBandPct',
    why: 'Width of the band a manager on the desk buys you — the size of the payoff.',
    range: { min: 0.01, max: 0.1, step: 0.01 },
  },
  {
    id: 'intel.sharp.skillReference',
    file: 'intel-precision',
    path: 'sharp.skillReference',
    why: 'Skill at which intel reads fully sharp; a reference point, guessed like the other 0–100 anchors.',
    range: { min: 50, max: 90, step: 5 },
  },

  // ── Body-shop demand (#312–#318) ──────────────────────────────────────────
  {
    id: 'bodyshop.volume.conquestBase',
    file: 'bodyshop-demand',
    path: 'volume.conquestBase',
    why: 'Baseline walk-in collision volume; the arrival model is design, the rate is a magnitude.',
    range: { min: 0.2, max: 2, step: 0.1 },
  },
  {
    id: 'bodyshop.volume.referralBase',
    file: 'bodyshop-demand',
    path: 'volume.referralBase',
    why: 'Baseline referred collision volume — same class as conquest.',
    range: { min: 0.5, max: 3, step: 0.1 },
  },
  {
    id: 'bodyshop.volume.repGain',
    file: 'bodyshop-demand',
    path: 'volume.repGain',
    why: 'How hard reputation pulls collision work; that it pulls is design, how hard is not.',
    range: { min: 1, max: 5, step: 0.25 },
  },
  {
    id: 'bodyshop.channel.insuranceRateCap',
    file: 'bodyshop-demand',
    path: 'channel.insuranceRateCap',
    why: 'Ceiling an insurer will pay versus retail — a real posture with a guessed number.',
    range: { min: 0.6, max: 0.95, step: 0.01 },
  },
  {
    id: 'bodyshop.channel.retailMarginMultiplier',
    file: 'bodyshop-demand',
    path: 'channel.retailMarginMultiplier',
    why: 'Retail premium over the insurance rate — the size of the channel trade-off.',
    range: { min: 1, max: 1.4, step: 0.05 },
  },
  {
    id: 'bodyshop.jobRevenue.paint',
    file: 'bodyshop-demand',
    path: 'jobRevenue.paint',
    why: 'Ticket for the highest-value collision category; the category split is design, the ticket is a price.',
    range: { min: 1200, max: 3500, step: 100 },
  },
  {
    id: 'bodyshop.jobRevenue.doorsPanels',
    file: 'bodyshop-demand',
    path: 'jobRevenue.doors_panels',
    why: 'Ticket for the most common collision category — a price we picked.',
    range: { min: 700, max: 2400, step: 100 },
  },

  // ── Fixed-ops standing decisions (#310 / #316 tuning) ─────────────────────
  {
    id: 'serviceManager.par.targetCoverDays',
    file: 'service-manager',
    path: 'par.targetCoverDays',
    why: 'Days of parts cover the SM stocks to; carrying-versus-stockout, a magnitude.',
    range: { min: 0.5, max: 4, step: 0.25 },
  },
  {
    id: 'serviceManager.par.reorderCoverDays',
    file: 'service-manager',
    path: 'par.reorderCoverDays',
    why: 'Reorder trigger in days of cover — the other half of the same trade-off.',
    range: { min: 0.2, max: 2, step: 0.1 },
  },
  {
    id: 'serviceManager.capacity.utilizationRushCeiling',
    file: 'service-manager',
    path: 'capacity.utilizationRushCeiling',
    why: 'Utilization above which the SM stops taking rush work; a threshold, not a policy.',
    range: { min: 0.6, max: 0.95, step: 0.05 },
  },
  {
    id: 'bodyShopManager.par.targetCoverDays',
    file: 'body-shop-manager',
    path: 'par.targetCoverDays',
    why: 'Body-shop mirror of the parts-cover target; same trade-off, own number.',
    range: { min: 0.5, max: 4, step: 0.25 },
  },
  {
    id: 'bodyShopManager.capacity.utilizationRushCeiling',
    file: 'body-shop-manager',
    path: 'capacity.utilizationRushCeiling',
    why: 'Body-shop rush ceiling — same class as its Service twin.',
    range: { min: 0.6, max: 0.95, step: 0.05 },
  },

  // ── Paid data subscriptions (#178/#179) — price only, never the tier gate ──
  {
    id: 'news.auctionData.dailyCost',
    file: 'news-progression-gating',
    path: 'unlocks[id=auction_data].dailyCost',
    why: 'Daily price of the auction feed; that it costs money is design, what it costs is a magnitude.',
    range: { min: 10, max: 120, step: 5 },
  },
  {
    id: 'news.competitorTracking.dailyCost',
    file: 'news-progression-gating',
    path: 'unlocks[id=competitor_tracking].dailyCost',
    why: 'Daily price of competitor tracking — same class as the auction feed.',
    range: { min: 10, max: 90, step: 5 },
  },

  // ── The seeded starting lot (#296) ────────────────────────────────────────
  {
    id: 'startingInventory.suv.targetRetail',
    file: 'starting-inventory',
    path: 'slots[category=suv].targetRetail',
    why: 'Price point of the seeded SUV; the one-of-each mix is design, the price band is a magnitude.',
    range: { min: 8000, max: 25000, step: 500 },
  },
  {
    id: 'startingInventory.truck.targetRetail',
    file: 'starting-inventory',
    path: 'slots[category=truck].targetRetail',
    why: 'Price point of the seeded truck — sets how much capital day 1 starts tied up.',
    range: { min: 10000, max: 30000, step: 500 },
  },
  {
    id: 'startingInventory.sedan.targetRetail',
    file: 'starting-inventory',
    path: 'slots[category=sedan].targetRetail',
    why: 'Price point of the seeded sedan — the cheapest rung of the opening lot.',
    range: { min: 6000, max: 20000, step: 500 },
  },
  {
    id: 'startingInventory.suv.tolerancePct',
    file: 'starting-inventory',
    path: 'slots[category=suv].tolerancePct',
    why: 'How far the seeded SUV may miss its price point; a spread, not a rule.',
    range: { min: 0.05, max: 0.35, step: 0.01 },
  },
  {
    id: 'startingInventory.truck.tolerancePct',
    file: 'starting-inventory',
    path: 'slots[category=truck].tolerancePct',
    why: 'Spread allowed on the seeded truck — same class as the SUV.',
    range: { min: 0.05, max: 0.35, step: 0.01 },
  },
  {
    id: 'startingInventory.sedan.tolerancePct',
    file: 'starting-inventory',
    path: 'slots[category=sedan].tolerancePct',
    why: 'Spread allowed on the seeded sedan — same class as the SUV.',
    range: { min: 0.05, max: 0.35, step: 0.01 },
  },
];

export function dimensionById(id: string, dims: readonly Dimension[] = SEARCH_SPACE): Dimension {
  const dim = dims.find((d) => d.id === id);
  if (!dim) {
    throw new Error(`Unknown search dimension '${id}'.`);
  }
  return dim;
}

/**
 * Every declared path must resolve to a number in its named file, and every
 * declared bound must be self-consistent. A typo'd path or a renamed key fails
 * loudly here rather than silently freezing a dimension the search believes it
 * is varying.
 */
export function validateSearchSpace(dims: readonly Dimension[] = SEARCH_SPACE): void {
  const seen = new Set<string>();
  for (const dim of dims) {
    const fail = (msg: string): never => {
      throw new Error(`Search dimension '${dim.id}': ${msg}`);
    };
    if (seen.has(dim.id)) fail('duplicate dimension id');
    seen.add(dim.id);
    if (!dim.why.trim()) fail('missing the why-this-is-a-balance-number note');
    if (!!dim.range === !!dim.values) fail('declare exactly one of `range` or `values`');
    if (dim.range) {
      const { min, max, step } = dim.range;
      if (![min, max, step].every(Number.isFinite)) fail('range bounds must be finite');
      if (min >= max) fail(`empty range [${min}, ${max}]`);
      if (step <= 0) fail(`step must be positive (got ${step})`);
      if (step > max - min) fail(`step ${step} is larger than its own range ${max - min}`);
    }
    if (dim.values) {
      if (dim.values.length === 0) fail('empty value set');
      if (!dim.values.every(Number.isFinite)) fail('value set must be finite numbers');
    }
    try {
      readTunable(dim.file, dim.path);
    } catch (err) {
      fail((err as Error).message);
    }
  }
}

/** Membership, with no clamping: an out-of-range proposal is rejected. */
export function allowsValue(dim: Dimension, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (dim.values) return dim.values.some((v) => Math.abs(v - value) <= EPS);
  const { min, max } = dim.range!;
  return value >= min - EPS && value <= max + EPS;
}

export function currentValue(dim: Dimension): number {
  return readTunable(dim.file, dim.path);
}

/** The dimension's path with selectors resolved to positional indices. */
export function canonicalPath(dim: Dimension): string {
  return `${dim.file}:${positionalPath(dim.file, dim.path)}`;
}

/** A candidate configuration: dimension id → proposed value. */
export type Candidate = Readonly<Record<string, number>>;

export interface AppliedCandidate {
  /** Restores every touched key to the value it held before `applyCandidate`. */
  readonly restore: () => void;
}

/**
 * Validate the WHOLE candidate, then apply it. Nothing is written until every
 * value is known legal, so a rejected candidate leaves `data/**` untouched
 * rather than half-applied.
 */
export function applyCandidate(
  candidate: Candidate,
  dims: readonly Dimension[] = SEARCH_SPACE,
): AppliedCandidate {
  const planned = Object.entries(candidate).map(([id, value]) => {
    const dim = dimensionById(id, dims);
    if (!allowsValue(dim, value)) {
      const bound = dim.values
        ? `set {${dim.values.join(', ')}}`
        : `range [${dim.range!.min}, ${dim.range!.max}]`;
      throw new Error(
        `Search dimension '${id}': ${value} is outside its declared ${bound} — rejected, not clamped.`,
      );
    }
    return { dim, value };
  });

  const undo: (() => void)[] = [];
  for (const { dim, value } of planned) {
    const previous = applyOverride(dim.file, dim.path, value);
    undo.push(() => restoreOverride(dim.file, dim.path, previous));
  }
  return {
    restore: () => {
      for (let i = undo.length - 1; i >= 0; i--) undo[i]();
    },
  };
}

export interface SpaceRow {
  readonly id: string;
  readonly file: string;
  readonly path: string;
  readonly bound: string;
  readonly current: number;
  /** True when the shipped value sits outside its own declared bound. */
  readonly outsideBound: boolean;
  readonly why: string;
}

/**
 * The manifest as data for the `space` report: each dimension, its declared
 * bound, and what `data/**` currently holds. A current value outside its own
 * bound is flagged — a signal that either the range or the shipped value is
 * wrong, and one worth seeing before a search starts from it.
 */
export function describeSpace(dims: readonly Dimension[] = SEARCH_SPACE): SpaceRow[] {
  return dims.map((dim) => {
    const current = currentValue(dim);
    return {
      id: dim.id,
      file: dim.file,
      path: dim.path,
      bound: dim.values
        ? `{${dim.values.join(', ')}}`
        : `[${dim.range!.min}, ${dim.range!.max}] step ${dim.range!.step}`,
      current,
      outsideBound: !allowsValue(dim, current),
      why: dim.why,
    };
  });
}

// ── The freeze guard ─────────────────────────────────────────────────────────

/**
 * A serialization of every registered data file, taken from the live in-memory
 * objects the loaders read. `JSON.stringify` preserves insertion order and
 * in-place mutation never reorders keys, so an unchanged file serializes
 * byte-identically.
 */
export function snapshotRegisteredFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of knownFiles()) {
    out[file] = JSON.stringify(registeredFile(file));
  }
  return out;
}

/**
 * Every `file:dotted.path` whose value differs between two snapshots. Array
 * elements are addressed positionally, which is what `canonicalPath` converts a
 * manifest selector into.
 */
export function diffSnapshots(
  before: Record<string, string>,
  after: Record<string, string>,
): string[] {
  const files = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: string[] = [];
  for (const file of [...files].sort()) {
    if (before[file] === after[file]) continue;
    walkDiff(
      before[file] === undefined ? undefined : JSON.parse(before[file]),
      after[file] === undefined ? undefined : JSON.parse(after[file]),
      file,
      '',
      out,
    );
  }
  return out;
}

function walkDiff(a: unknown, b: unknown, file: string, path: string, out: string[]): void {
  const label = () => (path ? `${file}:${path}` : file);
  const isObj = (v: unknown) => typeof v === 'object' && v !== null;
  if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) {
    if (!Object.is(a, b)) out.push(label());
    return;
  }
  const keys = new Set([
    ...Object.keys(a as Record<string, unknown>),
    ...Object.keys(b as Record<string, unknown>),
  ]);
  for (const key of keys) {
    walkDiff(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      file,
      path ? `${path}.${key}` : key,
      out,
    );
  }
}

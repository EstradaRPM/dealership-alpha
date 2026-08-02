import { signedSkillDrift, type SkillDriftConfig } from '../NPC';
import { deriveSeed } from '../Rng';
import { loadSourcingConfig, type SourcingConfig } from './schemas';

/**
 * UCM sourcing posture-lean policy + auto-fill (channel-desk M6, #293).
 *
 * Sourcing is modeled as a **posture, not quotas** (manager-roles-channel-desk.md
 * §7): the player sets a preference *lean* across three axes — margin (fat
 * spread) / condition (clean low-recon metal) / vehicle-type demand-fit (what's
 * hot on the heat map) — and the UCM scores the daily auction board against it,
 * auto-buying the best affordable fits. Strategy stays the player's (re-tune the
 * lean as heat shifts); only the daily scanning grind is delegated. Manual buy +
 * per-unit override always live (Pillar 5).
 *
 * Pure + deterministic: the composition root resolves each candidate's book
 * value (MarketEconomy), demand share (DemandShaper) and acquisition cost, plus
 * the act gate (top UCM `condition_reading`) and the per-day drift seed; this
 * module turns those into the list of listing ids the UCM buys.
 */

/** A preference blend across the three sourcing axes. Raw weights ≥ 0 — the
 *  engine normalizes them, so the dial's absolute scale never matters. */
export interface SourcingLean {
  readonly margin: number;
  readonly condition: number;
  readonly demandFit: number;
}

/** One auction-board listing reduced to the signals the lean scores. */
export interface SourcingCandidate {
  readonly listingId: string;
  /** Full acquisition outlay = asking price + recon estimate. */
  readonly cost: number;
  /** Honest heat-inclusive book value of the unit. */
  readonly book: number;
  /** Condition tier id (`clean` | `average` | `rough`). */
  readonly condition: string;
  /** Player-facing demand share for the unit's category (DemandShaper mix,
   *  ~[0,1], sums to 1 across segments). */
  readonly demandShare: number;
}

/**
 * Execution-fidelity drift on the auto-fill (channel-desk M5, #292). Above the
 * gate the UCM always *aims* at the player's lean; its `condition_reading` skill
 * governs how far its perceived fit of each unit scatters off the truth — a
 * green UCM mis-judges and buys off-lean, a sharp one (≥ `skillReference`) buys
 * exactly the lean-optimal set. Deterministic in `(skill, seed)`; the seed is
 * derived per-day at the call site (skill constant within a day) ⇒ replay-safe.
 * Omit ⇒ no drift (the UCM perceives true fit exactly).
 */
export interface SourcingDrift {
  /** Top UCM `condition_reading` skill (0–100). */
  readonly conditionReadingSkill: number;
  /** Per-day seed the composition root derives. */
  readonly seed: number;
  /** `managerGates.executionDrift.condition_reading`. */
  readonly config: SkillDriftConfig;
}

export interface SelectAutoBuysInput {
  readonly candidates: readonly SourcingCandidate[];
  readonly lean: SourcingLean;
  /** Demand segment count — the uniform baseline share is `1 / segmentCount`. */
  readonly segmentCount: number;
  /** Cash available to spend right now. */
  readonly cashOnHand: number;
  readonly drift?: SourcingDrift;
}

export interface SourcingDeps {
  readonly config?: SourcingConfig;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function resolveConfig(deps?: SourcingDeps): SourcingConfig {
  return deps?.config ?? loadSourcingConfig();
}

/**
 * Whether the UCM may act on sourcing (channel-desk M6, #293) — gated on the top
 * UCM's `condition_reading` clearing the act threshold, the SAME axis that gates
 * trade auto-approve (M4, manager-roles-channel-desk.md §3). The appraisal
 * *advice* (`getTradeConditionRead`, #163) stays free on hire; *acting* (buying
 * for you) is earned. Below the gate (or no UCM, `skill == null`) the player
 * scans + buys the board by hand. Pure; the composition root supplies the top
 * UCM skill (roster) + threshold (`tunables.managerGates.actThresholds`).
 */
export function isSourcingUnlocked(
  ucmConditionReadingSkill: number | null,
  threshold: number,
): boolean {
  return (
    ucmConditionReadingSkill != null && ucmConditionReadingSkill >= threshold
  );
}

/** Normalize a raw lean to weights summing to 1; an all-zero lean degrades to an
 *  even blend so the engine never divides by zero. */
export function normalizeLean(lean: SourcingLean): SourcingLean {
  const sum = lean.margin + lean.condition + lean.demandFit;
  if (sum <= 0) return { margin: 1 / 3, condition: 1 / 3, demandFit: 1 / 3 };
  return {
    margin: lean.margin / sum,
    condition: lean.condition / sum,
    demandFit: lean.demandFit / sum,
  };
}

/** Book-relative gross spread, normalized so `marginReference` book-relative
 *  gross scores 1.0. A unit listed at/above book scores 0. */
function marginScore(book: number, cost: number, reference: number): number {
  if (book <= 0 || reference <= 0) return 0;
  return clamp01((book - cost) / (book * reference));
}

function conditionScore(
  condition: string,
  scores: Record<string, number>,
): number {
  return clamp01(scores[condition] ?? 0);
}

/** Demand-fit relative to the uniform baseline: a category at the uniform share
 *  scores 0.5, hotter rises toward 1, colder falls toward 0. `gain` tunes the
 *  bite. Reads the player-facing influenceable heat map (DemandShaper mix), the
 *  same signal the heat console surfaces — so sourcing chases observable heat. */
function demandFitScore(
  share: number,
  uniform: number,
  gain: number,
): number {
  if (uniform <= 0) return 0.5;
  return clamp01(0.5 + (share / uniform - 1) * gain * 0.5);
}

/**
 * The true (drift-free) composite fit of a candidate against the lean — the
 * weighted blend of the three axis scores, each in `[0,1]`, so the composite is
 * itself in `[0,1]`. Exported for unit tests; `selectAutoBuys` is the consumer.
 */
export function scoreCandidate(
  candidate: SourcingCandidate,
  lean: SourcingLean,
  segmentCount: number,
  deps?: SourcingDeps,
): number {
  const config = resolveConfig(deps);
  const w = normalizeLean(lean);
  const uniform = segmentCount > 0 ? 1 / segmentCount : 0;
  return (
    w.margin * marginScore(candidate.book, candidate.cost, config.marginReference) +
    w.condition * conditionScore(candidate.condition, config.conditionScores) +
    w.demandFit * demandFitScore(candidate.demandShare, uniform, config.demandFitGain)
  );
}

/**
 * The listing ids the UCM auto-buys from the board this day. Scores every
 * candidate against the (normalized) lean, applies execution drift to the UCM's
 * *perceived* fit (a green UCM mis-judges → off-lean buys; a sharp one holds the
 * lean exactly), then greedily buys in descending perceived fit while the score
 * clears `buyThreshold` and cumulative cost stays within `cashOnHand` less the
 * `cashReserve` floor. Pure + deterministic.
 *
 * Drift is two-sided (`signedSkillDrift`) on the perceived score — a
 * *mis-perception*, like the auto-pricing mis-target — so a weak UCM both
 * over-buys poor fits (overrated) and skips good ones (underrated); both are
 * worse outcomes than the lean-optimal set (§4: always drift toward worse, never
 * ignoring the player). The drift magnitude is calibration-deferred (#286); the
 * ordering (higher skill ⇒ closer to lean-optimal, zero drift at/above
 * `skillReference`) and determinism are locked.
 */
export function selectAutoBuys(
  input: SelectAutoBuysInput,
  deps?: SourcingDeps,
): string[] {
  const config = resolveConfig(deps);
  const w = normalizeLean(input.lean);
  const uniform = input.segmentCount > 0 ? 1 / input.segmentCount : 0;

  const scored = input.candidates.map((c) => {
    const trueScore =
      w.margin * marginScore(c.book, c.cost, config.marginReference) +
      w.condition * conditionScore(c.condition, config.conditionScores) +
      w.demandFit * demandFitScore(c.demandShare, uniform, config.demandFitGain);
    let perceived = trueScore;
    if (input.drift) {
      const seed = deriveSeed(input.drift.seed, 'sourcing_score_drift', {
        listingId: c.listingId,
      });
      perceived =
        trueScore +
        signedSkillDrift(input.drift.conditionReadingSkill, seed, input.drift.config);
    }
    return { listingId: c.listingId, cost: c.cost, perceived };
  });

  // Descending perceived fit; the cost tiebreak keeps the order deterministic
  // when two units are perceived equally (cheaper first → more buys per dollar).
  scored.sort((a, b) =>
    b.perceived !== a.perceived ? b.perceived - a.perceived : a.cost - b.cost,
  );

  const spendable = input.cashOnHand - config.cashReserve;
  const bought: string[] = [];
  let spent = 0;
  for (const s of scored) {
    if (s.perceived < config.buyThreshold) break; // sorted desc ⇒ rest are too
    if (spent + s.cost > spendable) continue; // unaffordable; a cheaper fit may still fit
    bought.push(s.listingId);
    spent += s.cost;
  }
  return bought;
}

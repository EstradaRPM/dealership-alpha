import { z } from 'zod';
import { createRng } from '../NPC/Rng';
import type { CurrentVehicle } from '../NPC';
import { parseData, loadTunables } from '../data';

/**
 * Trade-in machinery (slice #167+, parent #150). The customer's *ask* — what
 * they want for the car they drove in on — is rolled here as a pure,
 * deterministic function. Staff evaluation, counter-offers, auto-resolution
 * and the `trade:resolved` event (#168–#169) accrue onto this same module so
 * trade logic stays co-located with the rest of deal construction.
 */

// ── Noise config (data/trade-allowance-noise.json) ────────────────────────────

export const TradeAllowanceNoiseConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    meanMultiplier: z.number(),
    stdev: z.number().min(0),
    floor: z.number(),
    ceiling: z.number(),
  })
  .strict();

export type TradeAllowanceNoiseConfig = z.infer<
  typeof TradeAllowanceNoiseConfigSchema
>;

export function loadTradeAllowanceNoiseConfig(): TradeAllowanceNoiseConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/trade-allowance-noise.json');
  return parseData(
    raw,
    TradeAllowanceNoiseConfigSchema,
    'data/trade-allowance-noise.json',
  );
}

// ── Trade valuation seam ──────────────────────────────────────────────────────

/**
 * Reads honest wholesale book for a customer's trade-in vehicle. The live
 * MarketEconomy provider (`createProviders().bookValueFn`) satisfies this at
 * runtime — `CurrentVehicle` carries the anchor fields (templateId / make /
 * year / mileage / category / condition) the provider actually reads. The
 * composition root adapts the provider to this narrower shape; game logic
 * never sees the cast.
 */
export type TradeBookValueFn = (vehicle: CurrentVehicle) => number;

// ── Allowance ask ─────────────────────────────────────────────────────────────

/**
 * Sample one trade-allowance noise multiplier. Mirrors the auction-side
 * motivated-seller draw (slice #160): a Box-Muller normal centered at
 * `meanMultiplier`, clipped to `[floor, ceiling]`. The clip turns the tails
 * into the hard "ignorance bargain" / "entitled ask" caps.
 */
function sampleTradeNoise(
  seed: number,
  cfg: TradeAllowanceNoiseConfig,
): number {
  const rng = createRng(seed);
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const raw = cfg.meanMultiplier + z * cfg.stdev;
  if (raw < cfg.floor) return cfg.floor;
  if (raw > cfg.ceiling) return cfg.ceiling;
  return raw;
}

/**
 * Generate the customer's trade allowance ask — the dollar number they want
 * for their trade. Pure and deterministic: identical `seed` (and inputs) →
 * identical ask.
 *
 *   allowanceAsk = bookValue(currentVehicle) × motivatedSellerMultiplier(seed)
 *                + max(0, loanPayoff − bookValue(currentVehicle))
 *
 * The noise term spreads the ask around honest book (most ±1 stdev, tails for
 * the entitled / ignorant). The negative-equity term floors the ask so an
 * underwater owner asks roughly enough to clear their payoff — they cannot
 * walk away owing the bank on a trade they expect us to absorb.
 *
 * `loanPayoff` is passed explicitly (it lives on `currentVehicle` but the
 * formula takes it as its own term); `null` (a cash-owner) reads as 0.
 */
export function generateTradeAsk(
  currentVehicle: CurrentVehicle,
  loanPayoff: number | null,
  bookValueFn: TradeBookValueFn,
  seed: number,
  config: TradeAllowanceNoiseConfig = loadTradeAllowanceNoiseConfig(),
): number {
  const book = bookValueFn(currentVehicle);
  const noisyValue = book * sampleTradeNoise(seed, config);
  const negativeEquity = Math.max(0, (loanPayoff ?? 0) - book);
  return Math.round(noisyValue + negativeEquity);
}

// ── Staff trade evaluation (#168) ─────────────────────────────────────────────

export const TradeEvalConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    counterWindowFraction: z.number().min(0),
    appraisalGenerosityPremium: z.number().min(0),
    counterGiveWeight: z.number().min(0).max(1),
    skillCounterThreshold: z.number().min(0).max(1),
    // ── Routine auto-resolution gate (#169) ──
    /**
     * A trade auto-resolves (no player overlay) only when the ask sits within
     * this fraction of the internal target above it: `ask − target ≤ target ×
     * routineGapFraction`. Wider gaps are *unusual* and escalate to the player
     * (slice 16). Accepts (`ask ≤ target`) are trivially within the gate.
     */
    routineGapFraction: z.number().min(0),
    /**
     * Routine auto-resolution also requires condition-read confidence ≥ this
     * floor. `0` lets a no-UCM (maximally defensive) appraisal still
     * auto-resolve; a positive floor forces low-confidence trades to the
     * player.
     */
    routineConfidenceFloor: z.number().min(0).max(1),
    // ── Manager-attention escalation (#170) ──
    /**
     * The extended counter range an escalation approver (GM/UCM) works with —
     * wider than `counterWindowFraction` so a manager counters far-above asks a
     * salesperson would decline. Fed to `evaluateTrade` (in place of
     * `counterWindowFraction`) on the staff-approver path.
     */
    managerCounterWindowFraction: z.number().min(0),
    /**
     * A routine-looking but underwater trade escalates (manager attention)
     * instead of silently abandoning when the lien overhang clears this band:
     * `payoff − target > target × negativeEquityEscalationMargin`.
     */
    negativeEquityEscalationMargin: z.number().min(0),
    /**
     * Default per-slot "always escalate to me above $X" — an ask over this
     * routes to the player even when a manager could handle it. The composition
     * root overrides it per save slot via `TradeResolutionDeps.playerOverrideThreshold`.
     */
    playerOverrideThresholdDefault: z.number().min(0),
    /**
     * Customer accept/reject on a PLAYER counter (#170). The base aversion
     * turning the haircut `gapFraction = (ask − counter)/ask` into rejection.
     */
    counterGapAversion: z.number().min(0),
    /** How much a customer's price-sensitivity amplifies counter-gap aversion. */
    counterSensitivityWeight: z.number().min(0),
  })
  .strict();

export type TradeEvalConfig = z.infer<typeof TradeEvalConfigSchema>;

export function loadTradeEvalConfig(): TradeEvalConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/trade-evaluation.json');
  return parseData(raw, TradeEvalConfigSchema, 'data/trade-evaluation.json');
}

// ── Trade-acquisition policy (#172) ───────────────────────────────────────────

/**
 * One selectable per-slot trade policy. `multiplier` scales the staff's
 * internal acceptance target in `evaluateTrade` (`book × multiplier ×
 * read-confidence factor`): `> 1` chases volume (overpay vs book), `< 1`
 * protects gross (under-pay). `label`/`blurb` drive the settings UI. Tunables
 * live in `data/tunables.json` (`tradePolicy`).
 */
export interface TradePolicyOption {
  readonly id: string;
  readonly label: string;
  readonly multiplier: number;
  readonly blurb: string;
}

export interface TradePolicyConfig {
  /** Policy applied when a slot has no persisted choice (v1: `market`). */
  readonly defaultId: string;
  readonly policies: readonly TradePolicyOption[];
}

/** Reads the trade-policy catalog from the `tradePolicy` section of tunables. */
export function loadTradePolicyConfig(): TradePolicyConfig {
  return loadTunables().tradePolicy;
}

/**
 * Resolve a per-slot trade-policy id to its acceptance-target multiplier. An
 * unknown or `undefined` id (legacy slot / never set) falls back to the
 * catalog `defaultId`, and a missing default falls back to the first listed
 * policy — so the resolver always returns a real multiplier. Pure.
 */
export function resolveTradePolicyMultiplier(
  policyId: string | undefined,
  config: TradePolicyConfig = loadTradePolicyConfig(),
): number {
  const byId =
    policyId !== undefined
      ? config.policies.find((p) => p.id === policyId)
      : undefined;
  const chosen =
    byId ??
    config.policies.find((p) => p.id === config.defaultId) ??
    config.policies[0];
  return chosen.multiplier;
}

/**
 * Narrow read of the acting salesperson's NEGOTIATE composite. Mirrors
 * SalesProcess's `GateSkill` but is defined locally so DealEngine never imports
 * SalesProcess (which depends on DealEngine — that would be a cycle). The
 * composition root resolves `skill.skillFor('NEGOTIATE')` and passes the result.
 */
export interface NegotiationSkill {
  readonly effectiveness: number;
  readonly trustworthiness: number;
}

/**
 * Narrow read of a UCM condition assessment. Mirrors StaffOrg's `ConditionRead`
 * (structurally compatible) but only the `confidence` scalar drives the
 * defensive valuation pull here. `null` ⇒ no used-car-manager on staff to read
 * the trade, which reads as zero confidence (maximally defensive).
 */
export interface TradeConditionRead {
  readonly confidence: number;
}

export type TradeAction = 'accept' | 'counter' | 'decline';

export interface TradeEvaluation {
  readonly action: TradeAction;
  /** Present only when `action === 'counter'`. Whole dollars. */
  readonly counterAmount?: number;
  /**
   * The internal acceptance target the decision was measured against
   * (`book × policyMultiplier × read-confidence factor`). Exposed so the
   * routine-gate in `resolveTradeIn` (#169) reads the same figure instead of
   * re-deriving the formula. Whole dollars.
   */
  readonly target: number;
  /** Human-readable decision trace (figures, target, gating skill). */
  readonly rationale: string;
}

export interface TradeEvalInput {
  readonly currentVehicle: CurrentVehicle;
  /** What the customer wants for the trade (`generateTradeAsk` output). */
  readonly allowanceAsk: number;
  /** Acting salesperson's resolved NEGOTIATE composite. */
  readonly skill: NegotiationSkill;
  /** UCM condition read on the trade, or `null` when no UCM is on staff. */
  readonly conditionRead: TradeConditionRead | null;
}

export interface TradeEvalDeps {
  /** Honest wholesale book for the trade (live MarketEconomy provider at runtime). */
  readonly bookValueFn: TradeBookValueFn;
  /**
   * Trade policy multiplier (slice #18 seam). `1.0` = 'market' (default until
   * #18 lands); `> 1` aggressive (chase volume, overpay vs book); `< 1`
   * conservative (protect gross). Scales the internal acceptance target.
   */
  readonly policyMultiplier?: number;
  readonly config?: TradeEvalConfig;
}

/**
 * Staff decision engine for a customer's trade allowance ask (#168). Pure and
 * deterministic: no RNG, no I/O — identical inputs → identical decision. This
 * slice ships the engine only; flow integration (#94) is untouched.
 *
 * Decision tree:
 *
 *   book          = bookValueFn(currentVehicle)              honest wholesale
 *   confidence    = conditionRead?.confidence ?? 0           0 when no UCM reads it
 *   generosity    = 1 + (1 − confidence)·appraisalGenerosityPremium
 *   target        = book × policyMultiplier × generosity     internal max allowance
 *
 *   ask ≤ target                          → ACCEPT  (we'd have paid at least this)
 *   target < ask ≤ target·(1+window)      → COUNTER at counterAmount
 *   ask > target·(1+window)               → COUNTER if a skilled closer
 *                                            (NEGOTIATE effectiveness ≥ threshold),
 *                                            else DECLINE (weak staff lets it walk)
 *
 *   counterAmount = round( target + (ask − target)·(1 − effectiveness)·counterGiveWeight )
 *
 * The two skill seams both pull toward thinner margin when weak — the source of the
 * channel-desk "no UCM = floor, a sharp desk tightens" behavior (#291/M4):
 *   • Low condition-read confidence (poor/absent UCM) pushes `target` ABOVE book
 *     → generous over-allowance (thin margin). A top UCM tightens it to ≈ book
 *     (best margin). Monotonic in skill; no UCM (confidence 0) = the floor.
 *   • Low NEGOTIATE effectiveness drifts the counter up toward the ask
 *     → over-pay. A perfect closer holds exactly at `target`.
 */
export function evaluateTrade(
  input: TradeEvalInput,
  deps: TradeEvalDeps,
): TradeEvaluation {
  const cfg = deps.config ?? loadTradeEvalConfig();
  const policyMultiplier = deps.policyMultiplier ?? 1.0;
  const { currentVehicle, allowanceAsk, skill, conditionRead } = input;

  const book = deps.bookValueFn(currentVehicle);
  const confidence = conditionRead?.confidence ?? 0;
  // Channel-desk margin (#291/M4): a green/absent appraiser pads the allowance
  // ABOVE book to avoid blowing the deal (generous → thin margin); a sharp UCM
  // tightens it down toward honest book (better margin). Monotonic in skill,
  // no UCM (confidence 0) = the most generous allowance = the margin floor.
  const generosityFactor = 1 + (1 - confidence) * cfg.appraisalGenerosityPremium;
  const target = book * policyMultiplier * generosityFactor;

  const dollars = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

  const roundedTarget = Math.round(target);

  if (allowanceAsk <= target) {
    return {
      action: 'accept',
      target: roundedTarget,
      rationale: `Ask ${dollars(allowanceAsk)} ≤ internal target ${dollars(
        target,
      )} (book ${dollars(book)} × policy ${policyMultiplier} × generosity factor ${generosityFactor.toFixed(
        2,
      )}); accepted.`,
    };
  }

  // Counter amount: hold at target, then drift toward the ask the weaker the
  // negotiator (over-pay). A perfect closer (effectiveness=1) holds at target.
  const giveFraction = (1 - skill.effectiveness) * cfg.counterGiveWeight;
  const counterAmount = Math.round(target + (allowanceAsk - target) * giveFraction);

  const farAbove = allowanceAsk > target * (1 + cfg.counterWindowFraction);
  if (farAbove && skill.effectiveness < cfg.skillCounterThreshold) {
    return {
      action: 'decline',
      target: roundedTarget,
      rationale: `Ask ${dollars(allowanceAsk)} far above target ${dollars(
        target,
      )} (> +${(cfg.counterWindowFraction * 100).toFixed(
        0,
      )}%) and NEGOTIATE effectiveness ${skill.effectiveness.toFixed(
        2,
      )} below threshold ${cfg.skillCounterThreshold}; declined.`,
    };
  }

  return {
    action: 'counter',
    counterAmount,
    target: roundedTarget,
    rationale: `Ask ${dollars(allowanceAsk)} above target ${dollars(
      target,
    )}; counter ${dollars(counterAmount)} (NEGOTIATE effectiveness ${skill.effectiveness.toFixed(
      2,
    )}${farAbove ? ', skilled closer holding a far-above ask' : ''}).`,
  };
}

// ── Routine trade auto-resolution (#169) ──────────────────────────────────────

export interface TradeResolutionInput {
  readonly currentVehicle: CurrentVehicle;
  /** Outstanding lien on the trade; `null` for a free-and-clear owner. */
  readonly loanPayoff: number | null;
  /** What the customer wants for the trade (`generateTradeAsk` output). */
  readonly allowanceAsk: number;
  /** Acting salesperson's resolved NEGOTIATE composite. */
  readonly skill: NegotiationSkill;
  /** UCM condition read on the trade, or `null` when no UCM is on staff. */
  readonly conditionRead: TradeConditionRead | null;
}

/**
 * An escalation approver resolved from StaffOrg (#170). Priority is GM > UCM >
 * player; the composition root resolves the highest-ranking manager on the
 * roster and passes their role + resolved NEGOTIATE composite. `null` (or
 * omitted) ⇒ no manager on staff ⇒ the player is the approver.
 */
export interface TradeApprover {
  readonly role: 'gm' | 'ucm';
  /** The approver's resolved NEGOTIATE composite (drives the extended counter). */
  readonly skill: NegotiationSkill;
}

/**
 * Channel-desk trade auto-approval gate (#291/M4). The UCM may silently approve
 * an *escalated* trade only once its `condition_reading` skill clears the act
 * threshold — the advise/act split (manager-roles-channel-desk.md §3): the
 * appraisal *advice* (`getTradeConditionRead`/#163) is free on hire and sharpens
 * with skill, but auto-approving *for* the player is earned. `null` (no UCM on
 * staff) ⇒ never unlocked. Hard cliff at the threshold (the earned-stripes beat);
 * the GM, when present, trumps this gate at the composition root. Pure — sibling
 * to `isAutoPricingUnlocked` (M2) / `isDiscountDeskingUnlocked` (M3).
 */
export function isTradeApprovalUnlocked(
  ucmConditionReadingSkill: number | null,
  threshold: number,
): boolean {
  return (
    ucmConditionReadingSkill !== null && ucmConditionReadingSkill >= threshold
  );
}

/**
 * A roster member as the approver resolver sees it (#291/M4) — the narrow read
 * the composition root maps its StaffOrg roster down to, so DealEngine never
 * depends on StaffOrg. `role` is the raw `role_id`; only `gm` / `used-car-manager`
 * participate.
 */
export interface ApproverCandidate {
  readonly role: string;
  /** The candidate's `condition_reading` skill (0–100); gates the UCM approver. */
  readonly conditionReading: number;
  /** Resolved NEGOTIATE composite — drives the extended counter when approving. */
  readonly skill: NegotiationSkill;
}

/**
 * Resolve the escalation approver from the roster with GM > UCM > player
 * priority and the channel-desk `condition_reading` gate (#291/M4 — replaces
 * #170's presence gate). The GM is the empire layer and **trumps the gate**
 * (never gated). Below it, a UCM may auto-approve an escalated trade only once
 * the *top* UCM `condition_reading` clears `conditionReadingThreshold` — the
 * act gate (appraisal *advice* stays free on hire; see `isTradeApprovalUnlocked`).
 * Returns the best-NEGOTIATE candidate of the winning pool (drives the extended
 * counter; appraisal confidence stays the best condition reader elsewhere, §6),
 * or `null` (no qualifying manager) ⇒ the trade escalates to the player. Pure.
 */
export function resolveTradeApprover(
  candidates: readonly ApproverCandidate[],
  conditionReadingThreshold: number,
): TradeApprover | null {
  const bestBy = (pool: readonly ApproverCandidate[]): ApproverCandidate =>
    pool.reduce((m, c) => (c.skill.effectiveness > m.skill.effectiveness ? c : m));

  const gms = candidates.filter((c) => c.role === 'gm');
  if (gms.length > 0) return { role: 'gm', skill: bestBy(gms).skill };

  const ucms = candidates.filter((c) => c.role === 'used-car-manager');
  if (ucms.length === 0) return null;
  const topConditionReading = ucms.reduce(
    (m, c) => Math.max(m, c.conditionReading),
    0,
  );
  if (!isTradeApprovalUnlocked(topConditionReading, conditionReadingThreshold)) {
    return null;
  }
  return { role: 'ucm', skill: bestBy(ucms).skill };
}

export interface TradeResolutionDeps {
  /** Honest wholesale book for the trade (live MarketEconomy provider at runtime). */
  readonly bookValueFn: TradeBookValueFn;
  /** Trade-policy multiplier (slice #18 seam). Default `1.0` (market). */
  readonly policyMultiplier?: number;
  /**
   * Escalation approver resolved from StaffOrg (#170). When an *unusual* trade
   * escalates and an approver is present (and the ask is under the player
   * override), they decide silently via the extended evaluator. `null`/omitted
   * ⇒ no manager ⇒ the trade routes to the player overlay (`player_review`).
   */
  readonly approver?: TradeApprover | null;
  /**
   * Per-slot "always escalate to me above $X" (#170). An ask over this routes
   * to the player even when a manager could handle it. Defaults to
   * `config.playerOverrideThresholdDefault`.
   */
  readonly playerOverrideThreshold?: number;
  readonly config?: TradeEvalConfig;
}

/**
 * The data an escalated trade hands the manager-attention overlay (#170) — the
 * player approver's decision surface. Plain serializable figures (it doubles as
 * the `trade:escalated` event payload at the StaffDispatch seam). The player
 * weighs the honest `book` and the customer's `payoff` against their `ask`,
 * with the staff's `recommendedCounter` and `staffConfidence` as advisories.
 */
export interface TradeReviewPayload {
  readonly currentVehicle: CurrentVehicle;
  /** Honest wholesale book for the trade. */
  readonly book: number;
  /** What the customer wants for the trade. */
  readonly allowanceAsk: number;
  /** Outstanding lien on the trade (0 for a free-and-clear owner). */
  readonly payoff: number;
  /** The staff's internal acceptance target (`evaluateTrade.target`). */
  readonly target: number;
  /** Advisory counter the salesperson would have offered (whole dollars). */
  readonly recommendedCounter: number;
  /** UCM condition-read confidence behind the appraisal (0 = no UCM). */
  readonly staffConfidence: number;
}

/**
 * Outcome of resolving a customer's trade as part of a closing deal (#169,
 * escalation #170).
 *
 *   - `resolved`      — routine *or* manager-approved. Auto-resolves silently;
 *                       carries the agreed allowance, the net `tradeEquity`
 *                       (allowance − payoff, ≥ 0) the deal structure folds in,
 *                       whether a counter was taken, and which `approver`
 *                       settled it (`auto` = routine salesperson, else the
 *                       escalation manager).
 *   - `abandoned`     — the agreed allowance can't clear the lien
 *                       (`negative_equity`), or an escalation manager declined
 *                       even at the extended counter range (`manager_declined`).
 *                       The customer walks.
 *   - `player_review` — *unusual* trade with no manager to handle it (or an ask
 *                       over the player override). Routes to the #84 player
 *                       overlay carrying `review`; StaffDispatch emits
 *                       `trade:escalated` and holds the deal for the player.
 */
export type TradeResolution =
  | {
      readonly status: 'resolved';
      readonly action: 'accept' | 'counter';
      readonly agreedAllowance: number;
      readonly hadCounter: boolean;
      /** `agreedAllowance − payoff`, ≥ 0. Net credit the deal structure folds in. */
      readonly tradeEquity: number;
      /** Who settled it: routine salesperson (`auto`) or the escalation manager. */
      readonly approver: 'auto' | 'gm' | 'ucm';
      readonly rationale: string;
    }
  | {
      readonly status: 'abandoned';
      readonly reason: 'negative_equity' | 'manager_declined';
      readonly rationale: string;
    }
  | {
      readonly status: 'player_review';
      readonly review: TradeReviewPayload;
      readonly rationale: string;
    };

/** Structure a routine/manager `accept|counter` into a resolved/abandoned trade. */
function settleAgreed(
  action: 'accept' | 'counter',
  agreedAllowance: number,
  payoff: number,
  approver: 'auto' | 'gm' | 'ucm',
  rationale: string,
): TradeResolution {
  const tradeEquity = agreedAllowance - payoff;
  if (tradeEquity < 0) {
    return {
      status: 'abandoned',
      reason: approver === 'auto' ? 'negative_equity' : 'manager_declined',
      rationale: `Agreed allowance $${agreedAllowance.toLocaleString(
        'en-US',
      )} below lien payoff $${payoff.toLocaleString(
        'en-US',
      )}; can't clear the lien. ${
        approver === 'auto'
          ? 'Customer underwater — abandoned.'
          : `${approver.toUpperCase()} declined to roll the negative equity.`
      }`,
    };
  }
  return {
    status: 'resolved',
    action,
    agreedAllowance,
    hadCounter: action === 'counter',
    tradeEquity,
    approver,
    rationale,
  };
}

/**
 * Resolve a customer's trade for a deal that has otherwise reached close (#169;
 * manager-attention escalation #170). Pure and deterministic — composes
 * `evaluateTrade` with the routine gate, the negative-equity guard, and the
 * escalation/approver model; no RNG, no I/O.
 *
 * A trade is *routine* (auto-resolves silently, `approver: 'auto'`) when the
 * salesperson's evaluation didn't decline, the ask sits within
 * `routineGapFraction` of the staff target, condition-read confidence clears
 * `routineConfidenceFloor`, and the lien overhang is within
 * `negativeEquityEscalationMargin`. Routine accepts agree at the ask; routine
 * counters agree at the staff counter.
 *
 * Anything else is *unusual* and escalates to a manager-attention decision:
 *   - If an `approver` (GM/UCM) is on staff and the ask is under the player
 *     override, they re-decide via `evaluateTrade` with the **extended** counter
 *     range (`managerCounterWindowFraction`) and their own NEGOTIATE skill — a
 *     counter a salesperson would decline. Resolves silently (`approver` tag),
 *     or `abandoned`/`manager_declined` if even the manager won't.
 *   - Otherwise (no manager, or ask over the player override) it returns
 *     `player_review` carrying the overlay payload; StaffDispatch routes it to
 *     the #84 player overlay.
 *
 * The negative-equity guard still applies after a manager approves: a manager
 * won't roll negative equity into the note (`manager_declined`).
 */
export function resolveTradeIn(
  input: TradeResolutionInput,
  deps: TradeResolutionDeps,
): TradeResolution {
  const cfg = deps.config ?? loadTradeEvalConfig();
  const policyMultiplier = deps.policyMultiplier ?? 1.0;
  const { currentVehicle, allowanceAsk, skill, conditionRead, loanPayoff } =
    input;
  const payoff = loanPayoff ?? 0;

  const evaluation = evaluateTrade(
    { currentVehicle, allowanceAsk, skill, conditionRead },
    { bookValueFn: deps.bookValueFn, policyMultiplier, config: cfg },
  );

  const confidence = conditionRead?.confidence ?? 0;
  const gapOk =
    allowanceAsk - evaluation.target <=
    evaluation.target * cfg.routineGapFraction;
  const confidenceOk = confidence >= cfg.routineConfidenceFloor;
  // A large lien overhang (payoff far over our internal target) is unusual even
  // when the ask itself looks routine — it routes to manager/player attention
  // rather than silently abandoning at the salesperson's desk.
  const overhangOk =
    payoff - evaluation.target <=
    evaluation.target * cfg.negativeEquityEscalationMargin;
  const routine =
    evaluation.action !== 'decline' && gapOk && confidenceOk && overhangOk;

  if (routine) {
    const agreedAllowance =
      evaluation.action === 'accept'
        ? allowanceAsk
        : (evaluation.counterAmount as number);
    return settleAgreed(
      evaluation.action,
      agreedAllowance,
      payoff,
      'auto',
      evaluation.rationale,
    );
  }

  // ── Escalation: resolve the approver (GM > UCM > player). ──
  const override =
    deps.playerOverrideThreshold ?? cfg.playerOverrideThresholdDefault;
  const forcePlayer = allowanceAsk > override;
  const approver = deps.approver ?? null;

  if (approver && !forcePlayer) {
    // Manager re-decides with the extended counter range + their own skill.
    const managerEval = evaluateTrade(
      { currentVehicle, allowanceAsk, skill: approver.skill, conditionRead },
      {
        bookValueFn: deps.bookValueFn,
        policyMultiplier,
        config: { ...cfg, counterWindowFraction: cfg.managerCounterWindowFraction },
      },
    );
    if (managerEval.action === 'decline') {
      return {
        status: 'abandoned',
        reason: 'manager_declined',
        rationale: `${approver.role.toUpperCase()} reviewed the escalated trade and declined — ${managerEval.rationale}`,
      };
    }
    const agreedAllowance =
      managerEval.action === 'accept'
        ? allowanceAsk
        : (managerEval.counterAmount as number);
    return settleAgreed(
      managerEval.action,
      agreedAllowance,
      payoff,
      approver.role,
      `${approver.role.toUpperCase()} approved the escalated trade — ${managerEval.rationale}`,
    );
  }

  // Player approver: hand the overlay everything it needs to decide.
  const recommendedCounter = Math.round(
    evaluation.target +
      Math.max(0, allowanceAsk - evaluation.target) *
        (1 - skill.effectiveness) *
        cfg.counterGiveWeight,
  );
  return {
    status: 'player_review',
    review: {
      currentVehicle,
      book: deps.bookValueFn(currentVehicle),
      allowanceAsk,
      payoff,
      target: evaluation.target,
      recommendedCounter,
      staffConfidence: confidence,
    },
    rationale: `Unusual trade escalated to the player — ${evaluation.rationale} (gap within band: ${gapOk}, confidence ≥ floor: ${confidenceOk}, overhang within band: ${overhangOk}, ask over override: ${forcePlayer}, manager on staff: ${approver !== null}).`,
  };
}

// ── Customer accept/reject on a player counter (#170) ─────────────────────────

export interface CustomerCounterInput {
  /** What the customer wanted for the trade. */
  readonly allowanceAsk: number;
  /** The player's proposed counter (whole dollars). */
  readonly counterAmount: number;
  /** Customer's price-sensitivity in [0,1] (1 = most haircut-averse). */
  readonly priceSensitivity: number;
}

/**
 * Deterministic customer accept/reject on a PLAYER counter (#170). When the
 * player offers `counterAmount` below the customer's `allowanceAsk`, the haircut
 * `gapFraction = (ask − counter)/ask` drives rejection, amplified by the
 * customer's price-sensitivity:
 *
 *   acceptProb = clamp01(
 *     1 − gapFraction · counterGapAversion · (1 + priceSensitivity · counterSensitivityWeight)
 *   )
 *
 * A counter at or above the ask is accepted outright (`acceptProb = 1`). Pure
 * and deterministic from `seed` — the caller derives it (e.g.
 * `deriveSeed(masterSeed, 'trade_counter_response', { customerId, day })`).
 */
export function rollCustomerCounterResponse(
  input: CustomerCounterInput,
  seed: number,
  config: TradeEvalConfig = loadTradeEvalConfig(),
): boolean {
  const { allowanceAsk, counterAmount, priceSensitivity } = input;
  if (allowanceAsk <= 0 || counterAmount >= allowanceAsk) return true;
  const gapFraction = (allowanceAsk - counterAmount) / allowanceAsk;
  const sensitivity = priceSensitivity < 0 ? 0 : priceSensitivity > 1 ? 1 : priceSensitivity;
  const aversion =
    gapFraction *
    config.counterGapAversion *
    (1 + sensitivity * config.counterSensitivityWeight);
  const acceptProb = aversion >= 1 ? 0 : 1 - aversion;
  return createRng(seed)() < acceptProb;
}

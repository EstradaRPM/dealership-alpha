import type { EventBus } from '../EventBus';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { StaffMorale } from '../StaffMorale';
import type { DeptDrain } from '../FloorSim';
import type { Inventory } from '../Inventory';
import type {
  DealEngine,
  CreditTierCatalog,
  TradeBookValueFn,
  TradeConditionRead,
  TradeApprover,
  TradeReviewPayload,
} from '../DealEngine';
import { resolveTradeIn, rollCustomerCounterResponse } from '../DealEngine';
import type { Person, Visit, SkillDriftConfig } from '../NPC';
import { skillDriftFraction } from '../NPC';
import { createRng, deriveSeed } from '../Rng';
import { loadStaffDispatchConfig, type StaffDispatchConfig } from './staffDispatchData';
import {
  closeAndPrice,
  makeSalespersonProfile,
  pickVehicleForMatch,
  resolveSalesProcess,
  vehicleSpaced,
  wantedVehicleCategory,
  type MatchCustomer,
  type ResolveDeps,
  type CloseDeps,
  type PickVehicleDeps,
  type SpacedVector,
  type VehicleCategory,
} from '../SalesProcess';

/** Narrow shape this module needs from a CustomerPool session lookup. */
export interface StaffDispatchCustomerSession {
  readonly bundle: { readonly person: Person; readonly visit: Visit };
  readonly visitArchetypeId: string;
  /** Customer archetype label (#320), e.g. `'Young Family'` — the same label CustomerPool stamps on `customer:arrived`. */
  readonly archetypeLabel: string;
}

export interface StaffDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  masterSeed: number;
  inventory: Pick<Inventory, 'getLotVehicles'>;
  dealEngine: Pick<DealEngine, 'closeDeal' | 'classifyCredit' | 'computeAutoFni'>;
  creditTiers: CreditTierCatalog;
  /** Resolves the customer's NPC bundle + visit-archetype id. */
  getCustomerSession: (customerId: string) => StaffDispatchCustomerSession | undefined;
  staffMorale?: StaffMorale;
  config?: StaffDispatchConfig;
  /** RNG for F&I auto-attach (defaults to Math.random). */
  fniRng?: () => number;
  /** Optional unlocked F&I roles override. Defaults to deriving from staffOrg roster. */
  unlockedRolesFn?: () => string[];
  /** Optional SalesProcess deps (configs, market/cost/book seam overrides). */
  salesProcessDeps?: ResolveDeps & CloseDeps & PickVehicleDeps;
  /**
   * Season/weather demand lean (#231 S2). Biases the customer want-vector
   * (SPACED axes) for the resolution day before the match + sales process, so
   * the seasonal effect is emergent through pickVehicleFor (#197) — which
   * models a season favors falls out of the match, not a per-model rule. The
   * composition root wires this from `Weather.leanWantVector`. Omitted ⇒
   * identity (behavior-neutral; the #94 calibration + legacy/test harnesses are
   * unaffected).
   */
  wantVectorBias?: (spaced: SpacedVector, day: number) => SpacedVector;
  /**
   * Vehicle-attribute demand lean for the resolution day (#231 S4). Signed
   * deltas over the attribute axes (winterCapability / openAir / fuelEfficiency)
   * that tilt the match toward weather-aligned vehicles (AWD in snow, etc.).
   * Passed straight into the matcher's `attributeLean`; the composition root
   * wires it from `Weather.attributeLeanForDay`. Omitted ⇒ no lean
   * (behavior-neutral; calibration + legacy/test harnesses unaffected).
   */
  attributeLeanForDay?: (day: number) => Readonly<Record<string, number>>;
  /**
   * Honest wholesale book for a customer's trade-in (#169). Wired from the live
   * MarketEconomy book provider at the composition root (which owns the
   * CurrentVehicle→PricedVehicleInput cast). Omitting it disables trade
   * resolution — `hasTrade` visits simply close without a trade (legacy/test
   * harnesses without a book provider).
   */
  tradeBookValueFn?: TradeBookValueFn;
  /**
   * UCM condition read on the trade (#169) — `confidence` pulls the staff's
   * internal trade valuation. Defaults to `null` (no UCM ⇒ maximally
   * defensive). The composition root derives it from the on-roster used-car
   * manager's `condition_reading` skill.
   */
  getTradeConditionRead?: () => TradeConditionRead | null;
  /**
   * Escalation approver (#170) resolved from StaffOrg with GM > UCM > player
   * priority. Returns the highest-ranking manager on the roster + their
   * NEGOTIATE composite, or `null` when none is hired (⇒ player overlay).
   */
  getTradeApprover?: () => TradeApprover | null;
  /**
   * Per-slot "always escalate to me above $X" trade override (#170). An ask
   * over this routes to the player even when a manager could handle it.
   * Defaults to the trade-evaluation config default. Persisted per save slot;
   * the composition root reads it through the save-scoped settings source.
   */
  getTradeEscalationOverride?: () => number;
  /**
   * Per-slot trade-acquisition policy multiplier (#172). Scales the staff's
   * internal trade-in acceptance target: `> 1` chases volume (overpay), `< 1`
   * protects gross (under-pay). Resolved live from the persisted slot setting
   * (`resolveTradePolicyMultiplier`) so a mid-game change takes effect on the
   * next trade. Omitted/`undefined` ⇒ `1.0` (market) — the #94 calibration
   * path is unaffected.
   */
  getTradePolicyMultiplier?: () => number;
  /**
   * Player-review handoff (#201). StaffDispatch owns the held close context;
   * the composition root stores the returned closure and calls it when the UI
   * submits a player decision.
   */
  onTradeReviewHeld?: (held: HeldTradeReview) => void;
  /**
   * Player-review handoff (#222). StaffDispatch owns the held discount context;
   * the composition root stores the returned closure and calls it when the UI
   * submits a player decision.
   */
  onDiscountReviewHeld?: (held: HeldDiscountReview) => void;
  /**
   * Discount-desking gate (channel-desk M3, #290). `true` once the used-car
   * desk can *act* on below-floor discounts — i.e. the top UCM's `t_o_closing`
   * skill clears the data-driven threshold. When unlocked the UCM auto-desks
   * ALL below-floor ups (authorizes the salesperson's counter down to cost and
   * closes); below the gate (or no UCM) the deal falls through to the
   * understaffed path — a rare rate-gated slice escalates to the player, the
   * rest walk. The composition root distills the top UCM `t_o_closing` skill
   * from the live roster and gates it through `isDiscountDeskingUnlocked`
   * against `tunables.managerGates.actThresholds.t_o_closing`, mirroring the M2
   * pricing gate. Omitted ⇒ locked (`false`) — acting is earned (legacy/test
   * harnesses without the getter take the understaffed path).
   */
  getDiscountDeskingUnlocked?: () => boolean;
  /**
   * Discount-desking execution-fidelity drift (channel-desk M5, #292). When the
   * desk acts on a below-floor up (gate unlocked) the UCM *aims* at the
   * salesperson's hold; its `t_o_closing` skill governs the gap. The realized
   * desk counter weakens off that hold toward the customer's target (a thinner
   * gross — always toward worse), scaled by `skillDriftFraction`. The
   * composition root supplies the top UCM `t_o_closing` skill + the
   * `managerGates.executionDrift.t_o_closing` config; StaffDispatch derives the
   * per-(customer, day) seed so it's replay-safe (#122). Omitted/`null` ⇒ no
   * drift (the desk holds exactly at the salesperson's counter — the pre-M5
   * behavior; legacy/test harnesses).
   */
  getDeskingDrift?: () => {
    readonly ucmClosingSkill: number;
    readonly config: SkillDriftConfig;
  } | null;
  /**
   * Trade-allowance execution-fidelity drift (channel-desk M5, #292). The UCM's
   * `condition_reading` skill governs how loosely the appraisal target drifts
   * off the M4 monotonic-margin baseline (a looser over-allowance → thinner
   * margin, always toward worse). The composition root supplies the top UCM
   * `condition_reading` skill + the `managerGates.executionDrift.condition_reading`
   * config; StaffDispatch derives the per-(customer, day) seed and threads the
   * result into `resolveTradeIn`. Omitted/`null` ⇒ no drift (the target sits at
   * the M4 baseline — legacy/test harnesses).
   */
  getTradeAllowanceDrift?: () => {
    readonly conditionReadingSkill: number;
    readonly config: SkillDriftConfig;
  } | null;
}

// Intentionally empty — dispatch is fully autonomous.
export interface StaffDispatch {}

export type PlayerTradeDecision =
  | { readonly kind: 'accept_ask' }
  | { readonly kind: 'accept_counter' }
  | { readonly kind: 'propose_counter'; readonly amount: number }
  | { readonly kind: 'decline' };

export type PlayerTradeDecisionResult =
  // `agreedAllowance` = the settled trade allowance, surfaced to the modal's
  // buy/walk recap line (#283) so a booked trade reads as an honest figure.
  | { readonly status: 'closed'; readonly agreedAllowance: number }
  | { readonly status: 'abandoned' }
  | {
      readonly status: 'counter_rejected';
      readonly amount: number;
      readonly accepted: false;
    };

export interface HeldTradeReview {
  readonly customerId: string;
  readonly day: number;
  readonly review: TradeReviewPayload;
  decide(decision: PlayerTradeDecision): PlayerTradeDecisionResult;
}

export interface DiscountReviewPayload {
  readonly customerId: string;
  readonly day: number;
  readonly vehicle: {
    readonly id: string;
    readonly make: string;
    readonly model: string;
    readonly year: number;
    readonly mileage: number;
    readonly category: string;
  };
  /** Competitor benchmark (book × markup) — for above/below-market labeling only. */
  readonly marketPrice: number;
  /** Our list price (the player-set askingPrice) — the top of the negotiation range. */
  readonly askingPrice: number;
  /** What the customer wants to pay (their reservation price) — the bottom of the range. */
  readonly customerTargetPrice: number;
  /**
   * The salesperson's failed counter — between the customer's target and our
   * ask, positioned tighter toward the ask the higher the salesperson's skill.
   * The customer already balked at it; re-pitching rolls for acceptance.
   */
  readonly salespersonCounter: number;
  /** Hard floor: vehicle cost. We never sell below it (a player counter under it abandons). */
  readonly minimumAcceptablePrice: number;
  /** Front gross if the customer paid full list. */
  readonly frontGrossAtAsk: number;
  /** True when the customer's target is at/above cost (we can meet it without a loss). */
  readonly canAcceptAsk: boolean;
  /**
   * Acceptance-heat readout fields (#287). The modal frames the negotiation as
   * a reactive accept-% rather than a raw "N offers left" countdown.
   */
  /** Max counter-offers the customer will hear before walking — the pip denominator. */
  readonly counterAttempts: number;
  /** Counters already missed at escalation time (always 0; the modal tracks live). */
  readonly priorMisses: number;
  /** Acceptance prob of the salesperson's already-failed counter — the opening read. */
  readonly salespersonCounterAcceptProb: number;
  /** Customer price-sensitivity (0..1) — lets the modal color the live price input. */
  readonly priceSensitivity: number;
  /** Per-miss acceptance cool-off — the modal's live color reflects it. */
  readonly missPenalty: number;
}

export type PlayerDiscountDecision =
  | { readonly kind: 'accept_ask' }
  | { readonly kind: 'accept_counter' }
  | { readonly kind: 'propose_counter'; readonly amount: number }
  | { readonly kind: 'decline' };

export type PlayerDiscountDecisionResult =
  | { readonly status: 'closed'; readonly soldPrice: number; readonly frontGross: number }
  | { readonly status: 'abandoned' }
  | {
      readonly status: 'counter_rejected';
      readonly amount: number;
      readonly accepted: false;
      /** Counter-offers the customer will still entertain before walking. */
      readonly attemptsRemaining: number;
      /** Acceptance prob of the just-rejected offer — the modal slams this headline (#287). */
      readonly acceptProb: number;
    };

export interface HeldDiscountReview {
  readonly customerId: string;
  readonly day: number;
  readonly review: DiscountReviewPayload;
  decide(decision: PlayerDiscountDecision): PlayerDiscountDecisionResult;
}

/** Outcome of a single auto-resolution attempt against one sales customer. */
type ResolveResult = 'resolved' | 'escalated' | 'declined';

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Whether the used-car desk can *act* on below-floor discounts (channel-desk
 * M3, #290 — reframes #288's UCM-*presence* gate onto the UCM's `t_o_closing`
 * (turn-over/desking) skill threshold). The acting capability is earned: a UCM
 * whose top `t_o_closing` skill meets the data-driven threshold desks ALL
 * below-floor ups; below it (or with no UCM, `ucmClosingSkill == null`) the
 * deal falls through to the understaffed path. Pure; the composition root
 * supplies the top UCM `t_o_closing` skill (from the roster) and the threshold
 * (from `tunables.managerGates.actThresholds.t_o_closing`). The cliff at the
 * threshold is the earned-stripes beat, by design (manager-roles-channel-desk.md
 * §3). Sibling to MarketEconomy's `isAutoPricingUnlocked` (M2).
 */
export function isDiscountDeskingUnlocked(
  ucmClosingSkill: number | null,
  threshold: number,
): boolean {
  return ucmClosingSkill != null && ucmClosingSkill >= threshold;
}

/**
 * Probability the customer accepts a counter at `counterPrice` given their
 * hidden target. At/below the target it's an automatic yes (1); above it,
 * acceptance falls off with the gap — steepened by their price-sensitivity and
 * cooled further by each prior swing-and-a-miss (`priorMisses × missPenalty`).
 * Pure/deterministic: the accept *roll* (rollDiscountCounterResponse) stays
 * seeded, but this probability is the read the discount modal surfaces as its
 * acceptance-heat number (#287). No replay impact.
 */
export function discountAcceptProbability(
  customerTargetPrice: number,
  counterPrice: number,
  priceSensitivity: number,
  priorMisses: number,
  missPenalty: number,
): number {
  if (counterPrice <= customerTargetPrice) return 1;
  const gapFraction =
    (counterPrice - customerTargetPrice) / Math.max(customerTargetPrice, 1);
  return clampUnit(
    1 - gapFraction * 1.6 * (1 + priceSensitivity) - priorMisses * missPenalty,
  );
}

function rollDiscountCounterResponse(
  customerTargetPrice: number,
  counterPrice: number,
  priceSensitivity: number,
  priorMisses: number,
  missPenalty: number,
  seed: number,
): boolean {
  return (
    createRng(seed)() <
    discountAcceptProbability(
      customerTargetPrice,
      counterPrice,
      priceSensitivity,
      priorMisses,
      missPenalty,
    )
  );
}

// Per-gate patience drain rate: balanced default (matches CustomerPool).
const ARCHETYPE_IMPATIENCE = 0.25;

/**
 * Builds the per-customer sales auto-resolution closure shared by the legacy
 * once-per-admit path and the per-tick floor drain (#101). #147 rewires the
 * close to the real machinery: pickVehicleFor → resolveSalesProcess →
 * closeAndPrice → DealEngine.closeDeal. The hold-floor model is untouched;
 * the synthetic close path is gone. The only `escalated` returns now are the
 * trade (#170) and discount (#222) player-review holds.
 */
function makeSalesResolver(deps: StaffDispatchDeps) {
  const { bus, staffOrg, queue, masterSeed, staffMorale } = deps;
  const config = deps.config ?? loadStaffDispatchConfig();

  function emitNoSale(
    customerId: string,
    staffId: string,
    day: number,
    reason: string,
    context?: { archetypeLabel?: string; wantedCategory?: VehicleCategory },
  ): void {
    bus.publish('staff:auto_resolved', {
      customerId,
      staffId,
      day,
      outcome: 'no_sale',
      grossImpact: 0,
      reason,
      archetypeLabel: context?.archetypeLabel,
      wantedCategory: context?.wantedCategory,
    });
  }

  return function resolveSalesCustomer(
    customerId: string,
    day: number,
  ): ResolveResult {
    const salespeople = staffOrg.currentRoster.filter(
      s => s.role_id === 'salesperson',
    );
    if (salespeople.length === 0) return 'declined';

    // Pick highest-effectiveness salesperson.
    const salesperson = salespeople.reduce((best, s) =>
      s.effectiveness > best.effectiveness ? s : best,
    );

    // Hold-floor model (#134): any salesperson on the roster always works
    // (holds) the up — there is no skill-gated decline.
    queue.resolveByCustomerId(customerId);

    const session = deps.getCustomerSession(customerId);
    if (!session) {
      emitNoSale(customerId, salesperson.id, day, 'no_session');
      return 'resolved';
    }
    const { bundle, visitArchetypeId } = session;
    const { person, visit } = bundle;
    if (visit.kind !== 'sales') {
      emitNoSale(customerId, salesperson.id, day, 'not_sales', {
        archetypeLabel: session.archetypeLabel,
      });
      return 'resolved';
    }

    // morale acts as a per-gate effectiveness multiplier on the salesperson's
    // composite skill profile (no more skill-independent close-rate dial).
    const moraleMult = staffMorale?.getMoraleMultiplier(salesperson.id) ?? 1.0;
    const effectiveness = clampUnit(salesperson.effectiveness * moraleMult);
    const trustworthiness = clampUnit(salesperson.trustworthiness ?? 0);
    const skill = makeSalespersonProfile({}, { effectiveness, trustworthiness });

    // Tier policy used by both finance affordability and deal-structuring.
    const tier =
      visit.paymentMethod === 'finance'
        ? deps.creditTiers.tiers[deps.dealEngine.classifyCredit(person.credit)]
        : undefined;

    // Season/weather demand lean (#231 S2): nudge the want-vector before the
    // match so the seasonal effect stays emergent through pickVehicleFor.
    const rawSpaced = visit.preferences as SpacedVector;
    const customerSpaced = deps.wantVectorBias
      ? deps.wantVectorBias(rawSpaced, day)
      : rawSpaced;
    const priceSensitivity = clampUnit(1 - person.wealth / 120000);
    // Walk-off narrative (#321): the "what they wanted" half, independent of
    // any matched vehicle — computed once so every no_sale emission below can
    // carry it alongside the "who" (session.archetypeLabel).
    const walkOffContext = {
      archetypeLabel: session.archetypeLabel,
      wantedCategory: wantedVehicleCategory(customerSpaced, deps.salesProcessDeps),
    };
    const matchCustomer: MatchCustomer = {
      masterSeed,
      customerId,
      customerSpaced,
      priceSensitivity,
      visitArchetypeId,
      wealth: person.wealth,
      annualIncome: person.annualIncome,
      paymentMethod: visit.paymentMethod,
      // Cash buyers don't carry a stamped behavioral cash-spend fraction on
      // the visit yet (NPC schema follow-on). The matcher's headroom math
      // uses this; default to the full wealth ceiling so cash eligibility is
      // truly "can the buyer cover list price" without a behavioral haircut.
      cashSpendFraction: visit.paymentMethod === 'cash' ? 1 : undefined,
      downPaymentBehavior: visit.downPaymentBehavior,
    };

    const pickDeps: PickVehicleDeps = {
      ...(deps.salesProcessDeps ?? {}),
      tier,
      // #231 S4: the day's vehicle-attribute demand lean nudges the match toward
      // weather-aligned units. Omitted seam ⇒ undefined ⇒ no effect.
      attributeLean: deps.attributeLeanForDay?.(day),
    };
    // #295 frontline-hold: a vehicle acquired during play (auction buy or
    // customer trade) is held off the walk-in pool until its `frontlineDay`, so
    // the player gets an interaction window before a simmed customer can buy it.
    // Enforced ONLY here — held units still show in `getLotVehicles()` and still
    // accrue carrying cost; only walk-in matching is blocked.
    const lot = deps.inventory
      .getLotVehicles()
      .filter((v) => v.frontlineDay <= day);
    const match = pickVehicleForMatch(matchCustomer, lot, pickDeps);
    if (!match) {
      emitNoSale(customerId, salesperson.id, day, 'no_fit', walkOffContext);
      return 'resolved';
    }
    const vehicle = lot.find(v => v.id === match.vehicleId);
    if (!vehicle) {
      // pickVehicleFor only returns ids from the lot snapshot, so this is
      // unreachable; the guard satisfies the type and is defensive vs. future
      // refactors.
      emitNoSale(customerId, salesperson.id, day, 'no_fit', walkOffContext);
      return 'resolved';
    }

    const resolution = resolveSalesProcess(
      {
        masterSeed,
        customerId,
        day,
        skill,
        customerDifficulty: clampUnit(1 - person.agreeableness / 100),
        archetypeImpatience: ARCHETYPE_IMPATIENCE,
        initialPatience: visit.resources.patience,
        customerSpaced,
        vehicleSpaced: vehicleSpaced(vehicle, deps.salesProcessDeps),
        visitArchetypeId,
      },
      deps.salesProcessDeps,
    );
    if (resolution.outcome === 'walk') {
      emitNoSale(customerId, salesperson.id, day, resolution.cause, walkOffContext);
      return 'resolved';
    }

    const close = closeAndPrice(
      {
        meters: resolution.meters,
        skill,
        priceSensitivity,
        vehicle,
      },
      deps.salesProcessDeps,
    );

    const closeDealAtPrice = (
      agreedPrice: number,
      tradeEquity: number,
    ): ResolveResult => {
      const unlockedRoles =
        deps.unlockedRolesFn?.() ??
        Array.from(new Set(staffOrg.currentRoster.map(s => s.role_id)));
      const fni = deps.dealEngine.computeAutoFni(
        effectiveness * 100,
        unlockedRoles,
        deps.fniRng,
      );

      let downPayment = 0;
      let loanAmount = 0;
      let term = 0;
      let apr = 0;
      if (visit.paymentMethod === 'cash') {
        // Net trade equity reduces the cash the customer brings to close.
        downPayment = Math.max(0, agreedPrice - tradeEquity);
      } else {
        const policy = tier!;
        apr = policy.apr;
        term = policy.maxTerm;
        downPayment = agreedPrice * (visit.downPaymentBehavior ?? 0);
        // Net trade equity acts as additional cap reduction, shrinking the note.
        loanAmount = Math.max(0, agreedPrice - downPayment - tradeEquity);
      }

      const result = deps.dealEngine.closeDeal({
        customerId,
        vehicleId: vehicle.id,
        agreedPrice,
        fniProducts: fni,
        paymentMethod: visit.paymentMethod,
        downPayment,
        loanAmount,
        term,
        apr,
      });

      bus.publish('staff:auto_resolved', {
        customerId,
        staffId: salesperson.id,
        day,
        outcome: 'closed',
        grossImpact: result.frontGross + result.backGross,
        matchQuality: match.matchQuality,
        vehicleCategory: vehicle.category,
        archetypeLabel: session.archetypeLabel,
      });
      return 'resolved';
    };

    const resolveTradeThenClose = (agreedPrice: number): ResolveResult => {
      // Trade resolution (#169, escalation #170): a visit that arrived with a
      // trade resolves the allowance after the deal reaches close but before it
      // structures. Routine trades auto-resolve silently (emit `trade:resolved`,
      // net the equity into the structure). Unusual trades escalate: a manager on
      // staff (GM > UCM) resolves them silently too; with none (or an ask over the
      // player override) the trade routes to the #84 overlay via `trade:escalated`
      // and the deal is HELD (this resolver returns 'escalated' so FloorSim raises
      // a grabbable exception). An underwater allowance / manager-declined trade
      // abandons. Requires the book provider; without it (legacy/test harness) a
      // `hasTrade` visit just closes without a trade.
      let tradeEquity = 0;
      if (
        visit.hasTrade &&
        person.currentVehicle &&
        visit.allowanceAsk !== undefined &&
        deps.tradeBookValueFn
      ) {
        const tradeConditionRead = deps.getTradeConditionRead?.() ?? null;
        // M5 (#292): the UCM's condition_reading skill loosens the appraisal
        // target off the M4 baseline (toward worse). Seeded per (customer, day)
        // ⇒ replay-safe; omitted getter ⇒ no drift (the M4 baseline).
        const allowanceDriftRead = deps.getTradeAllowanceDrift?.() ?? null;
        const allowanceDrift = allowanceDriftRead
          ? {
              conditionReadingSkill: allowanceDriftRead.conditionReadingSkill,
              seed: deriveSeed(masterSeed, 'trade_allowance_drift', {
                customerId,
                day,
              }),
              config: allowanceDriftRead.config,
            }
          : undefined;
        const tradeRes = resolveTradeIn(
          {
            currentVehicle: person.currentVehicle,
            loanPayoff: person.currentVehicle.loanPayoff,
            allowanceAsk: visit.allowanceAsk,
            skill: { effectiveness, trustworthiness },
            conditionRead: tradeConditionRead,
            allowanceDrift,
          },
          {
            bookValueFn: deps.tradeBookValueFn,
            approver: deps.getTradeApprover?.() ?? null,
            playerOverrideThreshold: deps.getTradeEscalationOverride?.(),
            policyMultiplier: deps.getTradePolicyMultiplier?.(),
          },
        );
        if (tradeRes.status === 'player_review') {
          const review = tradeRes.review;
          deps.onTradeReviewHeld?.({
            customerId,
            day,
            review,
            decide(decision) {
              const settlePlayerTrade = (
                agreedAllowance: number,
                action: 'accept' | 'counter',
                hadCounter: boolean,
              ): PlayerTradeDecisionResult => {
                if (agreedAllowance < review.payoff) {
                  emitNoSale(
                    customerId,
                    salesperson.id,
                    day,
                    'trade_negative_equity',
                    walkOffContext,
                  );
                  return { status: 'abandoned' };
                }

                bus.publish('trade:resolved', {
                  customerId,
                  currentVehicle: person.currentVehicle!,
                  agreedAllowance,
                  action,
                  hadCounter,
                  staffConfidence: tradeConditionRead?.confidence ?? 0,
                });
                closeDealAtPrice(agreedPrice, agreedAllowance - review.payoff);
                return { status: 'closed', agreedAllowance };
              };

              if (decision.kind === 'decline') {
                emitNoSale(
                  customerId,
                  salesperson.id,
                  day,
                  'trade_player_declined',
                  walkOffContext,
                );
                return { status: 'abandoned' };
              }
              if (decision.kind === 'accept_ask') {
                return settlePlayerTrade(review.allowanceAsk, 'accept', false);
              }
              if (decision.kind === 'accept_counter') {
                return settlePlayerTrade(review.recommendedCounter, 'counter', true);
              }

              const accepted = rollCustomerCounterResponse(
                {
                  allowanceAsk: review.allowanceAsk,
                  counterAmount: decision.amount,
                  priceSensitivity,
                },
                deriveSeed(masterSeed, 'trade_counter_response', { customerId, day }),
              );
              if (!accepted) {
                return {
                  status: 'counter_rejected',
                  amount: decision.amount,
                  accepted: false,
                };
              }
              return settlePlayerTrade(decision.amount, 'counter', true);
            },
          });
          // Hand the manager-attention overlay everything it needs, then hold the
          // deal for the player by surfacing this as a floor exception.
          bus.publish('trade:escalated', {
            customerId,
            day,
            currentVehicle: person.currentVehicle,
            book: tradeRes.review.book,
            allowanceAsk: tradeRes.review.allowanceAsk,
            payoff: tradeRes.review.payoff,
            target: tradeRes.review.target,
            recommendedCounter: tradeRes.review.recommendedCounter,
            staffConfidence: tradeRes.review.staffConfidence,
          });
          return 'escalated';
        }
        if (tradeRes.status === 'abandoned') {
          emitNoSale(
            customerId,
            salesperson.id,
            day,
            tradeRes.reason === 'negative_equity'
              ? 'trade_negative_equity'
              : 'trade_manager_declined',
            walkOffContext,
          );
          return 'resolved';
        }
        tradeEquity = tradeRes.tradeEquity;
        bus.publish('trade:resolved', {
          customerId,
          currentVehicle: person.currentVehicle,
          agreedAllowance: tradeRes.agreedAllowance,
          action: tradeRes.action,
          hadCounter: tradeRes.hadCounter,
          staffConfidence: tradeConditionRead?.confidence ?? 0,
        });
      }

      return closeDealAtPrice(agreedPrice, tradeEquity);
    };

    if (close.outcome !== 'buy') {
      if (!close.closeable) {
        // Pricing/Demand spine S9 (#281): the customer's reservation sits below
        // the salesperson's margin floor, so the deal can't close at the held
        // price. Frame the negotiation as three numbers on the list-price axis:
        // our ask (list), the customer's target (their reservation), and the
        // salesperson's failed counter (between the two, tighter toward the ask
        // the higher the salesperson's skill).
        const askingPrice = Math.max(0, Math.round(close.priceFormation.askingPrice));
        const minimumAcceptablePrice = Math.round(close.priceFormation.vehicleCost);
        const customerTargetPrice = Math.min(
          askingPrice,
          Math.max(0, Math.round(close.priceFormation.reservationPrice)),
        );
        // NEGOTIATE composite of the working salesperson positions the failed
        // counter: skill 1 → at the ask, skill 0 → at the customer's target.
        const salesSkill = clampUnit(close.priceFormation.closingComposite.effectiveness);
        const salespersonCounter = Math.round(
          Math.min(
            askingPrice,
            Math.max(
              minimumAcceptablePrice,
              lerp(customerTargetPrice, askingPrice, salesSkill),
            ),
          ),
        );

        // Acceptance-heat readout (#287): the opening read the player starts
        // with (the salesperson's failed counter, at zero prior misses) and the
        // patience budget (how many counters this customer hears before walking
        // — agreeableness across [min,max] with seeded ±0.5 jitter).
        const ev = config.discountEvent;
        const salespersonCounterAcceptProb = discountAcceptProbability(
          customerTargetPrice,
          salespersonCounter,
          priceSensitivity,
          0,
          ev.missPenalty,
        );
        const agreeNorm = clampUnit(person.agreeableness / 100);
        const counterAttempts = Math.max(
          ev.minCounterAttempts,
          Math.min(
            ev.maxCounterAttempts,
            Math.round(
              lerp(ev.minCounterAttempts, ev.maxCounterAttempts, agreeNorm) +
                (createRng(
                  deriveSeed(masterSeed, 'discount_attempts', { customerId, day }),
                )() -
                  0.5),
            ),
          ),
        );

        const review: DiscountReviewPayload = {
          customerId,
          day,
          vehicle: {
            id: vehicle.id,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            mileage: vehicle.mileage,
            category: vehicle.category,
          },
          marketPrice: Math.round(close.priceFormation.marketPrice),
          askingPrice,
          customerTargetPrice,
          salespersonCounter,
          minimumAcceptablePrice,
          frontGrossAtAsk: askingPrice - minimumAcceptablePrice,
          canAcceptAsk: customerTargetPrice >= minimumAcceptablePrice,
          counterAttempts,
          priorMisses: 0,
          salespersonCounterAcceptProb,
          priceSensitivity,
          missPenalty: ev.missPenalty,
        };

        // Channel-desk M3 (#290): the UCM auto-desks below-floor discounts only
        // once its `t_o_closing` skill clears the gate (resolved at the
        // composition root via `isDiscountDeskingUnlocked`). Acting is earned —
        // a green UCM under the threshold can't yet desk for you, so the deal
        // falls through to the understaffed path below. The desk authorizes the
        // salesperson's counter (down to cost) and closes it; never frequency-
        // gated. Omitted getter ⇒ locked (legacy/test harness ⇒ understaffed).
        if (deps.getDiscountDeskingUnlocked?.() ?? false) {
          // M5 (#292): the desk aims at the salesperson's hold; the UCM's
          // `t_o_closing` skill governs the gap. A green-but-gated desk concedes
          // off the hold toward the customer's target (a weaker counter → thinner
          // gross, always toward worse); a sharp desk holds tight. Seeded per
          // (customer, day) ⇒ replay-safe. No drift getter ⇒ hold at the counter.
          const drift = deps.getDeskingDrift?.();
          let deskCounter = review.salespersonCounter;
          if (drift) {
            const give = skillDriftFraction(
              drift.ucmClosingSkill,
              deriveSeed(masterSeed, 'discount_desking_drift', { customerId, day }),
              drift.config,
            );
            deskCounter =
              review.salespersonCounter -
              give * (review.salespersonCounter - review.customerTargetPrice);
          }
          return resolveTradeThenClose(
            Math.max(review.minimumAcceptablePrice, Math.round(deskCounter)),
          );
        }

        // Understaffed (no UCM, or one under the desking gate): only a tunable,
        // rare fraction of below-floor ups surface as an interactive
        // manager-attention event. The rest simply walk — the salesperson
        // couldn't hold the price and lost the deal.
        const escalates =
          createRng(
            deriveSeed(masterSeed, 'discount_escalation_roll', { customerId, day }),
          )() < ev.escalationRate;
        if (!escalates) {
          emitNoSale(customerId, salesperson.id, day, 'no_close', walkOffContext);
          return 'resolved';
        }

        // The patience budget (counterAttempts) is computed above for the review
        // payload; the live haggle drains it. A disagreeable buyer walks after
        // one swing-and-a-miss; an agreeable one haggles back and forth.
        let attemptsRemaining = counterAttempts;
        let priorMisses = 0;

        deps.onDiscountReviewHeld?.({
          customerId,
          day,
          review,
          decide(decision) {
            const settleDiscount = (
              agreedPrice: number,
            ): PlayerDiscountDecisionResult => {
              if (agreedPrice < review.minimumAcceptablePrice) {
                emitNoSale(
                  customerId,
                  salesperson.id,
                  day,
                  'discount_below_cost',
                  walkOffContext,
                );
                return { status: 'abandoned' };
              }
              resolveTradeThenClose(agreedPrice);
              return {
                status: 'closed',
                soldPrice: agreedPrice,
                frontGross: agreedPrice - review.minimumAcceptablePrice,
              };
            };

            // A counter above the customer's target rolls for acceptance (gap ×
            // their price-sensitivity, cooled by prior misses): some come down to
            // reality, some won't. At/below their target it's an automatic yes.
            // A rejected counter burns one attempt; once exhausted the customer
            // walks instead of hearing another offer.
            const attemptCounter = (
              amount: number,
            ): PlayerDiscountDecisionResult => {
              // The prob driving this offer's roll — surfaced as the modal's
              // headline so the player reads the customer's rigidity off its
              // movement. Same inputs feed the seeded roll, so the displayed
              // number is exactly what was rolled against.
              const acceptProb = discountAcceptProbability(
                review.customerTargetPrice,
                amount,
                priceSensitivity,
                priorMisses,
                ev.missPenalty,
              );
              const accepted = rollDiscountCounterResponse(
                review.customerTargetPrice,
                amount,
                priceSensitivity,
                priorMisses,
                ev.missPenalty,
                deriveSeed(masterSeed, 'discount_counter_response', {
                  customerId,
                  day,
                  attempt: priorMisses,
                }),
              );
              if (accepted) {
                return settleDiscount(amount);
              }
              priorMisses += 1;
              attemptsRemaining -= 1;
              if (attemptsRemaining <= 0) {
                emitNoSale(
                  customerId,
                  salesperson.id,
                  day,
                  'discount_haggle_exhausted',
                  walkOffContext,
                );
                return { status: 'abandoned' };
              }
              return {
                status: 'counter_rejected',
                amount,
                accepted: false,
                attemptsRemaining,
                acceptProb,
              };
            };

            if (decision.kind === 'decline') {
              emitNoSale(
                customerId,
                salesperson.id,
                day,
                'discount_player_declined',
                walkOffContext,
              );
              return { status: 'abandoned' };
            }
            if (decision.kind === 'accept_ask') {
              // Meet the customer at their target — a guaranteed close.
              return settleDiscount(review.customerTargetPrice);
            }
            if (decision.kind === 'accept_counter') {
              return attemptCounter(review.salespersonCounter);
            }
            return attemptCounter(decision.amount);
          },
        });
        bus.publish('discount:escalated', review);
        return 'escalated';
      }

      emitNoSale(customerId, salesperson.id, day, 'no_close', walkOffContext);
      return 'resolved';
    }

    return resolveTradeThenClose(close.realizedPrice);
  };
}

export function createStaffDispatch(deps: StaffDispatchDeps): StaffDispatch {
  const resolveSalesCustomer = makeSalesResolver(deps);

  deps.bus.subscribe('capacity:customer_admitted', ({ customerId, day }) => {
    resolveSalesCustomer(customerId, day);
  });

  return {};
}

/**
 * Per-tick floor drain (#101) — the locked #99 `drain` seam for the Sales
 * department, FloorSim's per-tick counterpart to `createStaffDispatch`'s
 * legacy once-per-admit path. A per-day instance; the composition root wires
 * one (or the legacy path, never both) per FloorSim day. Each tick it pulls
 * up to a skill-scaled number of unattempted sales workspace items off the
 * routine queue and resolves them via the shared resolver, so the queue
 * drains across ticks instead of instantly. Resolution outcomes are identical
 * to the legacy path (same resolver, same (customerId, day) RNG keying) — only
 * the cadence differs. `escalated` is surfaced per the locked seam shape.
 */
export function createStaffFloorDrain(deps: StaffDispatchDeps): DeptDrain {
  const { staffOrg, queue } = deps;
  const config = deps.config ?? loadStaffDispatchConfig();
  const resolveSalesCustomer = makeSalesResolver({ ...deps, config });

  // Carry-over of the fractional per-tick throughput so sub-1.0 rates still
  // drain (deterministic — no RNG; skill is the only input).
  let acc = 0;
  // Items already attempted (resolved/escalated/declined) so a customer the
  // dispatch left for the player isn't re-attempted every subsequent tick.
  const attempted = new Set<string>();

  return {
    drain({ day }) {
      const salespeople = staffOrg.currentRoster.filter(
        s => s.role_id === 'salesperson',
      );
      let resolved = 0;
      let escalated = 0;
      if (salespeople.length === 0) return { resolved, escalated };

      const bestEff = salespeople.reduce(
        (m, s) => (s.effectiveness > m ? s.effectiveness : m),
        0,
      );
      acc += lerp(config.minDrainPerTick, config.maxDrainPerTick, bestEff);
      let budget = Math.floor(acc);
      acc -= budget;
      if (budget <= 0) return { resolved, escalated };

      // Snapshot first: resolveSalesCustomer splices the live queue array.
      const candidates = queue
        .getQueue('sales')
        .filter(
          item =>
            item.type === 'workspace' &&
            item.customerId !== undefined &&
            !attempted.has(item.id),
        );
      for (const item of candidates) {
        if (budget <= 0) break;
        attempted.add(item.id);
        budget -= 1;
        const result = resolveSalesCustomer(item.customerId as string, day);
        if (result === 'resolved') resolved += 1;
        else if (result === 'escalated') escalated += 1;
      }
      return { resolved, escalated };
    },
  };
}

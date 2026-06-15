/**
 * Composition root (#114) — the seed-dependent half.
 *
 * #96: the root `masterSeed` is now per-save (random on new game, persisted
 * via SaveStore, the fixed legacy 42 for pre-#96 saves). It is only known
 * *after* an async SaveStore.load(), so every module that consumes it at
 * construction is built here and instantiated once the seed resolves —
 * keeping `masterSeed` a true construction-time tunable (CLAUDE.md:
 * "all tunables injected at construction"), never a late-bound provider.
 *
 * The EventBus is created by the caller and passed in: it is seed-free and
 * must outlive world (re)construction so the App's render-loop hook and bus
 * subscriptions have a stable bus before the seed is known.
 */
import type { EventBus } from './game/EventBus';
import { createGameClock, type GameClock } from './game/GameClock';
import { createWeather, type Weather } from './game/Weather';
import {
  createDepartmentQueue,
  type DepartmentQueue,
} from './game/DepartmentQueue';
import {
  createCustomerPool,
  SALES_ARCHETYPES,
  type CustomerPool,
} from './game/CustomerPool';
import { createEconomy, type Economy } from './game/Economy';
import { createInventory, type Inventory } from './game/Inventory';
import { loadTunables } from './game/data';
import { computeDemandFactor } from './computeDemandFactor';
import { computePricingTrafficMultiplier } from './computePricingTrafficMultiplier';
import { createStaffOrg, type StaffOrg } from './game/StaffOrg';
import { createCapacityManager } from './game/CapacityManager';
import type { CapacityManager } from './game/CapacityManager';
import {
  createStaffFloorDrain,
  isDiscountDeskingUnlocked,
  type HeldTradeReview,
  type HeldDiscountReview,
  type PlayerTradeDecision,
  type PlayerTradeDecisionResult,
  type PlayerDiscountDecision,
  type PlayerDiscountDecisionResult,
} from './game/StaffDispatch';
import {
  createMarketEconomy,
  rollAuctionSourceReliability,
  loadAuctionSourcesConfig,
  loadReconVarianceConfig,
  rollRecon,
  deriveReconSeed,
  resolveIntakeAsk,
  isAutoPricingUnlocked,
  type MarketEconomy,
} from './game/MarketEconomy';
import { createStaffMorale, type StaffMorale } from './game/StaffMorale';
import {
  createDayLoopController,
  createStubDemandSource,
  type DayLoopController,
  type DemandSource,
  type FloorSeamProvider,
} from './game/DayLoopController';
import { createDealEngine, loadCreditTiers, type DealEngine } from './game/DealEngine';
import type {
  CustomerSource,
  CustomerRef,
} from './game/FloorSim';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
  loadStaffTaxonomy,
  loadStaffArchetypes,
  loadCustomerTunables,
  loadCustomerCurrentVehicleConfig,
  loadTradeIncidenceConfig,
} from './game/NPC';
import {
  classifyCredit,
  generateTradeAsk,
  loadTradeAllowanceNoiseConfig,
  type TradeBookValueFn,
} from './game/DealEngine';
import type { PricedVehicleInput } from './game/SalesProcess';
import { createFollowUpPool, type FollowUpPool } from './game/FollowUpPool';
import {
  createTierManager,
  createBankruptcyMonitor,
  createIndictmentMonitor,
  createCareerEndingsMonitor,
  type TierManager,
  type BankruptcyMonitor,
  type IndictmentMonitor,
  type CareerEndingsMonitor,
  type CharacterProfile,
} from './game/CareerProgression';
import { createEndCardManager, type EndCardManager } from './game/EndCard';
import {
  createRegulatoryMeter,
  createReputation,
  type RegulatoryMeter,
  type Reputation,
} from './game/Reputation';
import { createServiceQueue, type ServiceQueue } from './game/ServiceQueue';
import { createServiceFloorDrain } from './game/ServiceDispatch';
import { createTelemetry, type Telemetry } from './game/Telemetry';
import { createHistoryLog, type HistoryLog } from './game/HistoryLog';
import { createKPIDashboard, type KPIDashboard } from './game/KPIDashboard';
import { createTierGate, loadTierGateConfig, type TierGate } from './game/TierGate';
import {
  createCompetitorMarket,
  loadCompetitors,
  loadPersonalityDrift,
  loadBrands,
  type CompetitorMarket,
} from './game/CompetitorMarket';
import { deriveSeed, createRng } from './game/NPC/Rng';
import {
  createDemandShaper,
  type DemandInfluenceInput,
  type DemandShaper,
  type SegmentMix,
} from './game/DemandShaper';

export type StaffTaxonomy = ReturnType<typeof loadStaffTaxonomy>;

export interface World {
  masterSeed: number;
  clock: GameClock;
  weather: Weather;
  departmentQueue: DepartmentQueue;
  customerPool: CustomerPool;
  economy: Economy;
  inventory: Inventory;
  dealEngine: DealEngine;
  staffOrg: StaffOrg;
  staffMorale: StaffMorale;
  capacityManager: CapacityManager;
  followUpPool: FollowUpPool;
  reputation: Reputation;
  regulatoryMeter: RegulatoryMeter;
  serviceQueue: ServiceQueue;
  tierManager: TierManager;
  bankruptcyMonitor: BankruptcyMonitor;
  indictmentMonitor: IndictmentMonitor;
  careerEndingsMonitor: CareerEndingsMonitor;
  endCardManager: EndCardManager;
  telemetry: Telemetry;
  historyLog: HistoryLog;
  kpiDashboard: KPIDashboard;
  tierGate: TierGate;
  dayLoop: DayLoopController;
  staffTaxonomy: StaffTaxonomy;
  marketEconomy: MarketEconomy;
  competitorMarket: CompetitorMarket;
  demandShaper: DemandShaper;
  demandControls: {
    readonly advertisingOptions: readonly { id: string; label: string; blurb: string }[];
    getAdvertisingCampaignId(): string;
    setAdvertisingCampaign(id: string): void;
  };
  resolvePlayerTradeDecision(
    customerId: string,
    decision: PlayerTradeDecision,
  ): PlayerTradeDecisionResult | null;
  resolvePlayerDiscountDecision(
    customerId: string,
    decision: PlayerDiscountDecision,
  ): PlayerDiscountDecisionResult | null;
}

/**
 * A fresh random root seed for a brand-new game. 32-bit unsigned: the RNG /
 * deriveSeed design (out of #96 scope) already namespaces and per-keys every
 * draw off this single root, so variability here is sufficient.
 */
export function makeSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

type DemandShaperTunables = ReturnType<typeof loadTunables>['demandShaper'];

function hasInfluence(weights: SegmentMix): boolean {
  return Object.values(weights).some((w) => Math.abs(w) > 0);
}

function selectLocationBaseline(
  masterSeed: number,
  segments: readonly string[],
  config: DemandShaperTunables,
): SegmentMix | undefined {
  const profiles = config.locationProfiles ?? [];
  if (profiles.length === 0) return undefined;
  const rng = createRng(deriveSeed(masterSeed, 'demand.shaper.location', {}));
  const profile = profiles[Math.floor(rng() * profiles.length) % profiles.length];
  return Object.fromEntries(segments.map((s) => [s, profile.weights[s] ?? 0]));
}

function scaledWeights(
  profile: Readonly<Record<string, number>>,
  scale: number,
): SegmentMix {
  return Object.fromEntries(
    Object.entries(profile).map(([segment, weight]) => [segment, weight * scale]),
  );
}

function buildInventoryInfluence(
  lot: readonly { category: string }[],
  config: DemandShaperTunables,
): DemandInfluenceInput | null {
  const inventoryConfig = config.inventoryInfluence;
  if (!inventoryConfig || lot.length === 0) return null;
  const categoryCounts: Record<string, number> = {};
  for (const vehicle of lot) {
    categoryCounts[vehicle.category] = (categoryCounts[vehicle.category] ?? 0) + 1;
  }
  const weights: SegmentMix = {};
  for (const [category, count] of Object.entries(categoryCounts)) {
    const categoryWeights = inventoryConfig.categoryWeights[category];
    if (!categoryWeights) continue;
    const scale = (count / lot.length) * inventoryConfig.maxWeight;
    for (const [segment, weight] of Object.entries(categoryWeights)) {
      weights[segment] = (weights[segment] ?? 0) + weight * scale;
    }
  }
  if (!hasInfluence(weights)) return null;
  return {
    id: 'inventory-composition',
    label: `Inventory composition (${lot.length} units)`,
    producer: 'inventory',
    weights,
    lagDays: inventoryConfig.lagDays ?? 0,
    decayDays: inventoryConfig.decayDays ?? inventoryConfig.lagDays ?? 0,
  };
}

function buildReputationInfluence(
  reviewScore: number,
  config: DemandShaperTunables,
): DemandInfluenceInput | null {
  const reputationConfig = config.reputationInfluence;
  if (!reputationConfig) return null;
  const neutral = reputationConfig.neutralReviewScore;
  const aboveNeutral = Math.max(0, reviewScore - neutral);
  const belowNeutral = Math.max(0, neutral - reviewScore);
  if (aboveNeutral === 0 && belowNeutral === 0) return null;
  const highDenom = Math.max(1, 100 - neutral);
  const lowDenom = Math.max(1, neutral);
  const scale =
    aboveNeutral > 0
      ? (aboveNeutral / highDenom) * reputationConfig.maxWeight
      : (belowNeutral / lowDenom) * reputationConfig.maxWeight;
  const profile =
    aboveNeutral > 0
      ? reputationConfig.highWeights
      : reputationConfig.lowWeights;
  const weights = scaledWeights(profile, scale);
  if (!hasInfluence(weights)) return null;
  return {
    id: 'reputation',
    label: `Reputation ${Math.round(reviewScore)}`,
    producer: 'reputation',
    weights,
    lagDays: reputationConfig.lagDays ?? 0,
    decayDays: reputationConfig.decayDays ?? reputationConfig.lagDays ?? 0,
  };
}

function advertisingInputId(campaignId: string): string {
  return `advertising:${campaignId}`;
}

function buildAdvertisingInfluence(
  campaignId: string,
  config: DemandShaperTunables,
): DemandInfluenceInput | null {
  const campaign = config.advertisingInfluence?.campaigns.find(
    (entry) => entry.id === campaignId,
  );
  if (!campaign || !hasInfluence(campaign.weights)) return null;
  return {
    id: advertisingInputId(campaign.id),
    label: `Advertising: ${campaign.label}`,
    producer: 'advertising',
    weights: campaign.weights,
    lagDays: campaign.lagDays,
    decayDays: campaign.decayDays ?? campaign.lagDays,
  };
}

/**
 * Pricing-posture segment producer (#277, Pricing/Demand spine S5) — the empty
 * socket. The demand vector is now the per-segment heat map (#278, S6); this
 * producer is where the player's price posture will skew *which segment walks
 * in* (Pillar 1), distinct from the price → arrival *volume* seam
 * (`computePricingTrafficMultiplier`). It stays wired-but-inert: returns `null`
 * (no segment deltas) so it is registered and removable like the others until
 * the calibration slice routes price posture into segment skew. Identity ⇒ zero
 * behavior change.
 */
function buildPricingInfluence(
  _config: DemandShaperTunables,
): DemandInfluenceInput | null {
  return null;
}

export function createWorld(deps: {
  bus: EventBus;
  masterSeed: number;
  characterProfile: CharacterProfile;
  /**
   * Per-slot "always escalate to me above $X" trade override (#170). A
   * persisted player setting the composition root reads from the active save
   * slot (SaveStore is the gateway) and passes in like `masterSeed`. Omitted ⇒
   * the trade-evaluation config default (`playerOverrideThresholdDefault`).
   */
  tradeEscalationOverride?: number;
  /**
   * Per-slot trade-acquisition policy multiplier (#172). A live getter (not a
   * value) so a mid-game Settings change takes effect on the next trade without
   * rebuilding the world — the composition root reads the persisted slot policy
   * id through `resolveTradePolicyMultiplier`. Omitted ⇒ `1.0` (market).
   */
  getTradePolicyMultiplier?: () => number;
  /**
   * Per-slot hours-of-op day length in logical ticks (#207). A live getter (not
   * a value) so a mid-game lever change applies on the next day without
   * rebuilding the world — the composition root reads the persisted slot
   * selection and resolves it to the option's `ticksPerDay`. Read once per day
   * in `floorSeams` (the lever is greyed during FLOOR_OPEN, so the value is
   * stable across a day → replay-safe). Omitted ⇒ FloorSim's `ticksPerDay`
   * tunable default.
   */
  getHoursOfOpTicksPerDay?: () => number;
  /**
   * Per-slot list-price strategy id (#285, Pricing/Demand spine S13). A live
   * getter (not a value) so a mid-game toggle change applies to the next
   * acquisition without rebuilding the world — the composition root reads the
   * persisted slot selection. Feeds the standing auto-pricing policy: once a
   * UCM is on staff the strategy auto-stamps each incoming unit's default ask
   * to its book↔market target. Omitted ⇒ the configured default strategy.
   */
  getPricingStrategy?: () => string;
}): World {
  const {
    bus,
    masterSeed,
    characterProfile,
    tradeEscalationOverride,
    getTradePolicyMultiplier,
    getHoursOfOpTicksPerDay,
    getPricingStrategy,
  } = deps;

  // Default initialDay = 1: the clock sits on "night before Day 1" so the
  // DayLoopController cold-start (skip-advance on the first nextDay) plays
  // Day 1 rather than skipping it.
  const clock = createGameClock({ bus });
  // Per-day weather is a pure projection of (masterSeed, day) — no state, no
  // snapshot (see Weather/CLAUDE.md). Slice 1 surfaces it on the Home calendar.
  const weather = createWeather({ masterSeed });
  const departmentQueue = createDepartmentQueue({ bus });
  // Legacy live-day arrival path OFF: FloorSim owns arrivals via the injected
  // customer-source seam below.
  const economy = createEconomy({ bus, startingCash: 50_000 });
  // Per-save auction-source reliability rolled once + shared between Inventory
  // (recon realization at acquisition) and StaffOrg (#163 UCM pre-purchase
  // read). Both need the same hidden reliability or the read drifts from the
  // realized truth.
  const auctionSourceReliability = rollAuctionSourceReliability(
    masterSeed,
    loadAuctionSourcesConfig(),
  );
  const reconVarianceCfg = loadReconVarianceConfig();
  // Reputation + TierManager are created ahead of Inventory + StaffOrg: the
  // hiring headcount cap (#131) reads the live tier, and Inventory's #173
  // floorplan APR scales with it (better tier → cheaper money). Reputation
  // drifts overnight and takes deal/walk hits via the bus; TierManager advances
  // off the monthly tier-gate verdict streak (#250), not an instantaneous check.
  const reputation = createReputation({ bus, economy });
  // #250 — the per-tier advancement streak lengths live in tier-gate.json's
  // `streak` field (composition root reads the shared tunable and injects it, so
  // TierManager stays decoupled from the TierGate module).
  const gateConfig = loadTierGateConfig();
  const streaksByTier: Record<number, number> = {};
  for (const [tierKey, targets] of Object.entries(gateConfig.tiers)) {
    const s = (targets as Record<string, number>).streak;
    if (typeof s === 'number') streaksByTier[Number(tierKey)] = s;
  }
  const tierManager = createTierManager({ bus, streaksByTier });
  const regulatoryMeter = createRegulatoryMeter({ bus, economy, tierManager });
  // #270: BankruptcyMonitor — the sole publisher of `career:bankruptcy_terminal`
  // (consumed by EndCardManager to settle a game-over). Built earlier but never
  // instantiated in the world (a composition orphan, #184/F1): until wired,
  // running out of cash never ended the run — the most common expected failure
  // path was dead. It watches `clock:overnight_payroll` for sustained insolvency
  // and routes bankruptcy to the tier-appropriate outcome (terminal at Tier 1,
  // contraction at Tier 2, compliance cost at Tier 3+). Its debt-overhang state
  // persists via the world snapshot (#188).
  const bankruptcyMonitor = createBankruptcyMonitor({
    bus,
    economy,
    tierManager,
  });
  // #271: IndictmentMonitor — the sole publisher of `career:indictment_terminal`
  // (consumed by EndCardManager to settle the prison-sentence game-over) plus
  // the Tier 2 contraction / Tier 3+ legal-defense outcomes. Built earlier but
  // never instantiated in the world (a composition orphan, #184/F2): until wired
  // none of those signals could fire. It accumulates severe-event pressure
  // (lemon-law incidents, audit failures, deal fraud flags) and routes an
  // indictment to the tier-appropriate outcome (terminal at Tier 1). Its
  // pressure state persists via the world snapshot (#188). NOTE: of its three
  // pressure inputs only `regulatory:lemon_law_incident` has a live producer so
  // far (DealEngine, selling an un-reconditioned hidden lemon); `audit_failure`
  // and `deal:fraud_flag` remain unwired follow-ons (#271).
  const indictmentMonitor = createIndictmentMonitor({
    bus,
    economy,
    tierManager,
  });
  // #272: CareerEndingsMonitor — the sole publisher of every SUCCESS ending
  // EndCardManager consumes (`career:retired`, `career:pe_sellout`,
  // `career:family_handoff`) plus the periodic `career:pe_offer_made`. Built
  // earlier but never instantiated in the world (a composition orphan, #184/F1):
  // until wired NONE of the win conditions could fire — a run could only end via
  // a terminal failure (bankruptcy / indictment / AG complaint). It tracks
  // retire/sellout/family-handoff eligibility off economy/tier/career-year and
  // surfaces a Tier 3+ PE offer on a fixed cadence via `clock:overnight_payroll`.
  // Its pending-offer state persists via the world snapshot (#188, envelope v8).
  const careerEndingsMonitor = createCareerEndingsMonitor({
    bus,
    economy,
    tierManager,
  });
  // MarketEconomy live providers (#155): closed-form anchor + markup table
  // replace the static cost-plus stubs in `SalesProcess/seams.ts`. Wired into
  // StaffFloorDrain (resolver always passes a full LotVehicle) and — since
  // #167 — into the customer factory's trade-ask seam below. Other call sites
  // that still pass narrow PricedVehicleInput stubs (CustomerPool's
  // resolveViaProcess, the #94 calibration test) fall back to the static stubs
  // by not injecting these. Built before Inventory (#273) so intake can stamp
  // the market suggestion as each unit's default asking price.
  // #156: the per-save personality vector is rolled from masterSeed at
  // construction. Two slots with different seeds get distinct hidden biases →
  // genuinely different worlds from minute one.
  // #157 wiring: pass the bus + a getCurrentDay so MarketEconomy subscribes
  // to inventory:vehicle_purchased/sold, records each transaction's
  // delta-vs-anchor into its rolling window, and exposes the emergent
  // segment-drift term in segmentHeat. With no comps recorded yet (cold
  // start), drift=0 and the engine reduces to the slice-#156 personality
  // world — the #94 calibration path stays untouched.
  const marketEconomy = createMarketEconomy({
    masterSeed,
    bus,
    getCurrentDay: () => clock.currentDay,
  });
  // #289 (channel-desk M2): the standing auto-pricing policy is gated on the top
  // UCM's `pricing` skill clearing this threshold — not mere UCM presence (#285).
  // Loaded once; the lazy pricingPolicyFn closure reads the live roster each
  // acquisition. No magic number: the gate lives in tunables.
  const managerGateThresholds = loadTunables().managerGates.actThresholds;
  const autoPriceThreshold = managerGateThresholds.pricing;
  const inventory = createInventory({
    bus,
    masterSeed,
    economy,
    auctionSourceReliability,
    reconVariance: reconVarianceCfg,
    // #173: floorplan APR follows the dealership tier — a diegetic
    // progression reward read live so a mid-game tier-up cheapens carry.
    getTier: () => tierManager.currentTier,
    // #273: stamp each acquired unit's default asking price (the close's
    // transaction anchor) at the market suggestion instead of cost basis. The
    // provider declares the narrow `PricedVehicleInput` seam but reads only the
    // anchor fields a LotVehicle carries — the cast is the documented runtime
    // contract, mirroring the trade-ask seam below.
    marketPriceFn: (v) =>
      marketEconomy.marketPriceFn(v as unknown as PricedVehicleInput),
    // #285 (spine S13) → #289 (M2): the strategy toggle is a standing
    // auto-pricing policy. The default ask follows the chosen book↔market posture
    // once the used-car desk can *act* on pricing — i.e. the top UCM's `pricing`
    // skill clears the gate (M2 reframes #285's presence gate onto the skill
    // threshold); below the gate (or no UCM) it's suggestion-only and the default
    // ask sits at the market suggestion (the player prices by hand). The unlock
    // gate + strategy live here at the composition boundary — Inventory and
    // MarketEconomy stay decoupled from StaffOrg. `staffOrg` is referenced lazily
    // (declared below); the closure only runs at acquisition time, long after
    // construction. `getPricingStrategy` returning '' falls back to the config
    // default inside `resolveIntakeAsk`.
    pricingPolicyFn: (v) => {
      const priced = v as unknown as PricedVehicleInput;
      // Top UCM pricing skill (null = no UCM on staff) vs the data-driven gate.
      const ucmPricingSkills = staffOrg.currentRoster
        .filter((s) => s.role_id === 'used-car-manager')
        .map((s) => s.skills['pricing'] ?? 0);
      const topUcmPricingSkill =
        ucmPricingSkills.length === 0 ? null : Math.max(...ucmPricingSkills);
      const automationUnlocked = isAutoPricingUnlocked(
        topUcmPricingSkill,
        autoPriceThreshold,
      );
      return resolveIntakeAsk({
        bookValue: marketEconomy.bookValueFn(priced),
        marketPrice: marketEconomy.marketPriceFn(priced),
        strategy: getPricingStrategy?.() ?? '',
        automationUnlocked,
      });
    },
  });
  // #271: getCurrentDay feeds the lemon-law exposure emit (selling an
  // un-reconditioned hidden lemon → `regulatory:lemon_law_incident`), the live
  // producer for IndictmentMonitor's severe-event pressure.
  const dealEngine = createDealEngine({
    bus,
    inventory,
    economy,
    getCurrentDay: () => clock.currentDay,
  });
  // CustomerPool gets the DealEngine + inventory + tier-catalog wiring (#146)
  // so dispatch(CLOSE) routes real closes through DealEngine.closeDeal — the
  // canonical deal:closed (with the five deal-structuring fields) fires
  // instead of synthesizing a SalesProcess emit against a stub vehicle.
  const creditTiers = loadCreditTiers();
  // #183: CompetitorMarket — the static v1 rival roster with weekly drift.
  // Built earlier but never instantiated in the world (a dark module): its
  // `market:competitive_pressure` (CustomerPool poaching) and #158
  // `competitor:price_changed` (one of emergent-C's four demand fuels) never
  // fired in a running game. Wired here so both go live.
  //
  // Determinism: CompetitorMarket is reconstructed from `masterSeed` at
  // construction, and its drift is persisted via snapshot/restore (#191, part
  // of the #186 world seam) — the seam restores onto a fresh World and never
  // replays `clock:day_ended`, so drift can't be re-derived from day count and
  // is captured (live stats + RNG cursor) instead. The #122 mid-day replay
  // never advances `day_ended`, so drift is invariant across a checkpoint.
  const brands = loadBrands();
  const competitorMarket = createCompetitorMarket({
    bus,
    competitors: loadCompetitors(),
    personalityDrift: loadPersonalityDrift(),
    seed: deriveSeed(masterSeed, 'competitor_market.drift', {}),
    // `brands` enables the #158 `competitor:price_changed` emit on meaningful
    // weekly pricing moves; MarketEconomy fans each into a synthetic comp.
    brands,
  });
  // #167: the customer's trade allowance ask. Compose DealEngine's pure
  // `generateTradeAsk` with the live book-value provider + noise config so the
  // NPC factory stays free of a DealEngine dep. The provider declares the
  // narrow `PricedVehicleInput` seam but reads only the anchor fields a
  // CurrentVehicle carries — the cast is the documented runtime contract and
  // lives here at the composition boundary, never in game logic.
  const tradeAllowanceNoise = loadTradeAllowanceNoiseConfig();
  const tradeBookValue: TradeBookValueFn = (cv) =>
    marketEconomy.bookValueFn(cv as unknown as PricedVehicleInput);
  const customerPool = createCustomerPool({
    bus,
    legacyDailyArrivals: false,
    npcDeps: {
      masterSeed,
      personArchetypes: loadPersonArchetypes(),
      visitArchetypes: loadVisitArchetypes(),
      traits: loadTraitTaxonomy(),
      // #165: stamp a deterministic `currentVehicle` on every customer so
      // the trade-in slices (#166–#171) have real history to work against.
      currentVehicleConfig: loadCustomerCurrentVehicleConfig(),
      // #282: derive a financed owner's loanPayoff relative to the trade's
      // current book (controlled LTV × loan-age × depreciation) — same live
      // provider that backs the trade-ask seam below.
      bookValueFn: tradeBookValue,
      // #166: stamp `hasTrade` on every sales visit via the composite
      // (archetype × paymentMethod × creditTier) incidence matrix.
      tradeIncidenceConfig: loadTradeIncidenceConfig(),
      classifyCreditTier: (credit) => classifyCredit(credit, creditTiers),
      // #167: stamp `allowanceAsk` on every trade-carrying sales visit.
      tradeAskFn: (currentVehicle, seed) =>
        generateTradeAsk(
          currentVehicle,
          currentVehicle.loanPayoff,
          tradeBookValue,
          seed,
          tradeAllowanceNoise,
        ),
    },
    dealEngine,
    inventory,
    creditTiers,
    // #183: poaching wiring. `runPoachChecks` early-returns without BOTH of
    // these, so customer poaching was doubly dark. `brands` lets the poach
    // engine score the rival roster carried on `market:competitive_pressure`;
    // `getPlayerStrength` is the live reputation review score normalized to
    // [0,1] — the same signal that already scales demand — against which a
    // competitor's relative strength is measured. (Tier could layer in later.)
    brands,
    getPlayerStrength: () =>
      Math.min(1, Math.max(0, reputation.reviewScore / 100)),
  });
  const staffTaxonomy = loadStaffTaxonomy();
  const staffOrg = createStaffOrg({
    bus,
    economy,
    masterSeed,
    taxonomy: staffTaxonomy,
    archetypes: loadStaffArchetypes(),
    getTier: () => tierManager.currentTier,
    // UCM condition-read truth seam (#163). Replays the same recon roll that
    // Inventory.buyFromAuction will use at acquisition — deterministic from
    // (masterSeed, listing.id) — so the read targets the realized truth the
    // player would actually realize on purchase.
    realizedReconFor: (v) => {
      const reliability = auctionSourceReliability.reliability[v.sourceId] ?? 0.5;
      return rollRecon(
        {
          estimate: v.reconEstimate,
          condition: v.condition,
          mileage: v.mileage,
          sourceReliability: reliability,
        },
        deriveReconSeed(masterSeed, v.id),
        reconVarianceCfg,
      ).realizedCost;
    },
  });
  // StaffMorale owns the per-staff morale dimension over the StaffOrg roster:
  // recognition on auto-closes, end-of-day workload drift, overnight pay
  // bump, and the overnight quit-risk roll — all via the bus. Wired here so
  // the live world (not just tests) feeds the morale multiplier into
  // StaffDispatch's resolver.
  const staffMorale = createStaffMorale({
    bus,
    staffOrg,
    queue: departmentQueue,
    masterSeed,
  });

  // Legacy aggregate admit gate OFF: the per-tick floor gate is the sole
  // admittance path under FloorSim.
  const capacityManager = createCapacityManager({
    bus,
    staffOrg,
    facilityTier: 1,
    legacyAdmitGate: false,
  });
  // FollowUpPool (#78): walked customers enter the pool with computed heat
  // (off the extended customer:resolved payload), decay overnight, and the
  // hottest resurface as morning BDC callback tasks that can return a
  // customer to Sales. Wired here so the live loop — not just tests — drains
  // walks into the BDC queue.
  const followUpPool = createFollowUpPool({
    bus,
    pool: customerPool,
    tunables: loadCustomerTunables().followUp,
  });

  // ServiceQueue (#80): starts silent (default initialTier=1 < minTierRequired
  // 2), follows career:tier_up off the bus, and once at Tier 2 emits a daily
  // service:intake_ready that DepartmentQueue pushes into the Service lane —
  // surfaced/resolved by the generic DepartmentScreen with no extra wiring.
  const serviceQueue = createServiceQueue({ bus, masterSeed });
  // EndCardManager (#84): all terminal failure paths + success endings
  // converge here and re-emit a single career:game_over carrying the
  // assembled EndCardData. Wired in the live world (not just tests) so the
  // composition-root interrupt channel can route game-over to the EndCard.
  const endCardManager = createEndCardManager({
    bus,
    characterProfile,
    tierManager,
  });
  const telemetry = createTelemetry({ bus });
  // HistoryLog (#208): a durable, player-facing record of notable events
  // (sales, escalations, market shocks, tier-ups) that survives the daily
  // floorEvents reset. Wired in the live world (not just tests) so the
  // in-game History screen reflects the running game; persisted via the
  // world snapshot.
  const historyLog = createHistoryLog({ bus });
  // Month-close hook (#123): the KPIDashboard supplies the month-to-date
  // snapshot the interstitial composes.
  const kpiDashboard = createKPIDashboard({ bus });
  // TierGate (#232): the monthly tier-GATE engine. Accrues each day's haul onto
  // the multi-dimensional monthly bars (units/gross from deal:closed; cash/csi
  // sampled nightly off the live providers below), computes honest per-face
  // pace/projection for the Home strip, and fires the single 4-band verdict on
  // clock:month_ended. Built after Economy/Reputation/TierManager so its signal
  // closures + tier read are live. Persisted via the world snapshot (#188).
  const tierGate = createTierGate({
    bus,
    getCurrentDay: () => clock.currentDay,
    getCurrentTier: () => tierManager.currentTier,
    signals: {
      cash: () => economy.cash,
      csi: () => reputation.reviewScore,
    },
  });

  // CustomerPool behind FloorSim's #99 customer-source seam: FloorSim's own
  // arrival RNG decides the admitted count per tick; the adapter only mints
  // identities for that count via CustomerPool.
  // #135: with `legacyAdmitGate:false`, CapacityManager's per-tick floor gate
  // owns admit-side domain consequences (missed-opportunity / walks) but the
  // gate cannot see the FloorSim-minted identities for admitted ups. Publish
  // `capacity:customer_admitted` here — once per admitted sales ref, after
  // the id is minted and before `floor:tick` (canonical #99 order) — so
  // DepartmentQueue enqueues a `workspace` item and the staff floor drain has
  // someone to hold.
  // #198 / #278: DemandShaper owns the per-day **segment heat map** (sedan /
  // truck / suv). The spawn draw below picks a segment from the heat map on the
  // existing seeded per-spawn stream (replay/#122-safe), then rolls a visit
  // archetype *within* that segment — personas demote to per-customer
  // negotiation flavor; segment heat is the demand driver. #211 selects a
  // seeded location-profile baseline, then layers active influence producers
  // (inventory composition + reputation) over it.
  const demandShaperConfig = loadTunables().demandShaper;
  const demandShaperSegments = demandShaperConfig.segments;
  const demandShaper = createDemandShaper({
    segments: demandShaperSegments,
    config: demandShaperConfig,
    initialMix: selectLocationBaseline(
      masterSeed,
      demandShaperSegments,
      demandShaperConfig,
    ),
  });
  const syncDemandInfluence = (id: string, input: DemandInfluenceInput | null) => {
    if (input) demandShaper.upsertInfluenceInput(input);
    else demandShaper.removeInfluenceInput(id);
  };
  const syncDemandInfluences = () => {
    syncDemandInfluence(
      'inventory-composition',
      buildInventoryInfluence(inventory.getLotVehicles(), demandShaperConfig),
    );
    syncDemandInfluence(
      'reputation',
      buildReputationInfluence(reputation.reviewScore, demandShaperConfig),
    );
    // #277 S5: the pricing-posture persona producer (empty socket — returns
    // null until the heat-map slice fills it). Wired here so the producer is
    // live and removable alongside inventory/reputation; identity for now.
    syncDemandInfluence(
      'pricing-posture',
      buildPricingInfluence(demandShaperConfig),
    );
  };
  syncDemandInfluences();
  const demandControls = {
    advertisingOptions: [
      { id: 'none', label: 'No campaign', blurb: 'No paid advertising push.' },
      ...(demandShaperConfig.advertisingInfluence?.campaigns.map((campaign) => ({
        id: campaign.id,
        label: campaign.label,
        blurb: campaign.blurb,
      })) ?? []),
    ],
    getAdvertisingCampaignId: () => {
      const active = demandShaper
        .getInfluenceInputs()
        .find((input) => input.producer === 'advertising' && hasInfluence(input.targetWeights));
      return active ? active.id.replace(/^advertising:/, '') : 'none';
    },
    setAdvertisingCampaign: (id: string) => {
      const existingIds = demandShaper
        .getInfluenceInputs()
        .filter((input) => input.producer === 'advertising')
        .map((input) => input.id);
      for (const existingId of existingIds) demandShaper.removeInfluenceInput(existingId);
      if (id === 'none') return;
      const input = buildAdvertisingInfluence(id, demandShaperConfig);
      if (input) demandShaper.upsertInfluenceInput(input);
    },
  };
  bus.subscribe('inventory:vehicle_purchased', syncDemandInfluences);
  bus.subscribe('inventory:vehicle_sold', syncDemandInfluences);
  bus.subscribe('reputation:satisfaction_hit', syncDemandInfluences);
  bus.subscribe('deal:closed', syncDemandInfluences);
  bus.subscribe('clock:overnight_reputation_drift', syncDemandInfluences);
  bus.subscribe('clock:day_started', () => demandShaper.advanceInfluenceDay());
  const archetypeByPersona = new Map(
    SALES_ARCHETYPES.map((a) => [a.personId, a]),
  );
  // Within-segment archetype roll (#278): demand picks the *segment*; this table
  // picks which visit archetype walks in for that segment (the negotiation
  // flavor personas demote to). Resolved against SALES_ARCHETYPES so the heat
  // map stays free of a CustomerPool dep.
  const segmentArchetypes = new Map<string, { personId: string; weight: number }[]>(
    Object.entries(demandShaperConfig.segmentArchetypes).map(([segment, weights]) => [
      segment,
      Object.entries(weights)
        .filter(([personId]) => archetypeByPersona.has(personId))
        .map(([personId, weight]) => ({ personId, weight })),
    ]),
  );
  const drawArchetypeForSegment = (segment: string, rng: () => number) => {
    const candidates = segmentArchetypes.get(segment) ?? [];
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (total > 0) {
      const r = rng() * total;
      let cum = 0;
      for (const candidate of candidates) {
        cum += candidate.weight;
        if (r < cum) return archetypeByPersona.get(candidate.personId)!;
      }
      return archetypeByPersona.get(candidates[candidates.length - 1].personId)!;
    }
    return SALES_ARCHETYPES[0];
  };

  const customerSource: CustomerSource = {
    spawn({ day, tick, count }): readonly CustomerRef[] {
      const refs: CustomerRef[] = [];
      for (let i = 0; i < count; i++) {
        // Deterministic per-spawn RNG: same (day, tick, i) ⇒ same draw on
        // replay. Demand picks the *segment* from the heat map; a second
        // independent seeded roll picks the within-segment visit archetype
        // (the negotiation flavor). Body-style match stays emergent downstream.
        const segmentRng = createRng(
          deriveSeed(masterSeed, 'demand.shaper.spawn', { day, tick, i }),
        );
        const archetypeRng = createRng(
          deriveSeed(masterSeed, 'demand.shaper.archetype', { day, tick, i }),
        );
        syncDemandInfluences();
        const segment = demandShaper.drawSegment(segmentRng);
        demandShaper.recordArrival(segment);
        const a = drawArchetypeForSegment(segment, archetypeRng);
        const id = customerPool.spawnCustomer(a.personId, a.visitId, a.label);
        const ref: CustomerRef = {
          id,
          source: 'ambient',
          mustHandle: false,
          department: 'sales',
        };
        refs.push(ref);
        if (ref.department === 'sales') {
          bus.publish('capacity:customer_admitted', { day, customerId: id, label: a.label });
        }
      }
      return refs;
    },
  };

  // Player-review trades (#201): StaffDispatch owns the held close context and
  // hands this composition root a closure. UI submits a decision through the
  // World seam; App never replays close math or reaches into game internals.
  const heldTradeReviews = new Map<string, HeldTradeReview>();
  const heldDiscountReviews = new Map<string, HeldDiscountReview>();

  // Per-day FloorSim seam set: CapacityManager / StaffDispatch / CustomerPool
  // behind the locked #99 seams. Invoked once per day → fresh per-day
  // instances.
  const floorSeams: FloorSeamProvider = (slip) => ({
    capacity: capacityManager.createFloorGate(),
    drains: [
      createStaffFloorDrain({
        bus,
        staffOrg,
        queue: departmentQueue,
        masterSeed,
        staffMorale,
        inventory,
        dealEngine,
        creditTiers: loadCreditTiers(),
        // #247: seed the F&I auto-attach RNG instead of letting StaffDispatch
        // fall back to its `Math.random` default. An unseeded draw in the live
        // close path is a replay-determinism bug (the locked #122 constraint:
        // a given save must replay identically) and made the back-gross — and
        // thus cash — non-deterministic for the headless balance harness.
        // Seeded per-DAY off masterSeed: a #122 mid-day resume re-runs the
        // whole day's drains from tick 0, reproducing the same close order and
        // therefore the same attach sequence, so day-granular seeding is
        // replay-safe. The day comes off the morning slip the seam is built with.
        fniRng: createRng(deriveSeed(masterSeed, 'fni.auto_attach', { day: slip.day })),
        getCustomerSession: (id) => {
          const s = customerPool.getSession(id);
          return s
            ? { bundle: s.bundle, visitArchetypeId: s.visitArchetypeId }
            : undefined;
        },
        salesProcessDeps: {
          marketPriceFn: marketEconomy.marketPriceFn,
          vehicleCostFn: marketEconomy.vehicleCostFn,
          bookValueFn: marketEconomy.bookValueFn,
        },
        // #231 S2: season demand lean. Biases the customer want-vector for the
        // resolution day before the match, so the seasonal effect is emergent
        // through pickVehicleFor (#197) — winter nudges wants toward
        // dependability/safety, summer toward performance/looks, etc.
        wantVectorBias: (spaced, day) => weather.leanWantVector(spaced, day),
        // #231 S4: vehicle-attribute demand lean. Tilts the match toward
        // weather-aligned units (AWD/4WD on snow days, fuel-efficient sedans in
        // spring), emergent through the same #197 match — no per-model rules.
        attributeLeanForDay: (day) => weather.attributeLeanForDay(day),
        // #169: trade resolution. Book provider (adapted at this boundary) +
        // the UCM condition-read confidence. A used-car-manager on the roster
        // appraises the trade with confidence = their `condition_reading`
        // skill (0–100 → unit); no UCM ⇒ null ⇒ maximally defensive valuation.
        tradeBookValueFn: tradeBookValue,
        getTradeConditionRead: () => {
          const ucms = staffOrg.currentRoster.filter(
            (s) => s.role_id === 'used-car-manager',
          );
          if (ucms.length === 0) return null;
          const bestSkill = ucms.reduce(
            (m, s) => Math.max(m, s.skills['condition_reading'] ?? 0),
            0,
          );
          return { confidence: Math.min(1, Math.max(0, bestSkill / 100)) };
        },
        // #170: escalation approver resolved with GM > UCM > player priority.
        // The highest-ranking manager on the roster reviews an unusual trade via
        // the extended evaluator; with none hired this returns null and the
        // trade routes to the player overlay.
        getTradeApprover: () => {
          const roster = staffOrg.currentRoster;
          const gms = roster.filter((s) => s.role_id === 'gm');
          const ucms = roster.filter((s) => s.role_id === 'used-car-manager');
          const pool = gms.length > 0 ? gms : ucms;
          if (pool.length === 0) return null;
          const best = pool.reduce((m, s) =>
            s.effectiveness > m.effectiveness ? s : m,
          );
          return {
            role: gms.length > 0 ? 'gm' : 'ucm',
            skill: {
              effectiveness: best.effectiveness,
              trustworthiness: best.trustworthiness ?? 0,
            },
          };
        },
        // #170: per-slot player override. Omitted ⇒ config default.
        getTradeEscalationOverride:
          tradeEscalationOverride !== undefined
            ? () => tradeEscalationOverride
            : undefined,
        // #172: per-slot trade-acquisition policy. Live getter so a Settings
        // change applies on the next trade. Omitted ⇒ 1.0 (market).
        getTradePolicyMultiplier,
        onTradeReviewHeld: (held) => heldTradeReviews.set(held.customerId, held),
        onDiscountReviewHeld: (held) =>
          heldDiscountReviews.set(held.customerId, held),
        // #290 (channel-desk M3): the UCM auto-desks below-floor discounts only
        // once its top `t_o_closing` skill clears the gate — reframing #288's
        // presence gate onto the skill threshold (acting is earned). Read live
        // off the roster each below-floor up so a mid-game hire/fire applies on
        // the next deal; below the gate (or no UCM) the deal takes the
        // understaffed path. The threshold + skill-axis knowledge stays here at
        // the composition boundary, mirroring the M2 pricingPolicyFn gate.
        getDiscountDeskingUnlocked: () => {
          const ucmClosingSkills = staffOrg.currentRoster
            .filter((s) => s.role_id === 'used-car-manager')
            .map((s) => s.skills['t_o_closing'] ?? 0);
          const topUcmClosingSkill =
            ucmClosingSkills.length === 0 ? null : Math.max(...ucmClosingSkills);
          return isDiscountDeskingUnlocked(
            topUcmClosingSkill,
            managerGateThresholds.t_o_closing,
          );
        },
      }),
      createServiceFloorDrain({
        bus,
        staffOrg,
        queue: departmentQueue,
        economy,
        masterSeed,
      }),
    ],
    customerSource,
    // #207: the hours-of-op lever's scaled day length. Read per-day so a
    // mid-game change applies on the next day; undefined ⇒ FloorSim default.
    ticksPerDay: getHoursOfOpTicksPerDay?.(),
  });

  // Reputation → demand feedback (#82). The #125 slip stays the stub neutral
  // fill for every reserved field; only the READ-only `reputation` scalar is
  // backed by the live module. DayLoopController projects this into FloorSim's
  // #99 DayContext, where the arrival model scales expected traffic by it.
  // reviewScore is the lag indicator on the [satisfactionMin, satisfactionMax]
  // = [0,100] scale → normalized to FloorSim's [0,1] reputation input.
  // #128a: the composite controllable-lever traffic multiplier (v1: inventory
  // depth × quality) rides the locked #125 `pricing.trafficMultiplier`. The
  // demand math stays behind this seam; DayLoopController.project() forwards
  // it to FloorSim's #99 `demandFactor`. An empty lot ⇒ factor 0 ⇒ no draw.
  const stubDemand = createStubDemandSource();
  const demandModelCfg = loadTunables().demandModel;
  const demandSource: DemandSource = {
    slipFor: (ctx) => {
      const slip = stubDemand.slipFor(ctx);
      // #231 S3: the daily-weather → traffic-volume rider composes onto the same
      // controllable-lever traffic multiplier (the seam comment's "marketing
      // slots in here later"). It is the per-DAY variance; FloorSim's
      // seasonArrivalMultiplier stays the coarse SEASON baseline — orthogonal,
      // no double-counting. Pure projection of (masterSeed, day) ⇒ replay-safe.
      // #277 S5 / #279 S7: the price → arrivals rider joins the same composite.
      // S7 ARMS it — the per-vehicle response is MarketEconomy's shared
      // `demandMultiplier` (the ONE model days-to-sell reads, Pillar 3), so a
      // lot priced above market draws less traffic, below market more, and a
      // hot segment tolerates the ask. `pricingTrafficWeight` (data) blends the
      // lot-wide mean toward identity for S14 calibration.
      const lot = inventory.getLotVehicles();
      return {
        ...slip,
        reputation: Math.min(1, Math.max(0, reputation.reviewScore / 100)),
        pricing: {
          ...slip.pricing,
          trafficMultiplier:
            computeDemandFactor(lot, demandModelCfg) *
            weather.volumeMultiplierForDay(ctx.day) *
            computePricingTrafficMultiplier(
              lot,
              { weight: demandModelCfg.pricingTrafficWeight },
              (v) => marketEconomy.demandMultiplierFor(v, v.askingPrice),
            ),
        },
      };
    },
  };

  const dayLoop = createDayLoopController({
    bus,
    seed: masterSeed,
    clock,
    demandSource,
    floorSeams,
  });

  return {
    masterSeed,
    clock,
    weather,
    departmentQueue,
    customerPool,
    economy,
    inventory,
    dealEngine,
    staffOrg,
    staffMorale,
    capacityManager,
    followUpPool,
    reputation,
    regulatoryMeter,
    serviceQueue,
    tierManager,
    bankruptcyMonitor,
    indictmentMonitor,
    careerEndingsMonitor,
    endCardManager,
    telemetry,
    historyLog,
    kpiDashboard,
    tierGate,
    dayLoop,
    staffTaxonomy,
    marketEconomy,
    competitorMarket,
    demandShaper,
    demandControls,
    resolvePlayerTradeDecision(customerId, decision) {
      const held = heldTradeReviews.get(customerId);
      if (!held) return null;
      const result = held.decide(decision);
      if (result.status !== 'counter_rejected') {
        heldTradeReviews.delete(customerId);
      }
      return result;
    },
    resolvePlayerDiscountDecision(customerId, decision) {
      const held = heldDiscountReviews.get(customerId);
      if (!held) return null;
      const result = held.decide(decision);
      if (result.status !== 'counter_rejected') {
        heldDiscountReviews.delete(customerId);
      }
      return result;
    },
  };
}

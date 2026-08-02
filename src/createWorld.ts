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
import {
  createInventory,
  generateStartingInventory,
  type Inventory,
} from './game/Inventory';
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
  isSourcingUnlocked,
  selectAutoBuys,
  loadSourcingConfig,
  type MarketEconomy,
  type SourcingLean,
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
  resolveTradeApprover,
  loadTradeAllowanceNoiseConfig,
  type TradeBookValueFn,
} from './game/DealEngine';
import type { PricedVehicleInput } from './game/SalesProcess';
import { createFollowUpPool, type FollowUpPool } from './game/FollowUpPool';
import type { InstalledBase } from './game/InstalledBase';
import type { PartsInventory } from './game/PartsInventory';
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
import type { ServiceDemand } from './game/ServiceDemand';
import type { ServiceInsights } from './game/ServiceInsights';
import type { BodyShopInsights } from './game/BodyShopInsights';
import type { ServiceMarketing } from './game/ServiceMarketing';
import type { ServiceQueue } from './game/ServiceQueue';
import type { ServiceReadModel, DeptReadModel } from './game/ServiceDispatch';
import type { CollisionStream } from './game/CollisionStream';
import type { BodyShopQueue } from './game/BodyShopQueue';
// #311 the Service department package (the labeled bundle that plugs into the
// shared department line); replaces the inline Service wiring previously here.
import { createServiceDepartment } from './serviceDepartment';
// #314 the Body Shop department package (the Tier-3 mirror — CollisionStream →
// BodyShopQueue → the shared dispatch engine, channel-posture pricing).
import { createBodyShopDepartment } from './bodyShopDepartment';
import { createTelemetry, type Telemetry } from './game/Telemetry';
import { createHistoryLog, type HistoryLog } from './game/HistoryLog';
import { createRecords, type Records } from './game/Records';
import { createMarketIntel, type MarketIntel } from './game/MarketIntel';
import { createKPIDashboard, type KPIDashboard } from './game/KPIDashboard';
import { createTierGate, loadTierGateConfig, type TierGate } from './game/TierGate';
import {
  createCompetitorMarket,
  loadCompetitors,
  loadPersonalityDrift,
  loadBrands,
  type CompetitorMarket,
} from './game/CompetitorMarket';
import { deriveSeed, createRng } from './game/Rng';
import {
  createDemandShaper,
  type DemandInfluenceInput,
  type DemandShaper,
  type SegmentMix,
} from './game/DemandShaper';
import {
  computePrepBet,
  createPrepBetHolder,
  type PrepBet,
} from './game/PrepBet';

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
  installedBase: InstalledBase;
  partsInventory: PartsInventory;
  serviceDemand: ServiceDemand;
  // #308 trailing-window read-model: per-category demand heat + base health.
  serviceInsights: ServiceInsights;
  // #307 the two service-marketing arms (retention + category-targeted conquest).
  serviceMarketing: ServiceMarketing;
  // #305 live service capacity read-model for the Service page + floor card.
  serviceReadModel: ServiceReadModel;
  // #305 service pricing-posture dial [0,1] (competitive↔premium).
  getServicePricingPosture(): number;
  setServicePricingPosture(value: number): void;
  // #313 Body-Shop demand spine (weather-spiked collision shock).
  collisionStream: CollisionStream;
  // #312 Body-Shop Tier-3 intake gate.
  bodyShopQueue: BodyShopQueue;
  // #314 live Body-Shop capacity read-model for the Body-Shop page + floor card.
  bodyShopReadModel: DeptReadModel;
  // #315 trailing-window read-model: per-collision-category demand heat +
  // conquest-flow/channel-mix health (conquest-dominant, no installed base).
  bodyShopInsights: BodyShopInsights;
  // #314 Body-Shop insurance↔retail channel posture [0,1] (0 = insurance-DRP,
  // 1 = retail). Feeds the demand mix and the per-ticket channel pricing.
  getBodyShopChannelPosture(): number;
  setBodyShopChannelPosture(value: number): void;
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
  records: Records;
  marketIntel: MarketIntel;
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
  // #322 Morning-prep bet (engagement spine tracer S4): the day's stocking
  // posture (lot's heaviest category) vs. the demand-heat read (DemandShaper
  // heat + Weather attribute lean), captured at the day-open verb and resolved
  // by the day-close Reveal. A World-level holder, persisted (#122-safe).
  getPrepBet(): PrepBet | null;
  setPrepBet(bet: PrepBet | null): void;
  // Capture the committed post-prep bet for the day now opening. Called by the
  // composition root right after `dayLoop.nextDay()`; a no-op contract on resume
  // (the frozen morning bet is restored from the snapshot instead).
  captureDayStartPrepBet(): void;
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
  /**
   * Per-slot UCM sourcing posture-lean (#293, channel-desk M6). A live getter
   * (not a value) so a mid-game dial change applies on the next day's board
   * scan without rebuilding the world — the composition root reads the persisted
   * slot lean. Drives the UCM's auto-fill: above the `condition_reading` gate the
   * desk scores the daily auction board against this margin/condition/demand-fit
   * blend and auto-buys the best affordable fits (off-lean drift by skill, M5).
   * Omitted ⇒ the configured default (balanced) lean. Manual buy always lives.
   */
  getSourcingLean?: () => SourcingLean;
}): World {
  const {
    bus,
    masterSeed,
    characterProfile,
    tradeEscalationOverride,
    getTradePolicyMultiplier,
    getHoursOfOpTicksPerDay,
    getPricingStrategy,
    getSourcingLean,
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
  const managerGates = loadTunables().managerGates;
  const managerGateThresholds = managerGates.actThresholds;
  const executionDrift = managerGates.executionDrift;
  const autoPriceThreshold = managerGateThresholds.pricing;
  // #293 (channel-desk M6): the default sourcing lean used until the player tunes
  // the dial. The auto-fill act gate shares the `condition_reading` threshold
  // with the M4 trade auto-approve (manager-roles-channel-desk.md §3).
  const sourcingConfig = loadSourcingConfig();
  const sourcingActThreshold = managerGateThresholds.condition_reading;
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
        .map((s) => s.effectiveSkills['pricing'] ?? 0);
      const topUcmPricingSkill =
        ucmPricingSkills.length === 0 ? null : Math.max(...ucmPricingSkills);
      const automationUnlocked = isAutoPricingUnlocked(
        topUcmPricingSkill,
        autoPriceThreshold,
      );
      // M5 (#292): once the desk can auto-price, the UCM aims at the strategy's
      // suggested target; its `pricing` skill governs the gap. A green-but-gated
      // UCM mis-prices the unit off the target (two-sided scatter), a sharp one
      // nails it. Seed per-(vehicle, day) so a #122 mid-day resume reproduces the
      // same ask. Only the unlocked branch reads `drift` (skill is non-null there).
      const drift =
        automationUnlocked && topUcmPricingSkill != null
          ? {
              ucmPricingSkill: topUcmPricingSkill,
              seed: deriveSeed(masterSeed, 'pricing_intake_drift', {
                vehicleId: v.id,
                day: clock.currentDay,
              }),
              config: executionDrift.pricing,
            }
          : undefined;
      return resolveIntakeAsk({
        bookValue: marketEconomy.bookValueFn(priced),
        marketPrice: marketEconomy.marketPriceFn(priced),
        strategy: getPricingStrategy?.() ?? '',
        automationUnlocked,
        drift,
      });
    },
    // #293 (channel-desk M6): UCM sourcing auto-fill. The whole decision is owned
    // here at the composition boundary so Inventory stays decoupled from
    // StaffOrg/MarketEconomy/DemandShaper. Act gate: the top UCM's
    // `condition_reading` clears the threshold (shared with M4 trade approve —
    // acting is earned, the appraisal *advice* in `getTradeConditionRead` stays
    // free on hire). Above it, score the fresh board against the player's lean —
    // margin (book vs full acquisition cost), condition tier, and demand-fit
    // (the player-facing DemandShaper heat map, the same signal the heat console
    // surfaces) — and auto-buy the best affordable fits, with M5 off-lean drift
    // by `condition_reading`. `staffOrg`/`demandShaper` are referenced lazily
    // (declared below); the closure only runs on the daily board scan, long after
    // construction. The empty roster at construction-time prep ⇒ gate closed ⇒
    // no auto-buy then. Player manual buy + per-unit override always live.
    autoSourceFn: (listings) => {
      const ucmReadingSkills = staffOrg.currentRoster
        .filter((s) => s.role_id === 'used-car-manager')
        .map((s) => s.effectiveSkills['condition_reading'] ?? 0);
      const topUcmReading =
        ucmReadingSkills.length === 0 ? null : Math.max(...ucmReadingSkills);
      if (!isSourcingUnlocked(topUcmReading, sourcingActThreshold)) return [];

      const mix = demandShaper.getMix();
      const candidates = listings
        .filter((l) => l.inspectionStatus !== 'pending')
        .map((l) => ({
          listingId: l.id,
          cost: l.askingPrice + l.reconCost,
          book: marketEconomy.bookValueFn(l as unknown as PricedVehicleInput),
          condition: l.condition,
          demandShare: mix[l.category] ?? 0,
        }));

      // M5 (#292): above the gate the UCM aims at the lean; its
      // `condition_reading` governs the gap (off-lean buys). Seed per-day so a
      // #122 mid-day resume reproduces the same picks (skill constant within a day).
      const drift =
        topUcmReading != null
          ? {
              conditionReadingSkill: topUcmReading,
              seed: deriveSeed(masterSeed, 'sourcing_autofill_drift', {
                day: clock.currentDay,
              }),
              config: executionDrift.condition_reading,
            }
          : undefined;

      return selectAutoBuys({
        candidates,
        lean: getSourcingLean?.() ?? sourcingConfig.defaultLean,
        segmentCount: demandShaper.segments.length,
        cashOnHand: economy.cash,
        drift,
      });
    },
    // #296: seed the day-one frontline lot (1 SUV / 1 truck / 1 sedan,
    // value-banded, condition-capped, recon-complete, frontline-ready). Owned at
    // t=0 — no cash debit, no purchase event. Cost basis = the live book value;
    // the default ask = the live market retail (suggestion-only at game start —
    // no UCM to auto-price yet). The composition root adapts MarketEconomy's live
    // providers at this boundary (same documented runtime cast as `marketPriceFn`
    // above) so Inventory stays MarketEconomy-decoupled. Deterministic from
    // `masterSeed` (#122) and persisted via the inventory snapshot; on a restore
    // the persisted lot overwrites it.
    startingInventory: () =>
      generateStartingInventory({
        masterSeed,
        bookValueFn: (v) =>
          marketEconomy.bookValueFn(v as unknown as PricedVehicleInput),
        retailValueFn: (v) =>
          marketEconomy.marketPriceFn(v as unknown as PricedVehicleInput),
      }),
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
  // #183: CompetitorMarket — the static rival roster with weekly drift, the
  // ambient market force. Built earlier but never instantiated in the world (a
  // dark module): its `market:competitive_pressure` (the daily rival-roster
  // heartbeat) and #158 `competitor:price_changed` (one of emergent-C's four
  // demand fuels) never fired in a running game. Wired here so both go live.
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

  // Service department package (#311, parent #297): the labeled "Service package"
  // (the five Service modules + InstalledBase + PartsInventory + the
  // manager-automation ladder) that plugs into the shared department line. This
  // is the behavior-neutral extraction of what was inline Service wiring here —
  // same module construction, same closures, same clock:day_started subscription
  // order, so a fixed seed replays byte-identically (#122). The demand spine
  // (ServiceDemand) is the single difference Body Shop (#312–#317) swaps; its
  // satellites (pricing posture, marketing arms, installed-base feedback) live in
  // the package and never cross the seam. See
  // docs/planning/shared-department-structure.md.
  const serviceDept = createServiceDepartment({
    bus,
    masterSeed,
    economy,
    staffOrg,
    tierManager,
    departmentQueue,
    reputation,
    weather,
    managerGates,
  });
  const {
    installedBase,
    partsInventory,
    serviceDemand,
    serviceInsights,
    serviceMarketing,
    serviceQueue,
    serviceReadModel,
  } = serviceDept;

  // Body Shop department package (#314, parent #297): the Tier-3 mirror of the
  // Service package. CollisionStream (demand spine) → BodyShopQueue (Tier-3 gate)
  // → the Body-Shop floor drain on the SHARED dispatch engine, with insurance/
  // retail channel-posture pricing. Shares the same PartsInventory parts room
  // (activating its four collision categories). Dark below Tier 3. See
  // docs/planning/shared-department-structure.md.
  const bodyShopDept = createBodyShopDepartment({
    bus,
    masterSeed,
    economy,
    staffOrg,
    tierManager,
    departmentQueue,
    reputation,
    weather,
    partsInventory,
    managerGates,
  });
  const {
    collisionStream,
    bodyShopQueue,
    bodyShopReadModel,
    bodyShopInsights,
  } = bodyShopDept;
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
  // Records (#329): the career's high-water marks — best day/month gross, best
  // PVR, longest selling streak, fattest single deal, most units in a day — and
  // the `records:broken` announcement the Reveal feed crowns (#330). Wired here
  // (not in the app) so its `floor:day_complete` subscription runs BEFORE the
  // app's day-close handler, guaranteeing every mark for the just-closed day
  // has fired by the time the Reveal is assembled.
  const records = createRecords({ bus });
  // MarketIntel (#178): what the player is allowed to KNOW, and what that costs.
  // The wire publishes everything the market engine does; this owns the other
  // half — which lanes reach the player, opened by money (a standing data
  // subscription, debited daily) or by people (a used car manager on the desk).
  // Gating is read-side only, so the engine's headline stream — and replay
  // (#122) — is identical whether or not anything is unlocked.
  const marketIntel = createMarketIntel({ economy });
  bus.subscribe('clock:day_started', () => marketIntel.advanceDay(clock.currentDay));
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

  // #306 warm repeat-buyer leads: an aged-out, still-loyal owner re-enters Sales.
  // InstalledBase emits the lead; the root maps its prior-vehicle `category`
  // onto a matching sales archetype (so the lead walks in wanting the kind of
  // car the player is likely stocked for — naturally a stronger match) and
  // spawns it into CustomerPool. Seeded on (day, ownerId) ⇒ replay-safe (#122).
  bus.subscribe('installedBase:repeat_buyer_ready', ({ day, leads }) => {
    for (const lead of leads) {
      const rng = createRng(
        deriveSeed(masterSeed, 'installed_base.repeat_buyer', {
          day,
          ownerId: lead.ownerId,
        }),
      );
      const arch = drawArchetypeForSegment(lead.category, rng);
      customerPool.spawnCustomer(arch.personId, arch.visitId, `Repeat Buyer: ${arch.label}`);
    }
  });

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
            ? {
                bundle: s.bundle,
                visitArchetypeId: s.visitArchetypeId,
                archetypeLabel: s.archetypeLabel,
              }
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
            (m, s) => Math.max(m, s.effectiveSkills['condition_reading'] ?? 0),
            0,
          );
          return { confidence: Math.min(1, Math.max(0, bestSkill / 100)) };
        },
        // #170 → #291 (channel-desk M4): escalation approver, GM > UCM > player.
        // The GM is the empire layer and trumps the gate (never gated). Below it,
        // the UCM may auto-approve an unusual trade ONLY once its top
        // `condition_reading` clears the act gate — reframing #170's presence
        // gate onto the skill threshold (acting is earned; the appraisal *advice*
        // in getTradeConditionRead stays free on hire). Read live off the roster
        // so a mid-game hire/fire applies on the next trade; below the gate (or no
        // UCM) this returns null and the trade routes to the player overlay. The
        // threshold + skill-axis knowledge stays here at the composition boundary,
        // mirroring the M2/M3 gates. The branching itself lives in the pure
        // `resolveTradeApprover` (DealEngine) — the root only maps its live
        // StaffOrg roster down to the narrow approver-candidate read.
        getTradeApprover: () =>
          resolveTradeApprover(
            staffOrg.currentRoster.map((s) => ({
              role: s.role_id,
              conditionReading: s.effectiveSkills['condition_reading'] ?? 0,
              skill: {
                effectiveness: s.effectiveness,
                trustworthiness: s.trustworthiness ?? 0,
              },
            })),
            managerGateThresholds.condition_reading,
          ),
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
            .map((s) => s.effectiveSkills['t_o_closing'] ?? 0);
          const topUcmClosingSkill =
            ucmClosingSkills.length === 0 ? null : Math.max(...ucmClosingSkills);
          return isDiscountDeskingUnlocked(
            topUcmClosingSkill,
            managerGateThresholds.t_o_closing,
          );
        },
        // #292 (channel-desk M5): once the desk acts on a below-floor up, the
        // UCM's `t_o_closing` skill governs how far its counter drifts off the
        // salesperson's hold (toward worse). Same roster distillation as the gate
        // above; null (no UCM) ⇒ no drift. The seed is derived inside StaffDispatch.
        getDeskingDrift: () => {
          const ucmClosingSkills = staffOrg.currentRoster
            .filter((s) => s.role_id === 'used-car-manager')
            .map((s) => s.effectiveSkills['t_o_closing'] ?? 0);
          if (ucmClosingSkills.length === 0) return null;
          return {
            ucmClosingSkill: Math.max(...ucmClosingSkills),
            config: executionDrift.t_o_closing,
          };
        },
        // #292 (channel-desk M5): the UCM's `condition_reading` skill governs how
        // loosely the appraisal target drifts off the M4 monotonic-margin baseline
        // (toward worse). null (no UCM) ⇒ no drift. Seed derived in StaffDispatch.
        getTradeAllowanceDrift: () => {
          const ucmReadingSkills = staffOrg.currentRoster
            .filter((s) => s.role_id === 'used-car-manager')
            .map((s) => s.effectiveSkills['condition_reading'] ?? 0);
          if (ucmReadingSkills.length === 0) return null;
          return {
            conditionReadingSkill: Math.max(...ucmReadingSkills),
            config: executionDrift.condition_reading,
          };
        },
      }),
      // #311: the per-day Service floor drain is built by the Service package
      // (the parts gate + #310 rush/capacity automation + #305 capacity/posture/
      // read-model all live in the bundle now). Reads tierManager live, so a
      // mid-game tier-up applies the next day, exactly as before.
      serviceDept.createFloorDrain(),
      // #314: the per-day Body-Shop floor drain (the Tier-3 mirror, built on the
      // same shared dispatch engine). Dark below Tier 3 — bays are 0, so the drain
      // resolves nothing until the showroom tier even though it's always wired.
      bodyShopDept.createFloorDrain(),
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
  // #128a: the composite controllable-lever traffic multiplier (currently: inventory
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

  // #322 Morning-prep bet (engagement spine tracer S4): a World-level holder for
  // the day's captured wager. Set by `captureDayStartPrepBet()` at the day-open
  // verb (post-prep, every day incl. cold-start Day 1) and read by the day-close
  // Reveal; persisted so a mid-day reload scores the same frozen morning bet.
  const prepBetHolder = createPrepBetHolder();
  const prepBetConfig = loadTunables().reveal.prepBet;

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
    installedBase,
    partsInventory,
    serviceDemand,
    serviceInsights,
    serviceMarketing,
    // #305 live service capacity read-model (waiting / in-progress / avg-wait /
    // utilization) for the Service page + floor card.
    serviceReadModel,
    // #305 service pricing posture dial [0,1] (competitive↔premium). Getter +
    // setter so a Settings/Service-page lever can drive it; persistence is a
    // later slice. Owned by the Service package (#311).
    getServicePricingPosture: serviceDept.getServicePricingPosture,
    setServicePricingPosture: serviceDept.setServicePricingPosture,
    // #312/#313/#314 Body Shop department (the Tier-3 mirror). collisionStream +
    // bodyShopQueue are exposed for persistence + the later Body-Shop page; the
    // read-model + channel posture back the page/floor card + channel control.
    collisionStream,
    bodyShopQueue,
    bodyShopReadModel,
    bodyShopInsights,
    getBodyShopChannelPosture: bodyShopDept.getBodyShopChannelPosture,
    setBodyShopChannelPosture: bodyShopDept.setBodyShopChannelPosture,
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
    records,
    marketIntel,
    kpiDashboard,
    tierGate,
    dayLoop,
    staffTaxonomy,
    marketEconomy,
    competitorMarket,
    demandShaper,
    demandControls,
    getPrepBet: prepBetHolder.get,
    setPrepBet: prepBetHolder.set,
    captureDayStartPrepBet() {
      prepBetHolder.set(
        computePrepBet({
          day: clock.currentDay,
          lot: inventory.getLotVehicles(),
          demandMix: demandShaper.getMix(),
          weatherAttrLean: weather.attributeLeanForDay(clock.currentDay),
          config: prepBetConfig,
        }),
      );
    },
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

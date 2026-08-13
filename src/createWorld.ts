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
  resolveSegmentArchetypes,
  skewSegmentArchetypes,
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
  resolveDeskSkill,
  type FniDeskSkills,
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
  applyReconJudgment,
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
  projectCrowdFinanceMix,
  type CrowdFinanceMix,
  type CrowdArchetypeShare,
} from './game/NPC';
import {
  classifyCredit,
  generateTradeAsk,
  resolveTradeApprover,
  loadTradeAllowanceNoiseConfig,
  buildFniMonthVerdict,
  type TradeBookValueFn,
  type FniMonthVerdict,
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
import { createFacility, type Facility } from './game/Facility';
import {
  createCreditFacility,
  type CreditFacility,
} from './game/CreditFacility';
import { createEndCardManager, type EndCardManager } from './game/EndCard';
import {
  createRegulatoryMeter,
  createReputation,
  loadReputationConfig,
  withOpeningPenalty,
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

/**
 * The store's position at this moment (#380): the cash it holds and the cost
 * basis of the cars it owns. `total` is `cash + stockValue` and is carried
 * rather than left to the caller so two surfaces cannot compute two totals.
 *
 * Cash stays the constraint — every bankruptcy, tier gate and career-ending
 * face branches on `economy.cash` — so `total` never replaces it. What the pair
 * buys is the reading that cash falling was a *move*: a car bought drops `cash`
 * and raises `stockValue` by the same number, and `total` sits still.
 */
export interface StoreWorth {
  /** `economy.cash` — the money in the bank. */
  readonly cash: number;
  /** What the lot cost: every owned unit's `purchasePrice + reconCost`. */
  readonly stockValue: number;
  /** `cash + stockValue`. */
  readonly total: number;
}

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
  /** #358 built physical capacity — lot spaces + service/body bays — and the
   *  current tier's ceiling over each. */
  facility: Facility;
  /** #392 the borrowing facility standing behind the store: a limit, a drawn
   *  balance, and interest every morning on whatever is standing. Always
   *  composed — a founder with no line of credit has a facility with a limit of
   *  zero, not an absent one. */
  creditFacility: CreditFacility;
  kpiDashboard: KPIDashboard;
  /**
   * The F&I desk's `finance_structuring` as it is working today, or `null` when
   * the store has no finance office (#370). Read by the posture peak meter,
   * which needs the very number the next contract will be judged against —
   * resolved through the same person-pick and the same morale multiplier the
   * close uses, so a projection and a contract can never disagree.
   */
  getFniStructuringSkill(): number | null;
  /**
   * What the store has, right now: the cash in the bank and the cars on the lot
   * (#380). A **position**, not a period reading — nothing here is windowed.
   *
   * Composed here because this is the only place that sees both halves, and it
   * is one getter rather than two reads so no surface adds up its own total. The
   * Home HUD and the Finance room state the same pair off this call; two sums
   * would be two answers to "am I going backwards".
   *
   * The rule is deliberately two terms and no more. Facility has no dollar
   * value in the engine (#358 counts built spaces), and floorplan is modeled as
   * a daily carrying cost rather than a debt balance — including either would be
   * a number the player cannot check by adding two figures the game shows them.
   */
  getStoreWorth(): StoreWorth;
  /**
   * How the COMING crowd would pay — the cash/finance split over every up, and
   * the credit-tier mix among the ones who would finance (#371). Derived in
   * closed form from the live demand configuration (heat map + advertising
   * influence + the within-segment archetype weights), never sampled: the read
   * consumes no seeded stream, so a fixed seed replays identically whether or
   * not the player has opened the lane that shows it.
   */
  getCrowdFinanceMix(): CrowdFinanceMix;
  /**
   * What the finance office did with the month that just closed (#373) — the
   * standing posture, who worked it, the two halves of what it earned, and
   * whether the crowd's payment mix was the one that posture is a bet on.
   * `null` for a month that retailed nothing: there was no crowd, so there is
   * no bet to resolve.
   *
   * Composed here rather than at the surface because it is three engine reads
   * that have to agree — the month's KPI window, the person the close would run
   * on, and the posture the deals were actually written at. `endingDay` is the
   * day `clock:month_ended` fired on, which is the last day of the month it
   * reports.
   */
  getFniMonthVerdict(endingDay: number): FniMonthVerdict | null;
  tierGate: TierGate;
  dayLoop: DayLoopController;
  staffTaxonomy: StaffTaxonomy;
  marketEconomy: MarketEconomy;
  competitorMarket: CompetitorMarket;
  demandShaper: DemandShaper;
  demandControls: {
    readonly advertisingOptions: readonly {
      id: string;
      label: string;
      blurb: string;
      /** Spend per day while this campaign runs; 0 for "no campaign" (#349). */
      dailyCost: number;
    }[];
    getAdvertisingCampaignId(): string;
    /** The running campaign's daily spend — 0 when nothing is running (#349). */
    getAdvertisingDailyCost(): number;
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
  if (!campaign) return null;
  const weights = campaign.weights ?? {};
  const personWeights = campaign.personWeights ?? {};
  // #372: a campaign is live if EITHER lane pulls. Reading only the segment
  // lane here would make a crowd-only push (the whole point of "we finance
  // anyone") resolve to null — no influence input, and therefore no daily bill
  // either, since the spend is read back off the running input.
  if (!hasInfluence(weights) && !hasInfluence(personWeights)) return null;
  return {
    id: advertisingInputId(campaign.id),
    label: `Advertising: ${campaign.label}`,
    producer: 'advertising',
    weights,
    personWeights,
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
  /**
   * Per-slot F&I posture, resolved to its rate markup in points of APR (#366).
   * A live getter (not a value) so a mid-game dial change applies on the next
   * deal without rebuilding the world — the composition root reads the persisted
   * slot posture id through `resolveFniPostureMarkupPts`. Only bites once an
   * `f&i-manager` is on the desk (grill Q2); an unstaffed store earns the
   * ambient markup whatever is selected. Omitted ⇒ the catalog's default
   * posture (Balanced).
   */
  getFniPostureMarkupPts?: () => number;
  /**
   * The same per-slot F&I posture, as its **id** (#373). The markup getter above
   * is what prices a deal; this is what lets the month verdict name the posture
   * the month was written at in the player's own words. Two getters over one
   * piece of slot state rather than one that returns both, because the pricing
   * path must not be able to read a label and the reporting path must not be
   * able to read a rate. Omitted ⇒ the catalog's default posture.
   */
  getFniPostureId?: () => string;
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
    getFniPostureMarkupPts,
    getFniPostureId,
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
  // The clock owns the day; Economy stamps every ledger entry with it (#351)
  // rather than shadowing it off the bus, which drifted by a day during trading
  // and read 1 for the rest of a session resumed from a save.
  // #390: the founder's Day 1 levers are resolved HERE and nowhere else. Every
  // module downstream takes a plain number, so no game module learns what a
  // backstory is — the picks cannot leak into the engine.
  const day1 = characterProfile.day1Modifier;
  const economy = createEconomy({
    bus,
    // The Inheritor opens on the money they were left. A zero bonus (every other
    // founder today) is byte-identical to the pre-#390 world.
    startingCash: 50_000 + day1.startingCapitalBonus,
    getCurrentDay: () => clock.currentDay,
  });
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
  // Loaded here rather than left to the module default because the match seam
  // below needs the same file's `brandReputation.matchWeight` (#151).
  // #391: the Inheritor's town already has an opinion, so the store opens below
  // the standing a stranger gets. A STARTING POSITION, not a permanent drag —
  // `withOpeningPenalty` moves two opening numbers and nothing else, so once the
  // career has climbed out it behaves exactly like anyone else's. Reputation is
  // handed a standing; it never learns there was a backstory.
  const baseReputationConfig = loadReputationConfig();
  const reputationConfig = day1.grudgesFlag
    ? withOpeningPenalty(baseReputationConfig)
    : baseReputationConfig;
  const reputation = createReputation({ bus, economy, config: reputationConfig });
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
  // Facility (#358, A2 R1): what the store has physically BUILT — lot spaces,
  // service bays, body bays — with the tier's number as the ceiling over each
  // rather than the answer. Built right after TierManager because the ceiling
  // reads the live tier, and before the department packages because both take
  // their bay count from here (the one bay truth that replaced the two
  // `baysByTier` constants). A new world is seeded at its tier's ceilings, so
  // nothing about today's play changes; construction (#359) is what moves it —
  // paid out of the same cash inventory competes for, landing days later.
  const facility = createFacility({
    bus,
    getTier: () => tierManager.currentTier,
    economy,
    getCurrentDay: () => clock.currentDay,
  });
  // #392: the borrowing facility. Built right after Economy (it banks through
  // it) and after the clock (every morning it charges a day's interest on the
  // standing balance). The ceiling is resolved HERE from the founder's line of
  // credit and handed down as a plain number — the module never learns a
  // backstory exists. A founder with no credit gets a facility with a limit of
  // zero, which is byte-identical to the pre-#392 world: nothing can be drawn,
  // so nothing is ever posted.
  const creditFacility = createCreditFacility({
    bus,
    economy,
    limit: day1.startingCreditLine,
    getCurrentDay: () => clock.currentDay,
  });
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
    // #390: the Ex-Mechanic's eye, as a plain number. Inventory adds it to the
    // reliability every recon roll is taken against — the roll's input, never
    // its seed, so the same save still rolls the same cars.
    reconJudgmentBonus: day1.reconJudgmentBonus,
    // #173: floorplan APR follows the dealership tier — a diegetic
    // progression reward read live so a mid-game tier-up cheapens carry.
    getTier: () => tierManager.currentTier,
    // #361 (A2 R2): the lot cap on buying. Built spaces come from Facility and
    // nowhere else — the same one-capacity-truth the department lines take
    // their bay count from — and are read live, so a finished construction job
    // reopens the auction the morning the space lands, with no further player
    // action. A trade still always lands (Inventory never checks it there).
    getBuiltLotSpaces: () => facility.getBuilt().lotSpaces,
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
    // #365: is anyone actually working the F&I desk? Read live off the roster
    // so the first F&I hire lifts the store's markup on the very next deal.
    // Until then the backend is ambient, which is the honest T1–T2 answer.
    getFniDeskStaffed: () =>
      staffOrg.currentRoster.some((s) => s.role_id === 'f&i-manager'),
    // #366: the standing posture that desk works to, read live so a change on
    // the Prep lever applies to the very next deal. Omitted ⇒ Balanced.
    getFniPostureMarkupPts,
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
  // Loaded once and shared: the customer factory samples these, and the #371
  // finance-mix projection integrates over the very same tables.
  const personArchetypes = loadPersonArchetypes();
  const visitArchetypes = loadVisitArchetypes();
  const traits = loadTraitTaxonomy();
  const customerPool = createCustomerPool({
    bus,
    legacyDailyArrivals: false,
    npcDeps: {
      masterSeed,
      personArchetypes,
      visitArchetypes,
      traits,
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
    // Who can come for your people (#357). The stores already competing with
    // you are the ones who would poach from you, so the rival on the offer is
    // a name the player has seen on the market screens — not a fresh invented
    // one. Read through a function so StaffOrg never holds CompetitorMarket.
    rivalNames: () => competitorMarket.getCompetitors().map((c) => c.name),
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
          // The founder's eye rides this read too (#390). The whole point of
          // this seam is that the UCM's condition read targets the truth the
          // player will actually realize on purchase — so it has to be taken
          // against the same reliability `Inventory.buildAcquiredVehicle` will
          // use, or the desk would be reading a different car than the one that
          // lands on the lot.
          sourceReliability: applyReconJudgment(
            reliability,
            day1.reconJudgmentBonus,
          ),
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

  // #369: who is working the F&I desk right now. Read live off the roster so
  // the first finance hire works the very next deal, and so a resignation shuts
  // the office again without anything being rebuilt.
  //
  // ONE person works the deal, so ONE person is chosen: the strongest
  // f&i-manager by the role's own composite, exactly how the resolver picks
  // which salesperson takes an up. Taking a per-skill maximum across the roster
  // would staff the desk with a manager nobody hired.
  //
  // Named (#370) rather than inlined into `getFniDesk` because the posture peak
  // meter has to read the same desk the close will run on.
  // #373 lifted the person out of the skills: the month verdict stars whoever
  // worked the desk BY NAME, and it has to be the same person the deals ran on.
  // One pick, two readers.
  const resolveFniDeskPerson = () => {
    const desks = staffOrg.currentRoster.filter(
      (s) => s.role_id === 'f&i-manager',
    );
    if (desks.length === 0) return null;
    return desks.reduce((best, s) =>
      s.effectiveness > best.effectiveness ? s : best,
    );
  };

  const resolveFniDesk = (): FniDeskSkills | null => {
    const desk = resolveFniDeskPerson();
    if (!desk) return null;
    return {
      staffId: desk.id,
      productPresentation: desk.effectiveSkills['product_presentation'] ?? 0,
      financeStructuring: desk.effectiveSkills['finance_structuring'] ?? 0,
    };
  };

  /**
   * The store's position right now (#380) — cash plus what the lot cost. Two
   * reads and one addition, in the one place that can see both modules, so the
   * Home HUD and the Finance room state the same total rather than each summing
   * their own. Live, never memoized: the pair is read on every render, the way
   * `economy.cash` already is.
   */
  const getStoreWorth = (): StoreWorth => {
    const cash = economy.cash;
    const stockValue = inventory.getStockValue();
    return { cash, stockValue, total: cash + stockValue };
  };

  /**
   * The desk's `finance_structuring` as it is working today, or `null` for a
   * store with no finance office (#370). The one number the F&I posture peak
   * meter needs, resolved here through the very rules the close uses —
   * `resolveFniDesk` picks the person, `resolveDeskSkill` applies their morale
   * — so the projection and the contract can never disagree.
   */
  const getFniStructuringSkill = (): number | null => {
    const desk = resolveFniDesk();
    if (!desk) return null;
    return resolveDeskSkill(
      desk.financeStructuring,
      staffMorale.getMoraleMultiplier(desk.staffId),
    );
  };

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
    facility,
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
    facility,
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
  // Same clock provider as Economy (#351): `deal:closed` carries no day, so the
  // module asks the clock rather than keeping a cursor that a restore can't set.
  const kpiDashboard = createKPIDashboard({ bus, getCurrentDay: () => clock.currentDay });
  /**
   * The monthly F&I verdict (#373) — the Reveal beat that resolves the standing
   * posture at the grain the bet was placed at.
   *
   * Composed here because it is three reads that have to agree, and each has
   * exactly one right source: the month's retail flow comes off the KPI log (the
   * same window the Finance tab reports and the same `deal:closed` records the
   * peak meter reads), the person comes off the ONE desk pick the close runs on,
   * and the posture comes off the slot state that priced the deals. A surface
   * assembling those three itself would be free to disagree with all three.
   *
   * The window is the closing month by arithmetic rather than by a stored month
   * boundary: `clock:month_ended` fires when `endingDay % daysPerMonth === 0`,
   * so the month is the `daysPerMonth` days ending on it. Floored at day 1 so a
   * world that started mid-month never queries a negative day.
   */
  const getFniMonthVerdict = (endingDay: number): FniMonthVerdict | null => {
    const daysPerMonth = loadTunables().clock.daysPerMonth;
    const kpi = kpiDashboard.getSnapshot({
      fromDay: Math.max(1, endingDay - daysPerMonth + 1),
      toDay: endingDay,
    });
    return buildFniMonthVerdict({
      month: Math.ceil(endingDay / daysPerMonth),
      postureId: getFniPostureId?.(),
      deskName: resolveFniDeskPerson()?.name ?? null,
      unitsRetailed: kpi.unitsRetailed,
      financedUnits: kpi.financeUnits,
      productGross: kpi.productGross,
      reserveGross: kpi.reserveGross,
    });
  };
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
      // #360: the facility face's producer. Built capacity ÷ the tier's ceiling
      // — the number A2 R1 made purchasable so this gate face could grade
      // something the player controls.
      facility: () => facility.getFacilityScore(),
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
    // #372: the person-archetype universe an influence input may skew. Passed
    // in like `segments` so DemandShaper keeps no CustomerPool dep; the
    // catalog is the same one the within-segment roll resolves against, so a
    // campaign cannot name a buyer the game does not spawn.
    personArchetypes: SALES_ARCHETYPES.map((a) => a.personId),
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
      { id: 'none', label: 'No campaign', blurb: 'No paid advertising push.', dailyCost: 0 },
      ...(demandShaperConfig.advertisingInfluence?.campaigns.map((campaign) => ({
        id: campaign.id,
        label: campaign.label,
        blurb: campaign.blurb,
        dailyCost: campaign.dailyCost,
      })) ?? []),
    ],
    getAdvertisingCampaignId: () => {
      const active = demandShaper
        .getInfluenceInputs()
        .find(
          (input) =>
            input.producer === 'advertising' &&
            (hasInfluence(input.targetWeights) ||
              hasInfluence(input.targetPersonWeights)),
        );
      return active ? active.id.replace(/^advertising:/, '') : 'none';
    },
    getAdvertisingDailyCost: () =>
      demandShaperConfig.advertisingInfluence?.campaigns.find(
        (c) => c.id === demandControls.getAdvertisingCampaignId(),
      )?.dailyCost ?? 0,
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
  // #349: a running campaign bills every day, the same standing-spend shape
  // ServiceMarketing's arms and the wire subscription use. `forceDebit` (not
  // `postExpense`) because the bill posts even when cash is short — the money
  // is already spent by the time the day ends.
  bus.subscribe('clock:day_ended', () => {
    const spend = demandControls.getAdvertisingDailyCost();
    if (spend > 0) {
      economy.forceDebit(
        spend,
        `Advertising: ${demandControls.getAdvertisingCampaignId()}`,
      );
    }
  });
  // Within-segment archetype roll (#278): demand picks the *segment*; this table
  // picks which visit archetype walks in for that segment (the negotiation
  // flavor personas demote to). Resolved against SALES_ARCHETYPES so the heat
  // map stays free of a CustomerPool dep — and resolved ONCE (#371), because
  // the finance-mix projection below integrates over the same weights.
  const segmentArchetypes = resolveSegmentArchetypes(
    demandShaperConfig.segmentArchetypes,
  );
  // The live within-segment weights: the static table bent by whatever crowd
  // skew advertising is currently pulling (#372). Read live, so a campaign
  // ramping in changes who walks in as it ramps.
  const liveArchetypesFor = (segment: string) =>
    skewSegmentArchetypes(
      segmentArchetypes.get(segment) ?? [],
      demandShaper.getPersonSkew(),
    );
  const drawArchetypeForSegment = (segment: string, rng: () => number) => {
    const candidates = liveArchetypesFor(segment);
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (total > 0) {
      const r = rng() * total;
      let cum = 0;
      for (const candidate of candidates) {
        cum += candidate.weight;
        if (r < cum) return candidate;
      }
      return candidates[candidates.length - 1];
    }
    return SALES_ARCHETYPES[0];
  };

  // The coming crowd's finance mix (#371) — the read the F&I posture dial is
  // set against. Composed from the LIVE demand configuration: the same heat map
  // `drawSegment` samples (advertising influence and all) crossed with the same
  // within-segment weights above, then integrated in closed form by NPC. It
  // draws no randomness and consumes no seeded stream, so a fixed seed replays
  // byte-identically whether or not the player ever opens the lane.
  const creditBands = Object.entries(creditTiers.tiers).map(([tier, def]) => ({
    tier,
    minScore: def.minScore,
  }));
  const getCrowdFinanceMix = (): CrowdFinanceMix => {
    const mix = demandShaper.getMix();
    const crowd: CrowdArchetypeShare[] = [];
    for (const segment of demandShaper.segments) {
      const segmentShare = mix[segment] ?? 0;
      if (segmentShare <= 0) continue;
      // Same live, skewed weights the spawn draw uses (#372) — the wire has to
      // report the crowd the store's own advertising is buying, not the crowd
      // it would see with no campaign running.
      const candidates = liveArchetypesFor(segment);
      const total = candidates.reduce((sum, c) => sum + c.weight, 0);
      const within = total > 0 ? candidates : [{ ...SALES_ARCHETYPES[0], weight: 1 }];
      const withinTotal = total > 0 ? total : 1;
      for (const candidate of within) {
        crowd.push({
          personArchetypeId: candidate.personId,
          visitArchetypeId: candidate.visitId,
          share: segmentShare * (candidate.weight / withinTotal),
        });
      }
    }
    return projectCrowdFinanceMix(crowd, {
      personArchetypes,
      visitArchetypes,
      traits,
      creditBands,
    });
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
          // #151 (B2 I6): the store's standing selling that make tilts the
          // argmax. `repFor` is the honest state ∈ [-1,1]; the weight that turns
          // it into a score term is the matcher's business, so it is applied
          // here at the boundary rather than baked into the module's read. Read
          // live, so a brand's record moves the next customer's match.
          reputationBonusFn: (brand) =>
            reputation.repFor(brand) * reputationConfig.brandReputation.matchWeight,
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
        // #369: the F&I desk. Read live off the roster so the first finance hire
        // works the very next deal — the same closure idiom as the approver and
        // the drift getters, so StaffDispatch never learns a role id.
        //
        // ONE person works the deal, so ONE person is chosen: the strongest
        // f&i-manager by the role's own composite, exactly how the resolver
        // picks which salesperson takes an up. Taking a per-skill maximum across
        // the roster would staff the desk with a manager nobody hired.
        getFniDesk: resolveFniDesk,
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
    facility,
    creditFacility,
    kpiDashboard,
    getFniStructuringSkill,
    getStoreWorth,
    getCrowdFinanceMix,
    getFniMonthVerdict,
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

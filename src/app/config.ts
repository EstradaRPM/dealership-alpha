// Module-level configuration for the app composition root.
//
// All of this is seed-free, built once at module load, and was formerly inlined
// at the top of App.tsx (#242 decomposition). Pulling it here keeps the React
// tree (AppRoot + the state hooks) free of the tunable-loading + pure-builder
// noise, and gives UI slices one stable place to read these from instead of
// editing the 1.8k-line App.tsx.
import { type ImageSourcePropType } from 'react-native';
import { loadTunables } from '../game/data';
import { loadTradePolicyConfig, isTradeApprovalUnlocked } from '../game/DealEngine';
import { loadInventoryConfig } from '../game/Inventory';
import { loadStaffArchetypes, loadStaffTaxonomy } from '../game/NPC';
import {
  loadNewsTemplatesConfig,
  loadPricingStrategiesConfig,
  loadSourcingConfig,
  personalityBiasFor,
  resolveIntelPrecision,
  isAutoPricingUnlocked,
  type IntelPrecision,
  type PricingStaffRead,
  type SourcingLean,
} from '../game/MarketEconomy';
import { isDiscountDeskingUnlocked } from '../game/StaffDispatch';
import { isServiceFunctionAutomated } from '../game/ServiceDispatch';
import { isBodyShopFunctionAutomated } from '../bodyShopManager';
import { loadRegulatoryTunables } from '../game/Reputation';
import { loadTierConfig } from '../game/CareerProgression';
import type { World } from '../createWorld';
import type { DeptKey } from '../game/DepartmentQueue';
import type { LotVehicle } from '../game/Inventory';
import type { PersonnelRoleOption } from '../ui/PersonnelScreen';
import {
  buildIndustryWire as buildIndustryWireModel,
  type CashDeltaSplit,
  type IndustryWireModel,
} from '../ui/HomeTab';
import {
  PART_CATEGORIES,
  SUPPLIER_TIERS,
  type PartCategory,
} from '../game/PartsInventory';
import { JOB_CATEGORIES } from '../game/ServiceMarketing';
import type {
  ServicePageModel,
  ServiceDemandHeatRow,
  ServiceCoverageRow,
  ServiceControlsModel,
} from '../ui/ServicePage';
import type {
  BodyShopPageModel,
  BodyShopDemandHeatRow,
  BodyShopCoverageRow,
  BodyShopControlsModel,
} from '../ui/BodyShopPage';
import { loadBodyShopQueueConfig } from '../game/BodyShopQueue';
import {
  classifyHeatBand,
  classifyHeatBandFine,
  heatIndexFor,
} from '../ui/DemandReadout';
import {
  buildSegmentHeatCells,
  buildActiveShocks,
  buildInventoryValuation,
  buildStaleInventory,
} from '../ui/KPIDashboard';
import type {
  MarketStateModel,
  ValueBandEdges,
  ValuationVehicleInput,
} from '../ui/KPIDashboard';
import type {
  ManagerStatusModel,
  UcmCapabilityFact,
  DeptManagerFact,
} from '../ui/PeopleTab';
import {
  buildRecoveryBanners as composeRecoveryBanners,
} from '../ui/NarrativeBeat';
import type { RecoveryBannerModel } from '../ui/NarrativeBeat';
import type {
  DemandCoverageGap,
  DemandReadoutEntry,
  DemandTargetingLever,
  HeatBandEntry,
  HeatBandThresholds,
} from '../ui/DemandReadout';

// Tier-keyed hero art for the shell's header backdrop. Metro requires static
// require() calls — the map must live at module scope.
export const HERO_BY_TIER: Partial<Record<number, ImageSourcePropType>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  1: require('../../assets/hero/lot-tier1.jpg'),
  // 2 and 3 added when art lands (#251)
};

export const DEPT_TITLES: Record<DeptKey, string> = {
  sales: 'Sales',
  service: 'Service',
  bdc: 'BDC',
  office: 'Office',
  lot: 'Lot',
  bodyshop: 'Body Shop',
};

// Representative open-hours window for the FLOOR-OPEN HUD clock (#121).
export const RENDER_LOOP = loadTunables().renderLoop;

// Want-axis fit a closed deal must clear to count as a "strong match" (#199) —
// drives the floor toast + DayRecap tally. Tunable, never a magic number.
export const STRONG_MATCH_THRESHOLD =
  loadTunables().matchPayoff.strongMatchThreshold;

// Hours-of-op lever options (#120/#207). The selected option's scaled
// ticksPerDay is fed into FloorSim (via getHoursOfOpTicksPerDay → createWorld →
// the floor seam → createFloorSim's additive ticksPerDay override), so a longer
// shift literally runs more ticks — observable on the FLOOR-OPEN HUD clock.
export const HOURS_OF_OP = loadTunables().ownership.hoursOfOp;

// Paid pre-purchase inspection cost shown on the auction-board action (#164).
export const INSPECTION_COST = loadInventoryConfig().inspection.cost;

// Aged-unit threshold for the pricing-screen aging warning (#173/#175).
export const AGED_THRESHOLD_DAYS = loadInventoryConfig().carrying.agedThresholdDays;

// Trade-acquisition policy catalog (#172). Seed-free; the selected id persists
// per save slot and resolves to the acceptance-target multiplier the trade
// resolver reads. Default = market (1.0).
export const TRADE_POLICY = loadTradePolicyConfig();

// List-price strategy catalog (#154). Seed-free; the selected id persists per
// save slot and drives the staff-suggested list price on the pricing screen
// (#175). Default = market.
export const PRICING_STRATEGIES = loadPricingStrategiesConfig();
export const PRICING_STRATEGY_OPTIONS = Object.entries(
  PRICING_STRATEGIES.strategies,
).map(([id, s]) => ({ id, label: s.label, blurb: s.blurb }));
export const REGULATORY_TUNABLES = loadRegulatoryTunables();

// UCM sourcing posture-lean (#293, channel-desk M6). Seed-free; the per-slot
// lean (margin/condition/demand-fit blend) persists per save slot and drives the
// UCM's auto-fill once `condition_reading` clears the act gate. Default =
// balanced. The dial UI is the mockup pass; the persistence seam lands now so a
// player's tuned lean round-trips through the save.
export const SOURCING_CONFIG = loadSourcingConfig();
export const DEFAULT_SOURCING_LEAN: SourcingLean = SOURCING_CONFIG.defaultLean;

// Tier ladder labels for the shell header (#215). Seed-free.
export const TIER_CONFIG = loadTierConfig();

export const DEFAULT_HIRING_ROLE_ID = 'salesperson';

// staffTaxonomy is seed-free: kept module-level so SKILL_CAPS (PersonnelScreen
// bars, #120) and the FLOOR-OPEN staff-strip department lookup don't depend on
// a built World.
export const staffTaxonomy = loadStaffTaxonomy();
export const staffArchetypes = loadStaffArchetypes();
// skill_id → cap, for the PersonnelScreen skill bars (Hiring lever, #120).
export const SKILL_CAPS: Record<string, number> = Object.fromEntries(
  Object.entries(staffTaxonomy.skills).map(([id, s]) => [id, s.cap]),
);

// role_id → humanized label + serving department, for the impressionistic
// FLOOR-OPEN staff strip (#117). Pure read mapping off the role catalog.
export function humanizeRole(roleId: string): string {
  return roleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const HIRABLE_ROLE_IDS = new Set(
  Object.values(staffArchetypes).map((a) => a.role_id),
);

export function buildHiringRoleOptions(tier: number): PersonnelRoleOption[] {
  return Object.entries(staffTaxonomy.roles)
    .filter(([roleId, role]) => {
      if (!HIRABLE_ROLE_IDS.has(roleId)) return false;
      // Worker-tier roles (lot-porter, technician) are entry-level — reached via
      // promotion (#324), never hired cold. Everyone customer-facing and up is
      // hireable once their per-role hireTier gate opens: salesperson (T1), the
      // service- and body-shop-advisors (T2/T3, the capacity unblock — #323),
      // and the managers/GM. Gating stays fully data-driven off staff-roles.json.
      if (role.tier === 'worker') return false;
      return (role.hireTier ?? 1) <= tier;
    })
    .map(([id]) => ({ id, label: humanizeRole(id) }))
    .sort((a, b) => {
      if (a.id === DEFAULT_HIRING_ROLE_ID) return -1;
      if (b.id === DEFAULT_HIRING_ROLE_ID) return 1;
      return a.label.localeCompare(b.label);
    });
}

// segment id → human label for the #198 / #278 segment-heat readout. The heat
// map's dimension is the VehicleCategory universe, so these double as the
// coverage-gap labels.
export const SEGMENT_LABELS: Record<string, string> = {
  sedan: 'Sedans',
  truck: 'Trucks',
  suv: 'SUVs',
};

export function buildTargetingLevers(world: World): DemandTargetingLever[] {
  return world.demandShaper.getInfluenceInputs().map((input) => ({
    id: input.id,
    label: input.label,
    lean: Object.entries(input.weights)
      .filter(([, weight]) => weight > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([segment, weight]) => ({
        segment,
        label: SEGMENT_LABELS[segment] ?? segment,
        weight,
      })),
  }));
}

// Heat-console band thresholds (#280) — single-sourced from tunables, no magic
// numbers in the composition root.
export const HEAT_BAND_THRESHOLDS: HeatBandThresholds =
  loadTunables().demandShaper.heatBands;

// Used-value pressure band edges for the KPI market-state panel (#179) —
// single-sourced from tunables, presentation-only.
export const VALUE_HEAT_BANDS: ValueBandEdges =
  loadTunables().marketEconomy.valueHeatBands;

// Pricing-intel precision (#284, S12): distill the roster to the narrow read
// MarketEconomy needs (the top UCM's pricing skill, or null when none is on
// staff) and resolve the coarse↔sharp profile. One profile feeds the heat
// console's band resolution AND the pricing screen's confidence/range/band
// tightness, so the player's whole read sharpens together when a UCM is hired.
export function buildPricingStaffRead(world: World): PricingStaffRead {
  const ucmSkills = world.staffOrg.currentRoster
    .filter((s) => s.role_id === 'used-car-manager')
    .map((s) => s.skills['pricing'] ?? 0);
  return {
    ucmPricingSkill: ucmSkills.length === 0 ? null : Math.max(...ucmSkills),
  };
}

export function resolvePricingIntel(world: World): IntelPrecision {
  return resolveIntelPrecision(buildPricingStaffRead(world));
}

// Forward demand signal (#280): band the LIVE heat vector the spawn draw uses
// (`getMix()` — the same model, no separate display source) per segment,
// hottest-first so the player reads what to stock and price to. Precision (#284)
// selects the band resolution: coarse hot/warm/cold by gut, or — once a UCM is
// on staff — a fine 5-band read with the numeric heat index exposed.
export function buildHeatConsole(
  world: World,
  precision: IntelPrecision,
  thresholds: HeatBandThresholds = HEAT_BAND_THRESHOLDS,
): HeatBandEntry[] {
  const mix = world.demandShaper.getMix();
  const segments = world.demandShaper.segments;
  const fine = precision.heatGranularity === 'fine';
  return segments
    .map((segment) => {
      const share = mix[segment] ?? 0;
      return {
        segment,
        label: SEGMENT_LABELS[segment] ?? segment,
        band: fine
          ? classifyHeatBandFine(share, segments.length, thresholds)
          : classifyHeatBand(share, segments.length, thresholds),
        share,
        heatIndex: fine ? heatIndexFor(share, segments.length) : undefined,
      };
    })
    .sort((a, b) => b.share - a.share)
    .map(({ segment, label, band, heatIndex }) => ({
      segment,
      label,
      band,
      ...(heatIndex != null ? { heatIndex } : {}),
    }));
}

// Market-state read-model for the KPI dashboard (#179, parent #150): the
// aggregate view of the engine the player operates within. Assembles the pure
// UI builders from `world` — MarketEconomy (per-segment value pressure factors,
// active shocks, per-vehicle valuation) + Inventory (lot + carrying + aging).
// Keyed on `demandShaper.segments` (the canonical vehicle-type category list,
// #278), the same keys MarketEconomy's segmentHeat uses.
export function buildMarketState(world: World): MarketStateModel {
  const me = world.marketEconomy;
  const day = world.clock.currentDay;
  const segments = world.demandShaper.segments;
  const active = me.shocks.activeInstances();
  const labelFor = (segment: string): string => SEGMENT_LABELS[segment] ?? segment;

  const segmentHeat = buildSegmentHeatCells({
    segments,
    labelFor,
    personalityFor: (segment) => personalityBiasFor(me.personality, segment),
    driftFor: (segment) => me.compHistory.segmentDrift(segment, day),
    // The shock term for a segment is the sum of active instances' magnitudes —
    // exactly what the segmentHeat composer's activeShockMod accumulates.
    shockFor: (segment) =>
      active.reduce((sum, inst) => sum + (inst.segmentMagnitudes[segment] ?? 0), 0),
    edges: VALUE_HEAT_BANDS,
  });

  const vehicles: ValuationVehicleInput[] = world.inventory
    .getLotVehicles()
    .map((v) => {
      const { bookValue, marketPrice } = me.valuationFor(v);
      return {
        cost: v.purchasePrice + v.reconCost,
        book: bookValue,
        market: marketPrice,
        dailyCarryingCost: v.dailyCarryingCost,
        aged: v.aged,
      };
    });

  return {
    segmentHeat,
    activeShocks: buildActiveShocks(active, day, labelFor),
    valuation: buildInventoryValuation(vehicles),
    stale: buildStaleInventory(vehicles, AGED_THRESHOLD_DAYS),
  };
}

// The wire's trust-badge copy (#176) — the labels and their plain-language
// explanations live in the news catalog next to the headline templates, so all
// player-facing wording for the wire retunes in one data file.
const NEWS_COPY = loadNewsTemplatesConfig();

// Industry-wire read-model for the Home screen (#176, parent #150). MarketNews
// keeps the ring buffer newest-first; the composition root only supplies the
// current day (for the "Today / Yesterday / Day N" stamp) and the trust-badge
// copy. Empty until the first headline publishes — the panel says so honestly
// rather than rendering a placeholder.
export function buildIndustryWire(world: World): IndustryWireModel {
  return buildIndustryWireModel({
    headlines: world.marketEconomy.news.getHeadlines().map((h) => ({
      id: h.id,
      day: h.day,
      text: h.text,
      sourceLabel: h.sourceLabel,
      reliability: h.reliability,
    })),
    currentDay: world.clock.currentDay,
    reliabilityLabels: NEWS_COPY.reliabilityLabels,
    reliabilityNotes: NEWS_COPY.reliabilityNotes,
  });
}

// Manager status read-model (#325, workstream A4): the delegated-authority
// surface for the People tab. The four desk gates + two fixed-ops managers act
// invisibly today; per macro-loop-spine §2 delegation must read as *permission*,
// so this distills which capabilities the player has handed off. Reuses the SAME
// act-gate predicates the engine gates on (isAutoPricingUnlocked etc.) against
// each manager's GROWN effectiveSkills (constant within a day, steps overnight —
// channel-desk M7), so the card never disagrees with what the desk actually does.
// The condition_reading axis gates BOTH trade auto-approve and sourcing auto-fill
// on one threshold, so a single predicate speaks for both.
export function buildManagerStatus(world: World): ManagerStatusModel {
  const gates = loadTunables().managerGates;
  const roster = world.staffOrg.currentRoster;

  // Top on-staff effective skill for a role on a given axis (null = none on
  // staff), mirroring the live gate reads in createWorld / the department
  // packages (top UCM pricing, top SM shop_throughput, …).
  const topSkill = (roleId: string, axis: string): number | null => {
    const held = roster.filter((s) => s.role_id === roleId);
    return held.length === 0
      ? null
      : Math.max(...held.map((s) => s.effectiveSkills[axis] ?? 0));
  };

  const pricingSkill = topSkill('used-car-manager', 'pricing');
  const conditionSkill = topSkill('used-car-manager', 'condition_reading');
  const closingSkill = topSkill('used-car-manager', 't_o_closing');
  const ucm: UcmCapabilityFact[] = [
    {
      axis: 'pricing',
      delegated: isAutoPricingUnlocked(pricingSkill, gates.actThresholds.pricing),
      skill: pricingSkill,
      threshold: gates.actThresholds.pricing,
    },
    {
      axis: 'condition_reading',
      // One axis + threshold gates both trade auto-approve (#291) and sourcing
      // auto-fill (#293) — either predicate is authoritative for the pair.
      delegated: isTradeApprovalUnlocked(
        conditionSkill,
        gates.actThresholds.condition_reading,
      ),
      skill: conditionSkill,
      threshold: gates.actThresholds.condition_reading,
    },
    {
      axis: 't_o_closing',
      delegated: isDiscountDeskingUnlocked(closingSkill, gates.actThresholds.t_o_closing),
      skill: closingSkill,
      threshold: gates.actThresholds.t_o_closing,
    },
  ];

  const svcSkill = topSkill('service-manager', 'shop_throughput');
  const bodySkill = topSkill('body-shop-manager', 'shop_throughput');
  const svcGates = gates.serviceManager.actThresholds;
  const bodyGates = gates.bodyShopManager.actThresholds;
  const departments: DeptManagerFact[] = [
    {
      dept: 'service',
      present: svcSkill !== null,
      functions: (['par', 'pricing', 'marketing', 'rush', 'capacity'] as const).map(
        (fn) => ({ fn, automated: isServiceFunctionAutomated(svcSkill, svcGates[fn]) }),
      ),
    },
    {
      dept: 'body',
      present: bodySkill !== null,
      functions: (['par', 'channel', 'rush', 'capacity'] as const).map((fn) => ({
        fn,
        automated: isBodyShopFunctionAutomated(bodySkill, bodyGates[fn]),
      })),
    },
  ];

  return { ucmPresent: pricingSkill !== null, ucm, departments };
}

// Recovery-banner read-model (#326, workstream A4): the persistent "climbing
// back" strip. Assembles the persisted monitor snapshot the pure UI builder
// consumes — the two recovery states that leave a lingering, self-clearing
// window: a bankruptcy contraction's debt overhang (BankruptcyMonitor, amortizes
// weekly to 0) and an AG contraction's license-suspension window (RegulatoryMeter,
// ticks down each overnight). Both persist through the world save seam, so the
// banner is correct after a save/load and disappears on its own when the state
// resolves. The indictment contraction and consent decree are one-shot in the
// engine (no lingering window) and surface as a beat only.
export function buildRecoveryBanners(world: World): readonly RecoveryBannerModel[] {
  return composeRecoveryBanners({
    outstandingDebt: world.bankruptcyMonitor.outstandingDebt,
    isSuspended: world.regulatoryMeter.isSuspended,
    suspensionDaysRemaining: world.regulatoryMeter.suspensionDaysRemaining,
  });
}

export function buildCoverageGap(
  entries: readonly DemandReadoutEntry[],
  lotVehicles: readonly LotVehicle[],
): DemandCoverageGap | null {
  // Heat map is keyed by segment, so a readout entry *is* a wanted segment —
  // no persona→category projection needed (#278).
  const wantedByCategory: Record<string, number> = {};
  for (const entry of entries) {
    wantedByCategory[entry.segment] =
      (wantedByCategory[entry.segment] ?? 0) + entry.count;
  }
  const stockedByCategory: Record<string, number> = {};
  for (const vehicle of lotVehicles) {
    stockedByCategory[vehicle.category] =
      (stockedByCategory[vehicle.category] ?? 0) + 1;
  }
  const [category, wantedCount] =
    Object.entries(wantedByCategory)
      .filter(([, wanted]) => wanted > 0)
      .sort(([, a], [, b]) => b - a)
      .find(([category]) => (stockedByCategory[category] ?? 0) === 0) ?? [];
  if (!category || wantedCount == null) return null;
  return {
    category,
    label: SEGMENT_LABELS[category] ?? category,
    wantedCount,
    stockCount: stockedByCategory[category] ?? 0,
  };
}

// Plain-language names for the four Service job/parts categories (#308). Used by
// the Service page demand-heat + coverage rows.
export const JOB_CATEGORY_LABELS: Record<string, string> = {
  oil_filters: 'Oil & Filters',
  tires_brakes: 'Tires & Brakes',
  drivetrain: 'Drivetrain',
  electronics: 'Electronics',
};

// Assemble the Service page model (#308) from the live read-models: the
// ServiceInsights trailing-window demand heat + base health, and the
// PartsInventory coverage-gap (recent demand vs parts on hand). Pure projection
// — no game-logic mutation. The recent per-category demand counts ServiceInsights
// tracks are the same `demand` the coverage read-model bands stock against, so a
// single source feeds both the heat and the coverage rows.
export function buildServicePageModel(world: World): ServicePageModel {
  const heat = world.serviceInsights.getDemandHeat();
  const demandHeat: ServiceDemandHeatRow[] = heat.map((h) => ({
    category: h.category,
    label: JOB_CATEGORY_LABELS[h.category] ?? h.category,
    band: h.band,
    trend: h.trend,
  }));
  const demandCounts: Record<string, number> = {};
  for (const h of heat) demandCounts[h.category] = h.count;
  const gap = world.partsInventory.getCoverageGap(demandCounts);
  const coverage: ServiceCoverageRow[] = heat.map((h) => {
    const g = gap[h.category];
    return {
      category: h.category,
      label: JOB_CATEGORY_LABELS[h.category] ?? h.category,
      demand: g.demand,
      onHand: g.onHand,
      onOrder: g.onOrder,
      gap: g.gap,
    };
  });
  return {
    demandHeat,
    coverage,
    baseHealth: { ...world.serviceInsights.getBaseHealth() },
  };
}

// Plain-language names for the four Body-Shop collision job/parts categories
// (#315). Used by the Body Shop page demand-heat + coverage rows.
export const BODY_SHOP_JOB_CATEGORY_LABELS: Record<string, string> = {
  windows_glass: 'Windows & Glass',
  doors_panels: 'Doors & Panels',
  interior_trim: 'Interior Trim',
  paint: 'Paint & Body',
};

// The tier the Body Shop unlocks at — single source of truth, read from the same
// config BodyShopQueue gates on (data/bodyshop-intake.json#minTierRequired). Used
// to show the Body Shop Operations-tab entry + floor card only once it's live
// (navigation itself is never tier-gated).
export const BODY_SHOP_MIN_TIER = loadBodyShopQueueConfig().minTierRequired;

// Assemble the Body Shop page model (#315) from the live read-models: the
// BodyShopInsights trailing-window demand heat + conquest health, and the
// PartsInventory coverage-gap over the four collision categories. Pure
// projection — no game-logic mutation. The Body Shop is conquest-dominant (no
// installed base), so the third readout is conquest health, not base health.
export function buildBodyShopPageModel(world: World): BodyShopPageModel {
  const heat = world.bodyShopInsights.getDemandHeat();
  const demandHeat: BodyShopDemandHeatRow[] = heat.map((h) => ({
    category: h.category,
    label: BODY_SHOP_JOB_CATEGORY_LABELS[h.category] ?? h.category,
    band: h.band,
    trend: h.trend,
  }));
  const demandCounts: Record<string, number> = {};
  for (const h of heat) demandCounts[h.category] = h.count;
  const gap = world.partsInventory.getCoverageGap(demandCounts);
  const coverage: BodyShopCoverageRow[] = heat.map((h) => {
    const g = gap[h.category];
    return {
      category: h.category,
      label: BODY_SHOP_JOB_CATEGORY_LABELS[h.category] ?? h.category,
      demand: g.demand,
      onHand: g.onHand,
      onOrder: g.onOrder,
      gap: g.gap,
    };
  });
  const ch = world.bodyShopInsights.getConquestHealth();
  return {
    demandHeat,
    coverage,
    conquest: {
      windowTickets: ch.windowTickets,
      intakePerDay: ch.intakePerDay,
      intakeTrend: ch.volumeTrend,
      retailShare: ch.retailShare,
      insuranceShare: ch.insuranceShare,
      retailTrend: ch.retailTrend,
    },
  };
}

// Plain-language supplier-tier names for the Service parts-stocking control
// (#309), cheapest/slowest → priciest/fastest. No magic strings in the view.
export const SUPPLIER_TIER_LABELS: Record<string, string> = {
  economy: 'Economy',
  standard: 'Standard',
  oem_direct: 'OEM Direct',
  rush: 'Rush',
};

// Assemble the Service POLICY controls model (#309) from the live World: the
// per-category PartsInventory procurement policy (par levels + supplier tier +
// on-hand), the stored pricing-posture dial, and the two ServiceMarketing arms.
// Pure read — the dispatch callbacks (RouteContent) mutate the World and persist.
// 'none' leads each marketing list since selecting it clears that arm.
export function buildServiceControlsModel(world: World): ServiceControlsModel {
  return {
    par: PART_CATEGORIES.map((cat) => {
      const policy = world.partsInventory.getPolicy(cat);
      return {
        category: cat,
        label: JOB_CATEGORY_LABELS[cat] ?? cat,
        reorderPoint: policy.reorderPoint,
        target: policy.target,
        tier: policy.tier,
        onHand: world.partsInventory.getStock(cat),
      };
    }),
    tierOptions: SUPPLIER_TIERS.map((id) => ({
      id,
      label: SUPPLIER_TIER_LABELS[id] ?? id,
    })),
    pricingPosture: world.getServicePricingPosture(),
    retentionOptions: [
      { id: 'none', label: 'None' },
      ...world.serviceMarketing.retentionCampaigns.map((c) => ({
        id: c.id,
        label: c.label,
        blurb: c.blurb,
      })),
    ],
    retentionId: world.serviceMarketing.getRetentionCampaign(),
    conquestOptions: [
      { id: 'none', label: 'None' },
      ...JOB_CATEGORIES.map((cat) => ({
        id: cat,
        label: JOB_CATEGORY_LABELS[cat] ?? cat,
      })),
    ],
    conquestCategory: world.serviceMarketing.getConquestSpecial(),
  };
}

// The four Body-Shop collision parts categories the controls drive par/supplier
// on (the active subset of PartsInventory's eight). Declared explicitly rather
// than sliced off PART_CATEGORIES so the Body-Shop set stays self-documenting and
// decoupled from the array's ordering.
export const BODY_SHOP_PART_CATEGORIES: readonly PartCategory[] = [
  'windows_glass',
  'doors_panels',
  'interior_trim',
  'paint',
];

// Assemble the Body Shop POLICY controls model (#318) from the live World: the
// per-collision-category PartsInventory procurement policy (par + supplier tier +
// on-hand) and the stored insurance↔retail channel posture. Pure read — the
// dispatch callbacks (RouteContent) mutate the World and persist. Mirrors
// buildServiceControlsModel; the Body Shop's single pricing/marketing lever is
// the channel dial (no separate retention/conquest arms).
export function buildBodyShopControlsModel(world: World): BodyShopControlsModel {
  return {
    par: BODY_SHOP_PART_CATEGORIES.map((cat) => {
      const policy = world.partsInventory.getPolicy(cat);
      return {
        category: cat,
        label: BODY_SHOP_JOB_CATEGORY_LABELS[cat] ?? cat,
        reorderPoint: policy.reorderPoint,
        target: policy.target,
        tier: policy.tier,
        onHand: world.partsInventory.getStock(cat),
      };
    }),
    tierOptions: SUPPLIER_TIERS.map((id) => ({
      id,
      label: SUPPLIER_TIER_LABELS[id] ?? id,
    })),
    channelPosture: world.getBodyShopChannelPosture(),
  };
}

// Month-close cadence — sourced from the same tunable GameClock uses, never
// a magic number. clock:month_ended fires on endingDay % daysPerMonth === 0.
export const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;

// Shape-check the persisted sourcing lean (#293) coming back out of the untyped
// save envelope; anything malformed degrades to the balanced default so a
// pre-#293 save (or a corrupt blob) never crashes the auto-fill.
export function readPersistedSourcingLean(value: unknown): SourcingLean {
  if (value == null || typeof value !== 'object') return DEFAULT_SOURCING_LEAN;
  const { margin, condition, demandFit } = value as Partial<SourcingLean>;
  return typeof margin === 'number' &&
    margin >= 0 &&
    typeof condition === 'number' &&
    condition >= 0 &&
    typeof demandFit === 'number' &&
    demandFit >= 0
    ? { margin, condition, demandFit }
    : DEFAULT_SOURCING_LEAN;
}

// Shape-check the persisted cash-delta split (#255) coming back out of the
// untyped save envelope; anything malformed degrades to "no delta yet".
export function readPersistedCashDelta(value: unknown): CashDeltaSplit | null {
  if (value == null || typeof value !== 'object') return null;
  const { ops, stock } = value as Partial<CashDeltaSplit>;
  return typeof ops === 'number' && typeof stock === 'number'
    ? { ops, stock }
    : null;
}

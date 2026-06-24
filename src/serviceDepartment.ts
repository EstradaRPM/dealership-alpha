/**
 * Service department package (#311, parent #297) — composition layer.
 *
 * The labeled "Service package" the shared assembly line
 * (`docs/planning/shared-department-structure.md`, LOCKED 2026-06-23) plugs into.
 * It bundles the five Service modules (Demand / Queue / Insights / Marketing +
 * the Dispatch drain) plus `InstalledBase` and `PartsInventory` into one builder,
 * and supplies the narrow seam (enriched intake + pricing read) the
 * department-agnostic backbone consumes.
 *
 * This is a **behavior-neutral** extraction of the Service wiring that previously
 * lived inline in `createWorld`: same module construction, same closures, same
 * `clock:day_started` subscription order, so a fixed seed replays byte-identically
 * (#122) and every Service test stays green. Manager automation stays at the
 * composition root, expressed through the shared `DepartmentLine` pattern.
 *
 * The demand spine (`ServiceDemand`) is the single injected difference Body Shop
 * (#312–#317) swaps; its three satellites (pricing posture, marketing arms,
 * installed-base feedback) live here in the package and never cross the seam.
 */
import type { EventBus } from './game/EventBus';
import type { Economy } from './game/Economy';
import type { StaffOrg } from './game/StaffOrg';
import type { DepartmentQueue } from './game/DepartmentQueue';
import type { Reputation } from './game/Reputation';
import type { Weather } from './game/Weather';
import type { TierManager } from './game/CareerProgression';
import type { DeptDrain } from './game/FloorSim';
import { loadTunables } from './game/data';
import { createDepartmentManagerAutomation } from './game/DepartmentLine';
import {
  createInstalledBase,
  loadInstalledBaseConfig,
  type InstalledBase,
} from './game/InstalledBase';
import {
  createPartsInventory,
  loadPartsInventoryConfig,
  type PartsInventory,
  type PartCategory,
} from './game/PartsInventory';
import { createServiceDemand, type ServiceDemand } from './game/ServiceDemand';
import {
  createServiceInsights,
  type ServiceInsights,
} from './game/ServiceInsights';
import {
  createServiceMarketing,
  type ServiceMarketing,
} from './game/ServiceMarketing';
import { createServiceQueue, type ServiceQueue } from './game/ServiceQueue';
import {
  createServiceFloorDrain,
  createServiceReadModel,
  loadServiceDispatchConfig,
  type ServiceReadModel,
  isServiceFunctionAutomated,
  autoServicePar,
  autoServicePosture,
  autoServiceMarketing,
  shouldRush,
  loadServiceManagerConfig,
} from './game/ServiceDispatch';

type ManagerGates = ReturnType<typeof loadTunables>['managerGates'];

export interface ServiceDepartmentDeps {
  bus: EventBus;
  masterSeed: number;
  economy: Economy;
  staffOrg: StaffOrg;
  tierManager: TierManager;
  departmentQueue: DepartmentQueue;
  reputation: Reputation;
  weather: Weather;
  /** `loadTunables().managerGates` — the shared manager act-threshold table. */
  managerGates: ManagerGates;
}

/**
 * The Service package surface the composition root spreads onto `World`. The
 * five Service modules keep their own public surfaces and tests; this is the
 * bundle that wires them to the shared line.
 */
export interface ServiceDepartment {
  installedBase: InstalledBase;
  partsInventory: PartsInventory;
  serviceDemand: ServiceDemand;
  serviceInsights: ServiceInsights;
  serviceMarketing: ServiceMarketing;
  serviceQueue: ServiceQueue;
  serviceReadModel: ServiceReadModel;
  getServicePricingPosture(): number;
  setServicePricingPosture(value: number): void;
  /**
   * Build the per-day Service floor drain (the locked #99 `drain` seam). Called
   * once per FloorSim day inside `floorSeams`; reads `tierManager` live so a
   * mid-game tier-up applies the next day.
   */
  createFloorDrain(): DeptDrain;
}

export function createServiceDepartment(
  deps: ServiceDepartmentDeps,
): ServiceDepartment {
  const {
    bus,
    masterSeed,
    economy,
    staffOrg,
    tierManager,
    departmentQueue,
    reputation,
    weather,
    managerGates,
  } = deps;

  const reputation01 = () =>
    Math.max(0, Math.min(1, reputation.reviewScore / 100));

  // #305/#306 service pricing posture — the single competitive↔premium dial
  // [0,1] (0 = competitive labor + markup, 1 = premium). A stored player setting,
  // neutral by default; the dial UI + persistence are a later slice. Declared
  // before InstalledBase so the feedback loop's gouging gate (#306) can read it
  // live; the drain reads the same value for its revenue dial.
  let servicePricingPosture = 0.5;

  // ServiceMarketing (#307): the two service-marketing arms, distinct from sales
  // advertising. RETENTION feeds InstalledBase's return roll; CONQUEST feeds
  // ServiceDemand's volume + mix skew. Each active arm debits its daily cost from
  // Economy on clock:day_started. Declared before InstalledBase + ServiceDemand
  // so their influence reads bind live. Adds no RNG.
  const serviceMarketing = createServiceMarketing({ economy });
  bus.subscribe('clock:day_started', ({ day }) => {
    serviceMarketing.advanceDay(day);
  });

  const installedBase = createInstalledBase({
    bus,
    config: loadInstalledBaseConfig(),
    masterSeed,
    reputation: reputation01,
    // #306 a premium posture turns served jobs into "gouging" — owners shop
    // around (loyalty/CSI drop, Reputation dings).
    getPricingPosture: () => servicePricingPosture,
    // #307 retention-arm lift raises the return roll's convenience term.
    getRetentionLift: () => serviceMarketing.retentionLift(),
  });

  // PartsInventory (#299/#301): the supply-side half of the Service profit
  // center. Stock-in debits cash now, a unit is recouped only when a matching
  // job consumes it. #301 adds par-level procurement: each morning it receives
  // due orders and runs its reorder sweep, driven off clock:day_started.
  const partsInventory = createPartsInventory({
    economy,
    config: loadPartsInventoryConfig(),
    masterSeed,
  });
  bus.subscribe('clock:day_started', ({ day }) => {
    partsInventory.advanceDay(day);
  });
  // #304 the rush emergency-order unlock tier (operation-maturity gate); the
  // drain's per-day isRushUnlocked predicate closes over it.
  const serviceDispatchConfig = loadServiceDispatchConfig();

  // #305 live service capacity read-model (waiting / in-progress / avg-wait /
  // utilization) for the Service page + floor card. Long-lived; each per-day
  // service drain writes the live snapshot into this same instance.
  const serviceReadModel = createServiceReadModel();

  // ServiceDemand (#302): the pure mix composer — the package's demand SPINE.
  // On each installedBase:returns_ready it folds returning owners in as the
  // primary stream, adds a conquest floor of fresh walk-ins (scaled by
  // reputation × service marketing), composes the job/parts category mix, and
  // publishes serviceDemand:intake_ready. Built AFTER InstalledBase + Weather
  // (its upstream providers). ServiceQueue gates this stream by tier and
  // re-publishes it as service:intake_ready (#303).
  const serviceDemand: ServiceDemand = createServiceDemand({
    bus,
    masterSeed,
    reputation: reputation01,
    // #307 conquest-arm reads: volume scaler + category-targeted mix skew.
    serviceMarketing: () => serviceMarketing.conquestVolumeInfluence(),
    conquestBias: () => serviceMarketing.conquestBias(),
    season: (day) => weather.weatherForDay(day).season,
    baseOwners: () => installedBase.getOwners(),
  });

  // ServiceInsights (#308): the trailing-window read-model behind the Service
  // page. Listens to the enriched intake (per-category demand heat) plus the
  // installed-base return/defection stream (base health). Built AFTER
  // ServiceDemand + InstalledBase. Emits nothing.
  const serviceInsights = createServiceInsights({ bus, installedBase });

  // ServiceManager automation (#310, generalized through DepartmentLine in #311):
  // the skill-gated ladder that hands the standing Service decisions over to the
  // on-staff service manager. The gates live HERE at the composition boundary so
  // the Service modules stay decoupled from StaffOrg — exactly as the channel-desk
  // UCM gates do. As the SM's `shop_throughput` clears each function's threshold
  // (a ladder), the SM takes over the decision the player otherwise ran by hand.
  // Below a gate (or no SM) the player keeps manual control — no behavior change.
  const serviceManagerGates = managerGates.serviceManager.actThresholds;
  const serviceManagerConfig = loadServiceManagerConfig();
  // Top on-staff SM `shop_throughput` (null = no service manager). Read live; the
  // effective skill is constant within an open day (channel-desk M7).
  const topServiceManagerSkill = (): number | null => {
    const skills = staffOrg.currentRoster
      .filter((s) => s.role_id === 'service-manager')
      .map((s) => s.effectiveSkills['shop_throughput'] ?? 0);
    return skills.length === 0 ? null : Math.max(...skills);
  };
  const serviceFnAutomated = (
    fn: keyof typeof serviceManagerGates,
  ): boolean =>
    isServiceFunctionAutomated(topServiceManagerSkill(), serviceManagerGates[fn]);

  // Standing setpoints applied each morning through the shared DepartmentLine
  // ladder. par/posture/marketing are constant within the day (the SM skill +
  // the readouts are replay-deterministic) ⇒ a fixed seed replays byte-identically
  // (#122). PartsInventory subscribes its own reorder sweep to clock:day_started
  // ABOVE, so a re-tuned par takes effect on the NEXT morning's sweep — an
  // intentional one-day lag, not a same-day race.
  createDepartmentManagerAutomation({
    bus,
    topManagerSkill: topServiceManagerSkill,
    isAutomated: isServiceFunctionAutomated,
    functions: [
      {
        threshold: serviceManagerGates.par,
        apply: () => {
          const setpoints = autoServicePar(
            serviceInsights
              .getDemandHeat()
              .map((h) => ({ category: h.category, demand: h.count })),
            { config: serviceManagerConfig },
          );
          for (const sp of setpoints) {
            partsInventory.setPolicy(sp.category as PartCategory, {
              reorderPoint: sp.reorderPoint,
              target: sp.target,
            });
          }
        },
      },
      {
        threshold: serviceManagerGates.pricing,
        apply: () => {
          servicePricingPosture = autoServicePosture(reputation01(), {
            config: serviceManagerConfig,
          });
        },
      },
      {
        threshold: serviceManagerGates.marketing,
        apply: () => {
          const health = serviceInsights.getBaseHealth();
          const coverage = serviceInsights.getDemandHeat().map((h) => ({
            category: h.category,
            demand: h.count,
            onHand: partsInventory.getStock(h.category as PartCategory),
          }));
          // The SM enables the first available retention campaign when churn
          // pressure is high (catalog hand-ordered cheapest/lightest first; the
          // S14 pass can switch this to a base-health-scaled pick).
          const retentionCampaignId =
            serviceMarketing.retentionCampaigns[0]?.id ?? 'none';
          const decision = autoServiceMarketing(
            { health, coverage, retentionCampaignId },
            { config: serviceManagerConfig },
          );
          serviceMarketing.setRetentionCampaign(decision.retentionId);
          serviceMarketing.setConquestSpecial(
            decision.conquestCategory as Parameters<
              typeof serviceMarketing.setConquestSpecial
            >[0],
          );
        },
      },
    ],
  });

  // ServiceQueue (#80, rewired #303): the Tier-2 gate on the Service intake.
  // Starts silent (default initialTier=1 < minTierRequired 2), follows
  // career:tier_up off the bus, and once at Tier 2 re-publishes ServiceDemand's
  // serviceDemand:intake_ready as a daily service:intake_ready that
  // DepartmentQueue pushes into the Service lane.
  const serviceQueue = createServiceQueue({ bus });

  return {
    installedBase,
    partsInventory,
    serviceDemand,
    serviceInsights,
    serviceMarketing,
    serviceQueue,
    serviceReadModel,
    getServicePricingPosture: () => servicePricingPosture,
    setServicePricingPosture: (v: number) => {
      servicePricingPosture = v < 0 ? 0 : v > 1 ? 1 : v;
    },
    createFloorDrain: (): DeptDrain =>
      createServiceFloorDrain({
        bus,
        staffOrg,
        queue: departmentQueue,
        economy,
        masterSeed,
        // #304 parts gate: a completed service job consumes one matching-category
        // PartsInventory unit; an under-stock miss rush-orders (once the rush tier
        // is unlocked at rushUnlockTier) or is a flat miss (lost revenue + CSI
        // hit). rushUnlockTier is the operation-maturity gate (PRD #297).
        partsInventory,
        // #310: once the rush function is automated, the service manager makes the
        // rush-vs-walk call instead of the blunt tier gate — it enables rush
        // regardless of tier (the SM IS the operational maturity the tier gate
        // stood in for). Once the capacity function is also automated the call
        // becomes capacity-aware: rush only while the shop has slack (live
        // utilization below the ceiling), else walk rather than overcommit a
        // slammed floor. Read per-miss; the SM skill is constant within the day
        // and the read-model is replay-deterministic ⇒ #122-safe. Below the rush
        // gate (or no SM) the original tier gate stands unchanged.
        isRushUnlocked: () => {
          if (serviceFnAutomated('rush')) {
            return shouldRush(
              {
                utilization: serviceReadModel.read().utilization,
                capacityAware: serviceFnAutomated('capacity'),
              },
              { config: serviceManagerConfig },
            );
          }
          return tierManager.currentTier >= serviceDispatchConfig.rushUnlockTier;
        },
        // #305 capacity + posture + read-model. facilityTier snapshots the current
        // tier (this seam is rebuilt per-day, so a tier-up applies the next day);
        // bays scale off it. getPricingPosture reads the live dial. The drain
        // writes the capacity read-model every tick.
        facilityTier: tierManager.currentTier,
        getPricingPosture: () => servicePricingPosture,
        readModel: serviceReadModel,
      }),
  };
}

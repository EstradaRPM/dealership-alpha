/**
 * Body Shop department package (#314, parent #297) — composition layer.
 *
 * The Tier-3 mirror of the Service package (`src/serviceDepartment.ts`): the
 * labeled "Body Shop package" that plugs into the shared department assembly line
 * (`docs/planning/shared-department-structure.md`, LOCKED 2026-06-23) at the same
 * narrow seam. It bundles `CollisionStream` (the demand spine), `BodyShopQueue`
 * (the Tier-3 gate), and the Body-Shop floor drain built on the **shared
 * department-dispatch engine** (`createDeptFloorDrain` — the same advisor pick /
 * parts gate / min(bays,advisors) capacity / read-model machinery Service uses),
 * driven by a Body-Shop `DeptDispatchProfile`.
 *
 * What differs from Service is exactly the demand spine and its satellites:
 *  - Demand: `CollisionStream` — a weather-spiked stochastic collision shock,
 *    conquest-dominant, split across insurance/retail channels.
 *  - Pricing: the insurance/retail **channel posture** (NOT Service's
 *    competitive↔premium dial). Insurance (DRP) jobs are rate-capped (the insurer
 *    sets the rate — CollisionStream already capped baseRevenue below book), retail
 *    (customer-pay) jobs are player-priced (posture lerps the markup).
 *
 * The shared parts room (`PartsInventory`, keyed across all 8 categories) is
 * injected, not created here — the Body Shop activates its four collision
 * categories (windows/glass, doors/panels, interior trim, paint) of the same
 * instance Service uses.
 *
 * Manager automation (#316) is wired here at the composition boundary, mirroring
 * the service-manager ladder (#310) through the shared `DepartmentLine` gate-and-
 * apply pattern: as the on-staff body-shop manager's `shop_throughput` clears each
 * function's gate, the manager takes over par tuning, the channel posture (the
 * unified pricing+marketing lever), and the capacity-aware rush-vs-walk call. The
 * pure decision engine lives in `src/bodyShopManager.ts`.
 */
import type { EventBus } from './game/EventBus';
import type { Economy } from './game/Economy';
import type { StaffOrg } from './game/StaffOrg';
import type { DepartmentQueue } from './game/DepartmentQueue';
import type { Reputation } from './game/Reputation';
import type { Weather } from './game/Weather';
import type { TierManager } from './game/CareerProgression';
import type { DeptDrain } from './game/FloorSim';
import type { PartsInventory, PartCategory } from './game/PartsInventory';
import { loadTunables } from './game/data';
import { createDepartmentManagerAutomation } from './game/DepartmentLine';
import {
  createCollisionStream,
  type CollisionStream,
} from './game/CollisionStream';
import {
  createBodyShopQueue,
  type BodyShopQueue,
} from './game/BodyShopQueue';
import {
  createBodyShopInsights,
  type BodyShopInsights,
} from './game/BodyShopInsights';
import {
  createDeptFloorDrain,
  createDeptReadModel,
  type DeptDispatchProfile,
  type DeptIntakeItem,
  type DeptReadModel,
  type DeptReadModelWriter,
} from './game/ServiceDispatch';
import {
  loadBodyShopDispatchConfig,
  type BodyShopDispatchConfig,
} from './bodyShopDispatchConfig';
import {
  isBodyShopFunctionAutomated,
  autoBodyShopPar,
  autoBodyShopChannelPosture,
  shouldRushBodyShop,
} from './bodyShopManager';
import { loadBodyShopManagerConfig } from './bodyShopManagerConfig';

type ManagerGates = ReturnType<typeof loadTunables>['managerGates'];

export interface BodyShopDepartmentDeps {
  bus: EventBus;
  masterSeed: number;
  economy: Economy;
  staffOrg: StaffOrg;
  tierManager: TierManager;
  departmentQueue: DepartmentQueue;
  reputation: Reputation;
  weather: Weather;
  /** The shared parts room (the same instance Service uses) — the Body Shop
   *  activates its four collision categories of it. */
  partsInventory: PartsInventory;
  /** `loadTunables().managerGates` — the shared manager act-threshold table
   *  (#316 reads `managerGates.bodyShopManager.actThresholds`). */
  managerGates: ManagerGates;
  /** Dispatch tunables override — production omits it (loads from data); tests
   *  inject a deterministic config (e.g. always-resolve). Mirrors how the shared
   *  engine accepts an explicit config. */
  config?: BodyShopDispatchConfig;
}

/** The Body Shop package surface the composition root spreads onto `World`. */
export interface BodyShopDepartment {
  collisionStream: CollisionStream;
  bodyShopQueue: BodyShopQueue;
  bodyShopReadModel: DeptReadModel;
  /** Trailing-window read-model backing the Body Shop page (#315): per-collision-
   *  category demand heat + conquest-flow/channel-mix health. */
  bodyShopInsights: BodyShopInsights;
  getBodyShopChannelPosture(): number;
  setBodyShopChannelPosture(value: number): void;
  /** Build the per-day Body-Shop floor drain (the locked #99 `drain` seam).
   *  Called once per FloorSim day; reads `tierManager` live so a mid-game tier-up
   *  applies the next day. */
  createFloorDrain(): DeptDrain;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

export function createBodyShopDepartment(
  deps: BodyShopDepartmentDeps,
): BodyShopDepartment {
  const {
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
  } = deps;

  const reputation01 = () => clamp01(reputation.reviewScore / 100);

  // The single Body-Shop pricing/marketing lever: the insurance↔retail channel
  // posture [0,1] (0 = full insurance-DRP lean, 1 = full retail). A stored player
  // setting, neutral by default; the channel-control UI + dial are a later slice
  // (#316/#317). It feeds BOTH CollisionStream's demand mix (lean retail → more
  // lumpy, fatter customer-pay jobs) AND the per-ticket pricing read (retail jobs
  // are player-priced; insurance is rate-capped). One coherent "lean into retail"
  // lever — the locked Body-Shop satellite, not two conflated mechanics.
  let channelPosture = 0.5;

  const bodyShopDispatchConfig: BodyShopDispatchConfig =
    deps.config ?? loadBodyShopDispatchConfig();

  // CollisionStream (#313): the demand SPINE. Weather/reputation/posture/base are
  // injected as live reads so the stream stays decoupled from those modules. The
  // small installed-base tie is left at the default 0 — Body Shop is
  // conquest-dominant, with only a weak base relationship (the InstalledBase tie
  // is a future calibration concern; CollisionStream caps it small regardless).
  const collisionStream = createCollisionStream({
    bus,
    masterSeed,
    weather: (day) => {
      const w = weather.weatherForDay(day);
      return { conditionId: w.conditionId, season: w.season };
    },
    reputation: reputation01,
    posture: () => channelPosture,
  });

  // BodyShopQueue (#312): the Tier-3 gate. Starts silent (default initialTier=1 <
  // minTierRequired 3), follows career:tier_up off the bus, and once at Tier 3
  // re-publishes CollisionStream's bodyshop:demand_ready as a daily
  // bodyshop:intake_ready that DepartmentQueue pushes into the Body-Shop lane.
  const bodyShopQueue = createBodyShopQueue({ bus });

  // Live Body-Shop capacity read-model (waiting / in-progress / avg-wait /
  // utilization) for the Body-Shop page + floor card. Long-lived; each per-day
  // drain writes the live snapshot into this same instance.
  const bodyShopReadModel: DeptReadModelWriter = createDeptReadModel();

  // BodyShopInsights (#315): the trailing-window read-model backing the Body Shop
  // page. Subscribes to bodyshop:intake_ready (the Tier-3-gated stream), so it is
  // naturally dark below Tier 3. The conquest-dominant analog of ServiceInsights
  // — no installed-base annuity; reuses the shared heat/trend helpers.
  const bodyShopInsights = createBodyShopInsights({ bus });

  // Body-shop-manager automation (#316, parent #297): the Tier-3 mirror of the
  // service-manager ladder (#310), expressed through the shared `DepartmentLine`
  // gate-and-apply pattern. The gates live HERE at the composition boundary so the
  // Body-Shop modules stay decoupled from StaffOrg — exactly as the service-manager
  // gates do. As the on-staff manager's `shop_throughput` clears each function's
  // threshold (a ladder), the manager takes over the decision the player otherwise
  // ran by hand. Below a gate (or no manager) the player keeps manual control — no
  // behavior change.
  //
  // The Body Shop has ONE pricing/marketing lever — the insurance↔retail `channel`
  // posture (the locked satellite table's "channel choice — no separate mailer
  // arms") — so the `channel` rung IS the unified pricing+marketing automation;
  // there is no separate marketing rung to mirror Service's retention/conquest
  // arms.
  const bodyShopManagerGates = managerGates.bodyShopManager.actThresholds;
  const bodyShopManagerConfig = loadBodyShopManagerConfig();
  // Top on-staff body-shop-manager `shop_throughput` (null = none on staff). Read
  // live; the effective skill is constant within an open day (channel-desk M7).
  const topBodyShopManagerSkill = (): number | null => {
    const skills = staffOrg.currentRoster
      .filter((s) => s.role_id === 'body-shop-manager')
      .map((s) => s.effectiveSkills['shop_throughput'] ?? 0);
    return skills.length === 0 ? null : Math.max(...skills);
  };
  const bodyShopFnAutomated = (
    fn: keyof typeof bodyShopManagerGates,
  ): boolean =>
    isBodyShopFunctionAutomated(
      topBodyShopManagerSkill(),
      bodyShopManagerGates[fn],
    );

  // Standing setpoints applied each morning through the shared DepartmentLine
  // ladder. par/channel are constant within the day (the manager skill + readouts
  // are replay-deterministic) ⇒ a fixed seed replays byte-identically (#122/#317).
  // PartsInventory subscribes its own reorder sweep to clock:day_started inside the
  // Service package (built BEFORE this one in createWorld), so a re-tuned par takes
  // effect on the NEXT morning's sweep — the same one-day lag Service has, not a
  // same-day race.
  createDepartmentManagerAutomation({
    bus,
    topManagerSkill: topBodyShopManagerSkill,
    isAutomated: isBodyShopFunctionAutomated,
    functions: [
      {
        threshold: bodyShopManagerGates.par,
        apply: () => {
          const setpoints = autoBodyShopPar(
            bodyShopInsights
              .getDemandHeat()
              .map((h) => ({ category: h.category, demand: h.count })),
            { config: bodyShopManagerConfig },
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
        threshold: bodyShopManagerGates.channel,
        apply: () => {
          channelPosture = autoBodyShopChannelPosture(reputation01(), {
            config: bodyShopManagerConfig,
          });
        },
      },
    ],
  });

  // The Body-Shop dispatch profile — everything department-specific the shared
  // engine needs. Pricing is the channel posture: insurance rate-capped, retail
  // player-priced.
  const profile: DeptDispatchProfile = {
    advisorRole: 'body-shop-advisor',
    queueDept: 'bodyshop',
    rngKey: 'bodyshop_dispatch',
    rngSeedInput: (itemId, day) => ({ bodyShopItemId: itemId, day }),
    priceTicket: (item: DeptIntakeItem) => {
      if (item.source === 'insurance') {
        // Rate-capped: the insurer sets the rate; the player can't mark it up.
        // CollisionStream already capped baseRevenue below book.
        return Math.round(item.baseRevenue * bodyShopDispatchConfig.insuranceRateMultiplier);
      }
      // Retail (customer-pay): player-priced. The channel posture lerps the markup
      // from the conservative floor to the aggressive ceiling.
      return Math.round(
        item.baseRevenue *
          lerp(
            bodyShopDispatchConfig.retailFloorMultiplier,
            bodyShopDispatchConfig.retailCeilMultiplier,
            channelPosture,
          ),
      );
    },
    revenueLabel: (item, rush) =>
      rush ? `Body Shop (rush) — ${item.label}` : `Body Shop — ${item.label}`,
    subscribeIntake: (b, enqueue) => {
      b.subscribe('bodyshop:intake_ready', ({ day, items }) => {
        for (const item of items) {
          enqueue(
            {
              itemId: item.bodyShopItemId,
              label: item.label,
              baseRevenue: item.baseRevenue,
              jobCategory: item.jobCategory,
              customerId: item.customerId,
              vehicleId: item.vehicleId,
              source: item.source,
            },
            day,
          );
        }
      });
    },
    fromQueuedItem: (item) => {
      if (item.dept !== 'bodyshop' || item.type !== 'routine') return null;
      return {
        item: {
          itemId: item.id,
          label: item.label,
          baseRevenue: item.baseRevenue ?? 0,
          // A legacy snapshot without jobCategory falls back to the first
          // collision category so the parts gate still consumes deterministically.
          jobCategory: (item.jobCategory ?? 'windows_glass') as PartCategory,
          customerId: item.customerId ?? '',
          vehicleId: item.vehicleId ?? '',
          source: item.source,
        },
        day: item.createdDay,
      };
    },
    emit: {
      ticketClosed: (p) =>
        bus.publish('bodyshop:ticket_closed', {
          bodyShopItemId: p.itemId,
          day: p.day,
          revenue: p.revenue,
          advisorId: p.advisorId,
        }),
      partsConsumed: (p) =>
        bus.publish('bodyshop:parts_consumed', {
          bodyShopItemId: p.itemId,
          day: p.day,
          jobCategory: p.jobCategory as
            | 'windows_glass'
            | 'doors_panels'
            | 'interior_trim'
            | 'paint',
          advisorId: p.advisorId,
        }),
      jobMissed: (p) =>
        bus.publish('bodyshop:job_missed', {
          bodyShopItemId: p.itemId,
          day: p.day,
          customerId: p.customerId,
          vehicleId: p.vehicleId,
          jobCategory: p.jobCategory as
            | 'windows_glass'
            | 'doors_panels'
            | 'interior_trim'
            | 'paint',
          lostRevenue: p.lostRevenue,
          csiHit: p.csiHit,
          advisorId: p.advisorId,
        }),
      jobRushed: (p) =>
        bus.publish('bodyshop:job_rushed', {
          bodyShopItemId: p.itemId,
          day: p.day,
          customerId: p.customerId,
          vehicleId: p.vehicleId,
          jobCategory: p.jobCategory as
            | 'windows_glass'
            | 'doors_panels'
            | 'interior_trim'
            | 'paint',
          revenue: p.revenue,
          advisorId: p.advisorId,
        }),
      jobUnserved: (p) =>
        bus.publish('bodyshop:job_unserved', {
          bodyShopItemId: p.itemId,
          day: p.day,
          customerId: p.customerId,
          vehicleId: p.vehicleId,
          jobCategory: p.jobCategory as
            | 'windows_glass'
            | 'doors_panels'
            | 'interior_trim'
            | 'paint',
          lostRevenue: p.lostRevenue,
          csiHit: p.csiHit,
          waitTicks: p.waitTicks,
        }),
    },
  };

  return {
    collisionStream,
    bodyShopQueue,
    bodyShopReadModel,
    bodyShopInsights,
    getBodyShopChannelPosture: () => channelPosture,
    setBodyShopChannelPosture: (v: number) => {
      channelPosture = clamp01(v);
    },
    createFloorDrain: (): DeptDrain =>
      createDeptFloorDrain({
        bus,
        staffOrg,
        queue: departmentQueue,
        economy,
        masterSeed,
        config: bodyShopDispatchConfig,
        // #314 parts gate over the Body-Shop collision categories of the shared
        // parts room. A completed collision job consumes one matching-category
        // unit; an under-stock miss rush-orders (once unlocked) or is a flat miss.
        partsInventory,
        // #316: once the rush function is automated, the body-shop manager makes
        // the rush-vs-walk call instead of the blunt tier gate — it enables rush
        // regardless of tier (the manager IS the operational maturity the tier gate
        // stood in for). Once the capacity function is also automated the call
        // becomes capacity-aware: rush only while the shop has slack (live
        // utilization below the ceiling), else walk rather than overcommit a
        // slammed floor. Read per-miss; the manager skill is constant within the
        // day and the read-model is replay-deterministic ⇒ #122/#317-safe. Below
        // the rush gate (or no manager) the original tier gate stands unchanged.
        isRushUnlocked: () => {
          if (bodyShopFnAutomated('rush')) {
            return shouldRushBodyShop(
              {
                utilization: bodyShopReadModel.read().utilization,
                capacityAware: bodyShopFnAutomated('capacity'),
              },
              { config: bodyShopManagerConfig },
            );
          }
          return tierManager.currentTier >= bodyShopDispatchConfig.rushUnlockTier;
        },
        // Bays scale off the current tier (snapshotted per-day, so a tier-up
        // applies the next day). The drain writes the read-model every tick.
        facilityTier: tierManager.currentTier,
        readModel: bodyShopReadModel,
        profile,
      }),
  };
}

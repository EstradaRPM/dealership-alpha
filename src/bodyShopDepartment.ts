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
 * Manager automation, the Body-Shop page, the floor card, and the channel-control
 * surface are later slices (#315–#317); this slice is the operations LOGIC
 * wire-up only.
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
import {
  createCollisionStream,
  type CollisionStream,
} from './game/CollisionStream';
import {
  createBodyShopQueue,
  type BodyShopQueue,
} from './game/BodyShopQueue';
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
        // Rush unlocks at the body-shop rush tier (the operation-maturity gate,
        // mirroring Service). No manager automation in this slice. Read per-miss so
        // a mid-game tier-up flips it live.
        isRushUnlocked: () =>
          tierManager.currentTier >= bodyShopDispatchConfig.rushUnlockTier,
        // Bays scale off the current tier (snapshotted per-day, so a tier-up
        // applies the next day). The drain writes the read-model every tick.
        facilityTier: tierManager.currentTier,
        readModel: bodyShopReadModel,
        profile,
      }),
  };
}

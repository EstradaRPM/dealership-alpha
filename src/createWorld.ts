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
import { createStaffOrg, type StaffOrg } from './game/StaffOrg';
import { createCapacityManager } from './game/CapacityManager';
import type { CapacityManager } from './game/CapacityManager';
import { createStaffFloorDrain } from './game/StaffDispatch';
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
} from './game/NPC';
import { createFollowUpPool, type FollowUpPool } from './game/FollowUpPool';
import {
  createTierManager,
  type TierManager,
  type CharacterProfile,
} from './game/CareerProgression';
import { createEndCardManager, type EndCardManager } from './game/EndCard';
import { createReputation, type Reputation } from './game/Reputation';
import { createServiceQueue, type ServiceQueue } from './game/ServiceQueue';
import { createTelemetry, type Telemetry } from './game/Telemetry';
import { createKPIDashboard, type KPIDashboard } from './game/KPIDashboard';

export type StaffTaxonomy = ReturnType<typeof loadStaffTaxonomy>;

export interface World {
  masterSeed: number;
  clock: GameClock;
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
  serviceQueue: ServiceQueue;
  tierManager: TierManager;
  endCardManager: EndCardManager;
  telemetry: Telemetry;
  kpiDashboard: KPIDashboard;
  dayLoop: DayLoopController;
  staffTaxonomy: StaffTaxonomy;
}

/**
 * A fresh random root seed for a brand-new game. 32-bit unsigned: the RNG /
 * deriveSeed design (out of #96 scope) already namespaces and per-keys every
 * draw off this single root, so variability here is sufficient.
 */
export function makeSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

export function createWorld(deps: {
  bus: EventBus;
  masterSeed: number;
  characterProfile: CharacterProfile;
}): World {
  const { bus, masterSeed, characterProfile } = deps;

  // Default initialDay = 1: the clock sits on "night before Day 1" so the
  // DayLoopController cold-start (skip-advance on the first nextDay) plays
  // Day 1 rather than skipping it.
  const clock = createGameClock({ bus });
  const departmentQueue = createDepartmentQueue({ bus });
  // Legacy live-day arrival path OFF: FloorSim owns arrivals via the injected
  // customer-source seam below.
  const economy = createEconomy({ bus, startingCash: 50_000 });
  const inventory = createInventory({ bus, masterSeed, economy });
  const dealEngine = createDealEngine({ bus, inventory, economy });
  // CustomerPool gets the DealEngine + inventory + tier-catalog wiring (#146)
  // so dispatch(CLOSE) routes real closes through DealEngine.closeDeal — the
  // canonical deal:closed (with the five deal-structuring fields) fires
  // instead of synthesizing a SalesProcess emit against a stub vehicle.
  const customerPool = createCustomerPool({
    bus,
    legacyDailyArrivals: false,
    npcDeps: {
      masterSeed,
      personArchetypes: loadPersonArchetypes(),
      visitArchetypes: loadVisitArchetypes(),
      traits: loadTraitTaxonomy(),
    },
    dealEngine,
    inventory,
    creditTiers: loadCreditTiers(),
  });
  const staffTaxonomy = loadStaffTaxonomy();
  // Reputation + TierManager are created ahead of StaffOrg so the hiring
  // headcount cap (#131) can read the live dealership tier. Reputation drifts
  // overnight and takes deal/walk hits via the bus; TierManager evaluates
  // tier-up on the payroll-night cadence.
  const reputation = createReputation({ bus, economy });
  const tierManager = createTierManager({ bus, economy, reputation });
  const staffOrg = createStaffOrg({
    bus,
    economy,
    masterSeed,
    taxonomy: staffTaxonomy,
    archetypes: loadStaffArchetypes(),
    getTier: () => tierManager.currentTier,
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
  // Month-close hook (#123): the KPIDashboard supplies the month-to-date
  // snapshot the interstitial composes.
  const kpiDashboard = createKPIDashboard({ bus, staffOrg });

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
  const customerSource: CustomerSource = {
    spawn({ day, tick, count }): readonly CustomerRef[] {
      const refs: CustomerRef[] = [];
      for (let i = 0; i < count; i++) {
        const a = SALES_ARCHETYPES[(day + tick + i) % SALES_ARCHETYPES.length];
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

  // Per-day FloorSim seam set: CapacityManager / StaffDispatch / CustomerPool
  // behind the locked #99 seams. Invoked once per day → fresh per-day
  // instances.
  const floorSeams: FloorSeamProvider = () => ({
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
        getCustomerSession: (id) => {
          const s = customerPool.getSession(id);
          return s
            ? { bundle: s.bundle, visitArchetypeId: s.visitArchetypeId }
            : undefined;
        },
        // GM-presence seam (#124): a staffed GM suppresses dramatic-case
        // escalations (gmExceptionFlagRates), so StaffDispatch returns
        // escalated:0 and the GM-gated batch sim-week can run unattended.
        getHasGm: () => staffOrg.currentRoster.some(s => s.role_id === 'gm'),
      }),
    ],
    customerSource,
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
      return {
        ...slip,
        reputation: Math.min(1, Math.max(0, reputation.reviewScore / 100)),
        pricing: {
          ...slip.pricing,
          trafficMultiplier: computeDemandFactor(
            inventory.getLotVehicles(),
            demandModelCfg,
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
    serviceQueue,
    tierManager,
    endCardManager,
    telemetry,
    kpiDashboard,
    dayLoop,
    staffTaxonomy,
  };
}

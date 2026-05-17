import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createSaveStore, createSqliteDriver } from './src/game/SaveStore';
import { createEventBus } from './src/game/EventBus';
import { createGameClock } from './src/game/GameClock';
import { createDepartmentQueue } from './src/game/DepartmentQueue';
import {
  createCustomerPool,
  SALES_ARCHETYPES,
} from './src/game/CustomerPool';
import { createDealEngine } from './src/game/DealEngine';
import { createEconomy } from './src/game/Economy';
import { createInventory } from './src/game/Inventory';
import { createStaffOrg } from './src/game/StaffOrg';
import { createCapacityManager } from './src/game/CapacityManager';
import { createStaffFloorDrain } from './src/game/StaffDispatch';
import {
  createDayLoopController,
  type FloorSeamProvider,
} from './src/game/DayLoopController';
import type {
  CustomerSource,
  CustomerRef,
  HandPlaySession,
  AdvanceResult,
} from './src/game/FloorSim';
import { loadTunables } from './src/game/data';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
  loadStaffTaxonomy,
  loadStaffArchetypes,
} from './src/game/NPC';
import { CharacterCreation } from './src/ui/CharacterCreation';
import { DayLoopShell } from './src/ui/DayLoopShell';
import type { DayRecapModel } from './src/ui/DayRecap';
import type {
  FloorDashboardModel,
  FloorEvent,
} from './src/ui/FloorDashboard';
import { HandPlayModal, type HandPlayOutcome } from './src/ui/HandPlayModal';
import { AuctionMenu } from './src/ui/AuctionMenu';
import type { CharacterProfile } from './src/game/CareerProgression';
import type { SaveStore } from './src/game/SaveStore';
import type { LotVehicle } from './src/game/Inventory';
import { AdminConsole } from './src/ui/AdminConsole';
import { createTelemetry } from './src/game/Telemetry';

const MASTER_SEED = 42;

// Hand-play modal default (#118): sourced from a tunable, never a magic
// number. false ⇒ opening the modal auto-pauses the day; true ⇒ the day
// keeps running live behind it (the #74/#105 felt-pacing comparison path).
const HAND_PLAY_LIVE = loadTunables().handPlay.playtestLiveDefault;

// ── Composition root (#114) ──────────────────────────────────────────────────
// Game modules created once at module level, outside React lifecycle.
const saveStore: SaveStore = createSaveStore(createSqliteDriver());
const bus = createEventBus();
// Default initialDay = 1: the clock sits on "night before Day 1" so the
// DayLoopController cold-start (skip-advance on the first nextDay) plays Day 1
// rather than skipping it.
const clock = createGameClock({ bus });
const departmentQueue = createDepartmentQueue({ bus });
// Legacy live-day arrival path OFF: FloorSim owns arrivals via the injected
// customer-source seam below.
const customerPool = createCustomerPool({
  bus,
  legacyDailyArrivals: false,
  npcDeps: {
    masterSeed: MASTER_SEED,
    personArchetypes: loadPersonArchetypes(),
    visitArchetypes: loadVisitArchetypes(),
    traits: loadTraitTaxonomy(),
  },
});
const economy = createEconomy({ bus, startingCash: 50_000 });
const inventory = createInventory({ bus, masterSeed: MASTER_SEED, economy });
const dealEngine = createDealEngine({ bus, inventory, economy });
const staffTaxonomy = loadStaffTaxonomy();
const staffOrg = createStaffOrg({
  bus,
  economy,
  masterSeed: MASTER_SEED,
  taxonomy: staffTaxonomy,
  archetypes: loadStaffArchetypes(),
});

// role_id → humanized label + serving department, for the impressionistic
// FLOOR-OPEN staff strip (#117). Pure read mapping off the role catalog.
function humanizeRole(roleId: string): string {
  return roleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
// Legacy aggregate admit gate OFF: the per-tick floor gate is the sole
// admittance path under FloorSim.
const capacityManager = createCapacityManager({
  bus,
  staffOrg,
  facilityTier: 1,
  legacyAdmitGate: false,
});
const telemetry = createTelemetry({ bus });

// CustomerPool behind FloorSim's #99 customer-source seam: FloorSim's own
// arrival RNG decides the admitted count per tick; the adapter only mints
// identities for that count via CustomerPool.
const customerSource: CustomerSource = {
  spawn({ day, tick, count }): readonly CustomerRef[] {
    const refs: CustomerRef[] = [];
    for (let i = 0; i < count; i++) {
      const a = SALES_ARCHETYPES[(day + tick + i) % SALES_ARCHETYPES.length];
      const id = customerPool.spawnCustomer(a.personId, a.visitId, a.label);
      refs.push({ id, source: 'ambient', mustHandle: false, department: 'sales' });
    }
    return refs;
  },
};

// Per-day FloorSim seam set: CapacityManager / StaffDispatch / CustomerPool
// behind the locked #99 seams. Invoked once per day → fresh per-day instances.
const floorSeams: FloorSeamProvider = () => ({
  capacity: capacityManager.createFloorGate(),
  drains: [
    createStaffFloorDrain({
      bus,
      staffOrg,
      queue: departmentQueue,
      economy,
      masterSeed: MASTER_SEED,
    }),
  ],
  customerSource,
});

const dayLoop = createDayLoopController({
  bus,
  seed: MASTER_SEED,
  clock,
  floorSeams,
});

type AppScreen = 'loading' | 'character-creation' | 'game' | 'auction';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [lotVehicles, setLotVehicles] = useState<readonly LotVehicle[]>([]);
  const [cash, setCash] = useState(economy.cash);
  // Running today's gross (front + back) summed from closed deals — the
  // composed-state source for the FLOOR-OPEN HUD / stat grid (#116).
  const [grossToday, setGrossToday] = useState(0);
  // Per-day FLOOR-OPEN event log (#117): walk heartbeats as transient lines,
  // forced exceptions as tappable alert rows. Reset each "Next Day".
  const [floorEvents, setFloorEvents] = useState<readonly FloorEvent[]>([]);
  const eventSeq = useRef(0);
  // Re-render trigger for the headless DayLoopController lifecycle.
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  // Hand-play spotlight (#118). The composition root owns the grabbed
  // FloorSim session; the modal is a thin view that renders the pending gate
  // and dispatches the picked approach back through advance().
  const [handSession, setHandSession] = useState<HandPlaySession | null>(null);
  const [handResult, setHandResult] = useState<AdvanceResult | null>(null);

  // Open the modal on a specific grabbable customer (forced-exception row or
  // a cherry-pick the composition root already selected). When not running
  // live, the day is already idle here (the render loop is #121) — auto-pause
  // is the default and holds until the player resumes.
  const openHandPlay = (customerId: string) => {
    const f = dayLoop.currentFloor();
    if (!f || !f.canGrab()) return;
    setHandSession(f.grab(customerId));
    setHandResult(null);
  };
  const cherryPick = () => {
    const f = dayLoop.currentFloor();
    if (!f || !f.canGrab()) return;
    const next = f.grabbableCustomers()[0];
    if (next) openHandPlay(next.id);
  };
  const chooseApproach = (choiceId: string) => {
    if (!handSession) return;
    // advance() burns handPlay.tickCostPerGate deterministic ticks inside
    // FloorSim regardless of pause state; the clock jumps on resume.
    const r = handSession.advance(choiceId);
    setHandResult(r.status === 'continue' ? null : r);
    bump();
  };
  const closeHandPlay = () => {
    setHandSession(null);
    setHandResult(null);
  };

  useEffect(() => {
    saveStore.load().then((state) => {
      if (state?.character) {
        setProfile(state.character as CharacterProfile);
        setScreen('game');
      } else {
        setScreen('character-creation');
      }
    });
  }, []);

  // Lifecycle + Auction-relevant state stay in sync with the EventBus.
  useEffect(() => {
    const onDayComplete = () => {
      bump();
      setLotVehicles(inventory.getLotVehicles());
      setCash(economy.cash);
    };
    const onVehiclePurchased = () => {
      setLotVehicles(inventory.getLotVehicles());
      setCash(economy.cash);
    };
    const onVehicleSold = () => setLotVehicles(inventory.getLotVehicles());
    const onRevenue = () => setCash(economy.cash);
    const onDealClosed = ({
      frontGross,
      backGross,
    }: {
      frontGross: number;
      backGross: number;
    }) => setGrossToday((g) => g + frontGross + backGross);
    const onWalked = ({ tick }: { day: number; tick: number }) =>
      setFloorEvents((log) => [
        ...log,
        {
          kind: 'walk',
          key: `w${eventSeq.current++}`,
          text: `t${tick} · a customer walked — no capacity`,
        },
      ]);
    const onExceptionRaised = ({
      tick,
      customerId,
      department,
    }: {
      day: number;
      tick: number;
      customerId: string;
      department: string;
    }) =>
      setFloorEvents((log) => [
        ...log,
        {
          kind: 'exception',
          key: `e${eventSeq.current++}`,
          customerId,
          text: `t${tick} · ${department} exception — needs you`,
        },
      ]);

    bus.subscribe('floor:day_complete', onDayComplete);
    bus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    bus.subscribe('deal:closed', onDealClosed);
    bus.subscribe('floor:customer_walked', onWalked);
    bus.subscribe('floor:exception_raised', onExceptionRaised);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
      bus.unsubscribe('deal:closed', onDealClosed);
      bus.unsubscribe('floor:customer_walked', onWalked);
      bus.unsubscribe('floor:exception_raised', onExceptionRaised);
    };
  }, []);

  const handleNextDay = () => {
    // MANAGERIAL → FLOOR_OPEN, then run the live floor to exhaustion. The
    // owned FloorSim emits floor:day_complete, which flips the controller
    // back to MANAGERIAL (handled by its own subscription) and re-renders.
    setGrossToday(0);
    setFloorEvents([]);
    const floor = dayLoop.nextDay();
    floor.runDay();
    bump();
  };

  const handleSaveCleared = () => {
    setProfile(null);
    setScreen('character-creation');
  };

  let content: React.ReactNode = <View style={styles.container} />;

  if (screen === 'character-creation') {
    content = (
      <>
        <StatusBar style="light" />
        <CharacterCreation
          saveStore={saveStore}
          onComplete={(p: CharacterProfile) => {
            setProfile(p);
            setScreen('game');
          }}
        />
      </>
    );
  } else if (screen === 'auction') {
    content = (
      <>
        <StatusBar style="light" />
        <AuctionMenu
          listings={inventory.getAuctionListings()}
          lotVehicles={lotVehicles}
          cash={cash}
          onBuy={(listingId) => inventory.buyFromAuction(listingId)}
          onClose={() => setScreen('game')}
        />
      </>
    );
  } else if (screen === 'game' && profile) {
    const loopState = dayLoop.state();
    const floor = dayLoop.currentFloor();
    const funnel = capacityManager.getDayFunnel();
    const flooredValue = lotVehicles.reduce(
      (sum, v) => sum + v.purchasePrice + v.reconCost,
      0,
    );
    const avgDaysInInventory =
      lotVehicles.length === 0
        ? 0
        : lotVehicles.reduce((sum, v) => sum + v.daysInInventory, 0) /
          lotVehicles.length;
    const floorModel: FloorDashboardModel | undefined = floor
      ? {
          day: loopState.day,
          tick: floor.currentTick,
          ticksPerDay: floor.ticksPerDay,
          cash: economy.cash,
          exceptionPending: floor
            .grabbableCustomers()
            .some((c) => c.source === 'exception' && c.mustHandle),
          ups: funnel.walkedIn,
          sold: funnel.sold,
          walked: funnel.potentialTraffic - funnel.walkedIn,
          pendingWarm: Math.max(0, funnel.walkedIn - funnel.staffEngaged),
          gross: grossToday,
          staff: staffOrg.currentRoster.map((s) => ({
            id: s.id,
            role: humanizeRole(s.role_id),
            department:
              staffTaxonomy.roles[s.role_id]?.department ?? 'unassigned',
          })),
          events: floorEvents,
          inventory: {
            unitsOnLot: lotVehicles.length,
            flooredValue,
            avgDaysInInventory,
          },
        }
      : undefined;
    // Just-ended-day recap (#119). In MANAGERIAL the funnel + running gross
    // still hold the day that just closed (both reset on the next
    // clock:day_started / handleNextDay). Absent on the night before Day 1.
    const recap: DayRecapModel | undefined = loopState.hasRecap
      ? {
          day: loopState.day,
          potentialTraffic: funnel.potentialTraffic,
          walkedIn: funnel.walkedIn,
          staffEngaged: funnel.staffEngaged,
          sold: funnel.sold,
          gross: grossToday,
          leakCause: funnel.leakCause,
        }
      : undefined;
    content = (
      <>
        <StatusBar style="light" />
        <DayLoopShell
          profile={profile}
          state={loopState}
          onNextDay={handleNextDay}
          onOpenAuction={() => setScreen('auction')}
          floorModel={floorModel}
          recap={recap}
          onExceptionPress={openHandPlay}
          onCherryPick={floor && floor.canGrab() ? cherryPick : undefined}
        />
      </>
    );
  } else if (screen !== 'loading') {
    content = (
      <View style={styles.container}>
        <StatusBar style="auto" />
      </View>
    );
  }

  const handOutcome: HandPlayOutcome | null = !handSession
    ? null
    : handResult == null
      ? handSession.currentGate
        ? {
            status: 'continue',
            gate: handSession.currentGate,
            choices: handSession.choices.map((c) => ({
              id: c.id,
              label: c.label,
            })),
          }
        : null
      : handResult.status === 'walk'
        ? { status: 'walk', cause: handResult.outcome.cause }
        : { status: 'closed' };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <SafeAreaView
          style={styles.safeArea}
          edges={['top', 'bottom', 'left', 'right']}
        >
          {content}
        </SafeAreaView>
        <HandPlayModal
          visible={handSession != null}
          customerId={handSession?.customerId ?? null}
          playLive={HAND_PLAY_LIVE}
          outcome={handOutcome}
          onChoose={chooseApproach}
          onClose={closeHandPlay}
        />
        {__DEV__ && (
          <AdminConsole
            bus={bus}
            clock={clock}
            economy={economy}
            inventory={inventory}
            saveStore={saveStore}
            telemetry={telemetry}
            customerPool={customerPool}
            onSaveCleared={handleSaveCleared}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#111',
  },
});

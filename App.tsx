import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
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
import { useFloorRenderLoop } from './src/ui/FloorRenderLoop';
import { AuctionMenu } from './src/ui/AuctionMenu';
import { PersonnelScreen } from './src/ui/PersonnelScreen';
import type { CharacterProfile } from './src/game/CareerProgression';
import type { SaveStore, MidDayCheckpoint } from './src/game/SaveStore';
import type { LotVehicle } from './src/game/Inventory';
import { AdminConsole } from './src/ui/AdminConsole';
import { createTelemetry } from './src/game/Telemetry';
import { createKPIDashboard } from './src/game/KPIDashboard';
import { MonthCloseInterstitial } from './src/ui/MonthCloseInterstitial';
import { useNavigator } from './src/ui/Navigator';
import { BottomNav } from './src/ui/BottomNav';
import { DepartmentScreen } from './src/ui/DepartmentScreen';
import type { DeptKey } from './src/game/DepartmentQueue';

const DEPT_TITLES: Record<DeptKey, string> = {
  sales: 'Sales',
  service: 'Service',
  bdc: 'BDC',
  office: 'Office',
  lot: 'Lot',
};

const MASTER_SEED = 42;

// Hand-play modal default (#118): sourced from a tunable, never a magic
// number. false ⇒ opening the modal auto-pauses the day; true ⇒ the day
// keeps running live behind it (the #74/#105 felt-pacing comparison path).
const HAND_PLAY_LIVE = loadTunables().handPlay.playtestLiveDefault;

// Representative open-hours window for the FLOOR-OPEN HUD clock (#121).
const RENDER_LOOP = loadTunables().renderLoop;

// Hours-of-op lever options (#120). "Wired only": the lever selects an id and
// the composition root holds the scaled ticksPerDay. Feeding it into FloorSim
// is a downstream slice (FloorSim/#99 is locked and reads its own value).
const HOURS_OF_OP = loadTunables().ownership.hoursOfOp;

// Primary customer-facing role the Hiring lever recruits for (v1 slice is
// sales-only; multi-role hiring is downstream).
const HIRING_ROLE_ID = 'salesperson';

// ── Composition root (#114) ──────────────────────────────────────────────────
// Game modules created once at module level, outside React lifecycle.
const saveStore: SaveStore = createSaveStore(createSqliteDriver());
// Mid-day checkpoint cell (#122) — a physically separate sqlite db so the
// in-progress FloorSim checkpoint can never collide with the main save blob
// (the #109 own-cell discipline; per-slot indexing arrives with slot wiring).
const checkpointStore: SaveStore = createSaveStore(
  createSqliteDriver({ databaseName: 'dealership.checkpoint.db' }),
);
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
// skill_id → cap, for the PersonnelScreen skill bars (Hiring lever, #120).
const SKILL_CAPS: Record<string, number> = Object.fromEntries(
  Object.entries(staffTaxonomy.skills).map(([id, s]) => [id, s.cap]),
);
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
// Month-close hook (#123): the KPIDashboard game module supplies the
// month-to-date snapshot the interstitial composes (no new rich content).
const kpiDashboard = createKPIDashboard({ bus, staffOrg });
// Month-close cadence — sourced from the same tunable GameClock uses, never
// a magic number. clock:month_ended fires on endingDay % daysPerMonth === 0.
const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;

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

export default function App() {
  const nav = useNavigator('loading');
  const screen = nav.current.route;
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [lotVehicles, setLotVehicles] = useState<readonly LotVehicle[]>([]);
  const [cash, setCash] = useState(economy.cash);
  // Hours-of-op lever selection (#120). Composition-root state only — the
  // downstream slice wires HOURS_OF_OP.options[…].ticksPerDay into FloorSim.
  const [hoursOfOpId, setHoursOfOpId] = useState(HOURS_OF_OP.defaultId);
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
  // Month-close interstitial (#123): the 1-based month that just closed, or
  // null when none is pending. Set on clock:month_ended, cleared on dismiss —
  // the MANAGERIAL interrupt point between the day-recap and next-day prep.
  const [monthClose, setMonthClose] = useState<number | null>(null);

  // The live clock (#121). Drives the owned FloorSim's step() at a tunable
  // cadence; speed/pause are pure render multipliers (game logic is
  // wall-clock-free). A hand-play modal open in auto-pause mode holds the
  // interval without touching the player's pause state.
  const floorLoop = useFloorRenderLoop({
    floor: dayLoop.currentFloor() ?? null,
    active: dayLoop.state().phase === 'FLOOR_OPEN',
    bus,
    onTick: bump,
    hold: (handSession != null && !HAND_PLAY_LIVE) || monthClose != null,
  });

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
    saveStore.load().then(async (state) => {
      if (state?.character) {
        setProfile(state.character as CharacterProfile);
        nav.reset('game');
        // Mid-day cold-start resume (#122): if a checkpoint exists for the
        // day the clock currently sits on, recreate the FloorSim and replay
        // its action log to land in the byte-exact pre-background state. A
        // stale checkpoint (the clock can't honor it — broader mid-game
        // clock/economy persistence is a later slice) is discarded, never
        // misapplied.
        const raw = await checkpointStore.load();
        const cp = raw as unknown as MidDayCheckpoint | null;
        if (cp && cp.day === clock.currentDay) {
          dayLoop.resume(cp);
          bump();
        } else if (cp) {
          await checkpointStore.clear();
        }
      } else {
        nav.reset('character-creation');
      }
    });
  }, []);

  // Lifecycle + Auction-relevant state stay in sync with the EventBus.
  useEffect(() => {
    const onDayComplete = () => {
      bump();
      setLotVehicles(inventory.getLotVehicles());
      setCash(economy.cash);
      // Day closed → the mid-day checkpoint is obsolete (#122 / #109: caller
      // clears it on day-complete).
      void checkpointStore.clear();
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

    // Month-close hook (#123): clock:month_ended fans out during the Next Day
    // transition (advanceDay) when the ending day completes a month. Latching
    // the interstitial here interrupts at MANAGERIAL — the render loop holds
    // (see useFloorRenderLoop hold) so the new month's floor stays paused
    // behind the screen until the player dismisses it.
    const onMonthEnded = ({ day }: { day: number }) =>
      setMonthClose(Math.ceil(day / DAYS_PER_MONTH));

    bus.subscribe('floor:day_complete', onDayComplete);
    bus.subscribe('clock:month_ended', onMonthEnded);
    bus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    bus.subscribe('deal:closed', onDealClosed);
    bus.subscribe('floor:customer_walked', onWalked);
    bus.subscribe('floor:exception_raised', onExceptionRaised);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('clock:month_ended', onMonthEnded);
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
      bus.unsubscribe('deal:closed', onDealClosed);
      bus.unsubscribe('floor:customer_walked', onWalked);
      bus.unsubscribe('floor:exception_raised', onExceptionRaised);
    };
  }, []);

  // Pause-on-background → persist the mid-day checkpoint (#122). The OS gives
  // no reliable "about to be killed" hook, so we snapshot on every
  // background/inactive transition while the floor is open; resume replays it
  // deterministically on the next cold start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') return;
      const cp = dayLoop.checkpoint();
      if (cp) void checkpointStore.save(cp as unknown as Record<string, unknown>);
    });
    return () => sub.remove();
  }, []);

  const handleNextDay = () => {
    // MANAGERIAL → FLOOR_OPEN. The live render loop (#121) now drives the
    // owned FloorSim's step() at the player's chosen cadence; the day no
    // longer runs to exhaustion synchronously. FloorSim emits
    // floor:day_complete on the final tick, which flips the controller back
    // to MANAGERIAL (its own subscription) and re-renders.
    setGrossToday(0);
    setFloorEvents([]);
    dayLoop.nextDay();
    bump();
  };

  // Bottom-nav dispatch (#76). Sales is the hand-play workspace, not a
  // resolve-list — it opens the existing cherry-pick/hand-play path. The
  // other four push the generic DepartmentScreen. Always responds; never
  // gated on badge count (see #71).
  const handleDeptPress = (dept: DeptKey) => {
    if (dept === 'sales') {
      cherryPick();
      return;
    }
    nav.navigate('department', { dept });
  };

  const handleSaveCleared = () => {
    setProfile(null);
    nav.reset('character-creation');
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
            nav.reset('game');
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
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'department') {
    const dept = (nav.current.params as { dept: DeptKey }).dept;
    content = (
      <>
        <StatusBar style="light" />
        <DepartmentScreen
          title={DEPT_TITLES[dept]}
          items={departmentQueue.getQueue(dept)}
          onResolve={(id) => {
            departmentQueue.resolveItem(id);
            bump();
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'personnel') {
    content = (
      <>
        <StatusBar style="light" />
        <PersonnelScreen
          roleId={HIRING_ROLE_ID}
          candidates={staffOrg.getCandidates(HIRING_ROLE_ID)}
          skillCaps={SKILL_CAPS}
          cash={cash}
          onHire={(candidateId) => {
            staffOrg.hire(candidateId);
            setCash(economy.cash);
          }}
          onClose={() => nav.back()}
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
          openHour: RENDER_LOOP.openHour,
          closeHour: RENDER_LOOP.closeHour,
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
    // MANAGERIAL pre-open ownership levers (#120). Assembled here in the
    // composition root; greyed by `ownershipUnlocked` (⇔ MANAGERIAL).
    const leverProps = {
      enabled: loopState.ownershipUnlocked,
      vehicles: lotVehicles.map((v) => ({
        id: v.id,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim,
        suggestedRetail: v.suggestedRetail,
        askingPrice: v.askingPrice,
      })),
      onSetAskingPrice: (vehicleId: string, price: number) => {
        inventory.setAskingPrice(vehicleId, price);
        setLotVehicles(inventory.getLotVehicles());
      },
      onOpenAuction: () => nav.navigate('auction'),
      onOpenHiring: () => nav.navigate('personnel'),
      rosterCount: staffOrg.currentRoster.length,
      hoursOptions: HOURS_OF_OP.options,
      hoursOfOpId,
      onSelectHours: setHoursOfOpId,
    };
    content = (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.container}>
        <DayLoopShell
          profile={profile}
          state={loopState}
          onNextDay={handleNextDay}
          onOpenAuction={() => nav.navigate('auction')}
          floorModel={floorModel}
          floorControls={
            floor
              ? {
                  speed: floorLoop.speed,
                  speeds: floorLoop.speeds,
                  paused: floorLoop.paused,
                  onSetSpeed: (s) => {
                    if (floorLoop.paused) floorLoop.togglePause();
                    floorLoop.setSpeed(s);
                  },
                  onTogglePause: floorLoop.togglePause,
                  onSkipToClose: floorLoop.skipToClose,
                }
              : undefined
          }
          recap={recap}
          onExceptionPress={openHandPlay}
          onCherryPick={floor && floor.canGrab() ? cherryPick : undefined}
          leverProps={leverProps}
        />
        </View>
        <BottomNav
          badges={departmentQueue.getBadges()}
          onPress={handleDeptPress}
        />
      </View>
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
        {monthClose != null && (
          <MonthCloseInterstitial
            model={{
              month: monthClose,
              tier: 1,
              isUnlocked: kpiDashboard.isUnlocked,
              snapshot: kpiDashboard.getSnapshot(),
            }}
            onDismiss={() => setMonthClose(null)}
          />
        )}
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

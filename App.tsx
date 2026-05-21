import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createSaveStore, createSqliteDriver } from './src/game/SaveStore';
import { createEventBus } from './src/game/EventBus';
import type {
  HandPlaySession,
  AdvanceResult,
} from './src/game/FloorSim';
import { loadTunables } from './src/game/data';
import { loadStaffTaxonomy } from './src/game/NPC';
import { createWorld, makeSeed, type World } from './src/createWorld';
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
import { MonthCloseInterstitial } from './src/ui/MonthCloseInterstitial';
import { ChapterCard } from './src/ui/NarrativeBeat';
import { EndCard } from './src/ui/EndCard';
import type { EndCardData } from './src/game/EndCard';
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
// Seed-free, must outlive world (re)construction. saveStore reads the
// persisted per-save masterSeed (#96) before the seed-dependent World is
// built; bus stays stable so the render-loop hook + bus subscriptions have a
// bus before the seed is known.
const saveStore: SaveStore = createSaveStore(createSqliteDriver());
// Mid-day checkpoint cell (#122) — a physically separate sqlite db so the
// in-progress FloorSim checkpoint can never collide with the main save blob
// (the #109 own-cell discipline; per-slot indexing arrives with slot wiring).
const checkpointStore: SaveStore = createSaveStore(
  createSqliteDriver({ databaseName: 'dealership.checkpoint.db' }),
);
const bus = createEventBus();

// Fresh random root seed minted once per app launch; consumed only if this
// launch starts a brand-new game (#96). An existing save ignores it and
// rebuilds the World from its own persisted seed.
const NEW_GAME_SEED = makeSeed();

// staffTaxonomy is seed-free: kept module-level so SKILL_CAPS (PersonnelScreen
// bars, #120) and the FLOOR-OPEN staff-strip department lookup don't depend on
// a built World.
const staffTaxonomy = loadStaffTaxonomy();
// skill_id → cap, for the PersonnelScreen skill bars (Hiring lever, #120).
const SKILL_CAPS: Record<string, number> = Object.fromEntries(
  Object.entries(staffTaxonomy.skills).map(([id, s]) => [id, s.cap]),
);

// role_id → humanized label + serving department, for the impressionistic
// FLOOR-OPEN staff strip (#117). Pure read mapping off the role catalog.
function humanizeRole(roleId: string): string {
  return roleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Month-close cadence — sourced from the same tunable GameClock uses, never
// a magic number. clock:month_ended fires on endingDay % daysPerMonth === 0.
const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;

export default function App() {
  const nav = useNavigator('loading');
  const screen = nav.current.route;
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  // The seed-dependent composition root (#96). Null until the per-save
  // masterSeed is resolved — from the persisted save on load, or the fresh
  // NEW_GAME_SEED at character creation. Built exactly once per game.
  const [world, setWorld] = useState<World | null>(null);
  // Latest world for bus handlers / AppState listener (their effects mount
  // once with [] before the world exists).
  const worldRef = useRef<World | null>(null);
  worldRef.current = world;
  const [lotVehicles, setLotVehicles] = useState<readonly LotVehicle[]>([]);
  const [cash, setCash] = useState(0);
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
  // Event-interrupt overlay channel (#84 / design record #127). Lives in the
  // composition root, layered ABOVE the Navigator — NOT a RouteParamMap route.
  // Non-terminal beats (career:tier_up / chapter rebrand) enqueue silently
  // during FLOOR_OPEN and drain as sequential full-bleed acknowledge-cards at
  // the MANAGERIAL boundary, FIFO by emission order (bus delivers in publish
  // order, so array order == emission order). Acknowledgement is OUT of the
  // tick-stamped action log by construction — it never enters the live sim,
  // so it carries zero replay-determinism risk (#127 decision 1/6).
  const [chapterQueue, setChapterQueue] = useState<
    readonly { fromTier: number; toTier: number; day: number }[]
  >([]);
  // Terminal end-of-career data (#127 decision 2). Set on career:game_over —
  // hard-stops the sim (held render loop) and routes to the EndCard via a
  // Navigator reset. Preempts the non-terminal queue (#127 decision 4).
  const [endCard, setEndCard] = useState<EndCardData | null>(null);

  // The live clock (#121). Drives the owned FloorSim's step() at a tunable
  // cadence; speed/pause are pure render multipliers (game logic is
  // wall-clock-free). A hand-play modal open in auto-pause mode holds the
  // interval without touching the player's pause state.
  const floorLoop = useFloorRenderLoop({
    floor: world?.dayLoop.currentFloor() ?? null,
    active: world ? world.dayLoop.state().phase === 'FLOOR_OPEN' : false,
    bus,
    onTick: bump,
    hold:
      (handSession != null && !HAND_PLAY_LIVE) ||
      monthClose != null ||
      chapterQueue.length > 0 ||
      endCard != null,
  });

  // Open the modal on a specific grabbable customer (forced-exception row or
  // a cherry-pick the composition root already selected). When not running
  // live, the day is already idle here (the render loop is #121) — auto-pause
  // is the default and holds until the player resumes.
  const openHandPlay = (customerId: string) => {
    const f = world?.dayLoop.currentFloor();
    if (!f || !f.canGrab()) return;
    setHandSession(f.grab(customerId));
    setHandResult(null);
  };
  const cherryPick = () => {
    const f = world?.dayLoop.currentFloor();
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
        // Per-save masterSeed (#96): the SaveStore v1→v2 migration backfills
        // the fixed legacy 42 for pre-#96 saves, so a number is guaranteed
        // here; the ?? 42 is a defensive belt only.
        const seed =
          typeof state.masterSeed === 'number' ? state.masterSeed : 42;
        const character = state.character as CharacterProfile;
        const w = createWorld({
          bus,
          masterSeed: seed,
          characterProfile: character,
        });
        setWorld(w);
        setCash(w.economy.cash);
        setProfile(character);
        nav.reset('game');
        // Mid-day cold-start resume (#122): if a checkpoint exists for the
        // day the clock currently sits on, recreate the FloorSim and replay
        // its action log to land in the byte-exact pre-background state. A
        // stale checkpoint (the clock can't honor it — broader mid-game
        // clock/economy persistence is a later slice) is discarded, never
        // misapplied.
        const raw = await checkpointStore.load();
        const cp = raw as unknown as MidDayCheckpoint | null;
        if (cp && cp.day === w.clock.currentDay) {
          w.dayLoop.resume(cp);
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
      const w = worldRef.current;
      bump();
      if (w) {
        setLotVehicles(w.inventory.getLotVehicles());
        setCash(w.economy.cash);
      }
      // Day closed → the mid-day checkpoint is obsolete (#122 / #109: caller
      // clears it on day-complete).
      void checkpointStore.clear();
    };
    const onVehiclePurchased = () => {
      const w = worldRef.current;
      if (!w) return;
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    };
    const onVehicleSold = () => {
      const w = worldRef.current;
      if (w) setLotVehicles(w.inventory.getLotVehicles());
    };
    const onRevenue = () => {
      const w = worldRef.current;
      if (w) setCash(w.economy.cash);
    };
    const onDealClosed = ({
      frontGross,
      backGross,
    }: {
      frontGross: number;
      backGross: number;
    }) => setGrossToday((g) => g + frontGross + backGross);
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

    // Non-terminal interrupt (#127 decision 1): a tier-up / chapter beat.
    // Enqueued here regardless of phase; it surfaces only when the queue
    // drains at the MANAGERIAL boundary (see the ChapterCard overlay below).
    const onTierUp = (e: { fromTier: number; toTier: number; day: number }) =>
      setChapterQueue((q) => [...q, e]);
    // Terminal interrupt (#127 decision 2/4): preempts everything — the rest
    // of the non-terminal queue is moot once the run is over. Hard-stops the
    // sim (the held render loop) and routes to the EndCard via a Navigator
    // reset (a new unreachable starting point).
    const onGameOver = ({ data }: { day: number; data: EndCardData }) => {
      setChapterQueue([]);
      setEndCard(data);
      nav.reset('end-card');
    };

    bus.subscribe('floor:day_complete', onDayComplete);
    bus.subscribe('clock:month_ended', onMonthEnded);
    bus.subscribe('career:tier_up', onTierUp);
    bus.subscribe('career:game_over', onGameOver);
    bus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    bus.subscribe('deal:closed', onDealClosed);
    bus.subscribe('floor:exception_raised', onExceptionRaised);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('clock:month_ended', onMonthEnded);
      bus.unsubscribe('career:tier_up', onTierUp);
      bus.unsubscribe('career:game_over', onGameOver);
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
      bus.unsubscribe('deal:closed', onDealClosed);
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
      const cp = worldRef.current?.dayLoop.checkpoint();
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
    if (!world) return;
    setGrossToday(0);
    setFloorEvents([]);
    world.dayLoop.nextDay();
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
          masterSeed={NEW_GAME_SEED}
          onComplete={(p: CharacterProfile) => {
            // New game → build the World from the freshly-minted seed that
            // CharacterCreation just persisted (#96).
            const w = createWorld({
              bus,
              masterSeed: NEW_GAME_SEED,
              characterProfile: p,
            });
            setWorld(w);
            setCash(w.economy.cash);
            setProfile(p);
            nav.reset('game');
          }}
        />
      </>
    );
  } else if (screen === 'auction' && world) {
    content = (
      <>
        <StatusBar style="light" />
        <AuctionMenu
          listings={world.inventory.getAuctionListings()}
          lotVehicles={lotVehicles}
          cash={cash}
          valuationFor={world.marketEconomy.valuationFor}
          sourceLabelFor={world.marketEconomy.sourceLabelFor}
          bus={bus}
          onBuy={(listingId) => world.inventory.buyFromAuction(listingId)}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'department' && world) {
    const dept = (nav.current.params as { dept: DeptKey }).dept;
    content = (
      <>
        <StatusBar style="light" />
        <DepartmentScreen
          title={DEPT_TITLES[dept]}
          items={world.departmentQueue.getQueue(dept)}
          onResolve={(id) => {
            world.departmentQueue.resolveItem(id);
            bump();
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'personnel' && world) {
    content = (
      <>
        <StatusBar style="light" />
        <PersonnelScreen
          roleId={HIRING_ROLE_ID}
          candidates={world.staffOrg.getCandidates(HIRING_ROLE_ID)}
          skillCaps={SKILL_CAPS}
          cash={cash}
          onHire={(candidateId) => {
            world.staffOrg.hire(candidateId);
            setCash(world.economy.cash);
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'game' && profile && world) {
    const loopState = world.dayLoop.state();
    const floor = world.dayLoop.currentFloor();
    const funnel = world.capacityManager.getDayFunnel();
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
          cash: world.economy.cash,
          exceptionPending: floor
            .grabbableCustomers()
            .some((c) => c.source === 'exception' && c.mustHandle),
          ups: funnel.walkedIn,
          sold: funnel.sold,
          pendingWarm: Math.max(0, funnel.walkedIn - funnel.staffEngaged),
          gross: grossToday,
          staff: world.staffOrg.currentRoster.map((s) => ({
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
        world.inventory.setAskingPrice(vehicleId, price);
        setLotVehicles(world.inventory.getLotVehicles());
      },
      onOpenAuction: () => nav.navigate('auction'),
      onOpenHiring: () => nav.navigate('personnel'),
      rosterCount: world.staffOrg.currentRoster.length,
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
          tier={world.tierManager.currentTier}
          cash={world.economy.cash}
          reputation={world.reputation.reviewScore}
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
          badges={world.departmentQueue.getBadges()}
          onPress={handleDeptPress}
        />
      </View>
    );
  } else if (screen === 'end-card' && endCard) {
    // Terminal EndCard (#127 decision 2/5). The only Navigator-reset target of
    // the interrupt channel; "New Career" wipes the save and returns to
    // character-creation (a fresh unreachable start).
    content = (
      <>
        <StatusBar style="light" />
        <EndCard
          visible
          data={endCard}
          onDismiss={() => {
            void saveStore.clear();
            setEndCard(null);
            setWorld(null);
            handleSaveCleared();
          }}
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
        {monthClose != null && world && (
          <MonthCloseInterstitial
            model={{
              month: monthClose,
              tier: 1,
              isUnlocked: world.kpiDashboard.isUnlocked,
              snapshot: world.kpiDashboard.getSnapshot(),
            }}
            onDismiss={() => setMonthClose(null)}
          />
        )}
        {endCard == null &&
          world != null &&
          chapterQueue.length > 0 &&
          world.dayLoop.state().phase === 'MANAGERIAL' && (
            // Non-terminal drain (#127 decision 1/3): one full-bleed
            // acknowledge-card at a time, at the MANAGERIAL boundary, before
            // the EOD recap (this Modal renders over the DayLoopShell recap).
            // onConfirm applies the tier-up rebrand and pops the queue head;
            // remaining beats surface FIFO on the next render.
            <ChapterCard
              visible
              toTier={chapterQueue[0].toTier}
              defaultBusinessName={
                world.tierManager.businessName || (profile?.name ?? '')
              }
              onConfirm={(opts) => {
                world.tierManager.applyTierUp(opts);
                setChapterQueue((q) => q.slice(1));
                bump();
              }}
            />
          )}
        {__DEV__ && world && (
          <AdminConsole
            bus={bus}
            clock={world.clock}
            economy={world.economy}
            inventory={world.inventory}
            saveStore={saveStore}
            telemetry={world.telemetry}
            customerPool={world.customerPool}
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

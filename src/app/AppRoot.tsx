import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createPlatformDriverFactory } from './storage';
import type {
  DriverFactory,
  MidDayCheckpoint,
} from '../game/SaveStore';
import { createWorld } from '../createWorld';
import { findDeadDeskOrder, readDeskOrders } from './deskOrders';
import {
  restoreWorld,
  type PersistedWorldSnapshot,
} from '../worldSnapshot';
import { ThemeProvider } from '../ui/theme';
import { useConfirm } from '../ui/kit';
import { useNavigator, useTabStacks } from '../ui/Navigator';
import { useFloorRenderLoop } from '../ui/FloorRenderLoop';
import type { CharacterProfile } from '../game/CareerProgression';
import type { DeptKey } from '../game/DepartmentQueue';
import type { ShellTabKey } from '../ui/AppShell';
import type { DayRecapModel } from '../ui/DayRecap';
import { createAppServices, type AppServices } from './services';
import type { TierFixture } from './devFixtures';
import { useWorldState } from './useWorldState';
import { useSaveSlots } from './useSaveSlots';
import { useLevers } from './useLevers';
import { useHints } from './useHints';
import { useModals } from './useModals';
import { useDayLoop } from './useDayLoop';
import { AppOverlays } from './screens/AppOverlays';
import { RouteContent } from './screens/RouteContent';
import {
  TRADE_POLICY,
  FNI_POSTURE,
  PRICING_STRATEGIES,
  HOURS_OF_OP,
  readPersistedCashDelta,
  readPersistedSourcingLean,
} from './config';

export interface DealershipAppProps {
  driverFactory?: DriverFactory;
  onServicesReady?: (services: AppServices) => void;
}

// Composition root (#242). Owns the seed-free services, the Navigator, and the
// five state-cluster hooks; wires them together and routes the active screen.
// All heavy per-screen view-model building lives in ./screens/*; all state +
// EventBus subscriptions live in the use* hooks. This file is the only place
// the clusters meet — the cross-cutting load/reset orchestrators and the
// floor render-loop hold flags.
export function DealershipApp({
  driverFactory,
  onServicesReady,
}: DealershipAppProps) {
  const servicesRef = useRef<AppServices | null>(null);
  if (servicesRef.current === null) {
    servicesRef.current = createAppServices(
      driverFactory ?? createPlatformDriverFactory(),
    );
  }
  const services = servicesRef.current;
  const { bus, saveStore, slotStore, legacyStore } = services;
  useEffect(() => {
    onServicesReady?.(servicesRef.current as AppServices);
  }, [onServicesReady]);
  const nav = useNavigator('loading');
  // The composition root's own dialog channel. It exists because a failure
  // reported through `Alert.alert` is invisible on web — the fixture launch
  // would fail and the menu would just sit there.
  const notice = useConfirm();
  const screen = nav.current.route;
  // Per-tab navigation stacks (#348, locked IA §3). The Navigator owns the
  // app's flow states; this owns the active tab and one stack per tab, so a
  // sub-screen renders INSIDE the shell and switching tabs preserves where the
  // player was in each. Home is the tab the console opens on.
  const tabs = useTabStacks<ShellTabKey>('home');

  const worldState = useWorldState(bus);
  const {
    world,
    setWorld,
    worldRef,
    cash,
    setCash,
    lotVehicles,
    setLotVehicles,
    floorEvents,
    setFloorEvents,
    eventSeq,
    profile,
    setProfile,
    newGameSeed,
    setNewGameSeed,
    bump,
  } = worldState;

  const saveSlots = useSaveSlots({
    services,
    worldRef,
    nav,
    loadActiveSlotIntoGame,
    resetSessionState,
  });
  const { buildCurrentSaveState, persistCurrentSave } = saveSlots;

  // The teaching cluster (#386). Built before the levers because every dial a
  // hint hangs under retires it through `onControlUsed` — one seam, so a hint
  // cannot survive the control it teaches being used.
  const hints = useHints({ slotStore });

  const levers = useLevers({
    worldRef,
    persistCurrentSave,
    bump,
    onControlUsed: hints.markUsed,
  });

  const modals = useModals({
    bus,
    worldRef,
    setLotVehicles,
    setCash,
    bump,
  });

  const dayLoop = useDayLoop({
    services,
    worldRef,
    nav,
    setLotVehicles,
    setCash,
    setFloorEvents,
    eventSeq,
    bump,
    buildCurrentSaveState,
    // #385: the second must-handle class. A bite runs the store on the policy
    // the player left standing, so an order no desk can carry out stops the run
    // the same way a floor escalation does. Read off the lever REFS, not the
    // state, so a dial changed in the same tick the run starts is the dial the
    // run is judged against.
    deskOrderHalt: () => {
      const w = worldRef.current;
      if (!w) return null;
      return findDeadDeskOrder(
        readDeskOrders(w, {
          pricingStrategyId: levers.pricingStrategyIdRef.current,
          sourcingLean: levers.sourcingLeanRef.current,
          fniPostureId: levers.fniPostureIdRef.current,
        }),
      );
    },
    // #388: the clock's two controls retire their hints from the handler, the
    // same seam `useLevers` uses for the dials — never from the footer button.
    onControlUsed: hints.markUsed,
  });

  // The live clock (#121). Drives the owned FloorSim's step() at a tunable
  // cadence; speed/pause are pure render multipliers (game logic is
  // wall-clock-free). A hand-play modal open in auto-pause mode holds the
  // interval without touching the player's pause state.
  const floorLoop = useFloorRenderLoop({
    floor: world?.dayLoop.currentFloor() ?? null,
    active: world ? world.dayLoop.state().phase === 'FLOOR_OPEN' : false,
    onTick: bump,
    hold:
      modals.tradeReview != null ||
      modals.discountReview != null ||
      screen === 'in-game-menu' ||
      (screen === 'settings' && world != null) ||
      dayLoop.monthClose != null ||
      dayLoop.chapterQueue.length > 0 ||
      dayLoop.endCard != null,
  });

  // Build (and route into) the game from whichever slot is currently active.
  // Called by the start menu's Continue/Load after it has selected the slot
  // (#195). The slot must already hold a character; the menu never offers an
  // empty/character-less slot for resume. Declared as a hoisted function so it
  // can be handed to useSaveSlots above without a circular hook dependency.
  async function loadActiveSlotIntoGame() {
    const state = await saveStore.load();
    if (!state?.character) return;
    // Per-save masterSeed (#96): the SaveStore v1→v2 migration backfills the
    // fixed legacy 42 for pre-#96 saves, so a number is guaranteed here; the
    // ?? 42 is a defensive belt only.
    const seed = typeof state.masterSeed === 'number' ? state.masterSeed : 42;
    const character = state.character as CharacterProfile;
    // Restore the persisted per-slot trade policy (#172) before any trade can
    // resolve. The ref backs the live multiplier getter handed to createWorld.
    if (typeof state.tradePolicy === 'string') {
      levers.tradePolicyIdRef.current = state.tradePolicy;
      levers.setTradePolicyId(state.tradePolicy);
    } else {
      levers.tradePolicyIdRef.current = TRADE_POLICY.defaultId;
      levers.setTradePolicyId(TRADE_POLICY.defaultId);
    }
    // Restore the persisted per-slot F&I posture (#366) before any deal can be
    // quoted. The ref backs the live markup getter handed to createWorld; an
    // absent id (a pre-#366 slot) or one the catalog no longer sells falls back
    // to the default posture rather than throwing.
    if (typeof state.fniPosture === 'string') {
      levers.fniPostureIdRef.current = state.fniPosture;
      levers.setFniPostureId(state.fniPosture);
    } else {
      levers.fniPostureIdRef.current = FNI_POSTURE.defaultId;
      levers.setFniPostureId(FNI_POSTURE.defaultId);
    }
    // Restore the persisted per-slot list-price strategy (#154).
    if (typeof state.pricingStrategy === 'string') {
      levers.setPricingStrategyId(state.pricingStrategy);
    } else {
      levers.setPricingStrategyId(PRICING_STRATEGIES.defaultStrategy);
    }
    if (typeof state.hoursOfOp === 'string') {
      levers.setHoursOfOpId(state.hoursOfOp);
    } else {
      levers.setHoursOfOpId(HOURS_OF_OP.defaultId);
    }
    // Restore the persisted per-slot UCM sourcing lean (#293) before the world
    // builds, so the first board scan auto-buys to the player's saved posture.
    // The ref backs the live getter handed to createWorld.
    const restoredLean = readPersistedSourcingLean(state.sourcingLean);
    levers.sourcingLeanRef.current = restoredLean;
    levers.setSourcingLean(restoredLean);
    const w = createWorld({
      bus,
      masterSeed: seed,
      characterProfile: character,
      getTradePolicyMultiplier: levers.getTradePolicyMultiplier,
      getHoursOfOpTicksPerDay: levers.getHoursOfOpTicksPerDay,
      getPricingStrategy: levers.getPricingStrategy,
      getSourcingLean: levers.getSourcingLean,
      getFniPostureMarkupPts: levers.getFniPostureMarkupPts,
      getFniPostureId: levers.getFniPostureId,
    });
    // World-state restore (#188 tracer): rehydrate the persisted world
    // snapshot (day + cash) onto the freshly-built World instead of leaving it
    // reset to "night before Day 1". Done before the checkpoint-resume block
    // below so the mid-day guard (`cp.day === clock.currentDay`) compares
    // against the restored day.
    if (state.world) {
      // restoreWorld migrates the persisted (possibly older) snapshot to the
      // current envelope shape before rehydrating (#196).
      restoreWorld(state.world as PersistedWorldSnapshot, w);
    }
    setWorld(w);
    setCash(w.economy.cash);
    // Restore the persisted vs-yesterday baselines + the last computed delta
    // split (#255), so the Home card shows the last closed day's delta right
    // away. Pre-#255 saves lack all three fields → re-seed + blank delta.
    dayLoop.prevDayCashRef.current =
      typeof state.prevDayCash === 'number' ? state.prevDayCash : w.economy.cash;
    dayLoop.prevDayAcquisitionSpendRef.current =
      typeof state.prevDayAcquisitionSpend === 'number'
        ? state.prevDayAcquisitionSpend
        : w.economy.inventoryAcquisitionSpend;
    dayLoop.setCashDelta(readPersistedCashDelta(state.cashDelta));
    // Restore the persisted last-day recap (#253): the chip reflects the real
    // last closed day, so a Day-15 save never shows "Night before Day 1". The
    // modal does not auto-pop on load — it pops only on an actual day close.
    dayLoop.setLastRecap((state.lastRecap as DayRecapModel | undefined) ?? null);
    dayLoop.setRecapModalOpen(false);
    // Re-read the loaded slot's teaching cell (#386) — the mount-time read
    // answered for whatever slot was active then, which is not this one.
    hints.refresh();
    setLotVehicles(w.inventory.getLotVehicles());
    setProfile(character);
    nav.reset('game');
    // Mid-day cold-start resume (#122): if a checkpoint exists for the day the
    // clock currently sits on, recreate the FloorSim and replay its action log
    // to land in the byte-exact pre-background state. A stale checkpoint (the
    // clock can't honor it) is discarded, never misapplied.
    const cp: MidDayCheckpoint | null = await slotStore.readCheckpoint();
    if (cp && cp.day === w.clock.currentDay) {
      w.dayLoop.resume(cp);
      bump();
    } else if (cp) {
      await slotStore.clearCheckpoint();
    }
  }

  // Tear down all session state back to a clean menu. Hoisted for the same
  // reason as loadActiveSlotIntoGame (handed to useSaveSlots above).
  function resetSessionState() {
    setProfile(null);
    setWorld(null);
    setLotVehicles([]);
    setCash(0);
    setFloorEvents([]);
    dayLoop.reset();
    modals.reset();
    // Every tab back to its root (#348) — a new career must not open inside the
    // last one's Lot room.
    tabs.reset();
  }

  // New game → build the World from the freshly-minted seed that
  // CharacterCreation just persisted (#96), seed the vs-yesterday baselines,
  // and route in.
  const startNewGame = (p: CharacterProfile) => {
    const w = createWorld({
      bus,
      masterSeed: newGameSeed,
      characterProfile: p,
      getTradePolicyMultiplier: levers.getTradePolicyMultiplier,
      getHoursOfOpTicksPerDay: levers.getHoursOfOpTicksPerDay,
      getPricingStrategy: levers.getPricingStrategy,
      getSourcingLean: levers.getSourcingLean,
      getFniPostureMarkupPts: levers.getFniPostureMarkupPts,
      getFniPostureId: levers.getFniPostureId,
    });
    setWorld(w);
    setCash(w.economy.cash);
    // Prime the lot view from the freshly-built world so the #296 day-one seed
    // inventory (1 SUV / 1 truck / 1 sedan) is visible at open. Seed units are
    // inserted at construction with no `inventory:vehicle_purchased` emit, so
    // without this pull the reactive lot state stays `[]` until the first
    // inventory event (an auction buy) fires — the load path already does this.
    setLotVehicles(w.inventory.getLotVehicles());
    // Seed the vs-yesterday baselines (#230/#255): first day's delta is
    // measured against the night-before-Day-1 cash + (zero) lifetime spend.
    dayLoop.prevDayCashRef.current = w.economy.cash;
    dayLoop.prevDayAcquisitionSpendRef.current =
      w.economy.inventoryAcquisitionSpend;
    dayLoop.setCashDelta(null);
    // Fresh game → no recap yet; Home shows honest pre-Day-1 copy (#253).
    dayLoop.setLastRecap(null);
    dayLoop.setRecapModalOpen(false);
    // Re-read the new slot's teaching cell (#386). A career started in the same
    // session as another one must not inherit its retired hints — the cell is
    // per-slot, so the only thing that can go stale is this in-memory read.
    hints.refresh();
    setProfile(p);
    nav.reset('game');
  };

  // __DEV__ tier fixtures (#248): create a fresh slot, seed it with a committed
  // mid-game world fixture, then route in through the *normal* load path —
  // loadActiveSlotIntoGame migrates + restores the snapshot exactly like any
  // save, and autosave/slots work from there. No production reach: the only
  // caller is the __DEV__-gated MainMenu entry.
  const startAtTierFixture = (fixture: TierFixture) => {
    void (async () => {
      try {
        const meta = await slotStore.createSlot(`[DEV] Tier ${fixture.tier}`);
        await slotStore.selectSlot(meta.id);
        await saveStore.save(fixture.state);
        await loadActiveSlotIntoGame();
      } catch (err) {
        console.error('Dev tier-fixture launch failed', err);
        // A notice, not a question: one acknowledging button, nothing to decline.
        notice.ask({
          title: 'Dev fixture',
          message: 'Could not start — save slots may be full. Delete one and retry.',
          confirmLabel: 'OK',
          cancelLabel: null,
        });
      }
    })();
  };

  // Boot to the start menu (#195). No auto-load into the last game — the
  // player chooses New Game / Continue / Load.
  useEffect(() => {
    nav.reset('main-menu');
  }, []);

  // Pause-on-background → persist the mid-day checkpoint (#122). The OS gives
  // no reliable "about to be killed" hook, so we snapshot on every
  // background/inactive transition while the floor is open; resume replays it
  // deterministically on the next cold start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') return;
      const cp = worldRef.current?.dayLoop.checkpoint();
      if (cp) void slotStore.writeCheckpoint(cp);
    });
    return () => sub.remove();
  }, []);

  // Department-dock dispatch (#76, retargeted in #346). A department that has
  // its own room opens that room; the rest fall through to the generic
  // DepartmentScreen queue. Always responds. The push lands on the stack of
  // whichever tab it was pressed from (#348) — the dock lives in Operations, so
  // its rooms stack there and People keeps its own position.
  const handleDeptPress = (dept: DeptKey) => {
    if (dept === 'service') return tabs.navigate('service');
    if (dept === 'bodyshop') return tabs.navigate('bodyShop');
    if (dept === 'lot') return tabs.navigate('lot');
    tabs.navigate('department', { dept });
  };

  // After a save is wiped (EndCard "New Career" or the dev AdminConsole), the
  // active slot is gone — return to the start menu (#195) rather than straight
  // into character-creation, which would have no slot to write into.
  const handleSaveCleared = () => {
    resetSessionState();
    nav.reset('main-menu');
  };

  const handleEndCardDismiss = () => {
    const completed = dayLoop.endCard;
    void (async () => {
      try {
        if (completed) {
          await legacyStore.appendLegacy({
            playerName: completed.playerName,
            backstoryId: completed.backstoryId,
            careerYear: completed.careerYear,
            tierReached: completed.tierReached,
            reason: completed.reason,
            flavorText: completed.flavorText,
            completedAt: new Date().toISOString(),
          });
        }
        await saveStore.clear();
        dayLoop.setEndCard(null);
        handleSaveCleared();
      } catch (err) {
        console.error('End-card dismissal failed', err);
      }
    })();
  };

  // True while the management AppShell is on screen: its hero header bleeds
  // behind the status bar, so the root SafeAreaView must NOT pad the top edge.
  const floorIsOpen =
    !!world &&
    world.dayLoop.state().phase === 'FLOOR_OPEN' &&
    !!world.dayLoop.currentFloor();
  // ...and only while the hero header itself is what's on screen: a pushed
  // sub-screen starts at the top edge, so it needs the inset back (#348).
  const shellOwnsTopInset =
    screen === 'game' &&
    !!profile &&
    !!world &&
    !floorIsOpen &&
    tabs.current === undefined;
  return (
    <SafeAreaProvider>
      {/* Single injectable theme (#225): every kit surface reads tokens from
          here, so swapping this theme object re-skins the whole UI in one place. */}
      <ThemeProvider>
        <View style={styles.container}>
          <SafeAreaView
            style={styles.safeArea}
            edges={
              // The shell's hero header bleeds behind the status bar and pads
              // its own content by the inset; every other screen keeps the top
              // edge.
              shellOwnsTopInset
                ? ['bottom', 'left', 'right']
                : ['top', 'bottom', 'left', 'right']
            }
          >
            <RouteContent
              nav={nav}
              tabs={tabs}
              bus={bus}
              saveStore={saveStore}
              slotStore={slotStore}
              worldState={worldState}
              saveSlots={saveSlots}
              levers={levers}
              hints={hints}
              dayLoop={dayLoop}
              floorLoop={floorLoop}
              loadActiveSlotIntoGame={loadActiveSlotIntoGame}
              startNewGame={startNewGame}
              startAtTierFixture={startAtTierFixture}
              handleDeptPress={handleDeptPress}
              handleEndCardDismiss={handleEndCardDismiss}
            />
          </SafeAreaView>
          <AppOverlays
            modals={modals}
            dayLoop={dayLoop}
            world={world}
            profile={profile}
            bus={bus}
            saveStore={saveStore}
            playtestLog={services.playtestLog}
            handleSaveCleared={handleSaveCleared}
            bump={bump}
          />
          {notice.dialog}
        </View>
      </ThemeProvider>
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

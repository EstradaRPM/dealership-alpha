import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { EventBus } from '../../game/EventBus';
import type { Navigator, TabStacks } from '../../ui/Navigator';
import type { ShellTabKey } from '../../ui/AppShell';
import type {
  SaveStore,
  MultiSlotSaveStore,
} from '../../game/SaveStore';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { FloorRenderLoop } from '../../ui/FloorRenderLoop';
import { makeSeed } from '../../createWorld';
import { CharacterCreation } from '../../ui/CharacterCreation';
import { MainMenu } from '../../ui/MainMenu';
import { InGameMenu } from '../../ui/InGameMenu';
import { SettingsScreen } from '../../ui/SettingsScreen';
import { LegacyWallView } from '../../ui/LegacyWall';
import { EndCard } from '../../ui/EndCard';
import { GameScreen } from './GameScreen';
import { TabStackContent } from './TabStackContent';
import {
  TRADE_POLICY,
  FNI_POSTURE,
  PRICING_STRATEGIES,
  HOURS_OF_OP,
} from '../config';
import type { WorldState } from '../useWorldState';
import type { SaveSlots } from '../useSaveSlots';
import type { Levers } from '../useLevers';
import type { Hints } from '../useHints';
import type { DayLoop } from '../useDayLoop';
import { TIER_FIXTURES, type TierFixture } from '../devFixtures';

export interface RouteContentProps {
  nav: Navigator;
  /** Per-tab stacks (#348): which tab is up, and how deep the player is in it. */
  tabs: TabStacks<ShellTabKey>;
  bus: EventBus;
  saveStore: SaveStore;
  slotStore: MultiSlotSaveStore;
  worldState: WorldState;
  saveSlots: SaveSlots;
  levers: Levers;
  /** The teaching cluster (#386) — which consequence hints are still owed. */
  hints: Hints;
  dayLoop: DayLoop;
  floorLoop: FloorRenderLoop;
  loadActiveSlotIntoGame: () => Promise<void>;
  startNewGame: (p: CharacterProfile) => void;
  /** __DEV__ only (#248) — launch a fresh slot from a committed Tier-N fixture. */
  startAtTierFixture: (fixture: TierFixture) => void;
  handleDeptPress: (dept: DeptKey) => void;
  handleEndCardDismiss: () => void;
}

// Top-level route renderer (#242). The composition root (AppRoot) owns state +
// orchestration; this owns the screen switch. Each branch is a thin delegation
// to a screen component / container — adding or editing a route touches this
// file, not the composition root.
export function RouteContent({
  nav,
  tabs,
  bus,
  saveStore,
  slotStore,
  worldState,
  saveSlots,
  levers,
  hints,
  dayLoop,
  floorLoop,
  loadActiveSlotIntoGame,
  startNewGame,
  startAtTierFixture,
  handleDeptPress,
  handleEndCardDismiss,
}: RouteContentProps): React.ReactElement {
  const screen = nav.current.route;
  const {
    world,
    profile,
    cash,
    lotVehicles,
    floorEvents,
    newGameSeed,
    setNewGameSeed,
    setLotVehicles,
    setCash,
    bump,
  } = worldState;
  const { persistCurrentSave } = saveSlots;

  if (screen === 'main-menu') {
    return (
      <>
        <StatusBar style="light" />
        <MainMenu
          saveStore={slotStore}
          onNewGame={() => {
            // The menu already created + selected the fresh slot. Mint a new
            // root seed for this game (so back-to-back new games don't clone),
            // then collect the character — it persists into the active slot.
            setNewGameSeed(makeSeed());
            levers.setHoursOfOpId(HOURS_OF_OP.defaultId);
            levers.tradePolicyIdRef.current = TRADE_POLICY.defaultId;
            levers.setTradePolicyId(TRADE_POLICY.defaultId);
            levers.fniPostureIdRef.current = FNI_POSTURE.defaultId;
            levers.setFniPostureId(FNI_POSTURE.defaultId);
            levers.setPricingStrategyId(PRICING_STRATEGIES.defaultStrategy);
            nav.reset('character-creation');
          }}
          onContinue={() => void loadActiveSlotIntoGame()}
          onLoadGame={() => void loadActiveSlotIntoGame()}
          onSettings={saveSlots.openSettings}
          onLegacyWall={saveSlots.openLegacyWall}
          // __DEV__ tier fixtures (#248): the registry is empty in production,
          // so this row never shows there.
          devTiers={__DEV__ ? TIER_FIXTURES.map((f) => f.tier) : undefined}
          onStartAtTier={
            __DEV__
              ? (tier) => {
                  const fixture = TIER_FIXTURES.find((f) => f.tier === tier);
                  if (fixture) startAtTierFixture(fixture);
                }
              : undefined
          }
        />
      </>
    );
  }
  if (screen === 'settings') {
    return (
      <>
        <StatusBar style="light" />
        <SettingsScreen
          snapshots={saveSlots.settingsSnapshots}
          onRollback={(index) => void saveSlots.handleRollback(index)}
          onClose={() => nav.back()}
        />
      </>
    );
  }
  if (screen === 'legacy-wall') {
    return (
      <>
        <StatusBar style="light" />
        <LegacyWallView
          visible
          legacies={saveSlots.legacyWallLegacies}
          onClose={() => nav.back()}
        />
      </>
    );
  }
  if (screen === 'in-game-menu') {
    return (
      <>
        <StatusBar style="light" />
        <InGameMenu
          slots={saveSlots.inGameSlots}
          activeSlotId={saveSlots.activeSlotId}
          status={saveSlots.inGameMenuStatus}
          onClose={() => nav.back()}
          onSave={() => void saveSlots.handleManualSave()}
          onLoadSlot={(slotId) => void saveSlots.handleInGameLoadSlot(slotId)}
          onReturnToMainMenu={() => void saveSlots.handleReturnToMainMenu()}
          onSettings={saveSlots.openSettings}
          // #386: re-arm every retired hint for this career. The menu is where
          // it lives because it is the one surface reachable from anywhere in
          // the game without giving up where the player was standing.
          onShowHintsAgain={hints.resetHints}
        />
      </>
    );
  }
  if (screen === 'character-creation') {
    return (
      <>
        <StatusBar style="light" />
        <CharacterCreation
          saveStore={saveStore}
          masterSeed={newGameSeed}
          onComplete={startNewGame}
        />
      </>
    );
  }
  // The KPI readout and the history log are no longer root routes (#351) —
  // both live inside the Finance tab now, where the tab bar stays mounted.
  if (screen === 'game' && profile && world) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <GameScreen
          world={world}
          profile={profile}
          lotVehicles={lotVehicles}
          grossToday={dayLoop.grossToday}
          floorEvents={floorEvents}
          cashDelta={dayLoop.cashDelta}
          floorLoop={floorLoop}
          levers={levers}
          hints={hints}
          tabs={tabs}
          // The active tab's pushed sub-screen, rendered by the shell with the
          // tab bar still up (#348). Null at a tab's root, where the tab's own
          // page renders — so this is also the flag that picks the body mode.
          stackScreen={
            tabs.current ? (
              <TabStackContent
                tabs={tabs}
                world={world}
                bus={bus}
                levers={levers}
                hints={hints}
                lotVehicles={lotVehicles}
                cash={cash}
                persistCurrentSave={persistCurrentSave}
                setLotVehicles={setLotVehicles}
                setCash={setCash}
                bump={bump}
              />
            ) : null
          }
          lastRecap={dayLoop.lastRecap}
          setRecapModalOpen={dayLoop.setRecapModalOpen}
          handleNextDay={dayLoop.handleNextDay}
          handleRunBite={dayLoop.handleRunBite}
          handleDeptPress={handleDeptPress}
          openInGameMenu={saveSlots.openInGameMenu}
          persistCurrentSave={persistCurrentSave}
          setLotVehicles={setLotVehicles}
          setCash={setCash}
          bump={bump}
        />
      </View>
    );
  }
  if (screen === 'end-card' && dayLoop.endCard) {
    // Terminal EndCard (#127 decision 2/5). The only Navigator-reset target of
    // the interrupt channel; "New Career" wipes the slot and returns to the
    // start menu (#195), where the player picks New Game.
    return (
      <>
        <StatusBar style="light" />
        <EndCard visible data={dayLoop.endCard} onDismiss={handleEndCardDismiss} />
      </>
    );
  }
  if (screen === 'loading') {
    return <View style={styles.container} />;
  }
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { EventBus } from '../../game/EventBus';
import type { Navigator } from '../../ui/Navigator';
import type {
  SaveStore,
  MultiSlotSaveStore,
} from '../../game/SaveStore';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { PartCategory, SupplierTier } from '../../game/PartsInventory';
import type { ConquestSelection } from '../../game/ServiceMarketing';
import type { FloorRenderLoop } from '../../ui/FloorRenderLoop';
import { makeSeed } from '../../createWorld';
import { CharacterCreation } from '../../ui/CharacterCreation';
import { MainMenu } from '../../ui/MainMenu';
import { InGameMenu } from '../../ui/InGameMenu';
import { SettingsScreen } from '../../ui/SettingsScreen';
import { LegacyWallView } from '../../ui/LegacyWall';
import { KPIDashboard } from '../../ui/KPIDashboard';
import { HistoryScreen } from '../../ui/HistoryScreen';
import { EndCard } from '../../ui/EndCard';
import { DepartmentScreen } from '../../ui/DepartmentScreen';
import { ServicePage } from '../../ui/ServicePage';
import { BodyShopPage } from '../../ui/BodyShopPage';
import { GameScreen } from './GameScreen';
import { AuctionScreen } from './AuctionScreen';
import { PricingScreenContainer } from './PricingScreenContainer';
import { PersonnelScreenContainer } from './PersonnelScreenContainer';
import {
  DEPT_TITLES,
  TRADE_POLICY,
  PRICING_STRATEGIES,
  HOURS_OF_OP,
  buildServicePageModel,
  buildServiceControlsModel,
  buildBodyShopPageModel,
  buildBodyShopControlsModel,
  buildMarketState,
} from '../config';
import type { WorldState } from '../useWorldState';
import type { SaveSlots } from '../useSaveSlots';
import type { Levers } from '../useLevers';
import type { DayLoop } from '../useDayLoop';
import { TIER_FIXTURES, type TierFixture } from '../devFixtures';

export interface RouteContentProps {
  nav: Navigator;
  bus: EventBus;
  saveStore: SaveStore;
  slotStore: MultiSlotSaveStore;
  worldState: WorldState;
  saveSlots: SaveSlots;
  levers: Levers;
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
  bus,
  saveStore,
  slotStore,
  worldState,
  saveSlots,
  levers,
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
          onKPIDashboard={saveSlots.openKPIDashboard}
          onHistory={saveSlots.openHistory}
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
  if (screen === 'kpi-dashboard' && world) {
    return (
      <>
        <StatusBar style="light" />
        <KPIDashboard
          snapshot={world.kpiDashboard.getSnapshot()}
          marketState={buildMarketState(world)}
          onClose={() => nav.back()}
        />
      </>
    );
  }
  if (screen === 'history' && world) {
    return (
      <>
        <StatusBar style="light" />
        <HistoryScreen
          entries={world.historyLog.getEntries()}
          onClose={() => nav.back()}
        />
      </>
    );
  }
  if (screen === 'auction' && world) {
    return (
      <AuctionScreen
        world={world}
        nav={nav}
        bus={bus}
        lotVehicles={lotVehicles}
        cash={cash}
        persistCurrentSave={persistCurrentSave}
        setCash={setCash}
      />
    );
  }
  if (screen === 'pricing' && world) {
    const { vehicleId } = nav.current.params as { vehicleId: string };
    return (
      <PricingScreenContainer
        world={world}
        nav={nav}
        vehicleId={vehicleId}
        pricingStrategyId={levers.pricingStrategyId}
        persistCurrentSave={persistCurrentSave}
        setLotVehicles={setLotVehicles}
      />
    );
  }
  if (screen === 'department' && world) {
    const dept = (nav.current.params as { dept: DeptKey }).dept;
    return (
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
  }
  if (screen === 'service' && world) {
    // Service department page (#308 readouts + #309 controls): demand heat +
    // stock coverage + base health, plus the policy levers (par/supplier/posture/
    // marketing). Each control dispatches into the already-built game logic, then
    // re-snapshots + re-renders so the page reflects the new policy. Policy-style
    // — set once, applied automatically. Navigation is never tier-gated.
    const w = world;
    const apply = () => {
      persistCurrentSave();
      bump();
    };
    return (
      <>
        <StatusBar style="light" />
        <ServicePage
          model={buildServicePageModel(w)}
          controls={{
            model: buildServiceControlsModel(w),
            onSetReorderPoint: (category, value) => {
              w.partsInventory.setPolicy(category as PartCategory, {
                reorderPoint: value,
              });
              apply();
            },
            onSetTarget: (category, value) => {
              w.partsInventory.setPolicy(category as PartCategory, {
                target: value,
              });
              apply();
            },
            onSetSupplierTier: (category, tier) => {
              w.partsInventory.setPolicy(category as PartCategory, {
                tier: tier as SupplierTier,
              });
              apply();
            },
            onSetPricingPosture: (value) => {
              w.setServicePricingPosture(value);
              apply();
            },
            onSetRetention: (id) => {
              w.serviceMarketing.setRetentionCampaign(id);
              apply();
            },
            onSetConquest: (category) => {
              w.serviceMarketing.setConquestSpecial(category as ConquestSelection);
              apply();
            },
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  }
  if (screen === 'bodyShop' && world) {
    // Body Shop department page (#315 readouts + #318 controls): demand heat +
    // stock coverage + conquest health, plus the policy levers (par/supplier per
    // collision category + the insurance↔retail channel dial). Each control
    // dispatches into the already-built game logic, then re-snapshots + re-renders
    // so the page reflects the new policy. Policy-style — set once, applied
    // automatically. Navigation is never tier-gated (the page renders its dark/
    // empty states below Tier 3 because the read-model is silent).
    const w = world;
    const apply = () => {
      persistCurrentSave();
      bump();
    };
    return (
      <>
        <StatusBar style="light" />
        <BodyShopPage
          model={buildBodyShopPageModel(w)}
          controls={{
            model: buildBodyShopControlsModel(w),
            onSetReorderPoint: (category, value) => {
              w.partsInventory.setPolicy(category as PartCategory, {
                reorderPoint: value,
              });
              apply();
            },
            onSetTarget: (category, value) => {
              w.partsInventory.setPolicy(category as PartCategory, {
                target: value,
              });
              apply();
            },
            onSetSupplierTier: (category, tier) => {
              w.partsInventory.setPolicy(category as PartCategory, {
                tier: tier as SupplierTier,
              });
              apply();
            },
            onSetChannelPosture: (value) => {
              w.setBodyShopChannelPosture(value);
              apply();
            },
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  }
  if (screen === 'personnel' && world) {
    return (
      <PersonnelScreenContainer
        world={world}
        nav={nav}
        cash={cash}
        selectedHiringRoleId={levers.selectedHiringRoleId}
        setSelectedHiringRoleId={levers.setSelectedHiringRoleId}
        setCash={setCash}
        bump={bump}
      />
    );
  }
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
          nav={nav}
          shellTab={dayLoop.shellTab}
          setShellTab={dayLoop.setShellTab}
          lastRecap={dayLoop.lastRecap}
          setRecapModalOpen={dayLoop.setRecapModalOpen}
          handleNextDay={dayLoop.handleNextDay}
          handleDeptPress={handleDeptPress}
          openInGameMenu={saveSlots.openInGameMenu}
          persistCurrentSave={persistCurrentSave}
          setLotVehicles={setLotVehicles}
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

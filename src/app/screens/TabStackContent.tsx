import React from 'react';
import { StatusBar } from 'expo-status-bar';
import type { EventBus } from '../../game/EventBus';
import type { World } from '../../createWorld';
import type { TabStacks } from '../../ui/Navigator';
import type { ShellTabKey } from '../../ui/AppShell';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { LotVehicle } from '../../game/Inventory';
import type { PartCategory, SupplierTier } from '../../game/PartsInventory';
import type { ConquestSelection } from '../../game/ServiceMarketing';
import { DepartmentScreen } from '../../ui/DepartmentScreen';
import { HistoryScreen } from '../../ui/HistoryScreen';
import { MonthResultsScreen, buildMonthResults } from '../../ui/FinanceTab';
import { DAYS_PER_MONTH } from '../config';
import { ServicePage } from '../../ui/ServicePage';
import { BodyShopPage } from '../../ui/BodyShopPage';
import { AuctionScreen } from './AuctionScreen';
import { PricingScreenContainer } from './PricingScreenContainer';
import { LotRoomContainer } from './LotRoomContainer';
import {
  DEPT_TITLES,
  buildServicePageModel,
  buildServiceControlsModel,
  buildBodyShopPageModel,
  buildBodyShopControlsModel,
} from '../config';
import type { Levers } from '../useLevers';

export interface TabStackContentProps {
  tabs: TabStacks<ShellTabKey>;
  world: World;
  bus: EventBus;
  levers: Levers;
  lotVehicles: readonly LotVehicle[];
  cash: number;
  persistCurrentSave: () => void;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
  setCash: (n: number) => void;
  bump: () => void;
}

/**
 * The in-tab route renderer (#348). `RouteContent` is the switch over ROOT
 * routes — whole-app flow states; this is its sibling for the sub-screens that
 * live inside a tab of the shell (locked IA §3). Each branch is the same thin
 * delegation to a screen container it was as a root route; the difference is
 * that whatever this returns is handed to `AppShell` as its body, so the tab
 * bar stays mounted and the player never loses the console by walking into a
 * room. Returns null at a tab's root, where the tab's own page renders.
 */
export function TabStackContent({
  tabs,
  world,
  bus,
  levers,
  lotVehicles,
  cash,
  persistCurrentSave,
  setLotVehicles,
  setCash,
  bump,
}: TabStackContentProps): React.ReactElement | null {
  const entry = tabs.current;
  if (!entry) return null;
  const screen = entry.route;

  if (screen === 'auction') {
    return (
      <AuctionScreen
        world={world}
        tabs={tabs}
        bus={bus}
        lotVehicles={lotVehicles}
        cash={cash}
        persistCurrentSave={persistCurrentSave}
        setCash={setCash}
      />
    );
  }
  if (screen === 'pricing') {
    const { vehicleId } = entry.params as { vehicleId: string };
    return (
      <PricingScreenContainer
        world={world}
        tabs={tabs}
        vehicleId={vehicleId}
        pricingStrategyId={levers.pricingStrategyId}
        persistCurrentSave={persistCurrentSave}
        setLotVehicles={setLotVehicles}
      />
    );
  }
  if (screen === 'lot') {
    return (
      <LotRoomContainer
        world={world}
        tabs={tabs}
        lotVehicles={lotVehicles}
        pricingStrategyId={levers.pricingStrategyId}
        onSelectPricingStrategy={levers.handleSelectPricingStrategy}
        persistCurrentSave={persistCurrentSave}
        setLotVehicles={setLotVehicles}
      />
    );
  }
  if (screen === 'dealHistory') {
    return (
      <>
        <StatusBar style="light" />
        <HistoryScreen
          entries={world.historyLog.getEntries()}
          onClose={() => tabs.back()}
        />
      </>
    );
  }
  if (screen === 'monthResults') {
    // Each closed month's financial side is RE-DERIVED over that month's day
    // window from the day-stamped deal log and the persisted ledger — the same
    // reads the dashboard uses — so the results screen can never disagree with
    // the dashboard about the same days. Only the gate's grade is stored,
    // because only the gate's grade cannot be recomputed after the month resets.
    return (
      <>
        <StatusBar style="light" />
        <MonthResultsScreen
          model={buildMonthResults(
            world.tierGate.getMonthVerdicts().map((verdict) => {
              const fromDay = (verdict.month - 1) * DAYS_PER_MONTH + 1;
              const toDay = verdict.month * DAYS_PER_MONTH;
              return {
                verdict,
                fromDay,
                toDay,
                kpi: world.kpiDashboard.getSnapshot({ fromDay, toDay }),
                pnl: world.economy.getPnL(fromDay, toDay),
              };
            }),
          )}
          onClose={() => tabs.back()}
        />
      </>
    );
  }
  if (screen === 'department') {
    const dept = (entry.params as { dept: DeptKey }).dept;
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
          onClose={() => tabs.back()}
        />
      </>
    );
  }
  // Both department pages dispatch into already-built game logic, then
  // re-snapshot + re-render so the page reflects the new policy. Policy-style —
  // set once, applied automatically.
  const apply = () => {
    persistCurrentSave();
    bump();
  };
  if (screen === 'service') {
    // Service department page (#308 readouts + #309 controls): demand heat +
    // stock coverage + base health, plus the policy levers (par/supplier/
    // posture/marketing). Navigation is never tier-gated.
    return (
      <>
        <StatusBar style="light" />
        <ServicePage
          model={buildServicePageModel(world)}
          controls={{
            model: buildServiceControlsModel(world),
            onSetReorderPoint: (category, value) => {
              world.partsInventory.setPolicy(category as PartCategory, {
                reorderPoint: value,
              });
              apply();
            },
            onSetTarget: (category, value) => {
              world.partsInventory.setPolicy(category as PartCategory, {
                target: value,
              });
              apply();
            },
            onSetSupplierTier: (category, tier) => {
              world.partsInventory.setPolicy(category as PartCategory, {
                tier: tier as SupplierTier,
              });
              apply();
            },
            onSetPricingPosture: (value) => {
              world.setServicePricingPosture(value);
              apply();
            },
            onSetRetention: (id) => {
              world.serviceMarketing.setRetentionCampaign(id);
              apply();
            },
            onSetConquest: (category) => {
              world.serviceMarketing.setConquestSpecial(
                category as ConquestSelection,
              );
              apply();
            },
          }}
          onClose={() => tabs.back()}
        />
      </>
    );
  }
  // Body Shop department page (#315 readouts + #318 controls): demand heat +
  // stock coverage + conquest health, plus the policy levers (par/supplier per
  // collision category + the insurance↔retail channel dial). Navigation is never
  // tier-gated (the page renders its dark/empty states below Tier 3 because the
  // read-model is silent).
  return (
    <>
      <StatusBar style="light" />
      <BodyShopPage
        model={buildBodyShopPageModel(world)}
        controls={{
          model: buildBodyShopControlsModel(world),
          onSetReorderPoint: (category, value) => {
            world.partsInventory.setPolicy(category as PartCategory, {
              reorderPoint: value,
            });
            apply();
          },
          onSetTarget: (category, value) => {
            world.partsInventory.setPolicy(category as PartCategory, {
              target: value,
            });
            apply();
          },
          onSetSupplierTier: (category, tier) => {
            world.partsInventory.setPolicy(category as PartCategory, {
              tier: tier as SupplierTier,
            });
            apply();
          },
          onSetChannelPosture: (value) => {
            world.setBodyShopChannelPosture(value);
            apply();
          },
        }}
        onClose={() => tabs.back()}
      />
    </>
  );
}

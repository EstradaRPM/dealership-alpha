import React from 'react';
import { StatusBar } from 'expo-status-bar';
import type { World } from '../../createWorld';
import type { TabStacks } from '../../ui/Navigator';
import type { ShellTabKey } from '../../ui/AppShell';
import type { EventBus } from '../../game/EventBus';
import type { LotVehicle } from '../../game/Inventory';
import { AuctionMenu } from '../../ui/AuctionMenu';
import { INSPECTION_COST } from '../config';

export interface AuctionScreenProps {
  world: World;
  tabs: TabStacks<ShellTabKey>;
  bus: EventBus;
  lotVehicles: readonly LotVehicle[];
  cash: number;
  persistCurrentSave: () => void;
  setCash: (n: number) => void;
}

// Auction board container (#242 extraction). Verbatim from App.tsx.
export function AuctionScreen({
  world,
  tabs,
  bus,
  lotVehicles,
  cash,
  persistCurrentSave,
  setCash,
}: AuctionScreenProps) {
  return (
    <>
      <StatusBar style="light" />
      <AuctionMenu
        listings={world.inventory.getAuctionListings()}
        lotVehicles={lotVehicles}
        cash={cash}
        // #361: spaces are the second thing the lane spends. Read live so a
        // construction job that landed this morning reopens bidding by itself.
        lotOccupancy={world.inventory.getLotOccupancy()}
        valuationFor={world.marketEconomy.valuationFor}
        sourceLabelFor={world.marketEconomy.sourceLabelFor}
        conditionReadFor={(l) =>
          world.staffOrg.assessCondition({
            id: l.id,
            reconEstimate: l.reconCost,
            condition: l.condition,
            mileage: l.mileage,
            sourceId: l.sourceId,
          })
        }
        bus={bus}
        inspectionCost={INSPECTION_COST}
        onBuy={(listingId) => {
          world.inventory.buyFromAuction(listingId);
          persistCurrentSave();
        }}
        onRequestInspection={(listingId) => {
          world.inventory.requestInspection(listingId);
          setCash(world.economy.cash);
          persistCurrentSave();
        }}
        onClose={() => tabs.back()}
      />
    </>
  );
}

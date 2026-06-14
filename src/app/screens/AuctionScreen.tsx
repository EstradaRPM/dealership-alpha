import React from 'react';
import { StatusBar } from 'expo-status-bar';
import type { World } from '../../createWorld';
import type { Navigator } from '../../ui/Navigator';
import type { EventBus } from '../../game/EventBus';
import type { LotVehicle } from '../../game/Inventory';
import { AuctionMenu } from '../../ui/AuctionMenu';
import { INSPECTION_COST } from '../config';

export interface AuctionScreenProps {
  world: World;
  nav: Navigator;
  bus: EventBus;
  lotVehicles: readonly LotVehicle[];
  cash: number;
  persistCurrentSave: () => void;
  setCash: (n: number) => void;
}

// Auction board container (#242 extraction). Verbatim from App.tsx.
export function AuctionScreen({
  world,
  nav,
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
        onClose={() => nav.back()}
      />
    </>
  );
}

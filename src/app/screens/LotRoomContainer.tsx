import React from 'react';
import { StatusBar } from 'expo-status-bar';
import type { World } from '../../createWorld';
import type { TabStacks } from '../../ui/Navigator';
import type { ShellTabKey } from '../../ui/AppShell';
import type { LotVehicle } from '../../game/Inventory';
import { LotRoom } from '../../ui/LotRoom';
import { PRICING_STRATEGY_OPTIONS } from '../config';

export interface LotRoomContainerProps {
  world: World;
  tabs: TabStacks<ShellTabKey>;
  lotVehicles: readonly LotVehicle[];
  pricingStrategyId: string;
  onSelectPricingStrategy: (id: string) => void;
  persistCurrentSave: () => void;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
}

/**
 * Lot room container (#346). The Lot owns the whole stock pipeline as one room
 * (locked IA §4): the stock list, the standing pricing strategy, the per-unit
 * pricing entry, and sourcing. Everything here used to be scattered across the
 * Prep block; this assembles the read model off the live World and owns the
 * writes, exactly as the pricing/personnel containers do.
 */
export function LotRoomContainer({
  world,
  tabs,
  lotVehicles,
  pricingStrategyId,
  onSelectPricingStrategy,
  persistCurrentSave,
  setLotVehicles,
}: LotRoomContainerProps) {
  return (
    <>
      <StatusBar style="light" />
      <LotRoom
        vehicles={lotVehicles.map((v) => ({
          id: v.id,
          year: v.year,
          make: v.make,
          model: v.model,
          trim: v.trim,
          suggestedRetail: v.suggestedRetail,
          askingPrice: v.askingPrice,
          daysInInventory: v.daysInInventory,
          carryingCostToDate: v.carryingCostToDate,
          dailyCarryingCost: v.dailyCarryingCost,
          aged: v.aged,
          // #362: the quote is the ENGINE's — book value with the configured
          // haircut, and the cost basis it is measured against. The room states
          // it; it never re-derives a price from book.
          wholesale: world.inventory.getWholesaleQuote(v.id)!,
        }))}
        // #361: the lot's own count, straight off the engine — a unit in prep
        // occupies a space like any other, so the room never counts the list.
        occupancy={world.inventory.getLotOccupancy()}
        onSetAskingPrice={(vehicleId, price) => {
          world.inventory.setAskingPrice(vehicleId, price);
          setLotVehicles(world.inventory.getLotVehicles());
          persistCurrentSave();
        }}
        onOpenPricing={(vehicleId) => tabs.navigate('pricing', { vehicleId })}
        pricingStrategyOptions={PRICING_STRATEGY_OPTIONS}
        pricingStrategyId={pricingStrategyId}
        onSelectPricingStrategy={onSelectPricingStrategy}
        // #285 (spine S13): the strategy is a standing auto-pricing policy once
        // a UCM is on staff — the same roster signal the pricing screen reads.
        autoPricingActive={world.staffOrg.currentRoster.some(
          (s) => s.role_id === 'used-car-manager',
        )}
        onOpenAuction={() => tabs.navigate('auction')}
        // #362: the release valve. Cash lands via Economy (the shell's revenue
        // subscription picks it up), the unit comes off the lot here, and the
        // freed space reopens buying with no further player action because the
        // auction reads occupancy live.
        onWholesale={(vehicleId) => {
          world.inventory.wholesaleVehicle(vehicleId);
          setLotVehicles(world.inventory.getLotVehicles());
          persistCurrentSave();
        }}
        onClose={() => tabs.back()}
      />
    </>
  );
}

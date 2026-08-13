import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { World } from '../../createWorld';
import type { TabStacks } from '../../ui/Navigator';
import type { ShellTabKey } from '../../ui/AppShell';
import type { LotVehicle } from '../../game/Inventory';
import { PricingScreen } from '../../ui/PricingScreen';
import {
  suggestListPrice,
  classifyPricePosition,
  deriveCompetitorComps,
} from '../../game/MarketEconomy';
import {
  PRICING_STRATEGIES,
  AGED_THRESHOLD_DAYS,
  resolvePricingIntel,
} from '../config';
import type { Hints } from '../useHints';

export interface PricingScreenContainerProps {
  world: World;
  tabs: TabStacks<ShellTabKey>;
  vehicleId: string;
  pricingStrategyId: string;
  /** The teaching cluster (#386/#388) — resolved here, marked on the commit. */
  hints: Hints;
  persistCurrentSave: () => void;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
}

// Pricing screen container (#242 extraction): assembles the valuation/comps/
// suggestion model off the live World for one lot unit. Verbatim from App.tsx.
export function PricingScreenContainer({
  world,
  tabs,
  vehicleId,
  pricingStrategyId,
  hints,
  persistCurrentSave,
  setLotVehicles,
}: PricingScreenContainerProps) {
  const v = world.inventory.getLotVehicles().find((x) => x.id === vehicleId);
  if (!v) {
    // Unit sold/abandoned while the screen was queued — bounce to the game.
    tabs.back();
    return <View style={styles.container} />;
  }
  const { bookValue, marketPrice } = world.marketEconomy.valuationFor(v);
  const strategyEntry =
    PRICING_STRATEGIES.strategies[pricingStrategyId] ??
    PRICING_STRATEGIES.strategies[PRICING_STRATEGIES.defaultStrategy];
  const suggestion = suggestListPrice(
    { bookValue, marketPrice, strategy: pricingStrategyId },
    { config: PRICING_STRATEGIES },
  );
  const ucm = world.staffOrg.currentRoster.find(
    (s) => s.role_id === 'used-car-manager',
  );
  return (
    <>
      <StatusBar style="light" />
      <PricingScreen
        vehicle={{
          id: v.id,
          year: v.year,
          make: v.make,
          model: v.model,
          trim: v.trim,
          bookValue,
          marketPrice,
          vehicleCost: v.purchasePrice + v.reconCost,
          initialAskingPrice: v.askingPrice,
          daysInInventory: v.daysInInventory,
          carryingCostToDate: v.carryingCostToDate,
          dailyCarryingCost: v.dailyCarryingCost,
          aged: v.aged,
          agedThresholdDays: AGED_THRESHOLD_DAYS,
        }}
        comps={deriveCompetitorComps(
          marketPrice,
          // #183: the live drifting roster (CompetitorMarket is now wired
          // into the World), so the comparables panel reflects the actual
          // post-drift market rather than the static base catalog.
          [...world.competitorMarket.getCompetitors()],
          { config: PRICING_STRATEGIES },
        ).slice(0, 4)}
        suggestion={{
          price: suggestion.suggestedPrice,
          source: ucm ? 'ucm' : 'heuristic',
          pricingSkill: ucm?.skills['pricing'],
          strategyLabel: strategyEntry.label,
        }}
        // Intel precision (#284): coarse band/range/confidence by gut, sharp
        // once a UCM is on staff — resolved from the same roster as `ucm` above.
        precision={resolvePricingIntel(world)}
        predictDays={(ask) =>
          world.marketEconomy.predictDaysToSell(
            { ...v, daysOnLot: v.daysInInventory },
            ask,
          )
        }
        classifyPosition={(ask) =>
          classifyPricePosition(ask, marketPrice, {
            config: PRICING_STRATEGIES,
          })
        }
        enabled={world.dayLoop.state().ownershipUnlocked}
        askingPriceHint={hints.hintFor('asking_price')}
        onCommit={(price) => {
          world.inventory.setAskingPrice(v.id, price);
          hints.markUsed('asking_price');
          setLotVehicles(world.inventory.getLotVehicles());
          persistCurrentSave();
        }}
        onClose={() => tabs.back()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
});

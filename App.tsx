import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createSaveStore, createSqliteDriver } from './src/game/SaveStore';
import { createEventBus } from './src/game/EventBus';
import { createGameClock } from './src/game/GameClock';
import { createDepartmentQueue } from './src/game/DepartmentQueue';
import { createCustomerPool } from './src/game/CustomerPool';
import { createDealEngine } from './src/game/DealEngine';
import { createEconomy } from './src/game/Economy';
import { createInventory } from './src/game/Inventory';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from './src/game/NPC';
import { CharacterCreation } from './src/ui/CharacterCreation';
import { HomeView } from './src/ui/HomeView';
import { SalesWorkspace } from './src/ui/SalesWorkspace';
import { AuctionMenu } from './src/ui/AuctionMenu';
import type { CharacterProfile } from './src/game/CareerProgression';
import type { SaveStore } from './src/game/SaveStore';
import type { DeptKey } from './src/game/DepartmentQueue';
import type { CustomerSession, CustomerAction } from './src/game/CustomerPool';
import type { LotVehicle } from './src/game/Inventory';
import { AdminConsole } from './src/ui/AdminConsole';
import { createTelemetry } from './src/game/Telemetry';

// Game modules — created once at module level, outside React lifecycle.
const saveStore: SaveStore = createSaveStore(createSqliteDriver());
const bus = createEventBus();
const clock = createGameClock({ bus, initialDay: 0 });
const departmentQueue = createDepartmentQueue({ bus });
const customerPool = createCustomerPool({
  bus,
  npcDeps: {
    masterSeed: 42,
    personArchetypes: loadPersonArchetypes(),
    visitArchetypes: loadVisitArchetypes(),
    traits: loadTraitTaxonomy(),
  },
});
const economy = createEconomy({ bus, startingCash: 50_000 });
const inventory = createInventory({ bus, masterSeed: 42, economy });
const dealEngine = createDealEngine({ bus, inventory, economy });
const telemetry = createTelemetry({ bus });

type AppScreen = 'loading' | 'character-creation' | 'game' | 'sales-workspace' | 'auction';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [badges, setBadges] = useState(departmentQueue.getBadges());
  const [activeSession, setActiveSession] = useState<CustomerSession | null>(null);
  const [lotVehicles, setLotVehicles] = useState<readonly LotVehicle[]>([]);
  const [cash, setCash] = useState(economy.cash);
  const dayStarted = useRef(false);

  useEffect(() => {
    saveStore.load().then((state) => {
      if (state?.character) {
        setProfile(state.character as CharacterProfile);
        setScreen('game');
      } else {
        setScreen('character-creation');
      }
    });
  }, []);

  // Kick off day 1 once the game screen is shown.
  useEffect(() => {
    if (screen !== 'game' || dayStarted.current) return;
    dayStarted.current = true;
    clock.advanceDay();
    setBadges(departmentQueue.getBadges());
    setLotVehicles(inventory.getLotVehicles());
  }, [screen]);

  // Keep badges, session, inventory, and cash in sync with EventBus.
  useEffect(() => {
    const onArrived = () => setBadges(departmentQueue.getBadges());
    const onChanged = ({ customerId }: { customerId: string }) => {
      const s = customerPool.getSession(customerId);
      if (s) setActiveSession({ ...s });
    };
    const onResolved = () => setBadges(departmentQueue.getBadges());
    const onVehiclePurchased = () => {
      setLotVehicles(inventory.getLotVehicles());
      setCash(economy.cash);
    };
    const onVehicleSold = () => setLotVehicles(inventory.getLotVehicles());
    const onRevenue = () => setCash(economy.cash);

    bus.subscribe('customer:arrived', onArrived);
    bus.subscribe('customer:state_changed', onChanged);
    bus.subscribe('customer:resolved', onResolved);
    bus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    return () => {
      bus.unsubscribe('customer:arrived', onArrived);
      bus.unsubscribe('customer:state_changed', onChanged);
      bus.unsubscribe('customer:resolved', onResolved);
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
    };
  }, []);

  const handleDeptPress = (dept: DeptKey) => {
    if (dept === 'sales') {
      const salesQueue = departmentQueue.getQueue('sales');
      const item = salesQueue.find((i) => i.type === 'workspace' && i.customerId);
      if (item?.customerId) {
        const session = customerPool.getSession(item.customerId);
        if (session) {
          setActiveSession({ ...session });
          setScreen('sales-workspace');
        }
      }
    }
    // finance, service, parts, bdc: screens not yet implemented — tap is a no-op
  };

  const handleDispatch = (action: CustomerAction) => {
    if (!activeSession) return;
    customerPool.dispatch(activeSession.customerId, action);
  };

  const handleSaveCleared = () => {
    setProfile(null);
    setScreen('character-creation');
    dayStarted.current = false;
  };

  let content: React.ReactNode = <View style={styles.container} />;

  if (screen === 'character-creation') {
    content = (
      <>
        <StatusBar style="light" />
        <CharacterCreation
          saveStore={saveStore}
          onComplete={(p: CharacterProfile) => { setProfile(p); setScreen('game'); }}
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
          onClose={() => setScreen('game')}
        />
      </>
    );
  } else if (screen === 'sales-workspace' && activeSession) {
    content = (
      <>
        <StatusBar style="light" />
        <SalesWorkspace
          session={activeSession}
          onDispatch={handleDispatch}
          onClose={() => setScreen('game')}
          dealEngine={dealEngine}
          lotVehicles={lotVehicles}
        />
      </>
    );
  } else if (screen === 'game' && profile) {
    content = (
      <>
        <StatusBar style="light" />
        <HomeView
          profile={profile}
          badges={badges}
          onDeptPress={handleDeptPress}
          lotVehicles={lotVehicles}
          onOpenAuction={() => setScreen('auction')}
        />
      </>
    );
  } else if (screen !== 'loading') {
    content = <View style={styles.container}><StatusBar style="auto" /></View>;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          {content}
        </SafeAreaView>
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

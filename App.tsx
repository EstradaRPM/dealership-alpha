import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createSaveStore, createSqliteDriver } from './src/game/SaveStore';
import { createEventBus } from './src/game/EventBus';
import { createGameClock } from './src/game/GameClock';
import { createDepartmentQueue } from './src/game/DepartmentQueue';
import {
  createCustomerPool,
  SALES_ARCHETYPES,
} from './src/game/CustomerPool';
import { createDealEngine } from './src/game/DealEngine';
import { createEconomy } from './src/game/Economy';
import { createInventory } from './src/game/Inventory';
import { createStaffOrg } from './src/game/StaffOrg';
import { createCapacityManager } from './src/game/CapacityManager';
import { createStaffFloorDrain } from './src/game/StaffDispatch';
import {
  createDayLoopController,
  type FloorSeamProvider,
} from './src/game/DayLoopController';
import type { CustomerSource, CustomerRef } from './src/game/FloorSim';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
  loadStaffTaxonomy,
  loadStaffArchetypes,
} from './src/game/NPC';
import { CharacterCreation } from './src/ui/CharacterCreation';
import { DayLoopShell } from './src/ui/DayLoopShell';
import { AuctionMenu } from './src/ui/AuctionMenu';
import type { CharacterProfile } from './src/game/CareerProgression';
import type { SaveStore } from './src/game/SaveStore';
import type { LotVehicle } from './src/game/Inventory';
import { AdminConsole } from './src/ui/AdminConsole';
import { createTelemetry } from './src/game/Telemetry';

const MASTER_SEED = 42;

// ── Composition root (#114) ──────────────────────────────────────────────────
// Game modules created once at module level, outside React lifecycle.
const saveStore: SaveStore = createSaveStore(createSqliteDriver());
const bus = createEventBus();
// Default initialDay = 1: the clock sits on "night before Day 1" so the
// DayLoopController cold-start (skip-advance on the first nextDay) plays Day 1
// rather than skipping it.
const clock = createGameClock({ bus });
const departmentQueue = createDepartmentQueue({ bus });
// Legacy live-day arrival path OFF: FloorSim owns arrivals via the injected
// customer-source seam below.
const customerPool = createCustomerPool({
  bus,
  legacyDailyArrivals: false,
  npcDeps: {
    masterSeed: MASTER_SEED,
    personArchetypes: loadPersonArchetypes(),
    visitArchetypes: loadVisitArchetypes(),
    traits: loadTraitTaxonomy(),
  },
});
const economy = createEconomy({ bus, startingCash: 50_000 });
const inventory = createInventory({ bus, masterSeed: MASTER_SEED, economy });
const dealEngine = createDealEngine({ bus, inventory, economy });
const staffOrg = createStaffOrg({
  bus,
  economy,
  masterSeed: MASTER_SEED,
  taxonomy: loadStaffTaxonomy(),
  archetypes: loadStaffArchetypes(),
});
// Legacy aggregate admit gate OFF: the per-tick floor gate is the sole
// admittance path under FloorSim.
const capacityManager = createCapacityManager({
  bus,
  staffOrg,
  facilityTier: 1,
  legacyAdmitGate: false,
});
const telemetry = createTelemetry({ bus });

// CustomerPool behind FloorSim's #99 customer-source seam: FloorSim's own
// arrival RNG decides the admitted count per tick; the adapter only mints
// identities for that count via CustomerPool.
const customerSource: CustomerSource = {
  spawn({ day, tick, count }): readonly CustomerRef[] {
    const refs: CustomerRef[] = [];
    for (let i = 0; i < count; i++) {
      const a = SALES_ARCHETYPES[(day + tick + i) % SALES_ARCHETYPES.length];
      const id = customerPool.spawnCustomer(a.personId, a.visitId, a.label);
      refs.push({ id, source: 'ambient', mustHandle: false, department: 'sales' });
    }
    return refs;
  },
};

// Per-day FloorSim seam set: CapacityManager / StaffDispatch / CustomerPool
// behind the locked #99 seams. Invoked once per day → fresh per-day instances.
const floorSeams: FloorSeamProvider = () => ({
  capacity: capacityManager.createFloorGate(),
  drains: [
    createStaffFloorDrain({
      bus,
      staffOrg,
      queue: departmentQueue,
      economy,
      masterSeed: MASTER_SEED,
    }),
  ],
  customerSource,
});

const dayLoop = createDayLoopController({
  bus,
  seed: MASTER_SEED,
  clock,
  floorSeams,
});

type AppScreen = 'loading' | 'character-creation' | 'game' | 'auction';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [lotVehicles, setLotVehicles] = useState<readonly LotVehicle[]>([]);
  const [cash, setCash] = useState(economy.cash);
  // Re-render trigger for the headless DayLoopController lifecycle.
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

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

  // Lifecycle + Auction-relevant state stay in sync with the EventBus.
  useEffect(() => {
    const onDayComplete = () => {
      bump();
      setLotVehicles(inventory.getLotVehicles());
      setCash(economy.cash);
    };
    const onVehiclePurchased = () => {
      setLotVehicles(inventory.getLotVehicles());
      setCash(economy.cash);
    };
    const onVehicleSold = () => setLotVehicles(inventory.getLotVehicles());
    const onRevenue = () => setCash(economy.cash);

    bus.subscribe('floor:day_complete', onDayComplete);
    bus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
    };
  }, []);

  const handleNextDay = () => {
    // MANAGERIAL → FLOOR_OPEN, then run the live floor to exhaustion. The
    // owned FloorSim emits floor:day_complete, which flips the controller
    // back to MANAGERIAL (handled by its own subscription) and re-renders.
    const floor = dayLoop.nextDay();
    floor.runDay();
    bump();
  };

  const handleSaveCleared = () => {
    setProfile(null);
    setScreen('character-creation');
  };

  let content: React.ReactNode = <View style={styles.container} />;

  if (screen === 'character-creation') {
    content = (
      <>
        <StatusBar style="light" />
        <CharacterCreation
          saveStore={saveStore}
          onComplete={(p: CharacterProfile) => {
            setProfile(p);
            setScreen('game');
          }}
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
  } else if (screen === 'game' && profile) {
    content = (
      <>
        <StatusBar style="light" />
        <DayLoopShell
          profile={profile}
          state={dayLoop.state()}
          onNextDay={handleNextDay}
          onOpenAuction={() => setScreen('auction')}
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

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <SafeAreaView
          style={styles.safeArea}
          edges={['top', 'bottom', 'left', 'right']}
        >
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

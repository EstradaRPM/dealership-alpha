import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createSaveStore, createSqliteDriver } from './src/game/SaveStore';
import { createEventBus } from './src/game/EventBus';
import { createGameClock } from './src/game/GameClock';
import { createDepartmentQueue } from './src/game/DepartmentQueue';
import { createCustomerPool } from './src/game/CustomerPool';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from './src/game/NPC';
import { CharacterCreation } from './src/ui/CharacterCreation';
import { HomeView } from './src/ui/HomeView';
import { SalesWorkspace } from './src/ui/SalesWorkspace';
import type { CharacterProfile } from './src/game/CareerProgression';
import type { SaveStore } from './src/game/SaveStore';
import type { DeptKey } from './src/game/DepartmentQueue';
import type { CustomerSession, CustomerAction } from './src/game/CustomerPool';

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

type AppScreen = 'loading' | 'character-creation' | 'game' | 'sales-workspace';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [badges, setBadges] = useState(departmentQueue.getBadges());
  const [activeSession, setActiveSession] = useState<CustomerSession | null>(null);
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
  }, [screen]);

  // Keep badges and active session in sync with EventBus.
  useEffect(() => {
    const onArrived = () => setBadges(departmentQueue.getBadges());
    const onChanged = ({ customerId }: { customerId: string }) => {
      const s = customerPool.getSession(customerId);
      if (s) setActiveSession({ ...s });
    };
    const onResolved = () => setBadges(departmentQueue.getBadges());

    bus.subscribe('customer:arrived', onArrived);
    bus.subscribe('customer:state_changed', onChanged);
    bus.subscribe('customer:resolved', onResolved);
    return () => {
      bus.unsubscribe('customer:arrived', onArrived);
      bus.unsubscribe('customer:state_changed', onChanged);
      bus.unsubscribe('customer:resolved', onResolved);
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
  };

  const handleDispatch = (action: CustomerAction) => {
    if (!activeSession) return;
    customerPool.dispatch(activeSession.customerId, action);
  };

  if (screen === 'loading') {
    return <View style={styles.container} />;
  }

  if (screen === 'character-creation') {
    return (
      <>
        <StatusBar style="light" />
        <CharacterCreation
          saveStore={saveStore}
          onComplete={(p: CharacterProfile) => { setProfile(p); setScreen('game'); }}
        />
      </>
    );
  }

  if (screen === 'sales-workspace' && activeSession) {
    return (
      <>
        <StatusBar style="light" />
        <SalesWorkspace
          session={activeSession}
          onDispatch={handleDispatch}
          onClose={() => setScreen('game')}
        />
      </>
    );
  }

  if (screen === 'game' && profile) {
    return (
      <>
        <StatusBar style="light" />
        <HomeView
          profile={profile}
          badges={badges}
          onDeptPress={handleDeptPress}
        />
      </>
    );
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

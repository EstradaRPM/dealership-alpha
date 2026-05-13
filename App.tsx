import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createSaveStore, createSqliteDriver } from './src/game/SaveStore';
import { CharacterCreation } from './src/ui/CharacterCreation';
import type { CharacterProfile } from './src/game/CareerProgression';
import type { SaveStore } from './src/game/SaveStore';

const saveStore: SaveStore = createSaveStore(createSqliteDriver());

type AppScreen = 'loading' | 'character-creation' | 'game';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');

  useEffect(() => {
    saveStore.load().then((state) => {
      if (state?.character) {
        setScreen('game');
      } else {
        setScreen('character-creation');
      }
    });
  }, []);

  if (screen === 'loading') {
    return <View style={styles.container} />;
  }

  if (screen === 'character-creation') {
    return (
      <>
        <StatusBar style="light" />
        <CharacterCreation
          saveStore={saveStore}
          onComplete={(_profile: CharacterProfile) => setScreen('game')}
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

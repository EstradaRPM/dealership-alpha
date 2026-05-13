import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { loadBackstories, buildCharacterModifier } from '../../game/CareerProgression';
import type { BackstoryId, CharacterProfile } from '../../game/CareerProgression';
import type { SaveStore } from '../../game/SaveStore';

interface Props {
  saveStore: SaveStore;
  onComplete: (profile: CharacterProfile) => void;
}

export function CharacterCreation({ saveStore, onComplete }: Props) {
  const backstories = loadBackstories();
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState<BackstoryId | null>(null);
  const [error, setError] = useState('');

  async function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter your name to continue.');
      return;
    }
    if (!selectedId) {
      setError('Choose a backstory to continue.');
      return;
    }
    const profile = buildCharacterModifier(trimmed, selectedId) as CharacterProfile;
    const existing = await saveStore.load();
    await saveStore.save({ ...(existing ?? {}), character: profile });
    onComplete(profile);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Who are you?</Text>

      <TextInput
        style={styles.nameInput}
        placeholder="Your name"
        value={name}
        onChangeText={(v) => { setName(v); setError(''); }}
        maxLength={40}
      />

      <Text style={styles.subheading}>Choose your backstory</Text>

      {backstories.map((b) => {
        const active = selectedId === b.id;
        return (
          <TouchableOpacity
            key={b.id}
            style={[styles.backstoryCard, active && styles.backstoryCardActive]}
            onPress={() => { setSelectedId(b.id); setError(''); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.backstoryLabel, active && styles.backstoryLabelActive]}>
              {b.label}
            </Text>
            <Text style={styles.backstoryFlavor}>{b.flavor}</Text>
          </TouchableOpacity>
        );
      })}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmText}>Begin</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: '#111',
    flexGrow: 1,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  backstoryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  backstoryCardActive: {
    borderColor: '#c8a96e',
  },
  backstoryLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ddd',
    marginBottom: 6,
  },
  backstoryLabelActive: {
    color: '#c8a96e',
  },
  backstoryFlavor: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  error: {
    color: '#e05555',
    marginTop: 8,
    marginBottom: 8,
    fontSize: 14,
  },
  confirmButton: {
    marginTop: 24,
    backgroundColor: '#c8a96e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
});

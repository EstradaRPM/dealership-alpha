import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import type { MultiSlotSaveStore, SlotMetadata } from '../../game/SaveStore';
import { colors } from '../theme';

type Mode = 'menu' | 'new' | 'load';

interface Props {
  saveStore: MultiSlotSaveStore;
  maxSlots?: number;
  onNewGame: (slotId: string) => void;
  onLoadGame: (slotId: string) => void;
  onSettings: () => void;
}

function formatLastPlayed(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function MainMenu({
  saveStore,
  maxSlots = 3,
  onNewGame,
  onLoadGame,
  onSettings,
}: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [slots, setSlots] = useState<readonly SlotMetadata[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setSlots(await saveStore.listSlots());
  }, [saveStore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name the new game to continue.');
      return;
    }
    try {
      const meta = await saveStore.createSlot(trimmed);
      await saveStore.selectSlot(meta.id);
      setName('');
      setError('');
      onNewGame(meta.id);
    } catch {
      setError('All slots are full. Delete one to start a new game.');
      await refresh();
    }
  }

  function handleDelete(slot: SlotMetadata) {
    Alert.alert(
      'Delete Save',
      `Delete "${slot.name}" (Day ${slot.day})? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await saveStore.deleteSlot(slot.id);
            await refresh();
          },
        },
      ],
    );
  }

  async function handleLoad(slot: SlotMetadata) {
    await saveStore.selectSlot(slot.id);
    onLoadGame(slot.id);
  }

  if (mode === 'menu') {
    return (
      <View style={styles.root}>
        <Text style={styles.brand}>DEALERSHIP</Text>
        <View style={styles.menuButtons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { setMode('new'); setError(''); }}
          >
            <Text style={styles.primaryText}>New Game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { setMode('load'); setError(''); }}
          >
            <Text style={styles.secondaryText}>Load</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSettings}>
            <Text style={styles.secondaryText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const atCap = slots.length >= maxSlots;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'new' ? 'NEW GAME' : 'LOAD GAME'}
        </Text>
        <TouchableOpacity
          onPress={() => { setMode('menu'); setError(''); }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>SAVE SLOTS</Text>

        {slots.length === 0 ? (
          <Text style={styles.emptyText}>No saved games yet.</Text>
        ) : (
          slots.map((slot) => (
            <View key={slot.id} style={styles.slotRow}>
              <TouchableOpacity
                style={styles.slotMain}
                disabled={mode === 'new'}
                onPress={() => handleLoad(slot)}
              >
                <Text style={styles.slotName}>{slot.name}</Text>
                <Text style={styles.slotMeta}>
                  Day {slot.day}  ·  {formatLastPlayed(slot.lastPlayed)}
                </Text>
              </TouchableOpacity>
              {mode === 'new' ? (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(slot)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}

        {mode === 'new' ? (
          <View style={styles.newSlotBox}>
            <Text style={styles.sectionLabel}>START A NEW GAME</Text>
            {atCap ? (
              <Text style={styles.hint}>
                All {maxSlots} slots are full. Delete one above to continue.
              </Text>
            ) : (
              <>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Name this save"
                  placeholderTextColor={colors.borderMuted}
                  value={name}
                  onChangeText={(v) => { setName(v); setError(''); }}
                  maxLength={40}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate}>
                  <Text style={styles.primaryText}>Create &amp; Continue</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.base,
  },
  brand: {
    fontFamily: 'monospace',
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: 96,
  },
  menuButtons: {
    paddingHorizontal: 32,
    marginTop: 64,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.borderMuted,
    letterSpacing: 4,
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  content: {
    padding: 20,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.border,
    letterSpacing: 3,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: colors.borderMuted,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
  },
  slotMain: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  slotName: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  slotMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.borderMuted,
    letterSpacing: 1,
  },
  deleteBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  deleteText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.danger,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  newSlotBox: {
    marginTop: 28,
  },
  nameInput: {
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.base,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hint: {
    color: colors.border,
    fontSize: 11,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  error: {
    color: colors.danger,
    marginTop: 16,
    fontSize: 14,
  },
});

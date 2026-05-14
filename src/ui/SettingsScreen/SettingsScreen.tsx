import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import type { WeeklySnapshot } from '../../game/SaveStore';

interface Props {
  snapshots: readonly WeeklySnapshot[];
  onRollback: (index: number) => void;
  onClose: () => void;
}

function formatDay(day: number): string {
  const week = Math.ceil(day / 7);
  return `Week ${week}  ·  Day ${day}`;
}

export function SettingsScreen({ snapshots, onRollback, onClose }: Props) {
  function handleRollback(index: number) {
    const snap = snapshots[index];
    if (!snap) return;
    Alert.alert(
      'Rollback Save',
      `Restore to ${formatDay(snap.day)}, Tier ${snap.tier}? Progress since then will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rollback',
          style: 'destructive',
          onPress: () => onRollback(index),
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>SETTINGS</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>WEEKLY SNAPSHOTS</Text>

        {snapshots.length === 0 ? (
          <Text style={styles.emptyText}>No snapshots yet. One is saved at the end of each week.</Text>
        ) : (
          snapshots.map((snap, i) => (
            <TouchableOpacity
              key={`${snap.day}-${i}`}
              style={styles.snapshotRow}
              onPress={() => handleRollback(i)}
            >
              <View style={styles.snapshotMeta}>
                <Text style={styles.snapshotDay}>{formatDay(snap.day)}</Text>
                <Text style={styles.snapshotTier}>Tier {snap.tier}</Text>
              </View>
              <Text style={styles.rollbackLabel}>Rollback</Text>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.hint}>
          Up to 6 snapshots are kept. Rolling back restores game state to that week.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555',
    letterSpacing: 4,
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  closeText: {
    color: '#888',
    fontSize: 14,
  },
  content: {
    padding: 20,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#444',
    letterSpacing: 3,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: '#555',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#252525',
  },
  snapshotMeta: {
    gap: 4,
  },
  snapshotDay: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  snapshotTier: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555',
    letterSpacing: 1,
  },
  rollbackLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#c8a96e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: {
    color: '#444',
    fontSize: 11,
    marginTop: 20,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});

import React from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { DeptKey } from '../../game/DepartmentQueue';

const DEPARTMENTS: { key: DeptKey; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'service', label: 'Service' },
  { key: 'bdc', label: 'BDC' },
  { key: 'office', label: 'Office' },
  { key: 'lot', label: 'Lot' },
];

type DeptBadges = Record<DeptKey, number>;

interface Props {
  profile: CharacterProfile;
  badges?: DeptBadges;
  onSwipeResolve?: (dept: DeptKey) => void;
}

const DEFAULT_BADGES: DeptBadges = { sales: 0, service: 0, bdc: 0, office: 0, lot: 0 };

function DeptItem({
  deptKey,
  label,
  count,
  onSwipe,
}: {
  deptKey: DeptKey;
  label: string;
  count: number;
  onSwipe?: (dept: DeptKey) => void;
}) {
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 10 && Math.abs(dy) < 20,
      onPanResponderRelease: (_, { dx }) => {
        if (Math.abs(dx) > 50 && count > 0 && onSwipe) {
          onSwipe(deptKey);
        }
      },
    })
  ).current;

  return (
    <View style={styles.deptItem} {...panResponder.panHandlers}>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
      <Text style={styles.deptLabel}>{label}</Text>
    </View>
  );
}

export function HomeView({ profile, badges = DEFAULT_BADGES, onSwipeResolve }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.dealershipName}>{profile.name}'s Lot</Text>
        <Text style={styles.tierLabel}>Tier 1 — Gravel Yard</Text>
      </View>

      <View style={styles.illustration} accessibilityLabel="Tier 1 gravel yard lot">
        <Text style={styles.illustrationPlaceholder}>🏚</Text>
        <Text style={styles.illustrationCaption}>Your gravel yard awaits.</Text>
      </View>

      <View style={styles.statusBar}>
        {DEPARTMENTS.map(({ key, label }) => (
          <DeptItem
            key={key}
            deptKey={key}
            label={label}
            count={badges[key]}
            onSwipe={onSwipeResolve}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dealershipName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  tierLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationPlaceholder: {
    fontSize: 80,
    marginBottom: 12,
  },
  illustrationCaption: {
    fontSize: 15,
    color: '#555',
    fontStyle: 'italic',
  },
  statusBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#161616',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  deptItem: {
    flex: 1,
    alignItems: 'center',
  },
  deptLabel: {
    fontSize: 11,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#c8a96e',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111',
  },
});

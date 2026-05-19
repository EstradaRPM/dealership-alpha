import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { DeptKey } from '../../game/DepartmentQueue';
import { colors } from '../theme';

/**
 * The 5-department bottom nav (#76). Always tappable — the badge count is a
 * visual indicator only, never a disabled gate (see #71: a fresh run has all
 * badges at 0 and the nav must still respond). Pure view: it dispatches a
 * `DeptKey` and renders the injected badge map.
 */
export interface BottomNavProps {
  badges: Record<DeptKey, number>;
  onPress: (dept: DeptKey) => void;
}

const TABS: readonly { key: DeptKey; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'service', label: 'Service' },
  { key: 'bdc', label: 'BDC' },
  { key: 'office', label: 'Office' },
  { key: 'lot', label: 'Lot' },
];

export function BottomNav({ badges, onPress }: BottomNavProps) {
  return (
    <View style={styles.bar}>
      {TABS.map(({ key, label }) => {
        const count = badges[key] ?? 0;
        return (
          <TouchableOpacity
            key={key}
            style={styles.tab}
            onPress={() => onPress(key)}
            accessibilityRole="button"
            accessibilityLabel={
              count > 0 ? `${label}, ${count} waiting` : label
            }
          >
            <View style={styles.iconRow}>
              <Text style={styles.label}>{label}</Text>
              {count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceRaised,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

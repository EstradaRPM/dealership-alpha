import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import type { QueueItem } from '../../game/DepartmentQueue';
import { colors } from '../theme';

/**
 * Generic resolve-list for a single department (#76). One component drives
 * Service / BDC / Office / Lot — the only per-department variance is the
 * injected `onResolve` and the optional presentation slots. Sales is NOT a
 * resolve-list (it routes to the hand-play workspace), so it never mounts
 * this.
 *
 * `renderItem` / `background` are deliberate seams: art (vehicle models,
 * lot/shop backdrops, customer icons) and richer rows layer on later WITHOUT
 * reworking resolve logic. Unused in v1 — present so downstream slices don't
 * touch the resolve path.
 */
export interface DepartmentScreenProps {
  /** Human-facing department title. */
  title: string;
  /** The queue for this department (read-model; never mutated here). */
  items: readonly QueueItem[];
  /** Resolve one item by id. The caller owns the queue + badge decrement. */
  onResolve: (id: string) => void;
  /** Back out of the screen. */
  onClose: () => void;
  /** Optional custom row renderer. Default: a label + "Resolve" affordance. */
  renderItem?: (item: QueueItem) => React.ReactNode;
  /** Optional behind-the-list backdrop (art layer). */
  background?: React.ReactNode;
}

export function DepartmentScreen({
  title,
  items,
  onResolve,
  onClose,
  renderItem,
  background,
}: DepartmentScreenProps) {
  return (
    <View style={styles.root}>
      {background != null && (
        <View style={styles.background} pointerEvents="none">
          {background}
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <Text style={styles.empty}>Nothing waiting in {title}.</Text>
        ) : (
          items.map((item) =>
            renderItem != null ? (
              <React.Fragment key={item.id}>
                {renderItem(item)}
              </React.Fragment>
            ) : (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                onPress={() => onResolve(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Resolve: ${item.label}`}
              >
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowAction}>Resolve →</Text>
              </TouchableOpacity>
            ),
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  background: { ...StyleSheet.absoluteFillObject },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceRaised,
  },
  backBtn: { paddingRight: 14, paddingVertical: 4 },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  count: {
    color: colors.textMuted,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  list: { padding: 16 },
  empty: {
    color: colors.borderMuted,
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  rowLabel: { color: colors.textPrimary, fontSize: 15, flex: 1, paddingRight: 12 },
  rowAction: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type { HistoryEntry, HistoryEntryKind } from '../../game/HistoryLog';
import { colors } from '../theme';

const KIND_LABEL: Record<HistoryEntryKind, string> = {
  sale: 'SALE',
  escalation: 'ESCALATION',
  market: 'MARKET',
  tier: 'MILESTONE',
};

const KIND_COLOR: Record<HistoryEntryKind, string> = {
  sale: colors.reward,
  escalation: colors.primary,
  market: colors.textSecondary,
  tier: colors.reward,
};

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={[styles.kind, { color: KIND_COLOR[entry.kind] }]}>
          {KIND_LABEL[entry.kind]}
        </Text>
        <Text style={styles.day}>Day {entry.day}</Text>
      </View>
      <Text style={styles.text}>{entry.text}</Text>
    </View>
  );
}

export interface HistoryScreenProps {
  entries: ReadonlyArray<HistoryEntry>;
  onClose?: () => void;
}

export function HistoryScreen({ entries, onClose }: HistoryScreenProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        {onClose ? (
          <TouchableOpacity
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close history"
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {entries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            No history yet. Notable events — sales, escalations, market shifts,
            promotions — will appear here as they happen.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
        >
          {entries.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    gap: 10,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kind: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  day: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

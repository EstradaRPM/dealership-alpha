import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { HistoryEntry, HistoryEntryKind } from '../../game/HistoryLog';
import { useTheme } from '../theme';
import { Surface, Badge, type BadgeTone } from '../kit';
import { actionFooterClearance } from '../AppShell';

const KIND_LABEL: Record<HistoryEntryKind, string> = {
  sale: 'Sale',
  escalation: 'Escalation',
  market: 'Market',
  tier: 'Milestone',
  staff: 'Staff',
  inventory: 'Inventory',
};

const KIND_TONE: Record<HistoryEntryKind, BadgeTone> = {
  sale: 'reward',
  escalation: 'info',
  market: 'neutral',
  tier: 'positive',
  // A departure is a loss, and the badge should not congratulate you for it.
  staff: 'danger',
  // Wholesaling out is a decision, not a win — usually a loss taken on purpose
  // to free a space. It gets the plain badge, never the sale's reward badge.
  inventory: 'neutral',
};

export interface HistoryScreenProps {
  entries: ReadonlyArray<HistoryEntry>;
  onClose: () => void;
}

/**
 * Deal history (#208, re-homed by #351) — a sibling screen inside the Finance
 * tab rather than a full-screen route behind the in-game menu. The durable
 * record of what actually happened, day by day, newest first; the tab bar stays
 * mounted behind it (locked IA §3).
 */
export function HistoryScreen({ entries, onClose }: HistoryScreenProps) {
  const t = useTheme();
  const s = makeStyles(t);

  return (
    <View style={s.root} testID="history-screen">
      <View style={s.header}>
        <TouchableOpacity
          onPress={onClose}
          testID="history-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={s.backBtn}
        >
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Deal History</Text>
      </View>
      {entries.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>
            No history yet. Notable events — sales, escalations, market shifts,
            promotions — will appear here as they happen.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          {entries.map((entry) => (
            <View key={entry.id} style={s.row}>
              <Surface variant="inset">
                <View style={s.rowHead}>
                  <Badge
                    label={KIND_LABEL[entry.kind]}
                    tone={KIND_TONE[entry.kind]}
                    variant="soft"
                  />
                  <Text style={s.day}>Day {entry.day}</Text>
                </View>
                <Text style={s.text}>{entry.text}</Text>
              </Surface>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.base },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.borderMuted,
    },
    backBtn: { paddingRight: t.spacing.md, paddingVertical: t.spacing.xxs },
    backText: { ...t.typography.button, color: t.colors.accent },
    title: { ...t.typography.title, color: t.colors.textPrimary, flex: 1 },
    body: { padding: t.spacing.lg, paddingBottom: actionFooterClearance(t) },
    row: { marginBottom: t.spacing.sm },
    rowHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    day: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    text: {
      ...t.typography.body,
      color: t.colors.textSecondary,
      marginTop: t.spacing.xs,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.xxl,
    },
    emptyText: {
      ...t.typography.body,
      color: t.colors.textMuted,
      textAlign: 'center',
    },
  });
}

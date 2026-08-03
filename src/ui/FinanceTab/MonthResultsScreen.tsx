import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, Badge } from '../kit';
import { actionFooterClearance } from '../AppShell';
import type { MonthResultsModel, MonthResultRow } from './monthResultsModel';

export interface MonthResultsScreenProps {
  model: MonthResultsModel;
  onClose: () => void;
}

/**
 * Month-close results (#351) — a sibling screen inside the Finance tab.
 *
 * The month-close interstitial is a beat that goes by once; this is the record
 * you can go back to. Each closed month shows the gate's grade, how every
 * graded face landed against its bar, and the four numbers the month actually
 * produced. Reading it never unmounts the console (locked IA §3).
 */
export function MonthResultsScreen({ model, onClose }: MonthResultsScreenProps) {
  const t = useTheme();
  const s = makeStyles(t);

  return (
    <View style={s.root} testID="month-results-screen">
      <View style={s.header}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={s.backBtn}
        >
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Month-Close Results</Text>
      </View>

      {model.rows.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>{model.emptyNote}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          {model.rows.map((row) => (
            <View key={row.month} style={s.region}>
              <MonthCard row={row} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MonthCard({ row }: { row: MonthResultRow }) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <Surface testID={`month-result-${row.month}`}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <SectionHeader title={row.title} />
          <Text style={s.sub}>{row.subtitle}</Text>
        </View>
        <Badge label={row.bandLabel} tone={row.tone} variant="soft" />
      </View>

      <View style={s.statRow}>
        {row.stats.map((stat) => (
          <View key={stat.label} style={s.stat}>
            <Text style={s.statValue}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.faces}>
        {row.faces.map((face) => (
          <View key={face.id} style={s.faceRow}>
            <Text style={s.faceLabel}>{face.label}</Text>
            <Text style={s.faceRatio}>{face.ratioLabel}</Text>
            <Badge label={face.bandLabel} tone={face.tone} variant="outline" />
          </View>
        ))}
      </View>
    </Surface>
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
    // Same bottom clearance the shell's tab content carries, so the floating
    // action band never lands on the last month's card.
    body: { padding: t.spacing.lg, paddingBottom: actionFooterClearance(t) },
    region: { marginBottom: t.spacing.lg },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm },
    sub: { ...t.typography.caption, color: t.colors.textMuted, marginTop: t.spacing.xxs },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: t.spacing.md,
      gap: t.spacing.md,
    },
    stat: { flexGrow: 1, flexBasis: '40%' },
    statValue: {
      ...t.typography.statValue,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    statLabel: { ...t.typography.statLabel, color: t.colors.textMuted },
    faces: { marginTop: t.spacing.md, gap: t.spacing.xs },
    faceRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    faceLabel: { ...t.typography.body, color: t.colors.textSecondary, flex: 1 },
    faceRatio: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xxl },
    emptyText: {
      ...t.typography.body,
      color: t.colors.textMuted,
      textAlign: 'center',
    },
  });
}

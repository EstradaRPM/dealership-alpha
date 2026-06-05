import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DemandTrend } from '../../game/DemandShaper';
import { colors } from '../theme';

/**
 * Pure read-model for the MANAGERIAL "who's been walking in" readout (#198).
 * The composition root assembles this off `DemandShaper.getObservedMix()`,
 * mapping each persona id to its human label. The view renders bars + trend
 * arrows and dispatches nothing.
 */
export interface DemandReadoutEntry {
  persona: string;
  label: string;
  /** Fraction of the trailing window (0–1). */
  share: number;
  count: number;
  trend: DemandTrend;
}

export interface DemandReadoutModel {
  entries: readonly DemandReadoutEntry[];
  /** Total arrivals in the trailing window (0 ⇒ "no data yet"). */
  totalObserved: number;
}

const TREND_GLYPH: Record<DemandTrend, string> = {
  rising: '▲',
  steady: '→',
  falling: '▼',
};

function trendColor(trend: DemandTrend): string {
  switch (trend) {
    case 'rising':
      return colors.positive;
    case 'falling':
      return colors.danger;
    case 'steady':
    default:
      return colors.textMuted;
  }
}

function DemandRow({ entry }: { entry: DemandReadoutEntry }) {
  const pct = Math.round(entry.share * 100);
  return (
    <View style={styles.row} accessibilityRole="text">
      <Text style={styles.rowLabel} numberOfLines={1}>
        {entry.label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.rowPct}>{pct}%</Text>
      <Text
        style={[styles.rowTrend, { color: trendColor(entry.trend) }]}
        accessibilityLabel={`${entry.label} trend ${entry.trend}`}
      >
        {TREND_GLYPH[entry.trend]}
      </Text>
    </View>
  );
}

/**
 * Observed persona-mix card: per-persona share bars + rising/steady/falling
 * trend arrows over the trailing arrival window. Read-only; smoke tests only.
 */
export function DemandReadout({ model }: { model: DemandReadoutModel }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Who's Been Walking In</Text>
      {model.totalObserved === 0 ? (
        <Text style={styles.empty}>No traffic yet — open the lot to see the mix.</Text>
      ) : (
        model.entries.map((entry) => (
          <DemandRow key={entry.persona} entry={entry} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 20,
    marginTop: 16,
  },
  title: {
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  empty: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { width: 96, fontSize: 14, color: colors.textSecondary },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  rowPct: {
    width: 38,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rowTrend: { width: 20, fontSize: 14, textAlign: 'center', marginLeft: 6 },
});

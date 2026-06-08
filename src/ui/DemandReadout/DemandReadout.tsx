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

export interface DemandTargetingLean {
  persona: string;
  label: string;
  /** Raw additive influence weight from the lever. */
  weight: number;
}

export interface DemandTargetingLever {
  id: string;
  label: string;
  lean: readonly DemandTargetingLean[];
}

export interface DemandCoverageGap {
  category: string;
  label: string;
  wantedCount: number;
  stockCount: number;
}

export interface DemandReadoutModel {
  entries: readonly DemandReadoutEntry[];
  /** Total arrivals in the trailing window (0 ⇒ "no data yet"). */
  totalObserved: number;
  targetingLevers?: readonly DemandTargetingLever[];
  coverageGap?: DemandCoverageGap | null;
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

function TargetingLeverRow({ lever }: { lever: DemandTargetingLever }) {
  const leanText =
    lever.lean.length === 0
      ? 'Neutral'
      : lever.lean
          .map((item) => `${item.label} +${Math.round(item.weight * 100)}`)
          .join(' / ');
  return (
    <View style={styles.targetingRow} accessibilityRole="text">
      <Text style={styles.targetingLabel} numberOfLines={1}>
        {lever.label}
      </Text>
      <Text style={styles.targetingLean}>{leanText}</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Who You're Targeting</Text>
        {model.targetingLevers && model.targetingLevers.length > 0 ? (
          model.targetingLevers.map((lever) => (
            <TargetingLeverRow key={lever.id} lever={lever} />
          ))
        ) : (
          <Text style={styles.empty}>No active targeting levers.</Text>
        )}
      </View>

      {model.coverageGap && (
        <View style={styles.coverageLine} accessibilityRole="text">
          <Text style={styles.coverageText}>
            Lot coverage: recent buyers wanted {model.coverageGap.label}; you
            stock {model.coverageGap.stockCount}.
          </Text>
        </View>
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
  section: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  sectionTitle: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  targetingRow: { paddingVertical: 4 },
  targetingLabel: { fontSize: 14, color: colors.textSecondary },
  targetingLean: { marginTop: 2, fontSize: 13, color: colors.textMuted },
  coverageLine: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  coverageText: { fontSize: 13, color: colors.textSecondary },
});

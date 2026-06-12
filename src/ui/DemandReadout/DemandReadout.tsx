import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import type { DemandTrend } from '../../game/DemandShaper';
import { useTheme } from '../theme';
import { Surface, SectionHeader, ProgressBar, Icon, type IconName, type IconProps } from '../kit';

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

/** Trend glyph + tone, in the same idiom as GateStrip's faces. */
const TREND_ICONS: Record<DemandTrend, { icon: IconName; tone: IconProps['tone'] }> = {
  rising: { icon: 'trending-up', tone: 'positive' },
  falling: { icon: 'trending-down', tone: 'danger' },
  steady: { icon: 'arrow-forward', tone: 'muted' },
};

function DemandRow({ entry }: { entry: DemandReadoutEntry }) {
  const t = useTheme();
  const pct = Math.round(entry.share * 100);
  const trend = TREND_ICONS[entry.trend];
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  };
  const label: TextStyle = {
    ...t.typography.body,
    color: t.colors.textSecondary,
    flexBasis: '30%',
  };
  const pctText: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    fontVariant: ['tabular-nums'],
    flexBasis: '11%',
    textAlign: 'right',
  };
  return (
    <View style={row} accessibilityRole="text">
      <Text style={label} numberOfLines={1}>
        {entry.label}
      </Text>
      <View style={{ flex: 1 }}>
        <ProgressBar value={entry.share} />
      </View>
      <Text style={pctText}>{pct}%</Text>
      <View accessibilityLabel={`${entry.label} trend ${entry.trend}`}>
        <Icon name={trend.icon} size="sm" tone={trend.tone} />
      </View>
    </View>
  );
}

function TargetingLeverRow({ lever }: { lever: DemandTargetingLever }) {
  const t = useTheme();
  const leanText =
    lever.lean.length === 0
      ? 'Neutral'
      : lever.lean
          .map((item) => `${item.label} +${Math.round(item.weight * 100)}`)
          .join(' / ');
  return (
    <View style={{ paddingVertical: t.spacing.xs }} accessibilityRole="text">
      <Text style={{ ...t.typography.label, color: t.colors.textSecondary }} numberOfLines={1}>
        {lever.label}
      </Text>
      <Text
        style={{
          ...t.typography.caption,
          color: t.colors.textMuted,
          marginTop: t.spacing.xxs,
        }}
      >
        {leanText}
      </Text>
    </View>
  );
}

/**
 * Observed persona-mix card: per-persona share bars + rising/steady/falling
 * trend glyphs over the trailing arrival window. The card paints no top-level
 * title — HomeTab's "Market" region header is the only header (#257); internal
 * sections read as `SectionHeader`s / quiet captions. Read-only; smoke tests only.
 */
export function DemandReadout({ model }: { model: DemandReadoutModel }) {
  const t = useTheme();
  const empty: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontStyle: 'italic',
  };
  const dividedSection: ViewStyle = {
    marginTop: t.spacing.lg,
    paddingTop: t.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.borderMuted,
  };
  return (
    <Surface testID="demand-readout">
      {model.totalObserved === 0 ? (
        <Text style={empty}>No traffic yet — open the lot to see the mix.</Text>
      ) : (
        model.entries.map((entry) => (
          <DemandRow key={entry.persona} entry={entry} />
        ))
      )}

      <View style={dividedSection}>
        <SectionHeader title="Who You're Targeting" />
        <View style={{ marginTop: t.spacing.sm }}>
          {model.targetingLevers && model.targetingLevers.length > 0 ? (
            model.targetingLevers.map((lever) => (
              <TargetingLeverRow key={lever.id} lever={lever} />
            ))
          ) : (
            <Text style={empty}>No active targeting levers.</Text>
          )}
        </View>
      </View>

      {model.coverageGap && (
        <View style={dividedSection} accessibilityRole="text">
          <Text style={{ ...t.typography.caption, color: t.colors.textSecondary }}>
            Lot coverage: recent buyers wanted {model.coverageGap.label}; you
            stock {model.coverageGap.stockCount}.
          </Text>
        </View>
      )}
    </Surface>
  );
}

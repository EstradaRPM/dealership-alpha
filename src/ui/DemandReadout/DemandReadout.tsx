import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import type { DemandTrend } from '../../game/DemandShaper';
import { useTheme } from '../theme';
import {
  Surface,
  SectionHeader,
  ProgressBar,
  Icon,
  Badge,
  type BadgeTone,
  type IconName,
  type IconProps,
} from '../kit';

/**
 * Pure read-model for the MANAGERIAL "what's hot on the lot" segment-heat
 * readout (#198, re-keyed to vehicle-type segments in #278). The composition
 * root assembles this off `DemandShaper.getObservedMix()`, mapping each segment
 * id to its human label. The view renders bars + trend arrows and dispatches
 * nothing.
 */
export interface DemandReadoutEntry {
  segment: string;
  label: string;
  /** Fraction of the trailing window (0–1). */
  share: number;
  count: number;
  trend: DemandTrend;
}

/** Coarse demand temperature for a segment. */
export type HeatBand = 'hot' | 'warm' | 'cold';

export interface HeatBandThresholds {
  /** share × segmentCount at/above which a segment reads HOT. */
  hot: number;
  /** share × segmentCount at/below which a segment reads COLD. */
  cold: number;
}

/**
 * Classify a segment's normalized heat share into a coarse band. `share` is the
 * segment's slice of the live heat vector (sums to 1 across segments), so
 * `share × segmentCount` expresses it as a multiple of a fair, even split:
 * 1.0 = even, >1 over-weighted (hotter), <1 under-weighted (cooler). Pure.
 */
export function classifyHeatBand(
  share: number,
  segmentCount: number,
  thresholds: HeatBandThresholds,
): HeatBand {
  const heat = share * segmentCount;
  if (heat >= thresholds.hot) return 'hot';
  if (heat <= thresholds.cold) return 'cold';
  return 'warm';
}

export interface HeatBandEntry {
  segment: string;
  label: string;
  band: HeatBand;
}

export interface DemandTargetingLean {
  segment: string;
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
  /**
   * Forward demand signal (#280): the live per-segment heat vector that drives
   * spawns, banded HOT/WARM/COLD. Sorted hottest-first. Absent ⇒ console hidden.
   */
  heatBands?: readonly HeatBandEntry[];
  entries: readonly DemandReadoutEntry[];
  /** Total arrivals in the trailing window (0 ⇒ "no data yet"). */
  totalObserved: number;
  targetingLevers?: readonly DemandTargetingLever[];
  coverageGap?: DemandCoverageGap | null;
}

/** Warm→cool temperature ramp + glyph for each heat band. */
const HEAT_BANDS: Record<HeatBand, { label: string; tone: BadgeTone; icon: IconName }> = {
  hot: { label: 'Hot', tone: 'reward', icon: 'trending-up' },
  warm: { label: 'Warm', tone: 'neutral', icon: 'arrow-forward' },
  cold: { label: 'Cold', tone: 'info', icon: 'trending-down' },
};

function HeatRow({ entry }: { entry: HeatBandEntry }) {
  const t = useTheme();
  const band = HEAT_BANDS[entry.band];
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  };
  const label: TextStyle = {
    ...t.typography.body,
    color: t.colors.textSecondary,
    flex: 1,
  };
  return (
    <View style={row} accessibilityRole="text">
      <Icon name={band.icon} size="sm" tone={band.tone === 'neutral' ? 'muted' : band.tone === 'reward' ? 'positive' : 'primary'} />
      <Text style={label} numberOfLines={1}>
        {entry.label}
      </Text>
      <View accessibilityLabel={`${entry.label} demand ${band.label}`}>
        <Badge label={band.label} tone={band.tone} variant="soft" />
      </View>
    </View>
  );
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
 * Segment-heat card: per-segment share bars + rising/steady/falling trend
 * glyphs over the trailing arrival window — "what's hot on the lot" (#278). The
 * card paints no top-level title — HomeTab's "Market" region header is the only
 * header (#257); internal sections read as `SectionHeader`s / quiet captions.
 * Read-only; smoke tests only.
 */
export function DemandReadout({ model }: { model: DemandReadoutModel }) {
  const t = useTheme();
  // Calm muted caption, not italic — italic empty-states read as wireframe
  // placeholder filler (#265).
  const empty: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
  };
  const dividedSection: ViewStyle = {
    marginTop: t.spacing.lg,
    paddingTop: t.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.borderMuted,
  };
  const hasHeat = model.heatBands && model.heatBands.length > 0;
  return (
    <Surface testID="demand-readout">
      {hasHeat && (
        <View testID="demand-heat-console">
          <SectionHeader title="Demand Heat" />
          <Text style={{ ...empty, marginTop: t.spacing.xxs, marginBottom: t.spacing.xs }}>
            What buyers want right now — stock and price to it.
          </Text>
          {model.heatBands!.map((entry) => (
            <HeatRow key={entry.segment} entry={entry} />
          ))}
        </View>
      )}

      <View style={hasHeat ? dividedSection : undefined}>
        {hasHeat && <SectionHeader title="Who's Been Walking In" />}
        <View style={hasHeat ? { marginTop: t.spacing.sm } : undefined}>
          {model.totalObserved === 0 ? (
            <Text style={empty}>No traffic yet — open the lot to see what's hot.</Text>
          ) : (
            model.entries.map((entry) => (
              <DemandRow key={entry.segment} entry={entry} />
            ))
          )}
        </View>
      </View>

      <View style={dividedSection}>
        <SectionHeader title="What You're Promoting" />
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

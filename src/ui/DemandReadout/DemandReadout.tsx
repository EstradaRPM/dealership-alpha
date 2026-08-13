import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import type { DemandTrend } from '../../game/DemandShaper';
import { useTheme } from '../theme';
import { emptyState } from '../copy';
import {
  Surface,
  SectionHeader,
  ProgressBar,
  Icon,
  Badge,
  HintLine,
  Coachmark,
  type CoachmarkModel,
  type BadgeTone,
  type IconName,
  type IconProps,
} from '../kit';
import { ChipRow } from '../DeptControls';

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

/**
 * Demand temperature for a segment. The coarse readout (no UCM) only ever emits
 * the middle three; the fine readout (UCM on staff, #284) adds the two extremes.
 */
export type HeatBand = 'very-hot' | 'hot' | 'warm' | 'cold' | 'very-cold';

export interface HeatBandThresholds {
  /** share × segmentCount at/above which a segment reads HOT. */
  hot: number;
  /** share × segmentCount at/below which a segment reads COLD. */
  cold: number;
  /** Fine-band edge: at/above this a hot segment reads VERY HOT (#284). */
  veryHot: number;
  /** Fine-band edge: at/below this a cold segment reads VERY COLD (#284). */
  veryCold: number;
}

/** A segment's normalized heat as a multiple of an even split (1.0 = fair share). */
export function heatIndexFor(share: number, segmentCount: number): number {
  return share * segmentCount;
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
  const heat = heatIndexFor(share, segmentCount);
  if (heat >= thresholds.hot) return 'hot';
  if (heat <= thresholds.cold) return 'cold';
  return 'warm';
}

/**
 * Fine 5-band classification surfaced once a UCM sharpens the read (#284). Same
 * heat index as the coarse band, but resolves the two extremes the gut read
 * can't distinguish — a merely-warm-hot from a red-hot segment.
 */
export function classifyHeatBandFine(
  share: number,
  segmentCount: number,
  thresholds: HeatBandThresholds,
): HeatBand {
  const heat = heatIndexFor(share, segmentCount);
  if (heat >= thresholds.veryHot) return 'very-hot';
  if (heat >= thresholds.hot) return 'hot';
  if (heat <= thresholds.veryCold) return 'very-cold';
  if (heat <= thresholds.cold) return 'cold';
  return 'warm';
}

export interface HeatBandEntry {
  segment: string;
  label: string;
  band: HeatBand;
  /** Numeric heat index, present only in the fine (UCM) readout (#284). */
  heatIndex?: number;
}

export interface DemandTargetingLean {
  segment: string;
  label: string;
  /** Raw additive influence weight from the lever. */
  weight: number;
}

/** One buyer type a lever is pulling harder on (#372). */
export interface DemandCrowdLean {
  personArchetype: string;
  label: string;
  /** Raw additive person-archetype weight from the lever. */
  weight: number;
}

export interface DemandTargetingLever {
  id: string;
  label: string;
  lean: readonly DemandTargetingLean[];
  /**
   * Who this lever brings in (#372) — the crowd lane, beside `lean`'s vehicle
   * lane. Empty for a lever that only shifts which kind of car is in demand.
   */
  crowdLean?: readonly DemandCrowdLean[];
}

/** One selectable advertising campaign (#212). */
export interface DemandAdvertisingOption {
  id: string;
  label: string;
  blurb: string;
  /**
   * Pre-formatted daily spend — "$75/day" (#349). Absent for the free "no
   * campaign" option. The console shows it on every chip, not just the running
   * one: comparing what each push costs IS the decision, and a lever with no
   * visible price is a lever with no teeth.
   */
  costLabel?: string;
}

/**
 * The advertising campaign control (#212), moved onto the demand console in
 * #346 — the locked IA §4 takes marketing/demand levers out of Operations Prep
 * and gives them to the console, which Growth inherits with the whole stack.
 * It sits with "What You're Promoting" because that is the readout of what this
 * lever does.
 */
export interface DemandAdvertisingControl {
  options: readonly DemandAdvertisingOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** What running a campaign costs and changes (#388), null once used. */
  hint?: string | null;
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
  /** The advertising campaign the player is running (#212 / #346). */
  advertising?: DemandAdvertisingControl;
  coverageGap?: DemandCoverageGap | null;
  /**
   * The first-run spine's coverage-gap step (#213), drawn under the line it is
   * teaching the player to read. Null/absent ⇒ not the step the player owes.
   */
  coachmark?: CoachmarkModel | null;
}

// Plain-language DEMAND-axis labels + glyph for each band. The internal model
// stays hot/warm/cold; the player-facing word names the axis (how much buyers
// want this vehicle type), never the temperature — the locked "no vague
// temperature labels" rule, same treatment as ServicePage/BodyShopPage.
const HEAT_BANDS: Record<HeatBand, { label: string; tone: BadgeTone; icon: IconName }> = {
  'very-hot': { label: 'Very high demand', tone: 'reward', icon: 'trending-up' },
  hot: { label: 'High demand', tone: 'reward', icon: 'trending-up' },
  warm: { label: 'Steady demand', tone: 'neutral', icon: 'arrow-forward' },
  cold: { label: 'Low demand', tone: 'info', icon: 'trending-down' },
  'very-cold': { label: 'Very low demand', tone: 'info', icon: 'trending-down' },
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
  const indexText: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontVariant: ['tabular-nums'],
  };
  return (
    <View style={row} accessibilityRole="text">
      <Icon name={band.icon} size="sm" tone={band.tone === 'neutral' ? 'muted' : band.tone === 'reward' ? 'positive' : 'primary'} />
      <Text style={label} numberOfLines={1}>
        {entry.label}
      </Text>
      {entry.heatIndex != null && (
        <Text
          style={indexText}
          accessibilityLabel={`${entry.label} heat index ${entry.heatIndex.toFixed(2)}`}
        >
          {entry.heatIndex.toFixed(2)}×
        </Text>
      )}
      <View accessibilityLabel={`${entry.label} ${band.label}`}>
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
  const crowdLean = lever.crowdLean ?? [];
  const leanText =
    lever.lean.length === 0
      ? 'Neutral'
      : lever.lean
          .map((item) => `${item.label} +${Math.round(item.weight * 100)}`)
          .join(' / ');
  // The crowd lane reads as its own sentence rather than more chips (#372):
  // "SUVs +85" and "Retirees +50" are different kinds of fact — what they want
  // to buy, and who they are — and running them together invites the player to
  // read one as the other.
  const crowdText =
    crowdLean.length === 0
      ? null
      : `Brings in: ${crowdLean
          .map((item) => `${item.label} +${Math.round(item.weight * 100)}`)
          .join(' / ')}`;
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
      {crowdText ? (
        <Text
          style={{
            ...t.typography.caption,
            color: t.colors.textMuted,
            marginTop: t.spacing.xxs,
          }}
        >
          {crowdText}
        </Text>
      ) : null}
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
          <SectionHeader title="Demand by Vehicle Type" />
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
            <Text style={empty}>{emptyState('demand_readout')}</Text>
          ) : (
            model.entries.map((entry) => (
              <DemandRow key={entry.segment} entry={entry} />
            ))
          )}
        </View>
      </View>

      <View style={dividedSection}>
        <SectionHeader title="What You're Promoting" />
        {model.advertising && (
          <View style={{ marginTop: t.spacing.sm }} testID="demand-advertising">
            {/* The price rides the chip so the campaigns compare against each
                other without selecting one (#349). */}
            <ChipRow
              options={model.advertising.options.map((o) => ({
                id: o.id,
                label: o.costLabel ? `${o.label} · ${o.costLabel}` : o.label,
              }))}
              selectedId={model.advertising.selectedId}
              onSelect={model.advertising.onSelect}
            />
            {model.advertising.hint && (
              <HintLine
                id="advertising_campaign"
                text={model.advertising.hint}
              />
            )}
            <Text style={{ ...empty, marginTop: t.spacing.sm }}>
              {model.advertising.options.find(
                (o) => o.id === model.advertising!.selectedId,
              )?.blurb ?? ''}
            </Text>
            {(() => {
              const running = model.advertising.options.find(
                (o) => o.id === model.advertising!.selectedId,
              );
              return running?.costLabel ? (
                <Text
                  testID="demand-advertising-cost"
                  style={{
                    ...t.typography.caption,
                    color: t.colors.textSecondary,
                    marginTop: t.spacing.xs,
                  }}
                >
                  Billed {running.costLabel} while it runs.
                </Text>
              ) : null;
            })()}
          </View>
        )}
        <View style={{ marginTop: t.spacing.sm }}>
          {model.targetingLevers && model.targetingLevers.length > 0 ? (
            model.targetingLevers.map((lever) => (
              <TargetingLeverRow key={lever.id} lever={lever} />
            ))
          ) : (
            <Text style={empty}>{emptyState('demand_targeting_levers')}</Text>
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

      {model.coachmark && <Coachmark model={model.coachmark} />}
    </Surface>
  );
}

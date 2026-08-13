import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { emptyState } from '../copy';
import {
  Surface,
  SectionHeader,
  StatCard,
  Badge,
  Icon,
  money,
  type BadgeTone,
  type BadgeVariant,
  type IconName,
} from '../kit';
import type {
  MarketStateModel,
  SegmentHeatCell,
  ActiveShockView,
  ValueBand,
} from './marketState';

// Exact (issue 387). One formatter for the whole app means one sign glyph too:
// the ASCII hyphen the kit writes, not the typographic minus this panel used to
// carry alone.
const fmt$ = money;

/** Signed whole-percent, e.g. +8% / −5% / 0% (uses a real minus glyph). */
function fmtSignedPct(fraction: number): string {
  const pct = Math.round(fraction * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

/**
 * Plain-language band presentation — the axis is "used values vs. baseline",
 * never a temperature word. Direction drives the color; intensity drives the
 * fill (soft = strong, outline = mild).
 */
const VALUE_BANDS: Record<
  ValueBand,
  { label: string; tone: BadgeTone; variant: BadgeVariant; icon: IconName }
> = {
  'strong-above': { label: 'Well above', tone: 'positive', variant: 'soft', icon: 'trending-up' },
  above: { label: 'Above', tone: 'positive', variant: 'outline', icon: 'trending-up' },
  neutral: { label: 'At baseline', tone: 'neutral', variant: 'soft', icon: 'remove' },
  below: { label: 'Below', tone: 'danger', variant: 'outline', icon: 'trending-down' },
  'strong-below': { label: 'Well below', tone: 'danger', variant: 'soft', icon: 'trending-down' },
};

function bandIconTone(tone: BadgeTone): 'positive' | 'danger' | 'muted' {
  if (tone === 'positive') return 'positive';
  if (tone === 'danger') return 'danger';
  return 'muted';
}

function SegmentHeatRow({ cell }: { cell: SegmentHeatCell }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const band = VALUE_BANDS[cell.band];
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  };
  const label: TextStyle = { ...t.typography.body, color: t.colors.textSecondary, flex: 1 };
  const pctText: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  };
  const breakdown: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginBottom: t.spacing.xs,
    marginLeft: t.spacing.xs,
  };
  return (
    <View>
      <TouchableOpacity
        style={row}
        testID={`finance-segment-heat-${cell.segment}`}
        accessibilityRole="button"
        accessibilityLabel={`${cell.label} used values ${band.label}, ${fmtSignedPct(
          cell.heat,
        )}. Tap for factor breakdown.`}
        onPress={() => setExpanded((v) => !v)}
      >
        <Icon name={band.icon} size="sm" tone={bandIconTone(band.tone)} />
        <Text style={label} numberOfLines={1}>
          {cell.label}
        </Text>
        <Text style={pctText}>{fmtSignedPct(cell.heat)}</Text>
        <Badge label={band.label} tone={band.tone} variant={band.variant} />
      </TouchableOpacity>
      {expanded && (
        <Text style={breakdown}>
          {`Personality ${fmtSignedPct(cell.personality)} · Drift ${fmtSignedPct(
            cell.drift,
          )} · Shocks ${fmtSignedPct(cell.shock)}`}
        </Text>
      )}
    </View>
  );
}

function ShockRow({ shock }: { shock: ActiveShockView }) {
  const t = useTheme();
  const effects =
    shock.segments.length === 0
      ? 'No segment effect'
      : shock.segments.map((s) => `${s.label} ${fmtSignedPct(s.magnitude)}`).join(', ');
  const daysLabel = `${shock.daysRemaining} day${shock.daysRemaining === 1 ? '' : 's'} left`;
  return (
    <View style={{ paddingVertical: t.spacing.xs }} accessibilityRole="text">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Text style={{ ...t.typography.label, color: t.colors.textSecondary, flex: 1 }} numberOfLines={1}>
          {shock.label}
        </Text>
        <Badge label={daysLabel} tone="info" variant="soft" />
      </View>
      <Text
        style={{ ...t.typography.caption, color: t.colors.textMuted, marginTop: t.spacing.xxs }}
      >
        {effects}
      </Text>
    </View>
  );
}

/**
 * Market-state panel for the KPI dashboard (#179): per-segment used-value
 * pressure (with tap-to-expand factor breakdown), active market shocks, lot
 * valuation, and stale-inventory aggregation. Pure presentation — the
 * composition root (`buildMarketState`) assembles the model from `world`.
 */
export function MarketStatePanel({ model }: { model: MarketStateModel }) {
  const t = useTheme();
  const empty: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const dividedSection: ViewStyle = {
    marginTop: t.spacing.lg,
    paddingTop: t.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.borderMuted,
  };
  const caption: TextStyle = {
    ...empty,
    marginTop: t.spacing.xxs,
    marginBottom: t.spacing.xs,
  };
  const { valuation, stale } = model;
  const staleSharePct = Math.round(stale.staleShare * 100);
  return (
    <Surface testID="market-state-panel" style={{ marginTop: t.spacing.md }}>
      <View testID="market-state-heat">
        <SectionHeader title="Used-Value Pressure" />
        <Text style={caption}>
          How each segment&apos;s used values are running vs. baseline — tap a row for
          the factor breakdown.
        </Text>
        {model.segmentHeat.length === 0 ? (
          <Text style={empty}>{emptyState('market_state_segments')}</Text>
        ) : (
          model.segmentHeat.map((cell) => <SegmentHeatRow key={cell.segment} cell={cell} />)
        )}
      </View>

      <View style={dividedSection} testID="market-state-shocks">
        <SectionHeader title="Active Market Shocks" />
        <View style={{ marginTop: t.spacing.sm }}>
          {model.activeShocks.length === 0 ? (
            <Text style={empty}>{emptyState('market_state_shocks')}</Text>
          ) : (
            model.activeShocks.map((shock) => <ShockRow key={shock.instanceId} shock={shock} />)
          )}
        </View>
      </View>

      <View style={dividedSection} testID="market-state-valuation">
        <SectionHeader title="Inventory Valuation" />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            rowGap: t.spacing.lg,
            marginTop: t.spacing.md,
          }}
        >
          <View style={{ width: '50%' }}>
            <StatCard label="Units in Stock" value={valuation.unitCount} />
          </View>
          <View style={{ width: '50%' }}>
            <StatCard label="Weekly Carry" value={fmt$(valuation.weeklyCarryingBurn)} />
          </View>
          <View style={{ width: '50%' }}>
            <StatCard label="Book Value" value={fmt$(valuation.totalBook)} />
          </View>
          <View style={{ width: '50%' }}>
            <StatCard label="Market Value" value={fmt$(valuation.totalMarket)} />
          </View>
          <View style={{ width: '100%' }}>
            <StatCard
              label="Unrealized Gross (Market − Book)"
              value={fmt$(valuation.unrealizedGross)}
              trend={
                valuation.unrealizedGross > 0
                  ? 'up'
                  : valuation.unrealizedGross < 0
                    ? 'down'
                    : 'flat'
              }
            />
          </View>
        </View>
      </View>

      <View style={dividedSection} testID="market-state-stale">
        <SectionHeader title="Stale Inventory" />
        <Text style={caption}>Units on the lot longer than {stale.thresholdDays} days.</Text>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: t.spacing.lg, marginTop: t.spacing.md }}
        >
          <View style={{ width: '50%' }}>
            <StatCard
              label="Stale Units"
              value={`${stale.staleCount} (${staleSharePct}%)`}
              trend={stale.staleCount > 0 ? 'down' : 'flat'}
            />
          </View>
          <View style={{ width: '50%' }}>
            <StatCard label="Capital in Stale" value={fmt$(stale.staleCost)} />
          </View>
        </View>
      </View>
    </Surface>
  );
}

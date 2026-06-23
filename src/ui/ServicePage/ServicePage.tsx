import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import {
  Surface,
  SectionHeader,
  Badge,
  Icon,
  type BadgeTone,
  type IconName,
  type IconProps,
} from '../kit';

/**
 * The dedicated Service page (#308, parent #297) — a read-only surface inside
 * the fixed Operations tab presenting the Service department's three
 * read-models: per-parts-category demand heat, parts stock coverage, and
 * installed-base health. Pure view: it renders a `ServicePageModel` assembled by
 * the composition root and dispatches only `onClose`. Visual treatment is
 * intentionally plain here — the neo-skeuomorphic rebrand is a later
 * `/map-mockup` pass; this slice delivers the functional, smoke-tested surface.
 */

/** Coarse demand level for a parts category. Banded internally as hot/warm/cold
 *  but surfaced with a plain-language DEMAND label (never a bare temperature
 *  word) so a layperson reads it right. */
export type ServiceHeatBand = 'hot' | 'warm' | 'cold';
export type ServiceTrend = 'rising' | 'steady' | 'falling';

export interface ServiceDemandHeatRow {
  category: string;
  /** Plain-language category name, e.g. "Tires & Brakes". */
  label: string;
  band: ServiceHeatBand;
  trend: ServiceTrend;
}

export interface ServiceCoverageRow {
  category: string;
  label: string;
  /** Recent demand for the category over the read-model window. */
  demand: number;
  onHand: number;
  onOrder: number;
  /** demand − onHand − onOrder; > 0 is a shortage to act on. */
  gap: number;
}

export interface ServiceBaseHealthModel {
  size: number;
  /** Mean loyalty [0,1]. */
  avgLoyalty: number;
  /** Mean CSI [0,1]. */
  avgCsi: number;
  /** Owners carrying a bad-visit / non-return streak — forward churn pressure. */
  atRiskCount: number;
  returnsPerDay: number;
  returnTrend: ServiceTrend;
  defectionsPerDay: number;
  churnTrend: ServiceTrend;
}

export interface ServicePageModel {
  demandHeat: readonly ServiceDemandHeatRow[];
  coverage: readonly ServiceCoverageRow[];
  baseHealth: ServiceBaseHealthModel;
}

// Plain-language DEMAND-axis labels. The internal band is hot/warm/cold; the
// player-facing word names the axis (demand), never the temperature (#308 AC +
// the locked "no vague temperature labels" rule).
const DEMAND_BAND: Record<ServiceHeatBand, { label: string; tone: BadgeTone }> = {
  hot: { label: 'High demand', tone: 'reward' },
  warm: { label: 'Steady demand', tone: 'neutral' },
  cold: { label: 'Low demand', tone: 'info' },
};

const TREND: Record<
  ServiceTrend,
  { icon: IconName; tone: IconProps['tone']; word: string }
> = {
  rising: { icon: 'trending-up', tone: 'positive', word: 'rising' },
  steady: { icon: 'arrow-forward', tone: 'muted', word: 'steady' },
  falling: { icon: 'trending-down', tone: 'danger', word: 'falling' },
};

function DemandHeatRow({ row }: { row: ServiceDemandHeatRow }) {
  const t = useTheme();
  const band = DEMAND_BAND[row.band];
  const trend = TREND[row.trend];
  const wrap: ViewStyle = {
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
    <View style={wrap} accessibilityRole="text">
      <Text style={label} numberOfLines={1}>
        {row.label}
      </Text>
      <View accessibilityLabel={`${row.label} demand trend ${trend.word}`}>
        <Icon name={trend.icon} size="sm" tone={trend.tone} />
      </View>
      <View accessibilityLabel={`${row.label} ${band.label}`}>
        <Badge label={band.label} tone={band.tone} variant="soft" />
      </View>
    </View>
  );
}

function CoverageRow({ row }: { row: ServiceCoverageRow }) {
  const t = useTheme();
  const short = row.gap > 0;
  const wrap: ViewStyle = {
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
  const figures: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontVariant: ['tabular-nums'],
  };
  return (
    <View style={wrap} accessibilityRole="text">
      <Text style={label} numberOfLines={1}>
        {row.label}
      </Text>
      <Text
        style={figures}
        accessibilityLabel={`${row.label}: need ${row.demand}, stock ${row.onHand}${
          row.onOrder > 0 ? `, ${row.onOrder} on order` : ''
        }`}
      >
        need {row.demand} · stock {row.onHand}
        {row.onOrder > 0 ? ` · ${row.onOrder} inbound` : ''}
      </Text>
      <View accessibilityLabel={`${row.label} ${short ? `short ${row.gap}` : 'covered'}`}>
        <Badge
          label={short ? `Short ${row.gap}` : 'Covered'}
          tone={short ? 'danger' : 'positive'}
          variant="soft"
        />
      </View>
    </View>
  );
}

function HealthStat({
  label,
  value,
  trend,
  trendGood,
}: {
  label: string;
  value: string;
  trend?: ServiceTrend;
  /** Which direction reads as good — flips the trend glyph tone for churn. */
  trendGood?: 'rising' | 'falling';
}) {
  const t = useTheme();
  const wrap: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  };
  const lbl: TextStyle = { ...t.typography.body, color: t.colors.textSecondary, flex: 1 };
  const val: TextStyle = {
    ...t.typography.label,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
  let glyph: { icon: IconName; tone: IconProps['tone']; word: string } | null = null;
  if (trend) {
    const base = TREND[trend];
    // For churn (good = falling), invert the positive/danger tone so a rising
    // defection rate reads as the danger it is.
    const tone: IconProps['tone'] =
      trend === 'steady'
        ? 'muted'
        : (trendGood ?? 'rising') === trend
          ? 'positive'
          : 'danger';
    glyph = { icon: base.icon, tone, word: base.word };
  }
  return (
    <View style={wrap} accessibilityRole="text">
      <Text style={lbl} numberOfLines={1}>
        {label}
      </Text>
      <Text style={val}>{value}</Text>
      {glyph && (
        <View accessibilityLabel={`${label} trend ${glyph.word}`}>
          <Icon name={glyph.icon} size="sm" tone={glyph.tone} />
        </View>
      )}
    </View>
  );
}

export interface ServicePageProps {
  model: ServicePageModel;
  onClose: () => void;
}

export function ServicePage({ model, onClose }: ServicePageProps) {
  const t = useTheme();
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const num = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1));
  const empty: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const region: ViewStyle = { marginTop: t.spacing.lg };
  const hint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
    marginBottom: t.spacing.xs,
  };
  const styles = makeStyles(t);

  return (
    <View style={styles.root} testID="service-page">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Service</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Surface testID="service-demand-heat">
          <SectionHeader title="Demand by Job" />
          <Text style={hint}>
            What your bays are being asked for — stock and staff to it.
          </Text>
          {model.demandHeat.length === 0 ? (
            <Text style={empty}>No service traffic yet.</Text>
          ) : (
            model.demandHeat.map((row) => (
              <DemandHeatRow key={row.category} row={row} />
            ))
          )}
        </Surface>

        <View style={region}>
          <Surface testID="service-stock-coverage">
            <SectionHeader title="Parts Coverage" />
            <Text style={hint}>
              Recent demand against the parts you have on hand.
            </Text>
            {model.coverage.length === 0 ? (
              <Text style={empty}>No parts demand to cover yet.</Text>
            ) : (
              model.coverage.map((row) => (
                <CoverageRow key={row.category} row={row} />
              ))
            )}
          </Surface>
        </View>

        <View style={region}>
          <Surface testID="service-base-health">
            <SectionHeader title="Customer Base" />
            <Text style={hint}>
              The owners who keep coming back — your service annuity.
            </Text>
            <HealthStat label="Owners in base" value={num(model.baseHealth.size)} />
            <HealthStat label="Avg. loyalty" value={pct(model.baseHealth.avgLoyalty)} />
            <HealthStat label="Avg. satisfaction" value={pct(model.baseHealth.avgCsi)} />
            <HealthStat
              label="At-risk owners"
              value={num(model.baseHealth.atRiskCount)}
            />
            <HealthStat
              label="Returns / day"
              value={num(model.baseHealth.returnsPerDay)}
              trend={model.baseHealth.returnTrend}
              trendGood="rising"
            />
            <HealthStat
              label="Defections / day"
              value={num(model.baseHealth.defectionsPerDay)}
              trend={model.baseHealth.churnTrend}
              trendGood="falling"
            />
          </Surface>
        </View>
      </ScrollView>
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
    body: { padding: t.spacing.lg },
  });
}

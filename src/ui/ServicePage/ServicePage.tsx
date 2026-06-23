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

// ── Controls (#309) ────────────────────────────────────────────────────────
// The player's Service POLICY levers. Set once and applied automatically — par
// levels + supplier tier drive PartsInventory's daily reorder sweep, the posture
// dial scales every ticket's revenue, and the two marketing arms steer the
// Service demand/return math. No per-morning clicking. The page stays a pure
// view: it renders the current values + option lists the composition root reads
// off the live World and dispatches the setters back (no game-logic reach-in).

/** Supplier-tier id (PartsInventory `SupplierTier`) — kept a bare string here so
 *  the UI never imports a game type. */
export type ServiceSupplierTierId = string;

/** One parts category's procurement policy row. */
export interface ServiceParControl {
  category: string;
  label: string;
  /** On-hand reorder trigger. */
  reorderPoint: number;
  /** Par level the reorder sweep fills back up to. */
  target: number;
  tier: ServiceSupplierTierId;
  /** Units on hand right now — context for tuning the par levels. */
  onHand: number;
}

/** A selectable supplier tier, cheapest/slowest → priciest/fastest. */
export interface ServiceTierOption {
  id: ServiceSupplierTierId;
  label: string;
}

/** A selectable marketing-arm option (retention campaign or conquest target). */
export interface ServiceMarketingOption {
  id: string;
  label: string;
  blurb?: string;
}

export interface ServiceControlsModel {
  par: readonly ServiceParControl[];
  tierOptions: readonly ServiceTierOption[];
  /** Pricing posture in [0,1]: 0 = fully competitive, 1 = fully premium. */
  pricingPosture: number;
  retentionOptions: readonly ServiceMarketingOption[];
  /** Active retention campaign id (`'none'` clears). */
  retentionId: string;
  conquestOptions: readonly ServiceMarketingOption[];
  /** Active conquest special's job category (`'none'` clears). */
  conquestCategory: string;
}

/** The controls model plus the dispatch callbacks. Absent ⇒ read-only page. */
export interface ServiceControls {
  model: ServiceControlsModel;
  onSetReorderPoint: (category: string, value: number) => void;
  onSetTarget: (category: string, value: number) => void;
  onSetSupplierTier: (category: string, tier: ServiceSupplierTierId) => void;
  onSetPricingPosture: (value: number) => void;
  onSetRetention: (id: string) => void;
  onSetConquest: (category: string) => void;
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

// Posture step per ± tap. The dial is continuous [0,1]; visual treatment (a real
// slider) is the later /map-mockup pass — this slice steps it functionally.
const POSTURE_STEP = 0.1;

/** Plain-language posture word — names the axis (competitive↔premium), never a
 *  temperature. Endpoints read right to a layperson. */
function postureWord(v: number): string {
  if (v <= 0.34) return 'Competitive';
  if (v >= 0.66) return 'Premium';
  return 'Balanced';
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  accessibilityName,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  accessibilityName: string;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <View style={s.stepperRow}>
      <Text style={s.stepperLabel}>{label}</Text>
      <View style={s.stepperControls}>
        <TouchableOpacity
          style={s.stepBtn}
          onPress={() => onChange(Math.max(min, value - 1))}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${accessibilityName}`}
        >
          <Text style={s.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepValue} accessibilityLabel={`${accessibilityName} ${value}`}>
          {value}
        </Text>
        <TouchableOpacity
          style={s.stepBtn}
          onPress={() => onChange(value + 1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${accessibilityName}`}
        >
          <Text style={s.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChipRow({
  options,
  selectedId,
  onSelect,
}: {
  options: readonly ServiceMarketingOption[] | readonly ServiceTierOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <View style={s.chipRow}>
      {options.map((o) => {
        const sel = o.id === selectedId;
        return (
          <TouchableOpacity
            key={o.id}
            style={[s.chip, sel && s.chipSel]}
            onPress={() => onSelect(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={o.label}
          >
            <Text style={[s.chipText, sel && s.chipTextSel]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ParControlRow({
  row,
  tierOptions,
  onSetReorderPoint,
  onSetTarget,
  onSetSupplierTier,
}: {
  row: ServiceParControl;
  tierOptions: readonly ServiceTierOption[];
  onSetReorderPoint: (category: string, value: number) => void;
  onSetTarget: (category: string, value: number) => void;
  onSetSupplierTier: (category: string, tier: ServiceSupplierTierId) => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <View style={s.parRow} testID={`service-par-${row.category}`}>
      <Text style={s.parTitle}>
        {row.label} <Text style={s.parOnHand}>· {row.onHand} on hand</Text>
      </Text>
      <Stepper
        label="Reorder at"
        value={row.reorderPoint}
        onChange={(v) => onSetReorderPoint(row.category, v)}
        accessibilityName={`${row.label} reorder point`}
      />
      <Stepper
        label="Stock up to"
        value={row.target}
        onChange={(v) => onSetTarget(row.category, v)}
        accessibilityName={`${row.label} target stock`}
      />
      <ChipRow
        options={tierOptions}
        selectedId={row.tier}
        onSelect={(tier) => onSetSupplierTier(row.category, tier)}
      />
    </View>
  );
}

function PostureControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const pct = Math.round(value * 100);
  return (
    <View style={s.postureRow} testID="service-pricing-posture">
      <TouchableOpacity
        style={s.stepBtn}
        onPress={() => onChange(clamp(value - POSTURE_STEP))}
        accessibilityRole="button"
        accessibilityLabel="More competitive pricing"
      >
        <Text style={s.stepBtnText}>−</Text>
      </TouchableOpacity>
      <View style={s.postureReadout}>
        <Text
          style={s.postureWord}
          accessibilityLabel={`Pricing posture ${postureWord(value)} ${pct} percent toward premium`}
        >
          {postureWord(value)}
        </Text>
        <Text style={s.postureScale}>Competitive ◄ {pct}% ► Premium</Text>
      </View>
      <TouchableOpacity
        style={s.stepBtn}
        onPress={() => onChange(clamp(value + POSTURE_STEP))}
        accessibilityRole="button"
        accessibilityLabel="More premium pricing"
      >
        <Text style={s.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export interface ServicePageProps {
  model: ServicePageModel;
  /** Policy controls (#309). Absent ⇒ the page is read-only. */
  controls?: ServiceControls;
  onClose: () => void;
}

export function ServicePage({ model, controls, onClose }: ServicePageProps) {
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

        {controls && (
          <>
            <View style={region}>
              <Surface testID="service-parts-controls">
                <SectionHeader title="Parts Stocking" />
                <Text style={hint}>
                  Set it once — stock reorders to par automatically each morning.
                </Text>
                {controls.model.par.map((row) => (
                  <ParControlRow
                    key={row.category}
                    row={row}
                    tierOptions={controls.model.tierOptions}
                    onSetReorderPoint={controls.onSetReorderPoint}
                    onSetTarget={controls.onSetTarget}
                    onSetSupplierTier={controls.onSetSupplierTier}
                  />
                ))}
              </Surface>
            </View>

            <View style={region}>
              <Surface testID="service-pricing-controls">
                <SectionHeader title="Pricing Posture" />
                <Text style={hint}>
                  Where you sit on labor rate + parts markup — applied to every
                  ticket.
                </Text>
                <PostureControl
                  value={controls.model.pricingPosture}
                  onChange={controls.onSetPricingPosture}
                />
              </Surface>
            </View>

            <View style={region}>
              <Surface testID="service-marketing-controls">
                <SectionHeader title="Service Marketing" />
                <Text style={hint}>
                  Retention keeps your base coming back; conquest drums up new
                  work in a category.
                </Text>
                <Text style={[hint, { marginTop: t.spacing.sm }]}>Retention</Text>
                <ChipRow
                  options={controls.model.retentionOptions}
                  selectedId={controls.model.retentionId}
                  onSelect={controls.onSetRetention}
                />
                <Text style={[hint, { marginTop: t.spacing.sm }]}>
                  Category conquest
                </Text>
                <ChipRow
                  options={controls.model.conquestOptions}
                  selectedId={controls.model.conquestCategory}
                  onSelect={controls.onSetConquest}
                />
              </Surface>
            </View>
          </>
        )}
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
    // ── Controls (#309) ──
    parRow: {
      paddingVertical: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.borderMuted,
    },
    parTitle: { ...t.typography.label, color: t.colors.textPrimary },
    parOnHand: { ...t.typography.caption, color: t.colors.textMuted },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.xxs,
    },
    stepperLabel: { ...t.typography.body, color: t.colors.textSecondary },
    stepperControls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { ...t.typography.title, color: t.colors.accent },
    stepValue: {
      ...t.typography.label,
      color: t.colors.textPrimary,
      minWidth: 28,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.xs,
      marginTop: t.spacing.xs,
    },
    chip: {
      paddingVertical: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.base,
    },
    chipSel: { borderColor: t.colors.accent, backgroundColor: t.colors.primaryDim },
    chipText: { ...t.typography.caption, color: t.colors.textSecondary },
    chipTextSel: { color: t.colors.accent },
    postureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      marginTop: t.spacing.xs,
    },
    postureReadout: { flex: 1, alignItems: 'center' },
    postureWord: { ...t.typography.label, color: t.colors.textPrimary },
    postureScale: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
  });
}

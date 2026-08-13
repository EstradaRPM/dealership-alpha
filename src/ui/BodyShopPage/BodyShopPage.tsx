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
  HintLine,
  type BadgeTone,
  type IconName,
  type IconProps,
} from '../kit';
import {
  ParControlRow,
  PostureDial,
  type DeptParControl,
  type DeptTierOption,
  type DeptSupplierTierId,
} from '../DeptControls';

/**
 * The dedicated Body Shop page (#315, parent #297) — the Tier-3 mirror of the
 * read-only half of the Service page, inside the fixed Operations tab. It
 * presents the Body Shop's read-models: per-collision-category **demand heat**,
 * parts **stock coverage**, and **conquest health** (the conquest-dominant
 * analog of Service's installed-base health — the Body Shop wins every job
 * fresh, so there is no loyalty/CSI/churn annuity, only collision-flow volume +
 * the insurance/retail channel mix). Still a pure view (the DepartmentScreen
 * idiom): it renders a `BodyShopPageModel` (+ an optional `BodyShopControls`,
 * #318) assembled by the composition root and dispatches only `onClose` and the
 * control setters. The #318 controls add the player's POLICY levers — par /
 * supplier per collision category (reusing the shared `DeptControls` primitives)
 * plus the Body-Shop-specific insurance↔retail channel dial. Visual treatment is
 * intentionally plain — the neo-skeuomorphic rebrand is a later `/map-mockup`
 * pass; this slice delivers the functional, smoke-tested surface.
 */

/** Coarse demand level for a collision category. Banded internally as
 *  hot/warm/cold but surfaced with a plain-language DEMAND label (never a bare
 *  temperature word) so a layperson reads it right. */
export type BodyShopHeatBand = 'hot' | 'warm' | 'cold';
export type BodyShopTrend = 'rising' | 'steady' | 'falling';

export interface BodyShopDemandHeatRow {
  category: string;
  /** Plain-language category name, e.g. "Windows & Glass". */
  label: string;
  band: BodyShopHeatBand;
  trend: BodyShopTrend;
}

export interface BodyShopCoverageRow {
  category: string;
  label: string;
  /** Recent demand for the category over the read-model window. */
  demand: number;
  onHand: number;
  onOrder: number;
  /** demand − onHand − onOrder; > 0 is a shortage to act on. */
  gap: number;
}

export interface BodyShopConquestHealthModel {
  /** Collision tickets tracked in the trailing window. */
  windowTickets: number;
  /** Mean collision jobs taken in per day. */
  intakePerDay: number;
  intakeTrend: BodyShopTrend;
  /** Retail / customer-pay share of recent intake [0,1]. */
  retailShare: number;
  /** Insurance / DRP share of recent intake [0,1]. */
  insuranceShare: number;
  /** Retail-conquest momentum — rising = the fat-margin channel is growing. */
  retailTrend: BodyShopTrend;
}

export interface BodyShopPageModel {
  demandHeat: readonly BodyShopDemandHeatRow[];
  coverage: readonly BodyShopCoverageRow[];
  conquest: BodyShopConquestHealthModel;
}

// ── Controls (#318) ────────────────────────────────────────────────────────
// The player's Body-Shop POLICY levers. Set once and applied automatically — par
// levels + supplier tier drive PartsInventory's daily reorder sweep over the four
// collision categories (the shared `DeptControls` primitives, reused verbatim);
// the channel dial is the Body-Shop's single pricing/marketing lever (#314): it
// steers BOTH the CollisionStream demand mix and the per-ticket pricing read
// (retail jobs are player-priced, insurance is rate-capped). No per-morning
// clicking. The page stays a pure view: it renders the current values + option
// lists the composition root reads off the live World and dispatches the setters
// back (no game-logic reach-in).

/** Supplier-tier id — re-exported from the shared control primitives. */
export type BodyShopSupplierTierId = DeptSupplierTierId;

export interface BodyShopControlsModel {
  par: readonly DeptParControl[];
  tierOptions: readonly DeptTierOption[];
  /** Insurance↔retail channel posture in [0,1]: 0 = full insurance-DRP lean,
   *  1 = full retail. The Body-Shop's single pricing/marketing lever. */
  channelPosture: number;
}

/** The controls model plus the dispatch callbacks. Absent ⇒ read-only page. */
export interface BodyShopControls {
  model: BodyShopControlsModel;
  onSetReorderPoint: (category: string, value: number) => void;
  onSetTarget: (category: string, value: number) => void;
  onSetSupplierTier: (category: string, tier: BodyShopSupplierTierId) => void;
  onSetChannelPosture: (value: number) => void;
  /**
   * Consequence hints (#388), each null once the player has used that block's
   * control. The parts line is the SAME lesson the Service page teaches, from
   * the one catalog entry — stocking policy is one mechanic reachable from two
   * rooms, and it retires once.
   */
  hints?: BodyShopControlHints;
}

export interface BodyShopControlHints {
  parts?: string | null;
  channelPosture?: string | null;
}

// Plain-language DEMAND-axis labels — the internal band is hot/warm/cold; the
// player-facing word names the axis (demand), never the temperature (the locked
// "no vague temperature labels" rule). Identical to the Service page's mapping.
const DEMAND_BAND: Record<BodyShopHeatBand, { label: string; tone: BadgeTone }> =
  {
    hot: { label: 'High demand', tone: 'reward' },
    warm: { label: 'Steady demand', tone: 'neutral' },
    cold: { label: 'Low demand', tone: 'info' },
  };

const TREND: Record<
  BodyShopTrend,
  { icon: IconName; tone: IconProps['tone']; word: string }
> = {
  rising: { icon: 'trending-up', tone: 'positive', word: 'rising' },
  steady: { icon: 'arrow-forward', tone: 'muted', word: 'steady' },
  falling: { icon: 'trending-down', tone: 'danger', word: 'falling' },
};

function DemandHeatRow({ row }: { row: BodyShopDemandHeatRow }) {
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

function CoverageRow({ row }: { row: BodyShopCoverageRow }) {
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
      <View
        accessibilityLabel={`${row.label} ${short ? `short ${row.gap}` : 'covered'}`}
      >
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
  trend?: BodyShopTrend;
  /** Which direction reads as good — flips the trend glyph tone. */
  trendGood?: 'rising' | 'falling';
}) {
  const t = useTheme();
  const wrap: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  };
  const lbl: TextStyle = {
    ...t.typography.body,
    color: t.colors.textSecondary,
    flex: 1,
  };
  const val: TextStyle = {
    ...t.typography.label,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
  let glyph: { icon: IconName; tone: IconProps['tone']; word: string } | null =
    null;
  if (trend) {
    const base = TREND[trend];
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

/** Plain-language channel word — names the axis (insurance↔retail), never a
 *  temperature. Endpoints read right to a layperson. */
function channelWord(v: number): string {
  if (v <= 0.34) return 'Insurance-led';
  if (v >= 0.66) return 'Retail-led';
  return 'Balanced';
}

/** The Body-Shop insurance↔retail channel dial — the shared `PostureDial` with
 *  the Body-Shop's endpoint labels + accessibility phrasing. Names the axis
 *  (Insurance ↔ Retail), never a temperature word (locked rule). */
function ChannelControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <PostureDial
      value={value}
      onChange={onChange}
      word={channelWord}
      leftLabel="Insurance"
      rightLabel="Retail"
      readoutA11y={(word, pct) =>
        `Channel mix ${word} ${pct} percent toward retail`
      }
      decreaseA11y="More insurance-DRP work"
      increaseA11y="More retail work"
      testID="body-shop-channel-posture"
    />
  );
}

export interface BodyShopPageProps {
  model: BodyShopPageModel;
  /** Policy controls (#318). Absent ⇒ the page is read-only. */
  controls?: BodyShopControls;
  onClose: () => void;
}

export function BodyShopPage({ model, controls, onClose }: BodyShopPageProps) {
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
    <View style={styles.root} testID="body-shop-page">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          testID="body-shop-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Body Shop</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Surface testID="body-shop-demand-heat">
          <SectionHeader title="Demand by Job" />
          <Text style={hint}>
            What collision work is coming in — stock and staff to it.
          </Text>
          {model.demandHeat.length === 0 ? (
            <Text style={empty}>No collision work yet.</Text>
          ) : (
            model.demandHeat.map((row) => (
              <DemandHeatRow key={row.category} row={row} />
            ))
          )}
        </Surface>

        <View style={region}>
          <Surface testID="body-shop-stock-coverage">
            <SectionHeader title="Parts Coverage" />
            <Text style={hint}>
              Recent demand against the collision parts you have on hand.
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
          <Surface testID="body-shop-conquest-health">
            <SectionHeader title="Conquest Health" />
            <Text style={hint}>
              Collision work is won fresh, not from a loyal base — watch the flow
              and your retail mix.
            </Text>
            <HealthStat
              label="Jobs in / day"
              value={num(model.conquest.intakePerDay)}
              trend={model.conquest.intakeTrend}
              trendGood="rising"
            />
            <HealthStat
              label="Retail (customer-pay)"
              value={pct(model.conquest.retailShare)}
              trend={model.conquest.retailTrend}
              trendGood="rising"
            />
            <HealthStat
              label="Insurance (DRP)"
              value={pct(model.conquest.insuranceShare)}
            />
            <HealthStat
              label="Jobs tracked"
              value={num(model.conquest.windowTickets)}
            />
          </Surface>
        </View>

        {controls && (
          <>
            <View style={region}>
              <Surface testID="body-shop-parts-controls">
                <SectionHeader title="Parts Stocking" />
                <Text style={hint}>
                  Set it once — collision parts reorder to par automatically each
                  morning.
                </Text>
                {controls.model.par.map((row) => (
                  <ParControlRow
                    key={row.category}
                    row={row}
                    tierOptions={controls.model.tierOptions}
                    testIDPrefix="body-shop-par-"
                    onSetReorderPoint={controls.onSetReorderPoint}
                    onSetTarget={controls.onSetTarget}
                    onSetSupplierTier={controls.onSetSupplierTier}
                  />
                ))}
                {controls.hints?.parts && (
                  <HintLine id="parts_policy" text={controls.hints.parts} />
                )}
              </Surface>
            </View>

            <View style={region}>
              <Surface testID="body-shop-channel-controls">
                <SectionHeader title="Channel Mix" />
                <Text style={hint}>
                  Lean toward insurance (DRP, rate-capped, steady) or retail
                  (customer-pay, fatter, lumpier) — steers both the work that
                  comes in and what you can charge.
                </Text>
                <ChannelControl
                  value={controls.model.channelPosture}
                  onChange={controls.onSetChannelPosture}
                />
                {controls.hints?.channelPosture && (
                  <HintLine
                    id="body_shop_channel_posture"
                    text={controls.hints.channelPosture}
                  />
                )}
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
  });
}

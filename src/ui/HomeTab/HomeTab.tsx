import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import {
  Surface,
  SectionHeader,
  StatCard,
  Pill,
  Icon,
  IconBadge,
  GaugeArc,
  GradientSurface,
  ProgressBar,
  EmptyState,
  Coachmark,
  type CoachmarkModel,
  type IconName,
  type IconBadgeTone,
} from '../kit';
import { emptyState } from '../copy';
import { StoreWorthLine } from '../StoreWorth';
import type { DayLoopState } from '../../game/DayLoopController';
import { GateStrip } from './GateStrip';
import type { HomeDashboardModel, HomeStat, MiniCalDay } from './homeModel';

/** Leading glyph + accent per quick-stat tile (#240), keyed by the read-model's
 *  stat key. View-side mapping so the read model stays presentation-free; an
 *  unknown key renders a plain tile. */
const STAT_ICONS: Record<string, { icon: IconName; tone: IconBadgeTone }> = {
  leads: { icon: 'people', tone: 'primary' },
  inventory: { icon: 'car-sport', tone: 'accent' },
  service: { icon: 'construct', tone: 'positive' },
};

export interface HomeTabProps {
  state: DayLoopState;
  /** Full status dashboard (#230). Absent ⇒ legacy header only (test renders). */
  dashboard?: HomeDashboardModel;
  /** Deep-link into the Operations tab (inventory tile). */
  onOpenOperations?: () => void;
  /** Reopen-affordance for the last day's recap (#253). The recap itself is a
   *  modal that pops on day close; this chip reopens it. Absent ⇒ no day has
   *  closed yet (pre-Day-1), so honest copy shows instead of a lie. */
  recapChip?: { day: number; onOpen: () => void };
  /**
   * The market GLANCE (#349) — two pre-formatted lines summarizing what the
   * demand console holds in full. The console itself (readout, campaign lever,
   * weekly report, wire) moved to Growth; Home's charter is glances only, and
   * every glance routes into its owning room (locked IA rules 1 + 4).
   */
  marketGlance?: HomeMarketGlance;
  /** Deep-link into the Growth demand console — the market glance's press. */
  onOpenGrowth?: () => void;
  /**
   * The first-run spine's opening step (#213), drawn under the market glance
   * it is about. Null/absent ⇒ this is not the step the player owes, and
   * nothing renders — the coachmark is anchored by composition, never floated.
   */
  coachmark?: CoachmarkModel | null;
}

/** The market glance's content — what's selling, and what you're paying for. */
export interface HomeMarketGlance {
  /** "Buyers want: SUVs" — the hottest vehicle type right now. */
  headline: string;
  /** "Running Local radio · $75/day" or "No campaign running". */
  campaignLabel: string;
}

/**
 * The management-phase Home hub (#215/#230). The day-cycle launch surface: a
 * status dashboard (identity, cash, reputation/CSI, calendar, quick stats) over
 * the day-close recap and a market glance. GLANCES ONLY (locked IA §1): the
 * demand console, the weekly report, the wire and the gate detail board all live
 * in Growth as of #349, and every glance here routes into its owning room —
 * inventory → Operations, gate strip and market → Growth. Presentation only — every
 * value arrives pre-formatted in the read models the composition root builds;
 * the pinned START DAY action lives in the surrounding `AppShell` footer.
 */
export function HomeTab({
  state,
  dashboard,
  onOpenOperations,
  recapChip,
  marketGlance,
  onOpenGrowth,
  coachmark,
}: HomeTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const regionBody: ViewStyle = { marginTop: t.spacing.md };

  return (
    <View>
      {dashboard ? (
        <Dashboard
          model={dashboard}
          onOpenOperations={onOpenOperations}
          onOpenGrowth={onOpenGrowth}
        />
      ) : (
        <View testID="home-region-identity">
          <Text style={{ ...t.typography.statValue, color: t.colors.textPrimary }}>
            Manager Desk
          </Text>
          <Text
            style={{
              ...t.typography.caption,
              color: t.colors.textSecondary,
              marginTop: t.spacing.xxs,
            }}
          >
            Between-day plan for Day {state.day}
          </Text>
        </View>
      )}

      {/* Titled "Recap", not "Today" — it holds the LAST closed day's recap
          chip, and a "Day N recap" under a "Today" header read dishonest (#258). */}
      <View style={region} testID="home-region-today">
        <SectionHeader title="Recap" />
        <View style={regionBody}>
          {recapChip ? (
            <RecapChip day={recapChip.day} onOpen={recapChip.onOpen} />
          ) : (
            // No day has closed yet — honest pre-Day-1 copy, never a "Night
            // before Day 1" string stamped onto a Day-15 save (#253).
            <EmptyState icon="calendar" text={emptyState('home_today')} />
          )}
        </View>
      </View>

      {/* Market GLANCE (#349). The full stack that used to render here — the
          demand readout with its campaign lever, the weekly report, the industry
          wire — moved to the Growth demand console. Home's charter is glances
          only, and a glance's whole job is to route (locked IA rules 1 + 4).
          Two lines: what buyers want, and what you're paying to steer them. */}
      <View style={region} testID="home-region-market">
        <SectionHeader title="Market" />
        <View style={regionBody}>
          {marketGlance ? (
            <MarketGlance glance={marketGlance} onOpen={onOpenGrowth} />
          ) : (
            <EmptyState icon="storefront" text={emptyState('demand_readout')} />
          )}
          {coachmark ? <Coachmark model={coachmark} /> : null}
        </View>
      </View>
    </View>
  );
}

/**
 * The market glance (#349) — a pressable card that opens the Growth demand
 * console. Same chevron idiom as the recap chip, because it is the same promise:
 * the detail is one tap away, in the room that owns it.
 */
function MarketGlance({
  glance,
  onOpen,
}: {
  glance: HomeMarketGlance;
  onOpen?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole="button"
      accessibilityLabel="Open the demand console"
      testID="home-market-glance"
    >
      <Surface variant="inset" padded={false} style={{ padding: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <IconBadge name="storefront" tone="accent" variant="solid" size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.label, color: t.colors.textPrimary }}>
              {glance.headline}
            </Text>
            <Text
              style={{
                ...t.typography.caption,
                color: t.colors.textSecondary,
                marginTop: t.spacing.xxs,
              }}
            >
              {glance.campaignLabel}
            </Text>
          </View>
          <Icon name="chevron-forward" size="sm" tone="primary" />
        </View>
      </Surface>
    </Pressable>
  );
}

/**
 * Reopen-affordance for the last day's recap (#253). The reward beat now pops
 * as a modal on day close; this chip lets the player pull it back up from the
 * Today region — and, because it is driven by the persisted recap, it stays
 * truthful across a reload (no hardcoded "Night before Day 1").
 */
function RecapChip({ day, onOpen }: { day: number; onOpen: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open Day ${day} recap`}
      testID="home-recap-chip"
    >
      <Surface variant="inset" padded={false} style={{ padding: t.spacing.md }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}
        >
          <IconBadge name="calendar" tone="primary" variant="solid" size="sm" />
          <Text
            style={{
              ...t.typography.label,
              color: t.colors.textPrimary,
              flex: 1,
            }}
          >
            Day {day} recap
          </Text>
          <Icon name="chevron-forward" size="sm" tone="primary" />
        </View>
      </Surface>
    </Pressable>
  );
}

function Dashboard({
  model,
  onOpenOperations,
  onOpenGrowth,
}: {
  model: HomeDashboardModel;
  onOpenOperations?: () => void;
  onOpenGrowth?: () => void;
}) {
  const t = useTheme();
  const cardCol: ViewStyle = { flex: 1 };
  // Hairline rule splitting the headline slab into its two faces — the same
  // divider idiom the quick-stat strip uses, so the two cards read as one
  // family. `alignSelf: stretch` keeps it flush to both edges of the taller
  // face, which is what makes the split read as one slab.
  const cardDivider: ViewStyle = {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: t.colors.border,
    marginHorizontal: t.spacing.lg,
  };
  const subValue: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    marginTop: t.spacing.xxs,
  };
  const [calendarExpanded, setCalendarExpanded] = React.useState(false);
  // Smooth open/close: LayoutAnimation is a no-op on the New Architecture (it
  // snaps) and a JS-driven Animated height stutters (it reflows the page on the
  // JS thread every frame). Reanimated runs the clip on the UI thread instead.
  // The drawer stays mounted and clipped; its natural height is measured once
  // via onLayout, then `expand` drives both the clip height and the opacity.
  const expand = useSharedValue(0);
  const [drawerHeight, setDrawerHeight] = React.useState(0);
  React.useEffect(() => {
    expand.value = withTiming(calendarExpanded ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [calendarExpanded, expand]);
  const drawerStyle = useAnimatedStyle(() => ({
    height: expand.value * drawerHeight,
    opacity: expand.value,
  }));

  return (
    <View testID="home-dashboard">
      {/* Identity (name + tier) AND the tier hero art are owned by the
          persistent AppShell header (#238 HITL / hero-backdrop collapse): the
          shell paints the lot photo as the page background and these cards
          float up over its bottom fade. */}
      {/* The two headline numbers — money and standing — share ONE slab split
          by a hairline, the way the mockup carries them. As two separate cards
          with a gutter between them they read as two unrelated widgets that
          happened to land side by side; on one slab with a rule down the middle
          they read as the business's vitals, and the pair gains the full card
          width instead of two half-width bevels. */}
      <View style={{ marginTop: t.spacing.md }}>
        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
            <View style={cardCol}>
              <StatCard
                label={model.cash.label}
                value={model.cash.value}
                delta={model.cash.delta}
                deltaContext={model.cash.deltaContext}
                trend={model.cash.trend}
                icon="cash"
                iconTone="positive"
              />
              {/* #380: what the store is WORTH, under the cash it holds. The
                  headline number only ever falls once the tiers automate
                  buying — the UCM sources the board, construction draws on a
                  timer, the wire bills daily — and a falling headline with
                  nothing beside it reads as decay. This is the line that says
                  the money turned into cars. Deliberately secondary: cash is
                  the constraint every gate and ending branches on. */}
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: t.colors.border,
                  marginTop: t.spacing.md,
                  paddingTop: t.spacing.md,
                }}
              >
                <StoreWorthLine model={model.worth} testID="home-store-worth" />
              </View>
            </View>
            <View style={cardDivider} />
            <View style={cardCol}>
              {/* Header mirrors the cash StatCard's badge-over-label, then the
                  score reads as a gold gauge dial instead of a flat number (#262). */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.sm,
                  marginBottom: t.spacing.sm,
                }}
              >
                <IconBadge name="star" tone="reward" variant="solid" size="sm" />
                <Text style={{ ...t.typography.statLabel, color: t.colors.textMuted }}>
                  Reputation
                </Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <GaugeArc
                  value={model.reputation.score / 100}
                  tone="reward"
                  readout={`${model.reputation.score}`}
                  readoutSuffix="/ 100"
                  caption={model.reputation.csiLabel}
                  captionTone="positive"
                  size={84}
                  testID="home-reputation-gauge"
                />
              </View>
            </View>
          </View>
        </Surface>
      </View>

      {/* Calendar — collapsed to a single row by default; tapping the row opens
          a flat drawer below (#256). The drawer is deliberately OUTSIDE the
          raised gradient card: keeping it in the card would stretch that card's
          surfaceRaised fill AND bloom its gloss (a 30%-of-height catch-light
          becomes a bright dome on the tall state). Holding the gradient card
          fixed and revealing a flat (gradient-free) drawer also keeps the open
          animation smooth — nothing re-rasterizes a LinearGradient per frame as
          the layout eases. */}
      <View style={{ marginTop: t.spacing.md }}>
        <Pressable
          onPress={() => setCalendarExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={calendarExpanded ? 'Collapse calendar' : 'Expand calendar'}
          testID="home-calendar-toggle"
        >
          <Surface>
            {/* Collapsed row: DAY chip · Week/Month/Quarter · weather chip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <DayBadge day={model.calendar.day} />
              <View style={{ flex: 1 }}>
                {/* One line always — between the DAY badge and weather chip the
                    column is narrow, and "Week 3 · Month 1 · Q1" wrapping
                    mid-phrase reads broken; shrink to fit instead. */}
                <Text
                  style={{ ...t.typography.statValue, color: t.colors.textPrimary }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Week {model.calendar.week} · Month {model.calendar.month} · Q
                  {model.calendar.quarter}
                </Text>
                <Text style={subValue}>{model.calendar.seasonLabel}</Text>
              </View>
              {model.calendar.weather ? (
                <Pill
                  tone="neutral"
                  variant="soft"
                  textCase="sentence"
                  label={model.calendar.weather.todayLabel}
                />
              ) : null}
            </View>
            {/* Month burn-down (the mockup's "Days this month" bar). The month
                is the tier-gate cadence, so how much of it is left is the one
                piece of calendar arithmetic the player plans against — without
                it this card is a strip of labels with nothing to read. */}
            <View style={{ marginTop: t.spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: t.spacing.xs,
                }}
              >
                <Text style={{ ...subValue, marginTop: 0 }}>Days this month</Text>
                <Text
                  style={{
                    ...subValue,
                    marginTop: 0,
                    color: t.colors.textPrimary,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {model.calendar.monthProgress.label}
                </Text>
              </View>
              <ProgressBar value={model.calendar.monthProgress.value} tone="primary" />
            </View>
          </Surface>
        </Pressable>
        {/* Expanded drawer: full month grid + weather forecast/leans, in a flat
            panel so no gradient blooms on open. (Sold-this-month lives once, in
            the gate strip's units face — #258 de-dup.) Always mounted, clipped
            to an Animated height + faded by `expand` so the open is a smooth
            glide, not LayoutAnimation's Fabric snap. */}
        <Animated.View
          style={[{ overflow: 'hidden' }, drawerStyle]}
          pointerEvents={calendarExpanded ? 'auto' : 'none'}
          importantForAccessibility={calendarExpanded ? 'auto' : 'no-hide-descendants'}
        >
          {/* Measure the drawer's natural height from an ABSOLUTELY-positioned
              layer. If this measuring view were a normal flow child, it would
              inherit the clip parent's animated `height: 0` on the New
              Architecture and report 0 — leaving `drawerHeight` at 0 so the
              drawer animates from 0 → `1 * 0` = 0 (never opens). An absolute
              child is laid out independent of the parent's height, so onLayout
              reports the true content height. */}
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h && h !== drawerHeight) setDrawerHeight(h);
            }}
          >
            <Surface variant="flat" style={{ marginTop: t.spacing.sm }}>
              <MiniCalendar days={model.calendar.miniCal} columns={7} />
              {model.calendar.weather ? (
                <Surface
                  variant="inset"
                  padded={false}
                  style={{ marginTop: t.spacing.sm, padding: t.spacing.md }}
                >
                  <Text style={{ ...subValue, marginTop: 0 }}>
                    {model.calendar.weather.forecastLabel}
                  </Text>
                  {model.calendar.weather.seasonLeanLabel ? (
                    <Text style={{ ...subValue, marginTop: t.spacing.xs }}>
                      {model.calendar.weather.seasonLeanLabel}
                    </Text>
                  ) : null}
                  {model.calendar.weather.weatherLeanLabel ? (
                    <Text style={{ ...subValue, marginTop: t.spacing.xs }}>
                      {model.calendar.weather.weatherLeanLabel}
                    </Text>
                  ) : null}
                </Surface>
              ) : null}
            </Surface>
          </View>
        </Animated.View>
      </View>

      {/* Monthly tier-gate progress strip (#233 S3b). The reframed TODAY'S
          TARGETS bar: each active face in its native idiom, the day's haul
          ticking up the bars, % on track in the header. */}
      {model.gate && model.gate.faces.length > 0 ? (
        <GateStrip model={model.gate} onOpen={onOpenGrowth} />
      ) : null}

      {/* Quick-stat strip (#264) */}
      <QuickStatStrip stats={model.stats} onOpenOperations={onOpenOperations} />
    </View>
  );
}

/**
 * The mockup's compact quick-stat row (#264): one short strip — icon tile +
 * value + label per cell, tight horizontal rhythm with hairline dividers —
 * replacing the three full-height mega-cards that each held a lone number (pure
 * wireframe smell on a fresh save). Pure layout reshape of the same read model;
 * the inventory cell keeps its Operations deep-link.
 */
function QuickStatStrip({
  stats,
  onOpenOperations,
}: {
  stats: HomeStat[];
  onOpenOperations?: () => void;
}) {
  const t = useTheme();
  // Column cell: a top [icon · value] row (so every icon AND value sits on one
  // shared line across cells), then the label on a single line beneath. One-line
  // labels make all cells exactly the same height with no padded reserve, so the
  // strip hugs its content (no dead space) and the dividers stretch clean.
  // Content is centered within each third — with only three full-width cells,
  // left-anchoring would leave each cluster stranded in a wide empty cell.
  const cell: ViewStyle = { flex: 1, alignItems: 'center' };
  const topRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  };
  const valueText: TextStyle = {
    ...t.typography.statValue,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
  const labelText: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.textMuted,
    marginTop: t.spacing.xs,
    textAlign: 'center',
  };
  const divider: ViewStyle = {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: t.colors.border,
    marginHorizontal: t.spacing.md,
  };
  return (
    <Surface style={{ marginTop: t.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        {stats.map((s, i) => {
          const meta = STAT_ICONS[s.key];
          const body = (
            <View style={cell}>
              <View style={topRow}>
                {meta != null && (
                  <IconBadge name={meta.icon} tone={meta.tone} variant="solid" size="sm" />
                )}
                <Text style={valueText} numberOfLines={1}>
                  {s.value}
                </Text>
              </View>
              {/* Single line keeps every cell the same height; ellipsizes
                  rather than fractures if a width ever can't hold the word. */}
              <Text style={labelText} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          );
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <View style={divider} />}
              {s.deepLink && onOpenOperations ? (
                <Pressable
                  style={{ flex: 1 }}
                  testID={`home-quick-stat-${s.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.label} — open Operations`}
                  onPress={onOpenOperations}
                >
                  {body}
                </Pressable>
              ) : (
                body
              )}
            </React.Fragment>
          );
        })}
      </View>
    </Surface>
  );
}

/**
 * The mockup's calendar-page "DAY 42" tile (#240): a primary-gradient header
 * strip over the big day number on a raised page. Mirrors `Surface`'s
 * frame/fill split so the bevel shadow isn't clipped by the page's rounded
 * corners.
 */
function DayBadge({ day }: { day: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        borderRadius: t.radius.md,
        backgroundColor: t.colors.surfaceRaised,
        ...t.elevation.raised,
      }}
      testID="home-day-badge"
    >
      <View style={{ borderRadius: t.radius.md, overflow: 'hidden' }}>
        <GradientSurface
          gradient="primary"
          style={{
            paddingVertical: t.spacing.xxs,
            paddingHorizontal: t.spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...t.typography.badge, color: t.colors.onAccent }}>DAY</Text>
        </GradientSurface>
        <GradientSurface
          gradient="surfaceRaised"
          style={{
            paddingVertical: t.spacing.xs,
            paddingHorizontal: t.spacing.md,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              ...t.typography.statValue,
              color: t.colors.textPrimary,
              fontVariant: ['tabular-nums'],
            }}
          >
            {day}
          </Text>
        </GradientSurface>
      </View>
    </View>
  );
}

function MiniCalendar({ days, columns }: { days: MiniCalDay[]; columns: number }) {
  const t = useTheme();
  const cell: ViewStyle = {
    width: 28,
    height: 24,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const cellText = (isToday: boolean): TextStyle => ({
    ...t.typography.caption,
    color: isToday ? t.colors.onAccent : t.colors.textMuted,
    fontVariant: ['tabular-nums'],
  });
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: t.spacing.sm }}
      testID="home-mini-calendar"
    >
      {days.map((d) => (
        <View
          key={d.dayOfMonth}
          style={{
            width: `${100 / columns}%`,
            alignItems: 'center',
            marginVertical: t.spacing.xxs,
          }}
        >
          {/* Today pops as a glossy gradient pip (#240's sweep); other days
              stay quiet flat cells. */}
          {d.isToday ? (
            <GradientSurface gradient="primary" style={{ ...cell, overflow: 'hidden' }}>
              <Text style={cellText(true)}>{d.dayOfMonth}</Text>
            </GradientSurface>
          ) : (
            <View style={cell}>
              <Text style={cellText(false)}>{d.dayOfMonth}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

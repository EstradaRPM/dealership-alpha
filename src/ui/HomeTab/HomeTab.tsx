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
  GradientSurface,
  type IconName,
  type IconBadgeTone,
} from '../kit';
import type { DayLoopState } from '../../game/DayLoopController';
import { DemandReadout, type DemandReadoutModel } from '../DemandReadout';
import { GateStrip } from './GateStrip';
import type { HomeDashboardModel, MiniCalDay } from './homeModel';

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
  /** Observed persona-mix readout (#198). Absent ⇒ hint shown. */
  demandReadout?: DemandReadoutModel;
}

/**
 * The management-phase Home hub (#215/#230). The day-cycle launch surface: a
 * status dashboard (identity, cash, reputation/CSI, calendar, quick stats) over
 * the day-close recap and the market demand readout. Presentation only — every
 * value arrives pre-formatted in the read models the composition root builds;
 * the pinned START DAY action lives in the surrounding `AppShell` footer.
 */
export function HomeTab({
  state,
  dashboard,
  onOpenOperations,
  recapChip,
  demandReadout,
}: HomeTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const regionBody: ViewStyle = { marginTop: t.spacing.md };
  const hint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontStyle: 'italic',
  };

  return (
    <View>
      {dashboard ? (
        <Dashboard model={dashboard} onOpenOperations={onOpenOperations} />
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
            <Text style={hint}>Your first day hasn&apos;t opened yet.</Text>
          )}
        </View>
      </View>

      <View style={region} testID="home-region-market">
        <SectionHeader title="Market" />
        <View style={regionBody}>
          {demandReadout ? (
            <DemandReadout model={demandReadout} />
          ) : (
            <Text style={hint}>Open the lot to build the demand readout.</Text>
          )}
        </View>
      </View>
    </View>
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
}: {
  model: HomeDashboardModel;
  onOpenOperations?: () => void;
}) {
  const t = useTheme();
  const cardRow: ViewStyle = {
    flexDirection: 'row',
    marginTop: t.spacing.md,
    gap: t.spacing.md,
  };
  const cardCol: ViewStyle = { flex: 1 };
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
      {/* Cash + reputation cards — both Surfaces flex-fill their column so the
          two slabs always render the same height regardless of content. */}
      <View style={cardRow}>
        <View style={cardCol}>
          <Surface style={{ flex: 1 }}>
            <StatCard
              label="Cash"
              value={model.cash.value}
              delta={model.cash.delta}
              trend={model.cash.trend}
              icon="cash"
              iconTone="positive"
            />
          </Surface>
        </View>
        <View style={cardCol}>
          <Surface style={{ flex: 1 }}>
            <View style={{ marginBottom: t.spacing.sm }}>
              <IconBadge name="star" tone="reward" variant="solid" size="sm" />
            </View>
            <Text style={{ ...t.typography.statValue, color: t.colors.textPrimary }}>
              {model.reputation.score}
              <Text style={{ ...t.typography.caption, color: t.colors.textMuted }}>
                {' '}
                / 100
              </Text>
            </Text>
            <Text
              style={{
                ...t.typography.statLabel,
                color: t.colors.textMuted,
                marginTop: t.spacing.xxs,
              }}
            >
              Reputation
            </Text>
            <View style={{ marginTop: t.spacing.xs, alignSelf: 'flex-start' }}>
              <Pill tone="positive" variant="soft" label={model.reputation.csiLabel} />
            </View>
          </Surface>
        </View>
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
                <Pill tone="neutral" variant="soft" label={model.calendar.weather.todayLabel} />
              ) : null}
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
        <GateStrip model={model.gate} />
      ) : null}

      {/* Quick-stat strip */}
      <View style={cardRow}>
        {model.stats.map((s) => {
          const tile = (
            <Surface style={{ flex: 1 }}>
              <StatCard
                label={s.label}
                value={s.value}
                align="center"
                icon={STAT_ICONS[s.key]?.icon}
                iconTone={STAT_ICONS[s.key]?.tone}
              />
            </Surface>
          );
          return (
            <View key={s.key} style={cardCol}>
              {s.deepLink && onOpenOperations ? (
                <Pressable
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.label} — open Operations`}
                  onPress={onOpenOperations}
                >
                  {tile}
                </Pressable>
              ) : (
                tile
              )}
            </View>
          );
        })}
      </View>
    </View>
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

import React from 'react';
import {
  View,
  Text,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, StatCard, Pill } from '../kit';
import type { DayLoopState } from '../../game/DayLoopController';
import { DayRecap, type DayRecapModel } from '../DayRecap';
import { DemandReadout, type DemandReadoutModel } from '../DemandReadout';
import type { HomeDashboardModel, MiniCalDay } from './homeModel';

export interface HomeTabProps {
  state: DayLoopState;
  /** Full status dashboard (#230). Absent ⇒ legacy header only (test renders). */
  dashboard?: HomeDashboardModel;
  /** Deep-link into the Operations tab (inventory tile). */
  onOpenOperations?: () => void;
  /** Just-ended-day recap. Absent on the night before Day 1. */
  recap?: DayRecapModel;
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
  recap,
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
  const showRecap = state.hasRecap && !!recap;

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

      <View style={region} testID="home-region-today">
        <SectionHeader title="Today" />
        <View style={regionBody}>
          {showRecap && recap ? (
            <DayRecap model={recap} />
          ) : (
            <Text style={hint}>Night before Day 1.</Text>
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
  const name: TextStyle = {
    ...t.typography.statValue,
    color: t.colors.textPrimary,
  };
  const subValue: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    marginTop: t.spacing.xxs,
  };

  return (
    <View testID="home-dashboard">
      {/* Identity + tier badge */}
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        testID="home-region-identity"
      >
        <Text style={name}>{model.businessName}</Text>
        <Pill tone="info" label={model.tierLabel} />
      </View>

      {/* Cash + reputation cards */}
      <View style={cardRow}>
        <View style={cardCol}>
          <Surface>
            <StatCard
              label="Cash"
              value={model.cash.value}
              delta={model.cash.delta}
              trend={model.cash.trend}
            />
          </Surface>
        </View>
        <View style={cardCol}>
          <Surface>
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
              <Pill tone="positive" label={model.reputation.csiLabel} />
            </View>
          </Surface>
        </View>
      </View>

      {/* Calendar */}
      <View style={{ marginTop: t.spacing.md }}>
        <Surface>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <Text style={{ ...t.typography.statValue, color: t.colors.textPrimary }}>
              Day {model.calendar.day}
            </Text>
            <Pill tone="neutral" label={model.calendar.seasonLabel} />
          </View>
          <Text style={subValue}>
            Week {model.calendar.week} · Month {model.calendar.month} · Q
            {model.calendar.quarter} {model.calendar.seasonLabel}
          </Text>
          <MiniCalendar days={model.calendar.miniCal} columns={7} />
          {/* Weather readout (#231): today's conditions + an honest one-day
              forecast. Renders only when the composition root supplied weather. */}
          {model.calendar.weather ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginTop: t.spacing.sm,
              }}
            >
              <Text style={{ ...t.typography.statValue, color: t.colors.textPrimary }}>
                {model.calendar.weather.todayLabel}
              </Text>
              <Text style={subValue}>{model.calendar.weather.forecastLabel}</Text>
            </View>
          ) : null}
        </Surface>
      </View>

      {/* Quick-stat strip */}
      <View style={cardRow}>
        {model.stats.map((s) => {
          const tile = (
            <Surface>
              <StatCard label={s.label} value={s.value} align="center" />
              {s.note ? (
                <Text
                  style={{
                    ...t.typography.caption,
                    color: t.colors.textSecondary,
                    marginTop: t.spacing.xxs,
                    textAlign: 'center',
                  }}
                >
                  {s.note}
                </Text>
              ) : null}
            </Surface>
          );
          return (
            <View key={s.key} style={cardCol}>
              {s.deepLink && onOpenOperations ? (
                <Pressable
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

function MiniCalendar({ days, columns }: { days: MiniCalDay[]; columns: number }) {
  const t = useTheme();
  const cell: ViewStyle = {
    width: 28,
    height: 24,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const todayCell: ViewStyle = { ...cell, backgroundColor: t.colors.accent };
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
          <View style={d.isToday ? todayCell : cell}>
            <Text
              style={{
                ...t.typography.caption,
                color: d.isToday ? t.colors.onAccent : t.colors.textMuted,
                fontVariant: ['tabular-nums'],
              }}
            >
              {d.dayOfMonth}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

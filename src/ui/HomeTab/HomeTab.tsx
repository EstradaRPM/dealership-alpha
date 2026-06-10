import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { SectionHeader } from '../kit';
import type { DayLoopState } from '../../game/DayLoopController';
import { DayRecap, type DayRecapModel } from '../DayRecap';
import { DemandReadout, type DemandReadoutModel } from '../DemandReadout';

export interface HomeTabProps {
  state: DayLoopState;
  /** Just-ended-day recap. Absent on the night before Day 1. */
  recap?: DayRecapModel;
  /** Observed persona-mix readout (#198). Absent ⇒ hint shown. */
  demandReadout?: DemandReadoutModel;
}

/**
 * The management-phase Home hub (#215). The day-close control room: what just
 * happened (recap) and what the market is doing (demand readout), composed from
 * read models handed in by the composition root. The pinned day action lives in
 * the surrounding `AppShell` footer, not here.
 */
export function HomeTab({ state, recap, demandReadout }: HomeTabProps) {
  const t = useTheme();
  const titleRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  };
  const title: TextStyle = { ...t.typography.statValue, color: t.colors.textPrimary };
  const subhead: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    marginTop: t.spacing.xxs,
  };
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
      <View style={titleRow}>
        <View>
          <Text style={title}>Manager Desk</Text>
          <Text style={subhead}>Between-day plan for Day {state.day}</Text>
        </View>
      </View>

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

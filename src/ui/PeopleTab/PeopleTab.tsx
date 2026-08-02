import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { SectionHeader, Surface, Button } from '../kit';
import { ManagerStatusCard } from './ManagerStatusCard';
import type { ManagerStatusModel } from './managerStatus';

/** The staff entry People owns (#346): headcount + the door to hiring. */
export interface PeopleRosterEntry {
  /** Bodies on payroll right now. */
  readonly count: number;
  readonly onOpenHiring: () => void;
}

export interface PeopleTabProps {
  /** The delegated-authority read-model (#325). */
  managerStatus: ManagerStatusModel;
  /**
   * Roster headcount + the hiring entry (#346). Hiring is People's charter, not
   * Prep's — it used to be a navigation link parked in the Operations Prep
   * block, with the roster two levels down behind it. Absent ⇒ not rendered.
   */
  roster?: PeopleRosterEntry;
}

/**
 * The People surface (one of the fixed 5-tab IA — always present, never
 * tier-gated). It holds the staff entry (#346) and the manager status card
 * (#325); #347 rebuilds the tab around the full roster + hiring pool.
 * Presentation only — the composition root builds the models.
 */
export function PeopleTab({ managerStatus, roster }: PeopleTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const regionBody: ViewStyle = { marginTop: t.spacing.md };
  const hint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
  };
  const actionRow: ViewStyle = { alignSelf: 'flex-start' };
  return (
    <View style={region} testID="people-tab">
      <SectionHeader title="People" />
      {roster && (
        <View style={regionBody}>
          <Surface testID="people-roster">
            <Text style={hint}>
              {roster.count === 0
                ? 'Nobody on payroll — you are working the floor alone.'
                : `${roster.count} on payroll.`}
            </Text>
            <View style={actionRow}>
              <Button
                label="Hire Staff"
                onPress={roster.onOpenHiring}
                icon="people"
                testID="people-hire-button"
              />
            </View>
          </Surface>
        </View>
      )}
      <ManagerStatusCard model={managerStatus} />
    </View>
  );
}

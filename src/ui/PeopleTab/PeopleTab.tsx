import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { SectionHeader } from '../kit';
import { ManagerStatusCard } from './ManagerStatusCard';
import type { ManagerStatusModel } from './managerStatus';

export interface PeopleTabProps {
  /** The delegated-authority read-model (#325). */
  managerStatus: ManagerStatusModel;
}

/**
 * The People surface (one of the fixed 5-tab IA — always present, never
 * tier-gated). Today it hosts the manager status card (#325); the roster /
 * hiring surface reaches its own rebrand slice later. Presentation only — the
 * composition root builds the models.
 */
export function PeopleTab({ managerStatus }: PeopleTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  return (
    <View style={region} testID="people-tab">
      <SectionHeader title="People" />
      <ManagerStatusCard model={managerStatus} />
    </View>
  );
}

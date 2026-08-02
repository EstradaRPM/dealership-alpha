import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { SectionHeader } from '../kit';
import type { DeptKey } from '../../game/DepartmentQueue';
import { OwnershipLevers, type OwnershipLeversProps } from '../OwnershipLevers';
import { DepartmentDock, type DeptTile } from './DepartmentDock';

export interface OperationsTabProps {
  /**
   * The departments the world has stood up (#346). The composition root builds
   * this list; a department with no mechanic behind it at the current tier is
   * simply absent from it. This component holds zero unlock logic.
   */
  dock: readonly DeptTile[];
  onDeptPress: (dept: DeptKey) => void;
  /** Pre-open Prep levers — hours + trade policy only (#120, reduced in #346). */
  leverProps?: OwnershipLeversProps;
}

/**
 * The tactical day-to-day surface (#215). Two regions, per the locked IA §4:
 * the department dock (every stood-up room is one tile, one door), and Prep —
 * pure pre-open policy, hours and trade policy, with **no navigation links
 * parked in it** (#346). Sourcing, the stock list and per-unit pricing live in
 * the Lot room; hiring lives on People; advertising lives on the demand
 * console. Pure composition of existing read-model surfaces.
 */
export function OperationsTab({
  dock,
  onDeptPress,
  leverProps,
}: OperationsTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const regionBody: ViewStyle = { marginTop: t.spacing.md };
  const hint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
  };

  return (
    <View>
      <View style={region} testID="ops-region-departments">
        <SectionHeader title="Departments" />
        <View style={regionBody}>
          {/* One tile per department, and one entry per department — the
              separate "Service Overview →" / "Body Shop Overview →" buttons
              were a second door into a room the dock already opens (#346). */}
          <DepartmentDock tiles={dock} onPress={onDeptPress} />
        </View>
      </View>

      <View style={region} testID="ops-region-prep">
        <SectionHeader title="Prep" />
        <View style={regionBody}>
          {leverProps ? (
            <OwnershipLevers {...leverProps} />
          ) : (
            <Text style={hint}>Prep levers will mount here as they unlock.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

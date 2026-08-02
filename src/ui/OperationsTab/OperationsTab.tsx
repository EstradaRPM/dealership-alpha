import React from 'react';
import {
  View,
  Text,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
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
  /** Pre-open ownership levers (#120). Absent ⇒ auction fallback / hint. */
  leverProps?: OwnershipLeversProps;
  /** Fallback when there are no levers yet. */
  onOpenAuction?: () => void;
}

/**
 * The tactical day-to-day surface (#215). Departments are reachable here (the
 * dock) and the pre-open prep levers — pricing, sourcing, hiring, hours, trade
 * policy, the T1 demand lever — live here, grouped under Operations per the
 * locked IA. Pure composition of existing read-model surfaces.
 */
export function OperationsTab({
  dock,
  onDeptPress,
  leverProps,
  onOpenAuction,
}: OperationsTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const regionBody: ViewStyle = { marginTop: t.spacing.md };
  const hint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontStyle: 'italic',
  };
  const secondaryBtn: ViewStyle = {
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.primaryDim,
    alignSelf: 'flex-start',
  };
  const secondaryBtnText: TextStyle = {
    ...t.typography.button,
    color: t.colors.accent,
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
          ) : onOpenAuction ? (
            <Pressable
              style={secondaryBtn}
              accessibilityRole="button"
              onPress={onOpenAuction}
            >
              <Text style={secondaryBtnText}>Visit Auction →</Text>
            </Pressable>
          ) : (
            <Text style={hint}>Prep levers will mount here as they unlock.</Text>
          )}
        </View>
      </View>
    </View>
  );
}
